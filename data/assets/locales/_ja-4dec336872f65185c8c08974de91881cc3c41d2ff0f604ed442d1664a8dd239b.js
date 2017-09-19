/*global I18n:true */

// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (searchElement, fromIndex) {
    if ( this === undefined || this === null ) {
      throw new TypeError( '"this" is null or not defined' );
    }

    var length = this.length >>> 0; // Hack to convert object.length to a UInt32

    fromIndex = +fromIndex || 0;

    if (Math.abs(fromIndex) === Infinity) {
      fromIndex = 0;
    }

    if (fromIndex < 0) {
      fromIndex += length;
      if (fromIndex < 0) {
        fromIndex = 0;
      }
    }

    for (;fromIndex < length; fromIndex++) {
      if (this[fromIndex] === searchElement) {
        return fromIndex;
      }
    }

    return -1;
  };
}

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default handling of translation fallbacks to false
I18n.fallbacks = false;

// Set default separator
I18n.defaultSeparator = ".";

// Set current locale to null
I18n.locale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.fallbackRules = {};

I18n.noFallbacks = false;

I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  },
  "zh_CN": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  },
  "zh_TW": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  },
  "ko": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  }
};

I18n.getFallbacks = function(locale) {
  if (locale === I18n.defaultLocale) {
    return [];
  } else if (!I18n.fallbackRules[locale]) {
    var rules = [],
        components = locale.split("-");

    for (var l = 1; l < components.length; l++) {
      rules.push(components.slice(0, l).join("-"));
    }

    rules.push(I18n.defaultLocale);

    I18n.fallbackRules[locale] = rules;
  }

  return I18n.fallbackRules[locale];
};

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};
  var lookupInitialScope = scope,
      translations = this.prepareOptions(I18n.translations),
      locale = options.locale || I18n.currentLocale(),
      messages = translations[locale] || {},
      currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.defaultSeparator);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.defaultSeparator + scope;
  }

  scope = scope.split(this.defaultSeparator);

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (!messages) {
    if (I18n.fallbacks) {
      var fallbacks = this.getFallbacks(locale);
      for (var fallback = 0; fallback < fallbacks.length; fallbacks++) {
        messages = I18n.lookup(lookupInitialScope, this.prepareOptions({locale: fallbacks[fallback]}, options));
        if (messages) {
          break;
        }
      }
    }

    if (!messages && this.isValidNode(options, "defaultValue")) {
        messages = options.defaultValue;
    }
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
      opts,
      count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);
  var matches = message.match(this.PLACEHOLDER),
      placeholder,
      value,
      name;

  if (!matches) {
    return message;
  }

  for (var i = 0; placeholder = matches[i]; i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    value = options[name];

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"));
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  var translation = this.lookup(scope, options);
  // Fallback to the default locale
  if (!translation && this.currentLocale() !== this.defaultLocale && !this.noFallbacks) {
    options.locale = this.defaultLocale;
    translation = this.lookup(scope, options);
  }
  if (!translation && this.currentLocale() !== 'en' && !this.noFallbacks) {
    options.locale = 'en';
    translation = this.lookup(scope, options);
  }

  try {
    if (typeof translation === "object") {
      if (typeof options.count === "number") {
        return this.pluralize(options.count, scope, options);
      } else {
        return translation;
      }
    } else {
      return this.interpolate(translation, options);
    }
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.localize = function(scope, value) {
  switch (scope) {
    case "currency":
      return this.toCurrency(value);
    case "number":
      scope = this.lookup("number.format");
      return this.toNumber(value, scope);
    case "percentage":
      return this.toPercentage(value);
    default:
      if (scope.match(/^(date|time)/)) {
        return this.toTime(scope, value);
      } else {
        return value.toString();
      }
  }
};

I18n.parseDate = function(date) {
  var matches, convertedDate;

  // we have a date, so just return it.
  if (typeof date === "object") {
    return date;
  }

  // it matches the following formats:
  //   yyyy-mm-dd
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ssZ
  //   yyyy-mm-dd[ T]hh:mm::ss+0000
  //
  matches = date.toString().match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?(Z|\+0000)?/);

  if (matches) {
    for (var i = 1; i <= 6; i++) {
      matches[i] = parseInt(matches[i], 10) || 0;
    }

    // month starts on 0
    matches[2] -= 1;

    if (matches[7]) {
      convertedDate = new Date(Date.UTC(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]));
    } else {
      convertedDate = new Date(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]);
    }
  } else if (typeof date === "number") {
    // UNIX timestamp
    convertedDate = new Date();
    convertedDate.setTime(date);
  } else if (date.match(/\d+ \d+:\d+:\d+ [+-]\d+ \d+/)) {
    // a valid javascript format with timezone info
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  } else {
    // an arbitrary javascript string
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  }

  return convertedDate;
};

I18n.toTime = function(scope, d) {
  var date = this.parseDate(d),
      format = this.lookup(scope);

  if (date.toString().match(/invalid/i)) {
    return date.toString();
  }

  if (!format) {
    return date.toString();
  }

  return this.strftime(date, format);
};

I18n.strftime = function(date, format) {
  var options = this.lookup("date");

  if (!options) {
    return date.toString();
  }

  options.meridian = options.meridian || ["AM", "PM"];

  var weekDay = date.getDay(),
      day = date.getDate(),
      year = date.getFullYear(),
      month = date.getMonth() + 1,
      hour = date.getHours(),
      hour12 = hour,
      meridian = hour > 11 ? 1 : 0,
      secs = date.getSeconds(),
      mins = date.getMinutes(),
      offset = date.getTimezoneOffset(),
      absOffsetHours = Math.floor(Math.abs(offset / 60)),
      absOffsetMinutes = Math.abs(offset) - (absOffsetHours * 60),
      timezoneoffset = (offset > 0 ? "-" : "+") + (absOffsetHours.toString().length < 2 ? "0" + absOffsetHours : absOffsetHours) + (absOffsetMinutes.toString().length < 2 ? "0" + absOffsetMinutes : absOffsetMinutes);

  if (hour12 > 12) {
    hour12 = hour12 - 12;
  } else if (hour12 === 0) {
    hour12 = 12;
  }

  var padding = function(n) {
    var s = "0" + n.toString();
    return s.substr(s.length - 2);
  };

  var f = format;
  f = f.replace("%a", options.abbr_day_names[weekDay]);
  f = f.replace("%A", options.day_names[weekDay]);
  f = f.replace("%b", options.abbr_month_names[month]);
  f = f.replace("%B", options.month_names[month]);
  f = f.replace("%d", padding(day));
  f = f.replace("%e", day);
  f = f.replace("%-d", day);
  f = f.replace("%H", padding(hour));
  f = f.replace("%-H", hour);
  f = f.replace("%I", padding(hour12));
  f = f.replace("%-I", hour12);
  f = f.replace("%m", padding(month));
  f = f.replace("%-m", month);
  f = f.replace("%M", padding(mins));
  f = f.replace("%-M", mins);
  f = f.replace("%p", options.meridian[meridian]);
  f = f.replace("%S", padding(secs));
  f = f.replace("%-S", secs);
  f = f.replace("%w", weekDay);
  f = f.replace("%y", padding(year));
  f = f.replace("%-y", padding(year).replace(/^0+/, ""));
  f = f.replace("%Y", year);
  f = f.replace("%z", timezoneoffset);

  return f;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ",", strip_insignificant_zeros: false}
  );

  var negative = number < 0,
      string = Math.abs(number).toFixed(options.precision).toString(),
      parts = string.split("."),
      precision,
      buffer = [],
      formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length -3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
        separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
        zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "")
    ;
  }

  return formattedNumber;
};

I18n.toCurrency = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.currency.format"),
    this.lookup("number.format"),
    {unit: "$", precision: 2, format: "%u%n", delimiter: ",", separator: "."}
  );

  number = this.toNumber(number, options);
  number = options.format
    .replace("%u", options.unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
      size = number,
      iterations = 0,
      unit,
      precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", {count: size});
    precision = 0;
  } else {
    unit = this.t("number.human.storage_units.units." + [null, "kb", "mb", "gb", "tb"][iterations]);
    precision = (size - Math.floor(size) === 0) ? 0 : 1;
  }

  options = this.prepareOptions(
    options,
    {precision: precision, format: "%n%u", delimiter: ""}
  );

  number = this.toNumber(size, options);
  number = options.format
    .replace("%u", unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toPercentage = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.percentage.format"),
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ""}
  );

  number = this.toNumber(number, options);
  return number + "%";
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(count, scope, options) {
  var translation;

  try { translation = this.lookup(scope, options); } catch (error) {}
  if (!translation) { return this.missingTranslation(scope); }

  options = this.prepareOptions(options);
  options.count = count.toString();

  var pluralizer = this.pluralizer(this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = ((typeof key === "object") && (key instanceof Array)) ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);
  if (message == null) message = this.missingTranslation(scope, keys[0]);

  return this.interpolate(message, options);
};

I18n.missingTranslation = function(scope, key) {
  var message = '[' + this.currentLocale() + "." + scope;
  if (key) { message += "." + key; }
  return message + ']';
};

I18n.currentLocale = function() {
  return (I18n.locale || I18n.defaultLocale);
};

// shortcuts
I18n.t = I18n.translate;
I18n.l = I18n.localize;
I18n.p = I18n.pluralize;

I18n.enable_verbose_localization = function(){
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value){
    var current = keys[scope];
    if(!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      Em.Logger.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (t" + current + ")";
  };
};


I18n.verbose_localization_session = function(){
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enable_verbose_localization();
  return true;
}

try {
  if(sessionStorage && sessionStorage.getItem("verbose_localization")) {
    I18n.enable_verbose_localization();
  }
} catch(e){
  // we don't care really, can happen if cookies disabled
}
;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='/unread'>未読 1つ</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>未読 " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "つ</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ja"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>新規トピック 1つ</a>";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>新規トピック " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "つ</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ja"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " remaining, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
r += "の他のトピックを読む";
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "This topic has ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 reply";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " replies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ja"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}};

MessageFormat.locale.ja = function ( n ) {
  return "other";
};


(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();
I18n.translations = {"ja":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"バイト"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"YYYY MMM","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"YYYY, MMM D h:mm a","long_with_year_no_time":"YYYY, MMM D","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date}前","tiny":{"half_a_minute":"1分前","less_than_x_seconds":{"other":"%{count}秒前"},"x_seconds":{"other":"%{count}秒"},"x_minutes":{"other":"%{count}分前"},"about_x_hours":{"other":"%{count}時間"},"x_days":{"other":"%{count}日"},"about_x_years":{"other":"%{count}年"},"over_x_years":{"other":"%{count}年以上前"},"almost_x_years":{"other":"%{count}年"},"date_month":"MMM D日","date_year":"MMM 'YY"},"medium":{"x_minutes":{"other":"%{count}分"},"x_hours":{"other":"%{count}時間"},"x_days":{"other":"%{count}日"},"date_year":"YYYY年MM月D日"},"medium_with_ago":{"x_minutes":{"other":"%{count}分前"},"x_hours":{"other":"%{count}時間前"},"x_days":{"other":"%{count}日前"}},"later":{"x_days":{"other":"%{count}日後"},"x_months":{"other":"%{count}か月後"},"x_years":{"other":"%{count}年後"}},"previous_month":"前の月","next_month":"次の月"},"share":{"topic":"このトピックのリンクをシェアする","post":"投稿 #%{postNumber}","close":"閉じる","twitter":"Twitter でこのリンクを共有する","facebook":"Facebook でこのリンクを共有する","google+":"Google+ でこのリンクを共有する","email":"メールでこのリンクを送る"},"action_codes":{"public_topic":"%{when} にこのトピックは公開されました","private_topic":"%{when} にこのトピックは非公開にされました","invited_user":"%{who} から招待されました: %{when}","removed_user":"%{who}が %{when}に削除しました","autoclosed":{"enabled":"クローズされました: %{when}","disabled":"%{when}にオープンしました"},"closed":{"enabled":"クローズされました: %{when}","disabled":"%{when}にオープンしました"},"archived":{"enabled":"%{when}にアーカイブしました","disabled":"%{when}にアーカイブを解除しました"},"pinned":{"enabled":"%{when}に固定しました","disabled":"%{when}に固定を解除しました"},"pinned_globally":{"enabled":"%{when}に全体への固定をしました","disabled":"%{when}に全体への固定を解除しました"},"visible":{"enabled":"リストに表示: %{when}","disabled":"リストから非表示: %{when}"}},"topic_admin_menu":"トピックの管理","emails_are_disabled":"メールアドレスの送信は管理者によって無効化されています。全てのメール通知は行われません","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)"}},"edit":"このトピックのタイトル/カテゴリを編集","not_implemented":"この機能はまだ実装されていません！","no_value":"いいえ","yes_value":"はい","generic_error":"申し訳ありません、エラーが発生しました。","generic_error_with_reason":"エラーが発生しました: %{error}","sign_up":"サインアップ","log_in":"ログイン","age":"経過","joined":"参加時刻","admin_title":"管理設定","flags_title":"通報","show_more":"もっと見る","show_help":"オプション","links":"リンク","links_lowercase":{"other":"リンク"},"faq":"FAQ","guidelines":"ガイドライン","privacy_policy":"プライバシーポリシー","privacy":"プライバシー","terms_of_service":"利用規約","mobile_view":"モバイル表示","desktop_view":"デスクトップ表示","you":"あなた","or":"あるいは","now":"たった今","read_more":"もっと読む","more":"More","less":"Less","never":"never","every_30_minutes":"30分毎","every_hour":"1時間毎","daily":"毎日","weekly":"毎週","every_two_weeks":"隔週","every_three_days":"3日毎","max_of_count":"最大 {{count}}","alternation":"または","character_count":{"other":"{{count}}文字"},"suggested_topics":{"title":"関連トピック","pm_title":"他のメッセージ"},"about":{"simple_title":"このサイトについて","title":"%{title}について","stats":" サイトの統計","our_admins":"管理者","our_moderators":"モデレータ","stat":{"all_time":"すべて","last_7_days":"過去7日間","last_30_days":"過去30日間"},"like_count":"いいね！","topic_count":"トピック","post_count":"投稿","user_count":"新規ユーザ","active_user_count":"アクティブユーザ","contact":"お問い合わせ","contact_info":"このサイトに影響を与える重要な問題や緊急の問題が発生した場合は、 %{contact_info}までご連絡ください"},"bookmarked":{"title":"ブックマーク","clear_bookmarks":"ブックマークを削除","help":{"bookmark":"クリックするとトピックの最初の投稿をブックマークします","unbookmark":"クリックするとトピック内の全てのブックマークを削除します"}},"bookmarks":{"not_logged_in":"投稿をブックマークするには、ログインする必要があります","created":"この投稿をブックマークしました","not_bookmarked":"この投稿をブックマークする","last_read":"この投稿をブックマークする","remove":"ブックマークを削除","confirm_clear":"このトピックの全てのブックマークを削除してもよいですか？"},"topic_count_latest":{"other":"{{count}} 個の新規または更新されたトピック。"},"topic_count_unread":{"other":"{{count}} 個の未読トピック。"},"topic_count_new":{"other":"{{count}} 件の新しいトピック"},"click_to_show":"クリックして表示","preview":"プレビュー","cancel":"キャンセル","save":"変更を保存","saving":"保存中...","saved":"保存しました","upload":"アップロード","uploading":"アップロード中...","uploading_filename":"{{filename}} をアップロードしています...","uploaded":"アップロードしました","enable":"有効にする","disable":"無効にする","undo":"取り消す","revert":"戻す","failed":"失敗","banner":{"close":"バナーを閉じる。","edit":"このバナーを編集 \u003e\u003e"},"choose_topic":{"none_found":"トピックが見つかりませんでした。","title":{"search":"トピック名、URL、または ID でトピックを検索:","placeholder":"トピックのタイトルを入力"}},"queue":{"topic":"トピック：","approve":"承認","reject":"リジェクト","delete_user":"削除されたユーザ","title":"承認待ち","none":"レビュー待ちの投稿はありません。","edit":"編集","cancel":"キャンセル","view_pending":"保留になっている投稿を見る","has_pending_posts":{"other":"このトピックで\u003cb\u003e{{count}}\u003c/b\u003e件の投稿が承認待ちです"},"confirm":"変更を保存","delete_prompt":"\u003cb\u003e%{username}\u003c/b\u003e を削除してもよろしいですか? これはそのユーザーの投稿をすべて削除し、メールアドレスとIPアドレスをブロックします。","approval":{"title":"この投稿は承認が必要です","description":"新しい投稿はモデレータによる承認が必要です。しばらくお待ち下さい。","pending_posts":{"other":"\u003cstrong\u003e{{count}}\u003c/strong\u003e件の投稿が保留中です。"},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e が \u003ca href='{{topicUrl}}'\u003eトピック\u003c/a\u003e を作成","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eあなた\u003c/a\u003e が \u003ca href='{{topicUrl}}'\u003eトピック\u003c/a\u003e を作成","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e が \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e に返信","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eあなた\u003c/a\u003e が \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e に返信","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e が \u003ca href='{{topicUrl}}'\u003eトピック\u003c/a\u003e に返信","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eあなた\u003c/a\u003e が \u003ca href='{{topicUrl}}'\u003eトピック\u003c/a\u003e に返信","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e が \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e をタグ付けしました","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e が \u003ca href='{{user2Url}}'\u003eあなた\u003c/a\u003e を をタグ付けしました","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eあなた\u003c/a\u003e が \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e をタグ付けしました","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e が投稿","posted_by_you":"\u003ca href='{{userUrl}}'\u003eあなた\u003c/a\u003e が投稿","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e が送信","sent_by_you":"\u003ca href='{{userUrl}}'\u003eあなた\u003c/a\u003e が送信"},"directory":{"filter_name":"ユーザ名でフィルタ","title":"ユーザ","likes_given":"与えた","likes_received":"もらった","topics_entered":"閲覧数","topics_entered_long":"トピックの閲覧数","time_read":"読んだ時間","topic_count":"トピック","topic_count_long":"作成されたトピックの数","post_count":"返信","post_count_long":"投稿の返信数","no_results":"結果はありませんでした","days_visited":"閲覧数","days_visited_long":"閲覧された日数","posts_read":"既読","posts_read_long":"投稿の閲覧数","total_rows":{"other":"%{count}人のユーザ"}},"groups":{"empty":{"posts":"このグループのメンバーからの投稿はありません。","members":"このグループからの投稿はありません。","mentions":"このグループのメンションはありません。","messages":"このグループへのメッセージはありません。","topics":"このグループのメンバーのトピックは何もありません。"},"add":"追加","selector_placeholder":"メンバーを追加","owner":"オーナー","visible":"このグループは全てのユーザに表示されています。","title":{"other":"グループ"},"members":"メンバー","topics":"トピック","posts":"投稿","mentions":"メンション","messages":"メッセージ","alias_levels":{"title":"誰がこのグループにメッセージや@メンションが送れますか?","nobody":"無し","only_admins":"管理者のみ","mods_and_admins":"管理者とモデレータのみ","members_mods_and_admins":"管理者、モデレータ、グループメンバーのみ","everyone":"だれでも"},"trust_levels":{"title":"以下を追加した時に自動でトラストレベルを付与する:","none":"なし"},"notifications":{"watching":{"title":"ウォッチ中"},"tracking":{"title":"追跡中"},"regular":{"title":"デフォルト"},"muted":{"title":"ミュート"}}},"user_action_groups":{"1":"「いいね！」 ","2":"「いいね！」 された","3":"ブックマーク","4":"トピック","5":"返信","6":"反応","7":"タグ付け","9":"引用","11":"編集","12":"アイテム送信","13":"受信ボックス","14":"保留"},"categories":{"all":"すべてのカテゴリ","all_subcategories":"すべてのサブカテゴリ","no_subcategory":"サブカテゴリなし","category":"カテゴリ","category_list":"カテゴリリストを表示","reorder":{"title":"カテゴリの並び替え","title_long":"カテゴリリストを並べ直します","fix_order":"位置を修正","save":"順番を保存","apply_all":"適用","position":"位置"},"posts":"投稿","topics":"トピック","latest":"最近の投稿","latest_by":"最新投稿: ","toggle_ordering":"カテゴリの並び替えモードを切り替え","subcategories":"サブカテゴリ:","topic_stat_sentence":{"other":"過去 %{unit} 間 %{count} 個の新着トピック。"}},"ip_lookup":{"title":"IPアドレスを検索","hostname":"ホスト名","location":"現在地","location_not_found":"（不明）","organisation":"組織","phone":"電話","other_accounts":"同じIPアドレスを持つアカウント","delete_other_accounts":"%{count}件削除","username":"ユーザ名","trust_level":"トラストレベル","read_time":"読んだ時間","topics_entered":"入力したトピック","post_count":"# 投稿","confirm_delete_other_accounts":"これらのアカウントを削除してもよろしいですか?"},"user_fields":{"none":"(オプションを選択)"},"user":{"said":"{{username}}:","profile":"プロフィール","mute":"ミュート","edit":"プロフィールを編集","download_archive":"自分の投稿をダウンロード","new_private_message":"メッセージを作成","private_message":"メッセージ","private_messages":"メッセージ","activity_stream":"アクティビティ","preferences":"設定","expand_profile":"開く","bookmarks":"ブックマーク","bio":"自己紹介","invited_by":"招待した人: ","trust_level":"トラストレベル","notifications":"お知らせ","statistics":"統計","desktop_notifications":{"label":"デスクトップ通知","not_supported":"申し訳ありません。そのブラウザは通知をサポートしていません。","perm_default":"通知を有効にする","perm_denied_btn":"アクセス拒否","perm_denied_expl":"通知へのアクセスが拒否されました。ブラウザの設定から通知を許可してください。","disable":"通知を無効にする","enable":"通知を有効にする","each_browser_note":"注意: 利用するすべてのブラウザでこの設定を変更する必要があります"},"dismiss_notifications_tooltip":"全ての未読の通知を既読にします","disable_jump_reply":"返信した後に投稿へ移動しない","dynamic_favicon":"新規または更新されたトピックのカウントをブラウザアイコンに表示する","external_links_in_new_tab":"外部リンクをすべて別のタブで開く","enable_quoting":"選択したテキストを引用して返信する","change":"変更","moderator":"{{user}} はモデレータです","admin":"{{user}} は管理者です","moderator_tooltip":"このユーザはモデレータであり","admin_tooltip":"このユーザは管理者です","blocked_tooltip":"このユーザはブロックされています","suspended_notice":"このユーザは {{date}} まで凍結状態です。","suspended_reason":"理由: ","github_profile":"Github","email_activity_summary":"アクティビティの情報","mailing_list_mode":{"label":"メーリングリストモード","enabled":"メーリングリストモードを有効にする","instructions":"この設定は、アクティビティの情報機能を無効化します。\u003cbr /\u003e\nミュートしているトピックやカテゴリはこれらのメールには含まれません。\n","daily":"デイリーアップデートを送る","individual":"新しい投稿がある場合にメールで送る"},"watched_categories":"ウォッチ中","tracked_categories":"追跡中","muted_categories":"ミュート中","delete_account":"アカウントを削除する","delete_account_confirm":"アカウントを削除してもよろしいですか？削除されたアカウントは復元できません。","deleted_yourself":"あなたのアカウントは削除されました。","delete_yourself_not_allowed":"アカウントを削除できませんでした。サイトの管理者へ連絡してください。","unread_message_count":"メッセージ","admin_delete":"削除","users":"ユーザ","muted_users":"ミュート","muted_users_instructions":"ユーザからの通知をすべて行いません","muted_topics_link":"ミュートしたトピックを表示する","staff_counters":{"flags_given":"役に立った通報","flagged_posts":"通報した投稿","deleted_posts":"削除された投稿","suspensions":"凍結","warnings_received":"警告"},"messages":{"all":"すべて","inbox":"受信ボックス","sent":"送信済み","archive":"アーカイブ","groups":"自分のグループ","bulk_select":"メッセージを選択","move_to_inbox":"受信ボックスへ移動","move_to_archive":"アーカイブ","failed_to_move":"選択したメッセージを移動できませんでした(ネットワークがダウンしている可能性があります)","select_all":"すべて選択する"},"change_password":{"success":"(メールを送信しました)","in_progress":"(メールを送信中)","error":"(エラー)","action":"パスワードリセット用メールを送信する","set_password":"パスワードを設定する"},"change_about":{"title":"プロフィールを変更","error":"変更中にエラーが発生しました。"},"change_username":{"title":"ユーザ名を変更","taken":"このユーザ名は既に使われています。","error":"ユーザ名変更中にエラーが発生しました。","invalid":"このユーザ名は無効です。英数字のみ利用可能です。"},"change_email":{"title":"メールアドレスを変更","taken":"このメールアドレスは既に使われています。","error":"メールアドレス変更中にエラーが発生しました。既にこのアドレスが使われているのかもしれません。","success":"このアドレスにメールを送信しました。メールの指示に従って確認処理を行ってください。"},"change_avatar":{"title":"プロフィール画像を変更","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003eから取得、基準は","gravatar_title":"Gravatarのアバターを変更","refresh_gravatar_title":"Gravatarを更新する","letter_based":"システムプロフィール画像","uploaded_avatar":"カスタム画像","uploaded_avatar_empty":"カスタム画像を追加","upload_title":"画像をアップロード","upload_picture":"画像をアップロード","image_is_not_a_square":"警告: アップロードされた画像は高さと幅が違うため切り落されました。","cache_notice":"プロフィール画像の更新に成功しました。ブラウザのキャッシュのため、反映されるまでに時間がかかる場合があります"},"change_profile_background":{"title":"プロフィールの背景画像","instructions":"プロフィールの背景画像は、幅850pxで中央揃えになります"},"change_card_background":{"title":"ユーザカードの背景画像","instructions":"背景画像は、幅590pxで中央揃えになります"},"email":{"title":"メールアドレス","instructions":"外部に公開されることはありません","ok":"確認用メールを送信します","invalid":"正しいメールアドレスを入力してください","authenticated":"あなたのメールアドレスは {{provider}} によって認証されています","frequency":{"other":"最後に利用されてから{{count}}分以上経過した場合にメールを送ります。"}},"name":{"title":"名前","instructions":"フルネーム(任意)","instructions_required":"氏名","too_short":"名前が短いです","ok":"問題ありません"},"username":{"title":"ユーザ名","instructions":"空白を含まず、被らない名前を入力してください","short_instructions":"@{{username}} であなたにメンションを送ることができます","available":"ユーザ名は利用可能です","global_match":"メールアドレスが登録済みのユーザ名と一致しました","global_mismatch":"既に利用されています。{{suggestion}} などはどうでしょうか？","not_available":"利用出来ない名前です。 {{suggestion}} などはどうでしょうか？","too_short":"ユーザ名が短すぎます","too_long":"ユーザ名が長すぎます","checking":"ユーザ名が利用可能か確認しています...","enter_email":"ユーザ名が見つかりました; 正しいメールアドレスを入力してください","prefilled":"この登録ユーザにマッチするメールアドレスが見つかりました"},"locale":{"title":"表示する言語","instructions":"ユーザインターフェイスの言語です。ページを再読み込みした際に変更されます。","default":"(デフォルト)"},"password_confirmation":{"title":"もう一度パスワードを入力してください。"},"last_posted":"最後の投稿","last_emailed":"最終メール","last_seen":"最後のアクティビティ","created":"参加日","log_out":"ログアウト","location":"場所","card_badge":{"title":"ユーザカードバッジ"},"website":"ウェブサイト","email_settings":"メール","like_notification_frequency":{"title":"いいねされた時に通知","always":"常時"},"email_previous_replies":{"title":"メールの文章の下部に以前の返信を含める","always":"常に"},"email_digests":{"every_30_minutes":"30分毎","every_hour":"1時間毎","daily":"毎日","every_three_days":"3日毎","weekly":"毎週","every_two_weeks":"2週間に1回"},"email_direct":"誰かが投稿を引用した時、投稿に返信があった時、私のユーザ名にメンションがあった時、またはトピックへの招待があった時にメールで通知を受け取る。","email_private_messages":"メッセージを受け取ったときにメールで通知を受け取る。","email_always":"常にメールへ通知を送る","other_settings":"その他","categories_settings":"カテゴリ設定","new_topic_duration":{"label":"以下の条件でトピックを新規と見なす","not_viewed":"未読","last_here":"ログアウトした後に投稿されたもの","after_1_day":"昨日投稿されたもの","after_2_days":"2日前に投稿されたもの","after_1_week":"先週投稿されたもの","after_2_weeks":"2週間前に投稿されたもの"},"auto_track_topics":"自動でトピックを追跡する","auto_track_options":{"never":"追跡しない","immediately":"今すぐ","after_30_seconds":"30秒後","after_1_minute":"1分後","after_2_minutes":"2分後","after_3_minutes":"3分後","after_4_minutes":"4分後","after_5_minutes":"5分後","after_10_minutes":"10分後"},"invited":{"search":"招待履歴を検索","title":"招待","user":"招待したユーザ","none":"保留中の招待はありません。","truncated":{"other":"{{count}} 件の招待を表示しています。"},"redeemed":"受け取られた招待","redeemed_tab":"受け取られた","redeemed_at":"受け取り日","pending":"保留中の招待","pending_tab":"保留中","topics_entered":"閲覧したトピックの数","posts_read_count":"読んだ投稿","expired":"この招待の有効期限が切れました。","rescind":"削除","rescinded":"取り消された招待","reinvite":"招待を再送信する","reinvited":"招待を再度送りました。","time_read":"リード時間","days_visited":"訪問日数","account_age_days":"アカウント有効日数","create":"招待を送る","generate_link":"招待リンクをコピー","bulk_invite":{"none":"まだだれも招待していません。ひとりひとりを招待することもできますが、\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e一括招待ファイルをアップロード\u003c/a\u003eすることで、一度に複数のユーザを招待する事ができます。","text":"ファイルからまとめて招待をする","uploading":"アップロードしています...","success":"ファイルは無事にアップロードされました。完了されましたらメッセージでお知らせをさせていただきます。","error":"ファイルアップロードエラー：'{{filename}}': {{message}}"}},"password":{"title":"パスワード","too_short":"パスワードが短すぎます。","common":"このパスワードは他のユーザが使用している可能性があります。","same_as_username":"パスワードがユーザ名と一致しています","same_as_email":"パスワードとメールアドレスが一致しています","ok":"パスワード OK。","instructions":"%{count} 文字以上の長さにしてください。"},"summary":{"title":"情報","stats":"統計","time_read":"読んだ時間","topic_count":{"other":"つのトピックを作成"},"post_count":{"other":"つの投稿"},"likes_given":{"other":"あげた \u003ci class='fa fa-heart'\u003e\u003c/i\u003e"},"likes_received":{"other":"もらった \u003ci class='fa fa-heart'\u003e\u003c/i\u003e"},"days_visited":{"other":"訪問日数"},"posts_read":{"other":"読んだ投稿"},"bookmark_count":{"other":"つのブックマーク"},"no_replies":"まだ返信はありません。","no_topics":"まだトピックはありません。","top_badges":"最近ゲットしたバッジ","no_badges":"まだバッジはありません。","more_badges":"バッジをもっと見る"},"associated_accounts":"関連アカウント","ip_address":{"title":"最後のIPアドレス"},"registration_ip_address":{"title":"登録時のIPアドレス"},"avatar":{"title":"プロフィール画像","header_title":"プロフィール、メッセージ、ブックマーク、設定"},"title":{"title":"タイトル"},"filters":{"all":"すべて"},"stream":{"posted_by":"投稿者","sent_by":"送信者","private_message":"メッセージ","the_topic":"トピック"}},"loading":"読み込み中...","errors":{"prev_page":"右記の項目をロード中に発生: ","reasons":{"network":"ネットワークエラー","server":"サーバーエラー","forbidden":"アクセス拒否","unknown":"エラー","not_found":"ページが見つかりません"},"desc":{"network":"インターネット接続を確認してください。","network_fixed":"ネットワーク接続が回復しました。","server":"エラーコード : {{status}}","forbidden":"閲覧する権限がありません","not_found":"アプリケーションが存在しないURLを読み込もうとしました。","unknown":"エラーが発生しました。"},"buttons":{"back":"戻る","again":"やり直す","fixed":"ページロード"}},"close":"閉じる","assets_changed_confirm":"Discourseがアップデートされました。ページを更新して最新のバージョンにしますか？","logout":"ログアウトしました","refresh":"更新","read_only_mode":{"enabled":"このサイトは閲覧専用モードになっています。閲覧し続けられますが、返信したりいいねを付けるなどのアクションは現在出来ません。","login_disabled":"読み取り専用モードにされています。ログインできません。"},"learn_more":"より詳しく...","year":"年","year_desc":"過去一年間に投稿されたトピック","month":"月","month_desc":"過去30日間に投稿されたトピック","week":"週","week_desc":"過去7日間に投稿されたトピック","day":"日","first_post":"最初の投稿","mute":"ミュート","unmute":"ミュート解除","last_post":"最終投稿時刻","last_reply_lowercase":"最後の返信","replies_lowercase":{"other":"返信"},"signup_cta":{"sign_up":"新しいアカウントを作成","hide_forever":"いいえ、結構です","intro":"こんにちは！ :heart_eyes: エンジョイしていますね。 ですが、サインアップしていないようです。","value_prop":"アカウントを作成した後、いま読んでいるページへ戻ります。また、新しい投稿があった場合はこことメールにてお知らせします。 いいね！を使って好きな投稿をみんなに教えましょう。 :heartbeat:"},"summary":{"enabled_description":"トピックのまとめを表示されています。","description":"\u003cb\u003e{{replyCount}}\u003c/b\u003e件の返信があります。","enable":"このトピックを要訳する","disable":"すべての投稿を表示する"},"deleted_filter":{"enabled_description":"削除された投稿は非表示になっています。","disabled_description":"削除された投稿は表示しています。","enable":"削除された投稿を非表示にする","disable":"削除された投稿を表示する"},"private_message_info":{"title":"メッセージ","invite":"他の人を招待する...","remove_allowed_user":"このメッセージから {{name}} を削除してもよろしいですか？"},"email":"メール","username":"ユーザ名","last_seen":"最終アクティビティ","created":"作成","created_lowercase":"投稿者","trust_level":"トラストレベル","search_hint":"ユーザ名、メールアドレスまたはIPアドレス","create_account":{"title":"アカウントの作成","failed":"エラーが発生しました。既にこのメールアドレスは使用中かもしれません。「パスワードを忘れました」リンクを試してみてください"},"forgot_password":{"title":"パスワードリセット","action":"パスワードを忘れました","invite":"ユーザ名かメールアドレスを入力してください。パスワードリセット用のメールを送信します。","reset":"パスワードをリセット","complete_username":"\u003cb\u003e%{username}\u003c/b\u003e,アカウントにパスワード再設定メールを送りました。","complete_email":"\u003cb\u003e%{email}\u003c/b\u003e宛にパスワード再設定メールを送信しました。","complete_username_found":"\u003cb\u003e%{username}\u003c/b\u003e,アカウントにパスワード再設定メールを送りました。","complete_email_found":"\u003cb\u003e%{email}\u003c/b\u003e宛にパスワード再設定メールを送信しました。","complete_username_not_found":" \u003cb\u003e%{username}\u003c/b\u003eは見つかりませんでした","complete_email_not_found":"\u003cb\u003e%{email}\u003c/b\u003eで登録したアカウントがありません。"},"login":{"title":"ログイン","username":"ユーザ名","password":"パスワード","email_placeholder":"メールアドレスかユーザ名","caps_lock_warning":"Caps Lockがオンになっています。","error":"不明なエラー","rate_limit":"しばらく待ってから再度ログインをお試しください。","blank_username_or_password":"あなたのメールアドレスかユーザ名、そしてパスワードを入力して下さい。","reset_password":"パスワードをリセット","logging_in":"ログイン中...","or":"または","authenticating":"認証中...","awaiting_confirmation":"アカウントはアクティベーション待ち状態です。もう一度アクティベーションメールを送信するには「パスワードを忘れました」リンクをクリックしてください。","awaiting_approval":"アカウントはまだスタッフに承認されていません。承認され次第メールにてお知らせいたします。","requires_invite":"申し訳ありませんが、このフォーラムは招待制です。","not_activated":"まだログインできません。\u003cb\u003e{{sentTo}}\u003c/b\u003e にアクティベーションメールを送信しております。メールの指示に従ってアカウントのアクティベーションを行ってください。","not_allowed_from_ip_address":"このIPアドレスでログインできません","admin_not_allowed_from_ip_address":"そのIPアドレスからは管理者としてログインできません","resend_activation_email":"再度アクティベーションメールを送信するにはここをクリックしてください。","sent_activation_email_again":"\u003cb\u003e{{currentEmail}}\u003c/b\u003e にアクティベーションメールを再送信しました。メールが届くまで数分掛かることがあります。 (メールが届かない場合は、迷惑メールフォルダの中をご確認ください)。","to_continue":"ログインしてください","preferences":"ユーザ設定を変更するには、ログインする必要があります。","google":{"title":"Googleで","message":"Google による認証 (ポップアップがブロックされていないことを確認してください)"},"google_oauth2":{"title":"Googleで","message":"Googleによる認証 (ポップアップがブロックされていないことを確認してください)"},"twitter":{"title":"Twitter","message":"Twitter による認証 (ポップアップがブロックされていないことを確認してください)"},"instagram":{"title":"Instagram","message":"Instagram による認証 (ポップアップがブロックされていないことを確認してください)"},"facebook":{"title":"Facebookで","message":"Facebook による認証 (ポップアップがブロックされていないことを確認してください)"},"yahoo":{"title":"with Yahoo","message":"Yahoo による認証 (ポップアップがブロックされていないことを確認してください)"},"github":{"title":"with GitHub","message":"Github による認証 (ポップアップがブロックされていないことを確認してください)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"絵文字 :)","more_emoji":"もっと...","options":"オプション","whisper":"ささやき","add_warning":"これは運営スタッフからの警告です。","toggle_whisper":"ささやき機能の切り替え","posting_not_on_topic":"どのトピックに返信しますか?","saving_draft_tip":"保存しています...","saved_draft_tip":"保存しました","saved_local_draft_tip":"ローカルに保存しました","similar_topics":"このトピックに似ているものは...","drafts_offline":"オフラインの下書き","error":{"title_missing":"タイトルを入力してください。","title_too_short":"タイトルは{{min}}文字以上必要です。","title_too_long":"タイトルは最長で{{max}}未満です。","post_missing":"内容が何もありません。","post_length":"投稿は{{min}}文字以上必要です。","try_like":"\u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e ボタンを試しましたか？","category_missing":"カテゴリを選択してください。"},"save_edit":"編集内容を保存","reply_original":"オリジナルトピックへ返信","reply_here":"ここに返信","reply":"返信","cancel":"キャンセル","create_topic":"トピックを作る","create_pm":"メッセージ","title":"Ctrl+Enterでも投稿できます","users_placeholder":"追加するユーザ","title_placeholder":"トピックのタイトルを入力してください。","edit_reason_placeholder":"編集する理由は何ですか?","show_edit_reason":"(編集理由を追加)","reply_placeholder":"文章を入力してください。 Markdown, BBコード, HTMLが使用出来ます。 画像はドラッグアンドドロップで貼り付けられます。","view_new_post":"新しい投稿を見る。","saving":"保存中","saved":"保存しました!","saved_draft":"編集中の投稿があります。ここをクリックすると編集に戻ります。","uploading":"アップロード中...","show_preview":"プレビューを表示する \u0026raquo;","hide_preview":"\u0026laquo; プレビューを隠す","quote_post_title":"投稿全体を引用","bold_title":"太字","bold_text":"太字にしたテキスト","italic_title":"斜体","italic_text":"斜体のテキスト","link_title":"ハイパーリンク","link_description":"リンクの説明をここに入力","link_dialog_title":"ハイパーリンクの挿入","link_optional_text":"タイトル(オプション)","link_url_placeholder":"http://example.com","quote_title":"引用","quote_text":"引用","code_title":"整形済みテキスト","code_text":"4文字スペースでインデント","upload_title":"アップロード","upload_description":"アップロード内容の説明文をここに入力","olist_title":"番号付きリスト","ulist_title":"箇条書き","list_item":"リストアイテム","heading_title":"見出し","heading_text":"見出し","hr_title":"水平線","help":"Markdown 編集のヘルプ","toggler":"編集パネルの表示/非表示","modal_ok":"OK","modal_cancel":"キャンセル","cant_send_pm":"%{username}へメッセージを送ることはできません。","admin_options_title":"このトピックの詳細設定","auto_close":{"label":"このトピックを自動的にクローズする時間:","error":"正しい値を入力してください。","based_on_last_post":"このトピックの新しい投稿が古くなるまではクローズしない","all":{"examples":"時間 (例: 24), 時刻(例: 17:30 ), タイムスタンプ(2013-11-22 14:00) を入力してください"},"limited":{"units":"(# of hours)","examples":"時間(24)を入力してください"}}},"notifications":{"title":"@ユーザ名 のメンション、投稿やトピックへの返信、メッセージなどの通知","none":"通知はありません","more":"通知をすべて確認する","total_flagged":"通報された投稿の合計","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='投稿しました' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}\u003cspan\u003eをいいね！しました\u003c/span\u003e\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003cspan\u003eをいいね！しました\u003c/span\u003e\u003c/p\u003e","liked_many":{"other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}と他{{count}}人\u003c/span\u003e {{description}}\u003cspan\u003eをいいね！しました\u003c/span\u003e\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003e '{{description}}' バッジをゲット！\u003c/p\u003e","group_message_summary":{"other":"\u003ci title='グループ宛にメッセージが届いています' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}}件のメッセージが{{group_name}}へ着ています\u003c/p\u003e"},"alt":{"mentioned":"メンションされました: ","quoted":"引用されました: ","replied":"リプライ","posted":"投稿者 ","edited":"投稿の編集者: ","liked":"あなたの投稿をいいねしました","private_message":"プライベートメッセージを受け取りました: ","invited_to_private_message":"プライベートメッセージへ招待されました: ","invited_to_topic":"トピックに招待されました: ","invitee_accepted":"招待が承認されました: ","moved_post":"投稿を移動しました: ","linked":"あなたの投稿にリンク","granted_badge":"バッジを付与","group_message_summary":"グループ宛のメッセージがあります"},"popup":{"mentioned":"\"{{topic}}\"で{{username}} がタグ付けしました - {{site_title}}","quoted":"\"{{topic}}\"で{{username}}が引用しました - {{site_title}}","replied":"{{username}}が\"{{topic}}\"へ返信しました - {{site_title}}","posted":"{{username}} が投稿しました \"{{topic}}\" - {{site_title}}","private_message":"\"{{topic}}\"で{{username}}からプライベートメッセージが届きました - {{site_title}}","linked":"\"{{topic}}\"にあるあなたの投稿に{{username}}がリンクしました - {{site_title}}"}},"upload_selector":{"title":"画像のアップロード","title_with_attachments":"画像/ファイルをアップロード","from_my_computer":"このデバイスから","from_the_web":"Web から","remote_tip":"画像へのリンク","local_tip":"ローカルからアップロードする画像を選択","local_tip_with_attachments":"デバイスから画像/ファイルを選択する {{authorized_extensions}}","hint":"(アップロードする画像をエディタにドラッグ\u0026ドロップすることもできます)","uploading":"アップロード中","select_file":"ファイル選択","image_link":"イメージのリンク先"},"search":{"sort_by":"並べ替え","relevance":"一番関連しているもの","latest_post":"最近の投稿","most_viewed":"最も閲覧されている順","most_liked":"「いいね！」されている順","select_all":"すべて選択する","clear_all":"すべてクリア","title":"トピック、投稿、ユーザ、カテゴリを探す","no_results":"何も見つかりませんでした。","no_more_results":"検索結果は以上です。","search_help":"検索のヘルプ","searching":"検索中...","post_format":"#{{post_number}}  {{username}}から","context":{"user":"@{{username}}の投稿を検索","category":"#{{category}} から検索する","topic":"このトピックを探す","private_messages":"メッセージ検索"}},"hamburger_menu":"他のトピック一覧やカテゴリを見る","new_item":"新着","go_back":"戻る","not_logged_in_user":"ユーザアクティビティと設定ページ","current_user":"ユーザページに移動","topics":{"bulk":{"unlist_topics":"トピックをリストから非表示にする","reset_read":"未読に設定","delete":"トピックを削除","dismiss_new":"既読にする","toggle":"選択したトピックを切り替え","actions":"操作","change_category":"カテゴリを変更","close_topics":"トピックをクローズする","archive_topics":"アーカイブトピック","notification_level":"通知レベルを変更","choose_new_category":"このトピックの新しいカテゴリを選択してください","selected":{"other":"あなたは \u003cb\u003e{{count}}\u003c/b\u003e トピックを選択しました。"},"change_tags":"タグを変更"},"none":{"unread":"未読のトピックはありません。","new":"新しいトピックはありません。","read":"まだトピックを一つも読んでいません。","posted":"トピックは一つもありません。","latest":"最新のトピックはありません。","hot":"ホットなトピックはありません。","bookmarks":"ブックマークしたトピックはありません。","category":"{{category}} トピックはありません。","top":"トップトピックはありません。","search":"検索結果はありません。","educate":{"new":"\u003cp\u003e新しいトピックがここに表示されます。\u003c/p\u003e\u003cp\u003eデフォルトで、新しいトピックがある場合は2日間、 \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e が表示されます。\u003c/p\u003e\u003cp\u003e設定は\u003ca href=\"%{userPrefsUrl}\"\u003eプロフィール設定\u003c/a\u003eから変更できます。\u003c/p\u003e","unread":"\u003cp\u003e新しいトピックがここに表示されます。\u003c/p\u003e\u003cp\u003e未読のトピックがある場合は、\u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003eが表示されます。 もし、\u003c/p\u003e\u003cul\u003e\u003cli\u003eトピックを作る\u003c/li\u003e\u003cli\u003eトピックに返信\u003c/li\u003e\u003cli\u003eトピックを4分以上読む\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eなどを行った場合、トピックを追跡してそれぞれのトピックの下にある通知の設定を経由してウォッチします。\u003c/p\u003e\u003cp\u003e\u003ca href=\"%{userPrefsUrl}\"\u003eプロフィール\u003c/a\u003eから変更できます。\u003c/p\u003e"}},"bottom":{"latest":"最新のトピックは以上です。","hot":"ホットなトピックは以上です。","posted":"投稿のあるトピックは以上です。","read":"既読のトピックは以上です。","new":"新着トピックは以上です。","unread":"未読のトピックは以上です。","category":"{{category}}トピックは以上です。","top":"トップトピックはこれ以上ありません。","bookmarks":"ブックマーク済みのトピックはこれ以上ありません。","search":"検索結果は以上です。"}},"topic":{"create":"新規トピック","create_long":"新しいトピックの作成","private_message":"メッセージを書く","archive_message":{"title":"アーカイブ"},"move_to_inbox":{"title":"受信ボックスへ移動"},"list":"トピック","new":"新着トピック","unread":"未読","new_topics":{"other":"{{count}}個の新着トピック"},"unread_topics":{"other":"{{count}}個の未読トピック"},"title":"トピック","invalid_access":{"title":"トピックはプライベートです","description":"申し訳ありませんが、このトピックへのアクセスは許可されていません。","login_required":"ポストを閲覧するには、ログインする必要があります"},"server_error":{"title":"トピックの読み込みに失敗しました","description":"申し訳ありませんが、トピックの読み込みに失敗しました。もう一度試してください。もし問題が継続する場合はお知らせください。"},"not_found":{"title":"トピックが見つかりませんでした","description":"申し訳ありませんがトピックが見つかりませんでした。モデレータによって削除された可能性があります。"},"total_unread_posts":{"other":"このトピックに未読のポストが{{count}}つあります。"},"unread_posts":{"other":"このトピックに未読のポストが{{count}}つあります。"},"new_posts":{"other":"前回閲覧時より、このトピックに新しいポストが{{count}}個投稿されています"},"likes":{"other":"このトピックには{{count}}個「いいね！」がついています"},"back_to_list":"トピックリストに戻る","options":"トピックオプション","show_links":"このトピック内のリンクを表示","toggle_information":"トピックの詳細を切り替え","read_more_in_category":"{{catLink}}の他のトピックを見る or {{latestLink}}。","read_more":"{{catLink}} or {{latestLink}}。","browse_all_categories":"全てのカテゴリを閲覧する","view_latest_topics":"最新のトピックを見る","suggest_create_topic":"新しいトピックを作成しませんか?","jump_reply_up":"以前の返信へジャンプ","jump_reply_down":"以後の返信へジャンプ","deleted":"トピックは削除されました","auto_close_notice":"このトピックはあと%{timeLeft}で自動的にクローズします。","auto_close_notice_based_on_last_post":"このトピックは最後の返信から%{duration} 経つとクローズします","auto_close_title":"オートクローズの設定","auto_close_save":"保存","auto_close_remove":"このトピックを自動でクローズしない","timeline":{"back_description":"未読の最終投稿へ戻る"},"progress":{"title":"トピック進捗","go_top":"上","go_bottom":"下","go":"へ","jump_bottom":"最後の投稿へ","jump_prompt":"投稿へジャンプ","jump_prompt_long":"どの投稿へジャンプしますか？","jump_bottom_with_number":"%{post_number}番へジャンプ","total":"投稿の合計","current":"現在の投稿"},"notifications":{"reasons":{"3_6":"このカテゴリに参加中のため通知されます","3_5":"このトピックに参加中のため通知されます","3_2":"このトピックに参加中のため通知されます。","3_1":"このトピックを作成したため通知されます。","3":"このトピックに参加中のため通知されます。","2_8":"このカテゴリを追跡しているため通知されます。","2_4":"このトピックに返信したため通知されます。","2_2":"このトピックを追跡中のため通知されます。","2":"\u003ca href=\"/users/{{username}}/preferences\"\u003eこのトピックを閲覧した\u003c/a\u003eため通知されます。","1_2":"他のユーザからメンションされた場合、投稿へ返信された場合に通知します。","1":"他のユーザからメンションされた場合、投稿へ返信された場合に通知します。","0_7":"このカテゴリに関して一切通知を受け取りません。","0_2":"このトピックに関して一切通知を受け取りません。","0":"このトピックに関して一切通知を受け取りません。"},"watching_pm":{"title":"ウォッチ中","description":"未読件数と新しい投稿がトピックの横に表示されます。このトピックに対して新しい投稿があった場合に通知されます。"},"watching":{"title":"ウォッチ中","description":"未読件数と新しい投稿がトピックの横に表示されます。このトピックに対して新しい投稿があった場合に通知されます。"},"tracking_pm":{"title":"追跡中","description":"新しい返信の数がこのメッセージに表示されます。他のユーザから@ユーザ名でメンションされた場合や、投稿へ返信された場合に通知されます。"},"tracking":{"title":"追跡中","description":"新しい返信の数がこのトピックに表示されます。他のユーザから@ユーザ名でメンションされた場合や、投稿へ返信された場合に通知されます。"},"regular":{"title":"デフォルト","description":"他のユーザからメンションされた場合か、投稿に返信された場合に通知されます。"},"regular_pm":{"title":"デフォルト","description":"他のユーザからメンションされた場合か、メッセージ内の投稿に返信された場合に通知されます。"},"muted_pm":{"title":"ミュートされました","description":"このメッセージについての通知を受け取りません。"},"muted":{"title":"ミュート","description":"このトピックに関するお知らせをすべて受け取りません。また、未読のタブにも通知されません。"}},"actions":{"recover":"トピックの削除を取り消す","delete":"トピックを削除","open":"トピックをオープン","close":"トピックをクローズする","multi_select":"投稿を選択","auto_close":"自動でクローズする...","pin":"トピックを固定","unpin":"トピックの固定を解除","unarchive":"トピックのアーカイブ解除","archive":"トピックのアーカイブ","invisible":"リストから非表示にする","visible":"リストに表示","reset_read":"読み込みデータをリセット","make_public":"公開トピックへ変更","make_private":"プライベートメッセージへ変更"},"feature":{"pin":"トピックをピン留めする...","unpin":"トピックの固定を解除","pin_globally":"トピックを全サイト的にピン留めする","make_banner":"バナートピック","remove_banner":"バナートピックを削除"},"reply":{"title":"返信","help":"このトピックに返信する"},"clear_pin":{"title":"ピンを解除する","help":"このトピックのピンを外し、トピックリストの先頭に表示されないようにする"},"share":{"title":"シェア","help":"このトピックのリンクをシェアする"},"flag_topic":{"title":"通報","help":"スタッフに知らせたいトピックを通報することにより、それについての通知をプライベートメッセージで受け取ることが出来ます","success_message":"このトピックを通報しました。"},"feature_topic":{"title":"トピックを特集","pin":"{{categoryLink}} カテゴリのトップに表示する","confirm_pin":"既に {{count}} 個ピン留めしています。多すぎるピン留めは新規、及び匿名ユーザの負担になる場合があります。このカテゴリの別のトピックのピン留めを続けますか？","unpin":"{{categoryLink}} カテゴリのトップからトピックを削除","unpin_until":"{{categoryLink}} カテゴリのトップからこのトピックを削除するか、\u003cstrong\u003e%{until}\u003c/strong\u003e まで待つ。","pin_note":"ユーザはトピックを個別にピン留め解除することができます","not_pinned":"{{categoryLink}}でピン留めされているトピックはありません。","pin_globally":"このトピックをすべてのトピックリストのトップに表示する","confirm_pin_globally":"既に{{count}} 個ピン留めしています。　多すぎるピン留めは新規ユーザと匿名ユーザの負担になる場合があります。ピン留めを続けますか？","unpin_globally":"トピック一覧のトップからこのトピックを削除します","unpin_globally_until":"このトピックをすべてのトピックリストのトップから削除するか、\u003cstrong\u003e%{until}\u003c/strong\u003e まで待つ。","global_pin_note":"ユーザはトピックを個別にピン留め解除することができます","not_pinned_globally":"すべてのトピックリストでピン留めされたトピックはありません。","make_banner":"このトピックを全てのページのバナーに表示します","remove_banner":"全てのページのバナーを削除します","banner_note":"ユーザはバナーを閉じることができます。常に１つのトピックだけがバナー表示されます"},"inviting":"招待中...","invite_private":{"title":"プライベートメッセージへ招待する","email_or_username":"招待するユーザのメールアドレスまたはユーザ名","email_or_username_placeholder":"メールアドレスまたはユーザ名","action":"招待","success":"ユーザにメッセージへの参加を招待しました。","error":"申し訳ありません、ユーザ招待中にエラーが発生しました。","group_name":"グループ名"},"controls":"オプション","invite_reply":{"title":"招待","username_placeholder":"ユーザ名","action":"招待を送る","help":"このトピックに他のユーザをメールまたは通知で招待する。","to_forum":"ログインしなくてもこの投稿に返信ができることを、あなたの友人に知らせます。","sso_enabled":"このトピックに招待したい人のユーザ名を入れてください","to_topic_blank":"このトピックに招待したい人のユーザ名かメールアドレスを入れてください","to_topic_email":"あなたはメールアドレスを入力しました。フレンドがすぐにこのトピックへ返信できるようにメールで招待します。","to_topic_username":"ユーザ名を入力しました。このトピックへの招待リンクの通知を送信します。","to_username":"招待したい人のユーザ名を入れてください。このトピックへの招待リンクの通知を送信します。","email_placeholder":"name@example.com","success_email":"\u003cb\u003e{{emailOrUsername}}\u003c/b\u003eに招待を送信しました。招待が受理されたらお知らせします。招待した人はユーザページの招待タブにて確認できます。","success_username":"ユーザをこのトピックへ招待しました。","error":"申し訳ありません。その人を招待できませんでした。すでに招待を送信していませんか？ (招待できる数には限りがあります)"},"login_reply":"ログインして返信","filters":{"n_posts":{"other":"{{count}} 件"},"cancel":"フィルター削除"},"split_topic":{"title":"新規トピックに移動","action":"新規トピックに移動","topic_name":"新規トピック名:","error":"投稿の新規トピックへの移動中にエラーが発生しました。","instructions":{"other":"新たにトピックを作成し、選択した\u003cb\u003e{{count}}\u003c/b\u003e個の投稿をこのトピックに移動しようとしています。"}},"merge_topic":{"title":"既存トピックに移動","action":"既存トピックに移動","error":"指定されたトピックへの投稿移動中にエラーが発生しました。","instructions":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e個の投稿をどのトピックに移動するか選択してください。"}},"change_owner":{"title":"投稿者を変更する","action":"オーナーシップを変更","error":"オーナーの変更ができませんでした。","label":"投稿の新しいオーナー","placeholder":"新しい所有者のユーザ名","instructions":{"other":"この {{count}} つの投稿の新しいオーナーを選択してください。（前のオーナー：\u003cb\u003e{{old_user}}\u003c/b\u003e）"},"instructions_warn":"この投稿についての通知が新しいユーザにさかのぼって移動されることはないので注意してください。\u003cbr\u003e警告: 投稿の関連データの所有権は、新しいユーザに転送されません。 注意して使用してください。"},"change_timestamp":{"title":"タイムスタンプを変更","action":"タイムスタンプを変更"},"multi_select":{"select":"選択","selected":"選択中 ({{count}})","select_replies":"返信と選択","delete":"選択中のものを削除","cancel":"選択を外す","select_all":"すべて選択する","deselect_all":"すべて選択を外す","description":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e個の投稿を選択中。"}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"引用して返信","edit":"編集中 {{link}} {{replyAvatar}} {{username}}","edit_reason":"理由: ","post_number":"投稿{{number}}","last_edited_on":"投稿の最終編集日","reply_as_new_topic":"トピックのリンクを付けて返信","continue_discussion":"{{postLink}} から:","follow_quote":"引用した投稿に移動","show_full":"全て表示","show_hidden":"隠されたコンテンツを表示する","deleted_by_author":{"other":"(投稿は投稿者により削除されました。フラグがついていない場合、%{count}時間後に自動的に削除されます)"},"expand_collapse":"開く/折りたたみ","gap":{"other":"{{count}}個の返信をすべて表示する"},"unread":"未読の投稿","has_replies":{"other":"{{count}} 件の返信"},"has_likes":{"other":"{{count}} 個のいいね！"},"has_likes_title":{"other":"{{count}}人のユーザがこの返信に「いいね！」しました"},"has_likes_title_only_you":"あなたがいいねした投稿","errors":{"create":"申し訳ありませんが、投稿中にエラーが発生しました。もう一度やり直してください。","edit":"申し訳ありませんが、投稿の編集中にエラーが発生しました。もう一度やり直してください。","upload":"申し訳ありません、ファイルのアップロード中にエラーが発生しました。再度お試しください。","too_many_uploads":"申し訳ありませんが、複数のファイルは同時にアップロードできません。","upload_not_authorized":"申し訳ありませんが、対象ファイルをアップロードする権限がありません (利用可能な拡張子: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"申し訳ありませんが、新規ユーザは画像のアップロードができません。","attachment_upload_not_allowed_for_new_user":"申し訳ありませんが、新規ユーザはファイルの添付ができません。","attachment_download_requires_login":"ファイルをダウンロードするには、ログインする必要があります"},"abandon":{"confirm":"編集中の投稿は失われてしまいます。本当によろしいですか？","no_value":"いいえ","yes_value":"はい"},"via_email":"メールで投稿されました。","whisper":"この投稿はモデレーターへのプライベートメッセージです","archetypes":{"save":"保存オプション"},"controls":{"reply":"この投稿の返信を編集","like":"この投稿に「いいね！」する","has_liked":"この投稿に「いいね！」しました。","undo_like":"「いいね！」を取り消す","edit":"この投稿を編集","edit_anonymous":"投稿を編集するには、ログインする必要があります","flag":"この投稿を通報する、またはプライベート通知を送る","delete":"投稿を削除する","undelete":"投稿を元に戻す","share":"投稿のリンクを共有する","more":"もっと読む","delete_replies":{"confirm":{"other":"この投稿への{{count}}件の返信を削除しますか?"},"yes_value":"返信も一緒に削除します","no_value":"投稿のみを削除する"},"admin":"投稿の管理","wiki":"wiki投稿にする","unwiki":"wiki投稿から外す","convert_to_moderator":"スタッフカラーを追加","revert_to_regular":"スタッフカラーを外す","rebake":"HTMLを再構成","unhide":"表示する","change_owner":"オーナーシップを変更"},"actions":{"flag":"通報","defer_flags":{"other":"取り下げた通報"},"undo":{"off_topic":"通報を取り消す","spam":"通報を取り消す","inappropriate":"通報を取り消す","bookmark":"ブックマークを取り消す","like":"「いいね！」を取り消す","vote":"投票を取り消す"},"people":{"off_topic":"関係無い話題として通報","spam":"スパムとして通報","inappropriate":"不適切な発言として通報"},"by_you":{"off_topic":"関係のない話題として通報しました","spam":"スパム報告として通報しました","inappropriate":"不適切であると報告されています","notify_moderators":"スタッフによる確認が必要として通報しました","notify_user":"このユーザにメッセージを送信しました","bookmark":"この投稿をブックマークしました","like":"あなたが「いいね！」しました","vote":"この投稿に投票しました"},"by_you_and_others":{"off_topic":{"other":"あなたと他{{count}}名が関係無い話題として通報しました"},"spam":{"other":"あなたと他{{count}}名がスパム報告として通報しました"},"inappropriate":{"other":"あなたと他{{count}}名が不適切な発言として通報しました"},"notify_moderators":{"other":"あなたと他{{count}}名がスタッフの確認が必要として通報しました"},"notify_user":{"other":"あなたと他{{count}}人がこのユーザにメッセージを送信しました"},"bookmark":{"other":"あなたと他{{count}}人がこの投稿をブックマークしました"},"like":{"other":"あなたと他{{count}}人が「いいね！」しました"},"vote":{"other":"あなたと他{{count}}人がこの投稿に投票しました"}},"by_others":{"off_topic":{"other":"{{count}}名のユーザが関係無い話題として通報しました"},"spam":{"other":"{{count}}名のユーザがスパム報告として通報しました"},"inappropriate":{"other":"{{count}}名のユーザが不適切な発言として通報しました"},"notify_moderators":{"other":"{{count}}名のユーザがスタッフの確認が必要として通報しました"},"notify_user":{"other":"{{count}} 人がこのユーザにメッセージを送信しました"},"bookmark":{"other":"{{count}}人のユーザがこの投稿をブックマークしました"},"like":{"other":"{{count}}人のユーザが「いいね！」しました"},"vote":{"other":"{{count}}人のユーザがこのポストに投票しました"}}},"delete":{"confirm":{"other":"これらの投稿を削除してもよろしいですか？"}},"revisions":{"controls":{"first":"最初のリビジョン","previous":"一つ前のリビジョン","next":"次のリビジョン","last":"最後のリビジョン","hide":"リビジョンを隠す","show":"リビジョンを表示","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"追加・削除箇所をインラインで表示","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"差分を横に並べて表示","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"ソース文書で表示する","button":"ソース文書"}}}},"category":{"can":"can\u0026hellip; ","none":"(カテゴリなし)","all":"全てのカテゴリ","choose":"カテゴリを選択\u0026hellip;","edit":"編集","edit_long":"カテゴリを編集","view":"カテゴリ内のトピックを見る","general":"一般","settings":"設定","topic_template":"トピックテンプレート","delete":"カテゴリを削除する","create":"新規カテゴリ","create_long":"新しくカテゴリを作ります","save":"カテゴリを保存する","slug":"カテゴリのスラッグ","slug_placeholder":"(任意) URLで使用されます","creation_error":"カテゴリの作成に失敗しました。","save_error":"カテゴリの保存に失敗しました。","name":"カテゴリ名","description":"カテゴリ内容","topic":"カテゴリトピック","logo":"カテゴリロゴ画像","background_image":"カテゴリの背景画像","badge_colors":"バッジの色","background_color":"背景色","foreground_color":"文字表示色","name_placeholder":"簡単な名前にしてください。","color_placeholder":"任意の Web カラー","delete_confirm":"このカテゴリを削除してもよろしいですか？","delete_error":"カテゴリ削除に失敗しました。","list":"カテゴリをリストする","no_description":"このカテゴリの説明はありません。トピック定義を編集してください。","change_in_category_topic":"カテゴリ内容を編集","already_used":"この色は他のカテゴリで利用しています","security":"セキュリティ","images":"画像","auto_close_label":"トピックが自動的にクローズするまでの時間:","auto_close_units":"時間","email_in":"カスタムメールアドレス:","email_in_allow_strangers":"登録されていないユーザからメールを受け取ります","email_in_disabled":"メールでの新規投稿は、サイトの設定で無効になっています。メールでの新規投稿を有効にするには","email_in_disabled_click":"\"email in\"設定を有効にしてください","allow_badges_label":"このカテゴリでバッジが付与されることを許可","edit_permissions":"パーミッションを編集","add_permission":"パーミッションを追加","this_year":"今年","position":"ポジション","default_position":"デフォルトポジション","position_disabled":"カテゴリはアクティビティで並び替えられます。カテゴリ一覧の順番を制御するには","position_disabled_click":"「固定されたケテゴリーの位置付け」の設定を有効にしてください。","parent":"親カテゴリ","notifications":{"watching":{"title":"ウォッチ中"},"tracking":{"title":"追跡中"},"regular":{"title":"デフォルト","description":"他のユーザからメンションされた場合や、投稿に返信された場合に通知されます。"},"muted":{"title":"ミュート中"}}},"flagging":{"title":"報告していただきありがとうございます。","action":"投稿を通報","take_action":"アクションをする","notify_action":"メッセージ","delete_spammer":"スパムの削除","yes_delete_spammer":"はい、スパムを削除する","ip_address_missing":"(N/A)","hidden_email_address":"(hidden)","submit_tooltip":"プライベートの通報を送信する","take_action_tooltip":"誰かが通報するのを待つのではなく、通報しましょう。","cant":"現在、この投稿を通報することはできません。","formatted_name":{"off_topic":"オフトピック","inappropriate":"不適切","spam":"スパム"},"custom_placeholder_notify_user":"具体的に、建設的に、そして常に親切にしましょう。","custom_placeholder_notify_moderators":"特にどのような問題が発生しているか記入して下さい。可能なら、関連するリンクなどを教えて下さい。"},"flagging_topic":{"title":"報告していただきありがとうございます。","action":"トピックを通報","notify_action":"メッセージ"},"topic_map":{"title":"トピックの情報","participants_title":"よく投稿する人","links_title":"人気のリンク","clicks":{"other":"%{count} クリック"}},"topic_statuses":{"warning":{"help":"これは公式の警告です。"},"bookmarked":{"help":"このトピックをブックマークしました"},"locked":{"help":"このトピックはクローズしています。新たに返信することはできません。"},"archived":{"help":"このトピックはアーカイブされています。凍結状態のため一切の変更ができません"},"locked_and_archived":{"help":"このトピックは閉じられ、アーカイブされます。新しい返信を受け入れず、変更することはできません"},"unpinned":{"title":"ピン留めされていません","help":"このトピックはピン留めされていません。 既定の順番に表示されます。"},"pinned_globally":{"title":"全体でピン留めされました"},"pinned":{"title":"ピン留め","help":"このトピックはピン留めされています。常にカテゴリのトップに表示されます"},"invisible":{"help":"このトピックはリストされていません。トピックリストには表示されません。直接リンクでのみアクセス可能です"}},"posts":"投稿","posts_long":"このトピックには{{number}}個の投稿があります","original_post":"オリジナルの投稿","views":"閲覧","views_lowercase":{"other":" 閲覧"},"replies":"返信","views_long":"このトピックは{{number}}回閲覧されました","activity":"アクティビティ","likes":"いいね！","likes_lowercase":{"other":"いいね！"},"likes_long":"このトピックには{{number}}つ「いいね！」がついています","users":"ユーザ","users_lowercase":{"other":"ユーザ"},"category_title":"カテゴリ","history":"History","changed_by":"by {{author}}","raw_email":{"title":"メール","not_available":"利用不可"},"categories_list":"カテゴリ一覧","filters":{"with_topics":"%{filter} トピック","with_category":"%{filter} %{category} トピック","latest":{"title":"最新","help":"最新のトピック"},"hot":{"title":"ホット","help":"話題のトピック"},"read":{"title":"既読","help":"既読のトピックを、最後に読んだ順に表示"},"search":{"title":"検索","help":"すべてのトピックを検索"},"categories":{"title":"カテゴリ","title_in":"カテゴリ - {{categoryName}}","help":"カテゴリ毎に整理されたトピックを表示"},"unread":{"title":"未読","title_with_count":{"other":"未読 ({{count}})"},"help":"未読投稿のあるトピック","lower_title_with_count":{"other":"{{count}} 未読"}},"new":{"lower_title_with_count":{"other":"{{count}}件"},"lower_title":"NEW","title":"新着","title_with_count":{"other":"最新 ({{count}})"},"help":"最近投稿されたトピック"},"posted":{"title":"自分の投稿","help":"投稿したトピック"},"bookmarks":{"title":"ブックマーク","help":"ブックマークしたトピック"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}} カテゴリの最新トピック"},"top":{"title":"トップ","help":"過去年間、月間、週間及び日間のアクティブトピック","all":{"title":"すべて"},"yearly":{"title":"年ごと"},"quarterly":{"title":"3ヶ月おき"},"monthly":{"title":"月ごと"},"weekly":{"title":"毎週"},"daily":{"title":"日ごと"},"all_time":"すべて","this_year":"年","this_quarter":"今季","this_month":"月","this_week":"週","today":"今日","other_periods":"次の期間のトピックを見る"}},"browser_update":"\u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eご利用のブラウザのバージョンが古いです\u003c/a\u003e。 \u003ca href=\"http://browsehappy.com\"\u003eブラウザをアップデート\u003c/a\u003eしてください。","permission_types":{"full":"作成 / 返信 / 閲覧","create_post":"返信 / 閲覧","readonly":"閲覧できる"},"search_help":{"title":"検索のヘルプ"},"keyboard_shortcuts_help":{"title":"ショートカットキー","jump_to":{"title":"ページ移動","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e ホーム","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e 最新","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e 新着","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e 未読","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e カテゴリ","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e トップ","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e ブックマーク","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e プロフィール","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e メッセージ"},"navigation":{"jump":"\u003cb\u003e#\u003c/b\u003e # 投稿へ","back":"\u003cb\u003eu\u003c/b\u003e 戻る","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e トピックへ"},"application":{"create":"\u003cb\u003ec\u003c/b\u003e 新しいトピックを作成","notifications":"\u003cb\u003en\u003c/b\u003e お知らせを開く","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e メニューを開く","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e ユーザメニュを開く","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e 更新されたトピックを表示する","search":"\u003cb\u003e/\u003c/b\u003e 検索","help":"\u003cb\u003e?\u003c/b\u003e キーボードヘルプを表示する","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e 新しい投稿を非表示にする","dismiss_topics":"Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e 次のセクション/前のセクション"},"actions":{"bookmark_topic":"\u003cb\u003ef\u003c/b\u003e トピックのブックマークを切り替え","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003eトピックを ピン留め/ピン留め解除","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e トピックをシェア","share_post":"\u003cb\u003es\u003c/b\u003e 投稿をシェアする","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e トピックへリンクして返信","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e トピックに返信","reply_post":"\u003cb\u003er\u003c/b\u003e 投稿に返信","quote_post":"\u003cb\u003eq\u003c/b\u003e 投稿を引用する","like":"\u003cb\u003el\u003c/b\u003e 投稿を「いいね！」する","flag":"\u003cb\u003e!\u003c/b\u003e 投稿を通報","bookmark":"\u003cb\u003eb\u003c/b\u003e 投稿をブックマークする","edit":"\u003cb\u003ee\u003c/b\u003e 投稿を編集","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e トピックをミュートする","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e レギュラー(デフォルト)トピックにする","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e トピックを追跡する","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e トピックをウォッチする"}},"badges":{"title":"バッジ","badge_count":{"other":"%{count}個のバッジ"}},"tagging":{"topics":{"none":{"latest":"最新のトピックはありません。"},"bottom":{"latest":"最新のトピックは以上です。"}}},"poll":{"voters":{"other":"投票者数"},"total_votes":{"other":"合計得票数"},"average_rating":"平均評価: \u003cstrong\u003e%{average}\u003c/strong\u003e.","cast-votes":{"title":"投票する","label":"今すぐ投票！"},"show-results":{"title":"投票結果を表示","label":"結果を表示"},"hide-results":{"title":"あなたの投票に戻る","label":"結果を非表示にする"},"open":{"title":"投票を開く","label":"開く","confirm":"この投票をオープンにしてもよろしいですか？"},"close":{"title":"投票を終了","label":"閉じる","confirm":"この投票を終了してもよろしいですか？"}},"type_to_filter":"設定項目を検索...","admin":{"title":"Discourseの管理者","moderator":"モデレータ","dashboard":{"title":"ダッシュボード","last_updated":"ダッシュボード最終更新:","version":"Version","up_to_date":"最新のバージョンです!","critical_available":"重要度の高いアップデートが存在します。","updates_available":"アップデートが存在します。","please_upgrade":"今すぐアップデートしてください!","no_check_performed":"アップデートの確認が正しく動作していません。sidekiq が起動していることを確認してください。","stale_data":"最近アップデートの確認が正しく動作していません。sidekiq が起動していることを確認してください。","version_check_pending":"アップロードしたてです。素晴らしいです！   ","installed_version":"インストール済み","latest_version":"最新","problems_found":"Discourse のインストールにいくつか問題が発見されました:","last_checked":"最終チェック","refresh_problems":"更新","no_problems":"問題は見つかりませんでした。","moderators":"モデレータ:","admins":"管理者:","blocked":"ブロック中:","suspended":"停止中:","private_messages_short":"メッセージ","private_messages_title":"メッセージ","mobile_title":"モバイル","space_free":"{{size}} free","uploads":"アップロード","backups":"バックアップ","traffic_short":"トラフィック","traffic":"Application web requests","page_views":"API Requests","page_views_short":"API Requests","show_traffic_report":"Show Detailed Traffic Report","reports":{"today":"今日","yesterday":"昨日","last_7_days":"過去7日","last_30_days":"過去30日","all_time":"All Time","7_days_ago":"7日前","30_days_ago":"30日前","all":"全て","view_table":"table","refresh_report":"Refresh Report","start_date":"Start Date","end_date":"End Date"}},"commits":{"latest_changes":"最新の更新内容:","by":"by"},"flags":{"title":"通報","old":"古い通報","active":"アクティブな通報","agree":"賛成する","agree_title":"有効で、間違いが無いものとして通報を行う","agree_flag_modal_title":"Agree and...","agree_flag_hide_post":"賛成(ポスト非表示 + プライベートメッセージ送信)","agree_flag_hide_post_title":"この投稿を非表示にし、編集を促すプライベートメッセージを自動的に送信する","agree_flag_restore_post":"賛成(投稿を復元)","agree_flag_restore_post_title":"この投稿を復元","agree_flag":"通報に賛成","agree_flag_title":"投稿を変更できなくする事に賛成","defer_flag":"取り下げる","defer_flag_title":"通報を削除します。何も行いません。","delete":"削除する","delete_title":"この通報で通報されている投稿を削除します","delete_post_defer_flag":"投稿を削除し、通報を取り下げます","delete_post_defer_flag_title":"投稿を削除します。最初の投稿を削除した場合、トピックも削除されます。","delete_post_agree_flag":"投稿を削除することに賛成します","delete_post_agree_flag_title":"投稿を削除します。最初の投稿を削除した場合、トピックも削除されます。","delete_flag_modal_title":"Delete and...","delete_spammer":"スパムユーザーを削除","delete_spammer_title":"ユーザと投稿した全ての投稿とトピックを削除します","disagree_flag_unhide_post":"反対する（投稿を表示する）","disagree_flag_unhide_post_title":"投稿への通報を削除し、投稿を表示します","disagree_flag":"反対する","disagree_flag_title":"無効または、不正としてこの通報を拒否します","clear_topic_flags":"完了","clear_topic_flags_title":"このトピックについての問題が解決されました。「完了」をクリックして通報の対応を完了します。","more":"(more replies...)","dispositions":{"agreed":"賛成しました。","disagreed":"反対する","deferred":"取り下げられた"},"flagged_by":"通報者: ","resolved_by":"解決方法","took_action":"Took action","system":"システム","error":"何らかの理由でうまくいきませんでした","reply_message":"返信する","no_results":"通報はありません。","topic_flagged":"この \u003cstrong\u003eトピック\u003c/strong\u003e は通報されました。","visit_topic":"トピックを確認","was_edited":"最初の通報後に編集された投稿","previous_flags_count":"この投稿は既に {{count}} 回通報されています","summary":{"action_type_3":{"other":"オフトピック x{{count}}"},"action_type_4":{"other":"不適切 x{{count}}"},"action_type_6":{"other":"カスタム x{{count}}"},"action_type_7":{"other":"カスタム x{{count}}"},"action_type_8":{"other":"スパム x{{count}}"}}},"groups":{"primary":"プライマリーグループ","no_primary":"（プライマリーグループなし）","title":"グループ","edit":"グループの編集","refresh":"リフレッシュ","new":"新規","selector_placeholder":"ユーザ名を入力","name_placeholder":"グループ名を入力 (ユーザ名同様にスペースなし)","about":"グループメンバーとグループ名を編集","group_members":"グループメンバー","delete":"削除","delete_confirm":"このグループを削除しますか?","delete_failed":"グループの削除に失敗しました。自動作成グループを削除することはできません。","delete_member_confirm":"'%{group}' グループから'%{username}' を削除しますか?","name":"名前","add":"追加","add_members":"メンバーを追加","custom":"カスタム","bulk":"グループに一括追加","bulk_paste":"1行ごとにユーザ名またはメールアドレスを貼り付けてください:","bulk_select":"(グループを選択)","automatic":"自動で作成されたグループ","automatic_membership_email_domains":"リスト内のメールアドレスのドメインに正確に一致したユーザは自動的にグループに追加される","automatic_membership_retroactive":"同じメールアドレスドメインのルールを既に登録済みのユーザにも適用","default_title":"このグループのすべてのユーザーのデフォルトタイトル","primary_group":"自動的にプライマリグループとして設定","group_owners":"オーナー","add_owners":"オーナーを追加","incoming_email_placeholder":"メールアドレスを入力"},"api":{"generate_master":"マスターAPIキーを生成","none":"現在アクティブなAPIキーが存在しません。","user":"ユーザ","title":"API","key":"Key","generate":"API キーを生成","regenerate":"API キーを再生成","revoke":"無効化","confirm_regen":"このAPIキーを新しいものに置き換えてもよろしいですか?","confirm_revoke":"このキーを無効化してもよろしいですか？","info_html":"API キーを使うと、JSON 呼び出しでトピックの作成・更新を行うことが出来ます。","all_users":"全てのユーザ","note_html":"このキーは、秘密にしてください。このキーを持っている全てのユーザは任意のユーザとして、好きな投稿を作成できます"},"plugins":{"title":"プラグイン","installed":"インストール済みプラグイン","name":"名前","none_installed":"インストール済みのプラグインはありません","version":"バージョン","enabled":"状態","is_enabled":"有効","not_enabled":"無効","change_settings":"設定を変更","change_settings_short":"設定","howto":"プラグインをインストールするには？"},"backups":{"title":"バックアップ","menu":{"backups":"バックアップ","logs":"ログ"},"none":"バックアップはありません","read_only":{"enable":{"title":"閲覧専用モードを有効にする","label":"閲覧専用モードを有効","confirm":"閲覧専用モードを有効にしてもよろしいですか？"},"disable":{"title":"閲覧専用モードを無効にする","label":"閲覧専用モードを無効"}},"logs":{"none":"ログがありません"},"columns":{"filename":"ファイル名","size":"サイズ"},"upload":{"label":"アップロード","title":"このインスタンスにバックアップをアップロード","uploading":"アップロード中...","success":"ファイル'{{filename}}' がアップロードされました。","error":"ファイル '{{filename}}'アップロードエラー: {{message}}"},"operations":{"is_running":"バックアップ作業を実行中...","failed":"{{operation}}失敗しました。ログをチェックください。","cancel":{"label":"キャンセル","title":"バックアップ作業をキャンセルする","confirm":"実行中のバックアップをキャンセルしてもよろしいですか？"},"backup":{"label":"バックアップ","title":"バックアップを行います","confirm":"新しくバックアップを行ってもよろしいですか？","without_uploads":"はい(ファイルは含まない)"},"download":{"label":"ダウンロード","title":"バックアップをダウンロード"},"destroy":{"title":"バックアップを削除","confirm":"このバックアップを削除しますか？"},"restore":{"is_disabled":"バックアップ復元を無効にされています。","label":"復元","title":"バックアップを復元","confirm":"バックアップを復元してもよろしいですか？"},"rollback":{"label":"ロールバック","title":"データベースを前回の状態に戻します"}}},"export_csv":{"user_archive_confirm":"投稿をダウンロードしてもよろしいですか？","success":"エクスポートを開始しました。処理が完了した後、メッセージでお知らせします。","failed":"出力失敗。詳しくはログに参考してください。","rate_limit_error":"投稿は1日に1度だけダウンロードできます。また明日お試しください。","button_text":"エクスポート","button_title":{"user":"全てのユーザをCSV出力","staff_action":"スタッフの操作ログをCSV出力","screened_email":"全てのスクリーンメールアドレスをCSV出力","screened_ip":"全てのスクリーンIPリストをCSV出力","screened_url":"全てのスクリーンURLリストをCSV出力"}},"export_json":{"button_text":"エクスポート"},"invite":{"button_text":"招待を送信","button_title":"招待を送信"},"customize":{"title":"カスタマイズ","long_title":"サイトのカスタマイズ","css":"CSS","header":"ヘッダ","top":"トップ","footer":"フッター","head_tag":{"text":"\u003c/head\u003e","title":"\u003c/head\u003eタグの前に挿入されるHTML"},"body_tag":{"text":"\u003c/body\u003e","title":"\u003c/body\u003eタグの前に挿入されるHTML"},"override_default":"標準のスタイルシートを読み込まない","enabled":"有効にする","preview":"プレビュー","undo_preview":"プレビューを削除","rescue_preview":"既定スタイル","explain_preview":"カスタムスタイルシートでサイトを表示する","explain_undo_preview":"有効中のカスタムスタイルシートへ戻る","explain_rescue_preview":"既定スタイルシートでサイトを表示する","save":"保存","new":"新規","new_style":"新しいスタイル","import":"インポート","import_title":"ファイルを選択するかテキストをペースト","delete":"削除","delete_confirm":"このカスタマイズ設定を削除しますか?","about":"サイトカスタマイズ設定により、サイトのヘッダとスタイルシートを変更できます。設定を選択するか、編集を開始して新たな設定を追加してください。","color":"カラー","opacity":"透明度","copy":"コピー","email_templates":{"title":"メールテンプレート","subject":"件名","multiple_subjects":"このメールのテンプレートは複数の件名があります。","none_selected":"編集するメールテンプレートを選択してください。"},"css_html":{"title":"CSS, HTML","long_title":"CSS と HTML のカスタマイズ"},"colors":{"title":"カラー","long_title":"カラースキーム","about":"CSSを記述することなくサイトのカラーを変更できます。スキームを追加して始めてください","new_name":"カラースキームを作成","copy_name_prefix":"のコピー","delete_confirm":"このカラースキームを削除してもよろしいですか？","undo":"取り消す","undo_title":"変更を元に戻して、前回保存されたカラーにします","revert":"取り戻す","revert_title":"デフォルトのカラースキームへ戻す","primary":{"name":"プライマリー","description":"テキスト、アイコンと枠の色"},"secondary":{"name":"セカンダリー","description":"メイン背景とボタンのテキスト色"},"tertiary":{"name":"ターシャリ","description":"リンク、いくつかのボタン、お知らせ、アクセントカラー"},"quaternary":{"name":"クォータナリ","description":"ナビゲーションリンク"},"header_background":{"name":"ヘッダー背景","description":"ヘッダー背景色"},"header_primary":{"name":"ヘッダープライマリー","description":"サイトヘッダーのテキストとアイコン"},"highlight":{"name":"ハイライト","description":"ページのハイライトされた部分(投稿やトピックなど)"},"danger":{"name":"危険","description":"削除された投稿やトピックのハイライトカラー"},"success":{"name":"成功","description":"操作が成功したことを示すために使用します"},"love":{"name":"love","description":"いいねボタンの色"}}},"email":{"title":"メール","settings":"設定","preview_digest":"まとめのプレビュー","sending_test":"テストメールを送信中...","error":"\u003cb\u003eERROR\u003c/b\u003e - %{server_error}","test_error":"テストメールを送れませんでした。メール設定、またはホストをメールコネクションをブロックされていないようを確認してください。","sent":"送信したメール","skipped":"スキップ済み","received":"受信したメール","rejected":"拒否されたメール","sent_at":"送信時間","time":"日付","user":"ユーザ","email_type":"メールタイプ","to_address":"送信先アドレス","test_email_address":"テスト用メールアドレス","send_test":"テストメールを送る","sent_test":"送信完了!","delivery_method":"送信方法","preview_digest_desc":"しばらくログインしていないユーザーに送られるまとめメールです。","refresh":"更新","format":"フォーマット","html":"html","text":"text","last_seen_user":"ユーザが最後にサイトを訪れた日:","reply_key":"返信キー","skipped_reason":"スキップの理由","incoming_emails":{"from_address":"送信者","to_addresses":"宛先","subject":"件名","error":"エラー","modal":{"subject":"件名"},"filters":{"subject_placeholder":"件名...","error_placeholder":"エラー"}},"logs":{"none":"ログなし","filters":{"title":"フィルター","user_placeholder":"ユーザ名","address_placeholder":"name@example.com","type_placeholder":"まとめ、サインアップ...","reply_key_placeholder":"返信キー","skipped_reason_placeholder":"理由"}}},"logs":{"title":"ログ","action":"アクション","created_at":"作成","last_match_at":"最終マッチ","match_count":"マッチ","ip_address":"IP","topic_id":"トピックID","post_id":"投稿ID","category_id":"カテゴリID","delete":"削除","edit":"編集","save":"保存","screened_actions":{"block":"ブロック","do_nothing":"何もしない"},"staff_actions":{"title":"スタッフ操作","instructions":"ユーザ名、アクションをクリックすると、リストはフィルタされます。プロフィール画像をクリックするとユーザページに遷移します","clear_filters":"すべて表示する","staff_user":"スタッフユーザ","target_user":"対象ユーザ","subject":"対象","when":"日時","context":"コンテンツ","details":"詳細","previous_value":"変更前","new_value":"変更後","diff":"差分を見る","show":"詳しく見る","modal_title":"詳細","no_previous":"変更前の値がありません。","deleted":"変更後の値がありません。レコードが削除されました。","actions":{"delete_user":"ユーザを削除","change_trust_level":"トラストレベルを変更","change_username":"ユーザ名変更","change_site_setting":"サイトの設定を変更","change_site_customization":"サイトのカスタマイズ設定を変更","delete_site_customization":"サイトのカスタマイズ設定を削除","suspend_user":"ユーザを凍結する","unsuspend_user":"ユーザの凍結を解除する","grant_badge":"バッジを付与","revoke_badge":"バッジを取り消す","check_email":"メールアドレスを表示する","delete_topic":"トピック削除","delete_post":"投稿削除","impersonate":"なりすまし","anonymize_user":"匿名ユーザ","roll_up":"IPブロックをロールアップ","delete_category":"カテゴリを削除する","create_category":"カテゴリを作る","block_user":"ユーザをブロック","unblock_user":"ユーザをブロック解除","grant_admin":"管理者権限を付与","revoke_admin":"管理者権限を剥奪","grant_moderation":"モデレータ権限を付与","revoke_moderation":"モデレータ権限を剥奪"}},"screened_emails":{"title":"ブロック対象アドレス","description":"新規アカウント作成時、次のメールアドレスからの登録をブロックする。","email":"メールアドレス","actions":{"allow":"許可する"}},"screened_urls":{"title":"ブロック対象URL","description":"記入されているURLは、スパムユーザとして認識されているユーザの投稿に使用されています。","url":"URL","domain":"ドメイン"},"screened_ips":{"title":"スクリーン対象IP","description":"参加中のIPアドレス。IPアドレスをホワイトリストに追加するには \"許可\" を利用してください。","delete_confirm":"%{ip_address} のルールを削除してもよろしいですか？","roll_up_confirm":"Are you sure you want to roll up commonly screened IP addresses into subnets?","rolled_up_some_subnets":"Successfully rolled up IP ban entries to these subnets: %{subnets}.","rolled_up_no_subnet":"There was nothing to roll up.","actions":{"block":"ブロック","do_nothing":"許可","allow_admin":"Allow Admin"},"form":{"label":"新規:","ip_address":"IPアドレス","add":"追加","filter":"Search"},"roll_up":{"text":"Roll up","title":"Creates new subnet ban entries if there are at least 'min_ban_entries_for_roll_up' entries."}},"logster":{"title":"エラーログ"}},"impersonate":{"title":"このユーザに切り替える","help":"Use this tool to impersonate a user account for debugging purposes. You will have to log out once finished.","not_found":"ユーザが見つかりませんでした。","invalid":"申し訳ありませんがこのユーザとして使えません。"},"users":{"title":"ユーザ","create":"管理者を追加","last_emailed":"最終メール","not_found":"ユーザが見つかりませんでした。","id_not_found":"申し訳ありません。そのユーザIDはシステムに存在していません","active":"アクティブ","show_emails":"メールアドレスを表示","nav":{"new":"新規","active":"アクティブ","pending":"保留中","staff":"スタッフ","suspended":"凍結中","blocked":"ブロック中","suspect":"マーク中"},"approved":"承認?","approved_selected":{"other":"承認ユーザ ({{count}})"},"reject_selected":{"other":"拒否ユーザ ({{count}})"},"titles":{"active":"アクティブユーザ","new":"新しいユーザ","pending":"保留中のユーザ","newuser":"トラストレベル0のユーザ (新しいユーザ)","basic":"トラストレベル1のユーザ (ベーシックユーザ)","staff":"スタッフ","admins":"管理者ユーザ","moderators":"モデレータ","blocked":"ブロック中のユーザ","suspended":"凍結中のユーザ","suspect":"マーク中のユーザ"},"reject_successful":{"other":"%{count}人のユーザの拒否に成功しました。"},"reject_failures":{"other":"%{count}人のユーザの拒否に失敗しました。"},"not_verified":"検証されていません","check_email":{"title":"メールアドレスを表示する","text":"表示する"}},"user":{"suspend_failed":"ユーザの凍結に失敗しました: {{error}}","unsuspend_failed":"ユーザの凍結解除に失敗しました: {{error}}","suspend_duration":"ユーザを何日間凍結しますか?","suspend_duration_units":"(日)","suspend_reason_label":"アカウントを凍結する理由を説明してください。ここに書いた理由は、このユーザのプロファイルページにおいて\u003cb\u003e全員が閲覧可能な状態\u003c/b\u003eで公開されます。またこのユーザがログインを試みた際にも表示されます。","suspend_reason":"理由","suspended_by":"凍結したユーザ","delete_all_posts":"全ての投稿を削除","suspend":"凍結","unsuspend":"凍結解除","suspended":"凍結状態","moderator":"モデレータ権限の所有","admin":"管理者権限の所有","blocked":"ブロック状態","staged":"ステージドモードの状態","show_admin_profile":"アカウントの管理","edit_title":"タイトルを編集","save_title":"タイトルを保存","refresh_browsers":"ブラウザを強制リフレッシュ","refresh_browsers_message":"全てのクライアントにメッセージが送信されました！","show_public_profile":"パブリックプロフィールを見る","impersonate":"このユーザになりすます","ip_lookup":"IPアドレスを検索","log_out":"ログアウト","logged_out":"すべてのデバイスでログアウトしました","revoke_admin":"管理者権限を剥奪","grant_admin":"管理者権限を付与","revoke_moderation":"モデレータ権限を剥奪","grant_moderation":"モデレータ権限を付与","unblock":"ブロック解除","block":"ブロック","reputation":"レピュテーション","permissions":"パーミッション","activity":"アクティビティ","like_count":"「いいね！」付けた/もらった数","last_100_days":"過去100日に","private_topics_count":"プライベートトピックの数","posts_read_count":"読んだ投稿数","post_count":"投稿数","topics_entered":"閲覧したトピックの数","flags_given_count":"通報した数","flags_received_count":"通報された数","warnings_received_count":"警告されました","flags_given_received_count":"通報をした / された","approve":"承認","approved_by":"承認したユーザ","approve_success":"ユーザが承認され、アクティベーション方法を記載したメールが送信されました。","approve_bulk_success":"成功!！選択したユーザ全員が承認され、メールが送信されました。","time_read":"リード時間","anonymize":"匿名ユーザ","anonymize_confirm":"このアカウントと匿名化してよいですか？ユーザ名、メールアドレスが変更され、全てのプロフィール情報がリセットされます","anonymize_yes":"はい。アカウントを匿名化してください","anonymize_failed":"アカウントの匿名化中に問題が発生しました","delete":"ユーザを削除","delete_forbidden_because_staff":"管理者およびモデレータアカウントは削除できません。","delete_posts_forbidden_because_staff":"管理者、モデレータの全ての投稿は削除できません","delete_forbidden":{"other":"投稿済のユーザは削除できません。ユーザを削除する前に全ての投稿を削除してください。(%{count}日以上経過した投稿は削除できません )"},"cant_delete_all_posts":{"other":"全ての投稿を削除できませんでした。%{count}日以上経過した投稿があります。(設定: delete_user_max_post_age)"},"cant_delete_all_too_many_posts":{"other":"全ての投稿を削除できませんでした。ユーザは%{count} 件以上投稿しています。(delete_all_posts_max)"},"delete_confirm":"このユーザを削除してもよろしいですか？","delete_and_block":"アカウントを削除し、同一メールアドレス及びIPアドレスからのサインアップを\u003cb\u003eブロックします\u003c/b\u003e","delete_dont_block":"削除する","deleted":"ユーザが削除されました。","delete_failed":"ユーザの削除中にエラーが発生しました。このユーザの全投稿を削除したことを確認してください。","send_activation_email":"アクティベーションメールを送信","activation_email_sent":"アクティベーションメールが送信されました。","send_activation_email_failed":"アクティベーションメールの送信に失敗しました。 %{error}","activate":"アカウントのアクティベート","activate_failed":"ユーザのアクティベートに失敗しました。","deactivate_account":"アカウントのアクティベート解除","deactivate_failed":"ユーザのアクティベート解除に失敗しました。","unblock_failed":"ユーザのブロック解除に失敗しました。","block_failed":"ユーザのブロックに失敗しました。","block_confirm":"このユーザをブロックしてもよろしいですか? ユーザは新しくトピックを作成したり、投稿する事ができなくなります。","deactivate_explanation":"アクティベート解除されたユーザは、メールで再アクティベートする必要があります。","suspended_explanation":"凍結中のユーザはログインできません。","block_explanation":"ブロックされているユーザは投稿およびトピックの作成ができません。","staged_explanation":"ステージドユーザは特定のトピック宛に、メールを経由して投稿する事が出来ます。","trust_level_change_failed":"ユーザのトラストレベル変更に失敗しました。","suspend_modal_title":"凍結中のユーザ","trust_level_2_users":"トラストレベル2のユーザ","trust_level_3_requirements":"トラストレベル3の条件","trust_level_locked_tip":"トラストレベルはロックされています。システムがユーザを昇格、降格させることはありません","trust_level_unlocked_tip":"トラストレベルはアンロックされています。システムはユーザを昇格、降格させます","lock_trust_level":"トラストレベルをロック","unlock_trust_level":"トラストレベルをアンロック","tl3_requirements":{"title":"トラストレベル3の条件","value_heading":"値","requirement_heading":"条件","visits":"訪問","days":"日","topics_replied_to":"返信したトピック","topics_viewed":"閲覧したトピックの数","topics_viewed_all_time":"閲覧したトピック","posts_read":"閲覧した投稿数","posts_read_all_time":"閲覧した投稿数","flagged_posts":"通報されている投稿","flagged_by_users":"通報されたユーザ","likes_given":"与えた「いいね！」","likes_received":"もらった「いいね！」","likes_received_days":"「いいね！」数：日別","likes_received_users":"「いいね！」数： ユーザ別","qualifies":"トラストレベル3の条件を満たしています。","does_not_qualify":"トラストレベル3の条件を満たしていません。","will_be_promoted":"もうすぐ昇格します","will_be_demoted":"もうすぐ降格します","on_grace_period":"現在の昇格期間中は、降格されません","locked_will_not_be_promoted":"トラストレベルはロックされています。昇格することはありません","locked_will_not_be_demoted":"トラストレベルはロックされています。降格することはありません"},"sso":{"title":"シングルサインオン","external_id":"External ID","external_username":"ユーザ名","external_name":"名前","external_email":"メール","external_avatar_url":"プロフィール画像URL"}},"user_fields":{"title":"ユーザフィールド","help":"ユーザが記入する項目(フィールド)を追加します","create":"ユーザフィールド作成","untitled":"無題","name":"フィールド名","type":"フィールドタイプ","description":"フィールド説明","save":"保存","edit":"編集","delete":"削除","cancel":"キャンセル","delete_confirm":"ユーザフィールドを削除してもよいですか？","options":"オプション","required":{"title":"サインアップ時の必須にしますか？","enabled":"必須","disabled":"任意"},"editable":{"title":"サインアップ後に編集可能にしますか？","enabled":"編集可能","disabled":"編集不可"},"show_on_profile":{"title":"パブリックプロフィールに表示しますか？","enabled":"プロフィールに表示","disabled":"プロフィール非表示"},"show_on_user_card":{"title":"ユーザカードに表示しますか？"},"field_types":{"text":"テキストフィールド","confirm":"確認","dropdown":"ドロップダウン"}},"site_text":{"title":"テキストコンテンツ","edit":"編集"},"site_settings":{"show_overriden":"上書き部分のみ表示","title":"設定","reset":"デフォルトに戻す","none":"なし","no_results":"何も見つかりませんでした。","clear_filter":"クリア","add_url":"URL追加","add_host":"ホストを追加","categories":{"all_results":"全て","required":"必須設定","basic":"基本設定","users":"ユーザ","posting":"投稿","email":"メール","files":"ファイル","trust":"トラストレベル","security":"セキュリティ","onebox":"Onebox","seo":"SEO","spam":"スパム","rate_limits":"投稿制限","developer":"開発者向け","embedding":"埋め込む","legal":"法律に基づく情報","uncategorized":"その他","backups":"バックアップ","login":"ログイン","plugins":"プラグイン","user_preferences":"ユーザ設定"}},"badges":{"title":"バッジ","new_badge":"新しいバッジ","new":"新規","name":"バッジの名前","badge":"バッジ","display_name":"バッジの表示名","description":"バッジの説明","long_description":"詳しい説明","badge_type":"バッジの種類","badge_grouping":"グループ","badge_groupings":{"modal_title":"バッジのグループ"},"granted_by":"付与者","granted_at":"付与日","reason_help":"(投稿かトピックへのリンク)","save":"バッジを保存する","delete":"削除","delete_confirm":"このバッジを削除してもよろしいですか？","revoke":"取り消す","reason":"理由","expand":"\u0026hellipを展開","revoke_confirm":"このバッジを取り消しますか？","edit_badges":"バッジを編集する","grant_badge":"バッジを付与","granted_badges":"付けられたバッジ","grant":"付ける","no_user_badges":"%{name}はバッジを付けられていません。","no_badges":"付けられるバッジがありません","none_selected":"バッジを選択して開始","allow_title":"バッジをタイトルとして使用されることを許可する","multiple_grant":"何度もゲットできるようにする","listable":"公開されるバッジページにバッジを表示する","enabled":"バッジを有効にする","icon":"アイコン","image":"画像","icon_help":"Font Awesomeのクラスか画像のURLを使用してください","query":"バッジクエリ(SQL)","target_posts":"投稿を対象","auto_revoke":"毎日クエリの取り消しを実行","show_posts":"バッジページでバッジを取得したことを投稿する","trigger":"トリガー","trigger_type":{"none":"毎日更新する","post_action":"ユーザが投稿に影響を与えたとき","post_revision":"ユーザが投稿、投稿の編集をした時","trust_level_change":"ユーザのトラストレベルが変わったとき","user_change":"ユーザを作成、編集したとき","post_processed":"投稿の処理後"},"preview":{"link_text":"付与するバッジをプレビュー","plan_text":"クエリ計画をプレビュー","modal_title":"バッジクエリをプレビュー","sql_error_header":"クエリにエラーがあります","error_help":"バッジクエリのヘルプについては、以下のリンクを参照してください","bad_count_warning":{"header":"WARNING!","text":"There are missing grant samples. This happens when the badge query returns user IDs or post IDs that do not exist. This may cause unexpected results later on - please double-check your query."},"no_grant_count":"付与されたバッジはありません","grant_count":{"other":"\u003cb\u003e%{count}\u003c/b\u003e個のバッジが付与されています"},"sample":"サンプル：","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link} at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"絵文字","help":"各ユーザが利用できる絵文字を追加します。 (ちょっとしたコツ: ドラッグアンドドロップで複数のファイルを一度にアップロードできます)","add":"新しい絵文字を追加","name":"名前","image":"画像","delete_confirm":"Are you sure you want to delete the :%{name}: emoji?"},"embedding":{"title":"埋め込み","edit":"編集","category":"カテゴリへ投稿","settings":"埋め込みの設定","save":"埋め込みの設定を保存"},"permalink":{"title":"パーマリンク","url":"URL","topic_id":"トピックID","topic_title":"トピック","post_id":"投稿ID","post_title":"投稿","category_id":"カテゴリID","category_title":"カテゴリ","external_url":"外部URL","delete_confirm":"このパーマリンクを削除してもよろしいですか？","form":{"label":"新規:","add":"追加","filter":"検索(URL または 外部URL)"}}}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"tiny":{"less_than_x_seconds":{"one":"\u003c 1s"},"x_seconds":{"one":"1s"},"x_minutes":{"one":"1m"},"about_x_hours":{"one":"1h"},"x_days":{"one":"1d"},"about_x_years":{"one":"1y"},"over_x_years":{"one":"\u003e 1y"},"almost_x_years":{"one":"1y"}},"medium":{"x_minutes":{"one":"1 min"},"x_hours":{"one":"1 hour"},"x_days":{"one":"1 day"}},"medium_with_ago":{"x_minutes":{"one":"1 min ago"},"x_hours":{"one":"1 hour ago"},"x_days":{"one":"1 day ago"}},"later":{"x_days":{"one":"1 day later"},"x_months":{"one":"1 month later"},"x_years":{"one":"1 year later"}}},"action_codes":{"split_topic":"split this topic %{when}","invited_group":"invited %{who} %{when}","removed_group":"removed %{who} %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"ap_south_1":"Asia Pacific (Mumbai)","cn_north_1":"China (Beijing)"}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"{{count}} new or updated topic."},"topic_count_unread":{"one":"{{count}} unread topic."},"topic_count_new":{"one":"{{count}} new topic."},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","queue":{"has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e1\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"1 user"}},"groups":{"index":"Groups","title":{"one":"group"},"notifications":{"watching":{"description":"You will be notified of every new post in every message, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."},"tracking":{"description":"You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"regular":{"description":"You will be notified if someone mentions your @name or replies to you."},"muted":{"description":"You will never be notified of anything about new topics in this group."}}},"categories":{"reorder":{"fix_order_tooltip":"Not all categories have a unique position number, which may cause unexpected results."},"topic_sentence":{"one":"1 topic","other":"%{count} topics"},"topic_stat_sentence":{"one":"%{count} new topic in the past %{unit}."}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","mailing_list_mode":{"many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","muted_categories_instructions":"You will not be notified of anything about new topics in these categories, and they will not appear in latest.","watched_topics_link":"Show watched topics","automatically_unpin_topics":"Automatically unpin topics when I reach the bottom.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email":{"frequency_immediately":"We'll email you immediately if you haven't read the thing we're emailing you about.","frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"like_notification_frequency":{"first_time_and_daily":"First time a post is liked and daily","first_time":"First time a post is liked","never":"Never"},"email_previous_replies":{"unless_emailed":"unless previously sent","never":"never"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","invited":{"sent":"Sent","truncated":{"one":"Showing the first invite."},"redeemed_tab_with_count":"Redeemed ({{count}})","pending_tab_with_count":"Pending ({{count}})","reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!","generated_link_message":"\u003cp\u003eInvite link generated successfully!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eInvite link is only valid for this email address: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e"},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark"},"top_replies":"Top Replies","more_replies":"More Replies","top_topics":"Top Topics","more_topics":"More Topics","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"read_only_mode":{"logout_disabled":"Logout is disabled while the site is in read only mode."},"too_few_topics_and_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","too_few_topics_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics. New visitors need some conversations to read and respond to.","too_few_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"replies_lowercase":{"one":"reply"},"signup_cta":{"hide_session":"Remind me tomorrow","hidden_for_session":"OK, I'll ask you tomorrow. You can always use 'Log In' to create an account, too."},"summary":{"description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"login":{"forgot":"I don't recall my account details"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e"},"popup":{"group_mentioned":"{{username}} mentioned you in \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"remote_tip_with_attachments":"link to image or file {{authorized_extensions}}","hint_for_supported_browsers":"you can also drag and drop or paste images into the editor"},"search":{"too_short":"Your search term is too short.","result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} results for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"}},"topics":{"bulk":{"dismiss":"Dismiss","dismiss_read":"Dismiss all unread","dismiss_button":"Dismiss…","dismiss_tooltip":"Dismiss just new posts or stop tracking topics","also_dismiss_topics":"Stop tracking these topics so they never show up as unread for me again","selected":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e topic."},"choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."}},"topic":{"unsubscribe":{"stop_notifications":"You will now receive less notifications for \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Your current notification state is "},"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"archive_message":{"help":"Move message to your archive"},"move_to_inbox":{"help":"Move message back to Inbox"},"new_topics":{"one":"1 new topic"},"unread_topics":{"one":"1 unread topic"},"total_unread_posts":{"one":"you have 1 unread post in this topic"},"unread_posts":{"one":"you have 1 unread old post in this topic"},"new_posts":{"one":"there is 1 new post in this topic since you last read it"},"likes":{"one":"there is 1 like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","replies_short":"%{current} / %{total}"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"feature_topic":{"pin_validation":"A date is required to pin this topic.","already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"no_banner_exists":"There is no banner topic.","banner_exists":"There \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e currently a banner topic."},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"filters":{"n_posts":{"one":"1 post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_owner":{"instructions":{"one":"Please choose the new owner of the post by \u003cb\u003e{{old_user}}\u003c/b\u003e."}},"change_timestamp":{"invalid_timestamp":"Timestamp cannot be in the future.","error":"There was an error changing the timestamp of the topic.","instructions":"Please select the new timestamp of the topic. Posts in the topic will be updated to have the same time difference."},"multi_select":{"description":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e post."}}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view 1 hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes":{"one":"{{count}} Like"},"has_likes_title":{"one":"1 person liked this post"},"has_likes_title_you":{"one":"you and 1 other person liked this post","other":"you and {{count}} other people liked this post"},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","wiki":{"about":"this post is a wiki"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","controls":{"delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?"}}},"actions":{"defer_flags":{"one":"Defer flag"},"people":{"notify_moderators":"notified moderators","notify_user":"sent a message","bookmark":"bookmarked this","like":"liked this","vote":"voted for this"},"by_you_and_others":{"off_topic":{"one":"You and 1 other flagged this as off-topic"},"spam":{"one":"You and 1 other flagged this as spam"},"inappropriate":{"one":"You and 1 other flagged this as inappropriate"},"notify_moderators":{"one":"You and 1 other flagged this for moderation"},"notify_user":{"one":"You and 1 other sent a message to this user"},"bookmark":{"one":"You and 1 other bookmarked this post"},"like":{"one":"You and 1 other liked this"},"vote":{"one":"You and 1 other voted for this post"}},"by_others":{"off_topic":{"one":"1 person flagged this as off-topic"},"spam":{"one":"1 person flagged this as spam"},"inappropriate":{"one":"1 person flagged this as inappropriate"},"notify_moderators":{"one":"1 person flagged this for moderation"},"notify_user":{"one":"1 person sent a message to this user"},"bookmark":{"one":"1 person bookmarked this post"},"like":{"one":"1 person liked this"},"vote":{"one":"1 person voted for this post"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","suppress_from_homepage":"Suppress this category from the homepage.","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"muted":{"description":"You will never be notified of anything about new topics in these categories, and they will not appear in latest."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links...","clicks":{"one":"1 click"}},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"topic_statuses":{"pinned_globally":{"help":"This topic is pinned globally; it will display at the top of latest and its category"}},"views_lowercase":{"one":"view"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (1)","other":"Latest ({{count}})"}},"unread":{"title_with_count":{"one":"Unread (1)"},"lower_title_with_count":{"one":"1 unread"}},"new":{"lower_title_with_count":{"one":"1 new"},"title_with_count":{"one":"New (1)"}},"category":{"title_with_count":{"one":"{{categoryName}} (1)"}}},"lightbox":{"download":"download"},"keyboard_shortcuts_help":{"navigation":{"title":"Navigation","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application"},"actions":{"title":"Actions","delete":"\u003cb\u003ed\u003c/b\u003e Delete post"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"public":{"title":"Votes are public."},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph","groups":"All groups"}},"flags":{"summary":{"action_type_3":{"one":"off-topic"},"action_type_4":{"one":"inappropriate"},"action_type_6":{"one":"custom"},"action_type_7":{"one":"custom"},"action_type_8":{"one":"spam"}}},"groups":{"delete_owner_confirm":"Remove owner privilege for '%{username}'?","bulk_complete":"The users have been added to the group.","incoming_email":"Custom incoming email address","flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"operations":{"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"customize":{"embedded_css":"Embedded CSS","email_templates":{"body":"Body","revert":"Revert Changes","revert_confirm":"Are you sure you want to revert your changes?"}},"email":{"templates":"Templates","bounced":"Bounced","incoming_emails":{"cc_addresses":"Cc","none":"No incoming emails found.","modal":{"title":"Incoming Email Details","error":"Error","headers":"Headers","body":"Body","rejection_message":"Rejection Mail"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com"}}},"logs":{"staff_actions":{"actions":{"change_site_text":"change site text","change_category_settings":"change category settings","backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"users":{"approved_selected":{"one":"approve user"},"reject_selected":{"one":"reject user"},"titles":{"member":"Users at Trust Level 2 (Member)","regular":"Users at Trust Level 3 (Regular)","leader":"Users at Trust Level 4 (Leader)"},"reject_successful":{"one":"Successfully rejected 1 user."},"reject_failures":{"one":"Failed to reject 1 user."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)"},"block_accept":"Yes, block this user","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"enabled":"shown on user card","disabled":"not shown on user card"}},"site_text":{"description":"You can customize any of the text on your forum. Please start by searching below:","search":"Search for the text you'd like to edit","revert":"Revert Changes","revert_confirm":"Are you sure you want to revert your changes?","go_back":"Back to Search","recommended":"We recommend customizing the following text to suit your needs:","show_overriden":"Only show overridden"},"site_settings":{"categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"preview":{"grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned."}}},"embedding":{"get_started":"If you'd like to embed Discourse on another website, begin by adding its host.","confirm_delete":"Are you sure you want to delete that host?","sample":"Use the following HTML code into your site to create and embed discourse topics. Replace \u003cb\u003eREPLACE_ME\u003c/b\u003e with the canonical URL of the page you are embedding it on.","host":"Allowed Hosts","path_whitelist":"Path Whitelist","add_host":"Add Host","feed_settings":"Feed Settings","feed_description":"Providing an RSS/ATOM feed for your site can improve Discourse's ability to import your content.","crawling_settings":"Crawler Settings","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"Username for topic creation","embed_post_limit":"Maximum number of posts to embed","embed_username_key_from_feed":"Key to pull discourse username from feed","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_truncate":"Truncate the embedded posts","embed_whitelist_selector":"CSS selector for elements that are allowed in embeds","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","embed_classname_whitelist":"Allowed CSS class names","feed_polling_enabled":"Import posts via RSS/ATOM","feed_polling_url":"URL of RSS/ATOM feed to crawl"}}}}};
I18n.locale = 'ja';
//! moment.js
//! version : 2.13.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, function () { 'use strict';

    var hookCallback;

    function utils_hooks__hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function create_utc__createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function valid__isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            m._isValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                m._isValid = m._isValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function valid__createInvalid (flags) {
        var m = create_utc__createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    function isUndefined(input) {
        return input === void 0;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = utils_hooks__hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            utils_hooks__hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (utils_hooks__hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (utils_hooks__hooks.deprecationHandler != null) {
                utils_hooks__hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(arguments).join(', ') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (utils_hooks__hooks.deprecationHandler != null) {
            utils_hooks__hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    utils_hooks__hooks.suppressDeprecationWarnings = false;
    utils_hooks__hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function isObject(input) {
        return Object.prototype.toString.call(input) === '[object Object]';
    }

    function locale_set__set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _ordinalParseLenient.
        this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    // internal storage for locale config files
    var locales = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we
                // want to undo that for lazy loaded locales
                locale_locales__getSetGlobalLocale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function locale_locales__getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = locale_locales__getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale');
                config = mergeConfigs(locales[name]._config, config);
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    config = mergeConfigs(locales[config.parentLocale]._config, config);
                } else {
                    // treat as if there is no base config
                    deprecateSimple('parentLocaleUndefined',
                            'specified parentLocale is not defined yet');
                }
            }
            locales[name] = new Locale(config);

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale;
            if (locales[name] != null) {
                config = mergeConfigs(locales[name]._config, config);
            }
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function locale_locales__getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function locale_locales__listLocales() {
        return keys(locales);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                get_set__set(this, unit, value);
                utils_hooks__hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get_set__get(this, unit);
            }
        };
    }

    function get_set__get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function get_set__set (mom, unit, value) {
        if (mom.isValid()) {
            mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    // MOMENTS

    function getSet (units, value) {
        var unit;
        if (typeof units === 'object') {
            for (unit in units) {
                this.set(unit, units[unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i;


    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (typeof callback === 'number') {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        return isArray(this._months) ? this._months[m.month()] :
            this._months[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function units_month__handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = create_utc__createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return units_month__handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (typeof value !== 'number') {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            utils_hooks__hooks.updateOffset(this, true);
            return this;
        } else {
            return get_set__get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    utils_hooks__hooks.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is discouraged and will be removed in upcoming major release. Please refer to https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    function createDate (y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getFullYear())) {
            date.setFullYear(y);
        }
        return date;
    }

    function createUTCDate (y) {
        var date = new Date(Date.UTC.apply(null, arguments));

        //the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getUTCFullYear())) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? utils_hooks__hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = utils_hooks__hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    utils_hooks__hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(utils_hooks__hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(local__createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = defaults(w.gg, config._a[YEAR], weekOfYear(local__createLocal(), dow, doy).year);
            week = defaults(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // constant that refers to the ISO standard
    utils_hooks__hooks.ISO_8601 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === utils_hooks__hooks.ISO_8601) {
            configFromISO(config);
            return;
        }

        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (getParsingFlags(config).bigHour === true &&
                config._a[HOUR] <= 12 &&
                config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!valid__isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || locale_locales__getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return valid__createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        } else if (isDate(input)) {
            config._d = input;
        } else {
            configFromInput(config);
        }

        if (!valid__isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (input === undefined) {
            config._d = new Date(utils_hooks__hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (typeof(input) === 'object') {
            configFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function local__createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
         'moment().min is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
         function () {
             var other = local__createLocal.apply(null, arguments);
             if (this.isValid() && other.isValid()) {
                 return other < this ? this : other;
             } else {
                 return valid__createInvalid();
             }
         }
     );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
        function () {
            var other = local__createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return valid__createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return local__createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = locale_locales__getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = ((string || '').match(matcher) || []);
        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : local__createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            utils_hooks__hooks.updateOffset(res, false);
            return res;
        } else {
            return local__createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    utils_hooks__hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
            } else if (Math.abs(input) < 16) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    add_subtract__addSubtract(this, create__createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    utils_hooks__hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm) {
            this.utcOffset(this._tzm);
        } else if (typeof this._i === 'string') {
            this.utcOffset(offsetFromString(matchOffset, this._i));
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? local__createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? create_utc__createUTC(c._a) : local__createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?\d*)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$/;

    function create__createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])        * sign,
                h  : toInt(match[HOUR])        * sign,
                m  : toInt(match[MINUTE])      * sign,
                s  : toInt(match[SECOND])      * sign,
                ms : toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(local__createLocal(duration.from), local__createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    create__createDuration.fn = Duration.prototype;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = create__createDuration(val, period);
            add_subtract__addSubtract(this, dur, direction);
            return this;
        };
    }

    function add_subtract__addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (days) {
            get_set__set(mom, 'Date', get_set__get(mom, 'Date') + days * isAdding);
        }
        if (months) {
            setMonth(mom, get_set__get(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            utils_hooks__hooks.updateOffset(mom, days || months);
        }
    }

    var add_subtract__add      = createAdder(1, 'add');
    var add_subtract__subtract = createAdder(-1, 'subtract');

    function moment_calendar__calendar (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || local__createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            diff = this.diff(sod, 'days', true),
            format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format]() : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, local__createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(from, units) : !this.isBefore(from, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(to, units) : !this.isAfter(to, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units || 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input,units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input,units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            delta, output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        if (units === 'year' || units === 'month' || units === 'quarter') {
            output = monthDiff(this, that);
            if (units === 'quarter') {
                output = output / 3;
            } else if (units === 'year') {
                output = output / 12;
            }
        } else {
            delta = this - that;
            output = units === 'second' ? delta / 1e3 : // 1000
                units === 'minute' ? delta / 6e4 : // 1000 * 60
                units === 'hour' ? delta / 36e5 : // 1000 * 60 * 60
                units === 'day' ? (delta - zoneDelta) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                units === 'week' ? (delta - zoneDelta) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                delta;
        }
        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    utils_hooks__hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    utils_hooks__hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function moment_format__toISOString () {
        var m = this.clone().utc();
        if (0 < m.year() && m.year() <= 9999) {
            if (isFunction(Date.prototype.toISOString)) {
                // native implementation is ~50x faster, use it when we can
                return this.toDate().toISOString();
            } else {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        } else {
            return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        }
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? utils_hooks__hooks.defaultFormatUtc : utils_hooks__hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(local__createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(local__createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = locale_locales__getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    function startOf (units) {
        units = normalizeUnits(units);
        // the following switch intentionally omits break keywords
        // to utilize falling through the cases.
        switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
        case 'date':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
        }

        // weeks are a special case
        if (units === 'week') {
            this.weekday(0);
        }
        if (units === 'isoWeek') {
            this.isoWeekday(1);
        }

        // quarters are also special
        if (units === 'quarter') {
            this.month(Math.floor(this.month() / 3) * 3);
        }

        return this;
    }

    function endOf (units) {
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond') {
            return this;
        }

        // 'date' is an alias for 'day', so it should be considered as such.
        if (units === 'date') {
            units = 'day';
        }

        return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
    }

    function to_type__valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return this._offset ? new Date(this.valueOf()) : this._d;
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function moment_valid__isValid () {
        return valid__isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 1st is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        return isStrict ? locale._ordinalParse : locale._ordinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0], 10);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    // LOCALES

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        return isArray(this._weekdays) ? this._weekdays[m.day()] :
            this._weekdays[this._weekdays.isFormat.test(format) ? 'format' : 'standalone'][m.day()];
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return this._weekdaysShort[m.day()];
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return this._weekdaysMin[m.day()];
    }

    function day_of_week__handleStrictParse(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = create_utc__createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return day_of_week__handleStrictParse.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = create_utc__createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.
        return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var momentPrototype__proto = Moment.prototype;

    momentPrototype__proto.add               = add_subtract__add;
    momentPrototype__proto.calendar          = moment_calendar__calendar;
    momentPrototype__proto.clone             = clone;
    momentPrototype__proto.diff              = diff;
    momentPrototype__proto.endOf             = endOf;
    momentPrototype__proto.format            = format;
    momentPrototype__proto.from              = from;
    momentPrototype__proto.fromNow           = fromNow;
    momentPrototype__proto.to                = to;
    momentPrototype__proto.toNow             = toNow;
    momentPrototype__proto.get               = getSet;
    momentPrototype__proto.invalidAt         = invalidAt;
    momentPrototype__proto.isAfter           = isAfter;
    momentPrototype__proto.isBefore          = isBefore;
    momentPrototype__proto.isBetween         = isBetween;
    momentPrototype__proto.isSame            = isSame;
    momentPrototype__proto.isSameOrAfter     = isSameOrAfter;
    momentPrototype__proto.isSameOrBefore    = isSameOrBefore;
    momentPrototype__proto.isValid           = moment_valid__isValid;
    momentPrototype__proto.lang              = lang;
    momentPrototype__proto.locale            = locale;
    momentPrototype__proto.localeData        = localeData;
    momentPrototype__proto.max               = prototypeMax;
    momentPrototype__proto.min               = prototypeMin;
    momentPrototype__proto.parsingFlags      = parsingFlags;
    momentPrototype__proto.set               = getSet;
    momentPrototype__proto.startOf           = startOf;
    momentPrototype__proto.subtract          = add_subtract__subtract;
    momentPrototype__proto.toArray           = toArray;
    momentPrototype__proto.toObject          = toObject;
    momentPrototype__proto.toDate            = toDate;
    momentPrototype__proto.toISOString       = moment_format__toISOString;
    momentPrototype__proto.toJSON            = toJSON;
    momentPrototype__proto.toString          = toString;
    momentPrototype__proto.unix              = unix;
    momentPrototype__proto.valueOf           = to_type__valueOf;
    momentPrototype__proto.creationData      = creationData;

    // Year
    momentPrototype__proto.year       = getSetYear;
    momentPrototype__proto.isLeapYear = getIsLeapYear;

    // Week Year
    momentPrototype__proto.weekYear    = getSetWeekYear;
    momentPrototype__proto.isoWeekYear = getSetISOWeekYear;

    // Quarter
    momentPrototype__proto.quarter = momentPrototype__proto.quarters = getSetQuarter;

    // Month
    momentPrototype__proto.month       = getSetMonth;
    momentPrototype__proto.daysInMonth = getDaysInMonth;

    // Week
    momentPrototype__proto.week           = momentPrototype__proto.weeks        = getSetWeek;
    momentPrototype__proto.isoWeek        = momentPrototype__proto.isoWeeks     = getSetISOWeek;
    momentPrototype__proto.weeksInYear    = getWeeksInYear;
    momentPrototype__proto.isoWeeksInYear = getISOWeeksInYear;

    // Day
    momentPrototype__proto.date       = getSetDayOfMonth;
    momentPrototype__proto.day        = momentPrototype__proto.days             = getSetDayOfWeek;
    momentPrototype__proto.weekday    = getSetLocaleDayOfWeek;
    momentPrototype__proto.isoWeekday = getSetISODayOfWeek;
    momentPrototype__proto.dayOfYear  = getSetDayOfYear;

    // Hour
    momentPrototype__proto.hour = momentPrototype__proto.hours = getSetHour;

    // Minute
    momentPrototype__proto.minute = momentPrototype__proto.minutes = getSetMinute;

    // Second
    momentPrototype__proto.second = momentPrototype__proto.seconds = getSetSecond;

    // Millisecond
    momentPrototype__proto.millisecond = momentPrototype__proto.milliseconds = getSetMillisecond;

    // Offset
    momentPrototype__proto.utcOffset            = getSetOffset;
    momentPrototype__proto.utc                  = setOffsetToUTC;
    momentPrototype__proto.local                = setOffsetToLocal;
    momentPrototype__proto.parseZone            = setOffsetToParsedOffset;
    momentPrototype__proto.hasAlignedHourOffset = hasAlignedHourOffset;
    momentPrototype__proto.isDST                = isDaylightSavingTime;
    momentPrototype__proto.isDSTShifted         = isDaylightSavingTimeShifted;
    momentPrototype__proto.isLocal              = isLocal;
    momentPrototype__proto.isUtcOffset          = isUtcOffset;
    momentPrototype__proto.isUtc                = isUtc;
    momentPrototype__proto.isUTC                = isUtc;

    // Timezone
    momentPrototype__proto.zoneAbbr = getZoneAbbr;
    momentPrototype__proto.zoneName = getZoneName;

    // Deprecations
    momentPrototype__proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    momentPrototype__proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    momentPrototype__proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    momentPrototype__proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779', getSetZone);

    var momentPrototype = momentPrototype__proto;

    function moment__createUnix (input) {
        return local__createLocal(input * 1000);
    }

    function moment__createInZone () {
        return local__createLocal.apply(null, arguments).parseZone();
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function locale_calendar__calendar (key, mom, now) {
        var output = this._calendar[key];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    function preParsePostFormat (string) {
        return string;
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relative__relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var prototype__proto = Locale.prototype;

    prototype__proto._calendar       = defaultCalendar;
    prototype__proto.calendar        = locale_calendar__calendar;
    prototype__proto._longDateFormat = defaultLongDateFormat;
    prototype__proto.longDateFormat  = longDateFormat;
    prototype__proto._invalidDate    = defaultInvalidDate;
    prototype__proto.invalidDate     = invalidDate;
    prototype__proto._ordinal        = defaultOrdinal;
    prototype__proto.ordinal         = ordinal;
    prototype__proto._ordinalParse   = defaultOrdinalParse;
    prototype__proto.preparse        = preParsePostFormat;
    prototype__proto.postformat      = preParsePostFormat;
    prototype__proto._relativeTime   = defaultRelativeTime;
    prototype__proto.relativeTime    = relative__relativeTime;
    prototype__proto.pastFuture      = pastFuture;
    prototype__proto.set             = locale_set__set;

    // Month
    prototype__proto.months            =        localeMonths;
    prototype__proto._months           = defaultLocaleMonths;
    prototype__proto.monthsShort       =        localeMonthsShort;
    prototype__proto._monthsShort      = defaultLocaleMonthsShort;
    prototype__proto.monthsParse       =        localeMonthsParse;
    prototype__proto._monthsRegex      = defaultMonthsRegex;
    prototype__proto.monthsRegex       = monthsRegex;
    prototype__proto._monthsShortRegex = defaultMonthsShortRegex;
    prototype__proto.monthsShortRegex  = monthsShortRegex;

    // Week
    prototype__proto.week = localeWeek;
    prototype__proto._week = defaultLocaleWeek;
    prototype__proto.firstDayOfYear = localeFirstDayOfYear;
    prototype__proto.firstDayOfWeek = localeFirstDayOfWeek;

    // Day of Week
    prototype__proto.weekdays       =        localeWeekdays;
    prototype__proto._weekdays      = defaultLocaleWeekdays;
    prototype__proto.weekdaysMin    =        localeWeekdaysMin;
    prototype__proto._weekdaysMin   = defaultLocaleWeekdaysMin;
    prototype__proto.weekdaysShort  =        localeWeekdaysShort;
    prototype__proto._weekdaysShort = defaultLocaleWeekdaysShort;
    prototype__proto.weekdaysParse  =        localeWeekdaysParse;

    prototype__proto._weekdaysRegex      = defaultWeekdaysRegex;
    prototype__proto.weekdaysRegex       =        weekdaysRegex;
    prototype__proto._weekdaysShortRegex = defaultWeekdaysShortRegex;
    prototype__proto.weekdaysShortRegex  =        weekdaysShortRegex;
    prototype__proto._weekdaysMinRegex   = defaultWeekdaysMinRegex;
    prototype__proto.weekdaysMinRegex    =        weekdaysMinRegex;

    // Hours
    prototype__proto.isPM = localeIsPM;
    prototype__proto._meridiemParse = defaultLocaleMeridiemParse;
    prototype__proto.meridiem = localeMeridiem;

    function lists__get (format, index, field, setter) {
        var locale = locale_locales__getLocale();
        var utc = create_utc__createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (typeof format === 'number') {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return lists__get(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = lists__get(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = locale_locales__getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return lists__get(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = lists__get(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function lists__listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function lists__listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function lists__listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function lists__listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function lists__listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    locale_locales__getSetGlobalLocale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports
    utils_hooks__hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', locale_locales__getSetGlobalLocale);
    utils_hooks__hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', locale_locales__getLocale);

    var mathAbs = Math.abs;

    function duration_abs__abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function duration_add_subtract__addSubtract (duration, input, value, direction) {
        var other = create__createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function duration_add_subtract__add (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function duration_add_subtract__subtract (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'year') {
            days   = this._days   + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            return units === 'month' ? months : months / 12;
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function duration_as__valueOf () {
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asYears        = makeAs('y');

    function duration_get__get (units) {
        units = normalizeUnits(units);
        return this[units + 's']();
    }

    function makeGetter(name) {
        return function () {
            return this._data[name];
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        s: 45,  // seconds to minute
        m: 45,  // minutes to hour
        h: 22,  // hours to day
        d: 26,  // days to month
        M: 11   // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function duration_humanize__relativeTime (posNegDuration, withoutSuffix, locale) {
        var duration = create__createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds < thresholds.s && ['s', seconds]  ||
                minutes <= 1           && ['m']           ||
                minutes < thresholds.m && ['mm', minutes] ||
                hours   <= 1           && ['h']           ||
                hours   < thresholds.h && ['hh', hours]   ||
                days    <= 1           && ['d']           ||
                days    < thresholds.d && ['dd', days]    ||
                months  <= 1           && ['M']           ||
                months  < thresholds.M && ['MM', months]  ||
                years   <= 1           && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set a threshold for relative time strings
    function duration_humanize__getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        return true;
    }

    function humanize (withSuffix) {
        var locale = this.localeData();
        var output = duration_humanize__relativeTime(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var iso_string__abs = Math.abs;

    function iso_string__toISOString() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        var seconds = iso_string__abs(this._milliseconds) / 1000;
        var days         = iso_string__abs(this._days);
        var months       = iso_string__abs(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds;
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        return (total < 0 ? '-' : '') +
            'P' +
            (Y ? Y + 'Y' : '') +
            (M ? M + 'M' : '') +
            (D ? D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? h + 'H' : '') +
            (m ? m + 'M' : '') +
            (s ? s + 'S' : '');
    }

    var duration_prototype__proto = Duration.prototype;

    duration_prototype__proto.abs            = duration_abs__abs;
    duration_prototype__proto.add            = duration_add_subtract__add;
    duration_prototype__proto.subtract       = duration_add_subtract__subtract;
    duration_prototype__proto.as             = as;
    duration_prototype__proto.asMilliseconds = asMilliseconds;
    duration_prototype__proto.asSeconds      = asSeconds;
    duration_prototype__proto.asMinutes      = asMinutes;
    duration_prototype__proto.asHours        = asHours;
    duration_prototype__proto.asDays         = asDays;
    duration_prototype__proto.asWeeks        = asWeeks;
    duration_prototype__proto.asMonths       = asMonths;
    duration_prototype__proto.asYears        = asYears;
    duration_prototype__proto.valueOf        = duration_as__valueOf;
    duration_prototype__proto._bubble        = bubble;
    duration_prototype__proto.get            = duration_get__get;
    duration_prototype__proto.milliseconds   = milliseconds;
    duration_prototype__proto.seconds        = seconds;
    duration_prototype__proto.minutes        = minutes;
    duration_prototype__proto.hours          = hours;
    duration_prototype__proto.days           = days;
    duration_prototype__proto.weeks          = weeks;
    duration_prototype__proto.months         = months;
    duration_prototype__proto.years          = years;
    duration_prototype__proto.humanize       = humanize;
    duration_prototype__proto.toISOString    = iso_string__toISOString;
    duration_prototype__proto.toString       = iso_string__toISOString;
    duration_prototype__proto.toJSON         = iso_string__toISOString;
    duration_prototype__proto.locale         = locale;
    duration_prototype__proto.localeData     = localeData;

    // Deprecations
    duration_prototype__proto.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', iso_string__toISOString);
    duration_prototype__proto.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    utils_hooks__hooks.version = '2.13.0';

    setHookCallback(local__createLocal);

    utils_hooks__hooks.fn                    = momentPrototype;
    utils_hooks__hooks.min                   = min;
    utils_hooks__hooks.max                   = max;
    utils_hooks__hooks.now                   = now;
    utils_hooks__hooks.utc                   = create_utc__createUTC;
    utils_hooks__hooks.unix                  = moment__createUnix;
    utils_hooks__hooks.months                = lists__listMonths;
    utils_hooks__hooks.isDate                = isDate;
    utils_hooks__hooks.locale                = locale_locales__getSetGlobalLocale;
    utils_hooks__hooks.invalid               = valid__createInvalid;
    utils_hooks__hooks.duration              = create__createDuration;
    utils_hooks__hooks.isMoment              = isMoment;
    utils_hooks__hooks.weekdays              = lists__listWeekdays;
    utils_hooks__hooks.parseZone             = moment__createInZone;
    utils_hooks__hooks.localeData            = locale_locales__getLocale;
    utils_hooks__hooks.isDuration            = isDuration;
    utils_hooks__hooks.monthsShort           = lists__listMonthsShort;
    utils_hooks__hooks.weekdaysMin           = lists__listWeekdaysMin;
    utils_hooks__hooks.defineLocale          = defineLocale;
    utils_hooks__hooks.updateLocale          = updateLocale;
    utils_hooks__hooks.locales               = locale_locales__listLocales;
    utils_hooks__hooks.weekdaysShort         = lists__listWeekdaysShort;
    utils_hooks__hooks.normalizeUnits        = normalizeUnits;
    utils_hooks__hooks.relativeTimeThreshold = duration_humanize__getSetRelativeTimeThreshold;
    utils_hooks__hooks.prototype             = momentPrototype;

    var _moment = utils_hooks__hooks;

    return _moment;

}));
//! moment.js locale configuration
//! locale : japanese (ja)
//! author : LI Long : https://github.com/baryon

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var ja = moment.defineLocale('ja', {
        months : '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
        monthsShort : '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
        weekdays : '日曜日_月曜日_火曜日_水曜日_木曜日_金曜日_土曜日'.split('_'),
        weekdaysShort : '日_月_火_水_木_金_土'.split('_'),
        weekdaysMin : '日_月_火_水_木_金_土'.split('_'),
        longDateFormat : {
            LT : 'Ah時m分',
            LTS : 'Ah時m分s秒',
            L : 'YYYY/MM/DD',
            LL : 'YYYY年M月D日',
            LLL : 'YYYY年M月D日Ah時m分',
            LLLL : 'YYYY年M月D日Ah時m分 dddd'
        },
        meridiemParse: /午前|午後/i,
        isPM : function (input) {
            return input === '午後';
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 12) {
                return '午前';
            } else {
                return '午後';
            }
        },
        calendar : {
            sameDay : '[今日] LT',
            nextDay : '[明日] LT',
            nextWeek : '[来週]dddd LT',
            lastDay : '[昨日] LT',
            lastWeek : '[前週]dddd LT',
            sameElse : 'L'
        },
        ordinalParse : /\d{1,2}日/,
        ordinal : function (number, period) {
            switch (period) {
            case 'd':
            case 'D':
            case 'DDD':
                return number + '日';
            default:
                return number;
            }
        },
        relativeTime : {
            future : '%s後',
            past : '%s前',
            s : '数秒',
            m : '1分',
            mm : '%d分',
            h : '1時間',
            hh : '%d時間',
            d : '1日',
            dd : '%d日',
            M : '1ヶ月',
            MM : '%dヶ月',
            y : '1年',
            yy : '%d年'
        }
    });

    return ja;

}));
moment.fn.shortDateNoYear = function(){ return this.format('MMM D'); };
moment.fn.shortDate = function(){ return this.format('YYYY MMM D'); };
moment.fn.longDate = function(){ return this.format('YYYY MMMM D h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['ja'] = function (n) {
  return n === 0 ? ["zero", "none", "other"] : "other";
};
