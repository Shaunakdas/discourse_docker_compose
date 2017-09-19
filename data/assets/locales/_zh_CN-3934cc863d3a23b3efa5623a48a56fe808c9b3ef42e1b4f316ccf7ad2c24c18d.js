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
r += "还有 ";
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
r += "<a href='/unread'>1 个未读主题</a>";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个未读主题</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_CN"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "和 ";
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
r += " <a href='/new'>1 个新</a>主题";
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
r += "和 ";
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
r += " <a href='/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个近期</a>主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_CN"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "可以阅读，或者";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "浏览";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
r += "中的其他主题";
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
r += "这个主题有 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_CN"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "，有很多人赞了该帖";
return r;
},
"med" : function(d){
var r = "";
r += "，有非常多人赞了该帖";
return r;
},
"high" : function(d){
var r = "";
r += "，大多数人赞了该帖";
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

MessageFormat.locale.zh_CN = function ( n ) {
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
I18n.translations = {"zh_CN":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"字节"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}K","millions":"{{number}}M"}},"dates":{"time":"ah:mm","timeline_date":"YYYY年MMM","long_no_year":"MMMDoah:mm","long_no_year_no_time":"MMMDo","full_no_year_no_time":"MMMDo","long_with_year":"lll","long_with_year_no_time":"ll","full_with_year_no_time":"ll","long_date_with_year":"YY年MMMDoLT","long_date_without_year":"MMMDoLT","long_date_with_year_without_time":"YY年MMMDo","long_date_without_year_with_linebreak":"MMMDo\u003cbr/\u003eLT","long_date_with_year_with_linebreak":"YY年MMMDo\u003cbr/\u003eLT","wrap_ago":"%{date}前","tiny":{"half_a_minute":"1分钟内","less_than_x_seconds":{"other":"%{count}秒内"},"x_seconds":{"other":"%{count}秒前"},"x_minutes":{"other":"%{count}分钟前"},"about_x_hours":{"other":"%{count}小时前"},"x_days":{"other":"%{count}天前"},"about_x_years":{"other":"%{count}年内"},"over_x_years":{"other":"%{count}年前"},"almost_x_years":{"other":"近%{count}年"},"date_month":"MMMDo","date_year":"YY年MMM"},"medium":{"x_minutes":{"other":"%{count}分钟"},"x_hours":{"other":"%{count}小时"},"x_days":{"other":"%{count}天"},"date_year":"YY年MMM"},"medium_with_ago":{"x_minutes":{"other":"%{count}分钟前"},"x_hours":{"other":"%{count}小时前"},"x_days":{"other":"%{count}天前"}},"later":{"x_days":{"other":"%{count}天后"},"x_months":{"other":"%{count}个月后"},"x_years":{"other":"%{count}年后"}},"previous_month":"上个月","next_month":"下个月"},"share":{"topic":"分享指向这个主题的链接","post":"#%{postNumber} 楼","close":"关闭","twitter":"分享至 Twitter","facebook":"分享至 Facebook","google+":"分享至 Google+","email":"通过邮件分享内容"},"action_codes":{"public_topic":"于%{when}设置为公共主题","private_topic":"于%{when}设置为私密主题","split_topic":"于%{when}分割了该主题","invited_user":"于%{when}邀请了%{who}","invited_group":"于%{when}邀请了%{who}","removed_user":"于%{when}移除了%{who}","removed_group":"于%{when}移除了%{who}","autoclosed":{"enabled":"于%{when}关闭","disabled":"于%{when}打开"},"closed":{"enabled":"于%{when}关闭","disabled":"于%{when}打开"},"archived":{"enabled":"于%{when}存档","disabled":"于%{when}解除存档"},"pinned":{"enabled":"于%{when}置顶","disabled":"于%{when}解除置顶"},"pinned_globally":{"enabled":"于%{when}全站置顶","disabled":"于%{when}解除全站置顶"},"visible":{"enabled":"于%{when}解除隐藏","disabled":"于%{when}隐藏"}},"topic_admin_menu":"管理主题","emails_are_disabled":"出站邮件已经被管理员全局禁用。将不发送任何邮件提醒。","bootstrap_mode_enabled":"为方便站点准备发布，其正处于初始化模式中。所有新用户将被授予信任等级1，并为他们设置接受每日邮件摘要。初始化模式会在用户数超过 %{min_users} 个时关闭。","bootstrap_mode_disabled":"初始化模式将会在24小时后关闭。","s3":{"regions":{"us_east_1":"美国东部（N. Virginia）","us_west_1":"美国西部（N. California）","us_west_2":"美国西部（Oregon）","us_gov_west_1":"政府专用（US）","eu_west_1":"欧洲（Ireland）","eu_central_1":"欧洲（Frankfurt）","ap_southeast_1":"亚太地区（Singapore）","ap_southeast_2":"亚太地区（Sydney）","ap_south_1":"亚太地区（Mumbai）","ap_northeast_1":"亚太地区（Tokyo）","ap_northeast_2":"亚太地区（Seoul）","sa_east_1":"南美（Sao Paulo）","cn_north_1":"中国（Beijing）"}},"edit":"编辑标题和分类","not_implemented":"非常抱歉，这个功能仍在开发中！","no_value":"否","yes_value":"是","generic_error":"抱歉，出了点小问题。","generic_error_with_reason":"出错了：%{error}","sign_up":"注册","log_in":"登录","age":"年龄","joined":"加入于","admin_title":"管理","flags_title":"标记","show_more":"显示更多","show_help":"选项","links":"链接","links_lowercase":{"other":"链接"},"faq":"常见问题","guidelines":"指引","privacy_policy":"隐私政策","privacy":"隐私","terms_of_service":"服务条款","mobile_view":"移动版","desktop_view":"桌面版","you":"你","or":"或","now":"刚才","read_more":"阅读更多","more":"更多","less":"更少","never":"从未","every_30_minutes":"每半小时","every_hour":"每小时","daily":"每天","weekly":"每周","every_two_weeks":"每两周","every_three_days":"每三天","max_of_count":"不超过 {{count}}","alternation":"或","character_count":{"other":"%{count} 个字符"},"suggested_topics":{"title":"推荐主题","pm_title":"推荐消息"},"about":{"simple_title":"关于","title":"关于%{title}","stats":"站点统计","our_admins":"我们的管理员","our_moderators":"我们的版主","stat":{"all_time":"全部","last_7_days":"7天以内","last_30_days":"30天以内"},"like_count":"赞","topic_count":"主题","post_count":"帖子","user_count":"新用户","active_user_count":"活跃用户","contact":"联系我们","contact_info":"重要事件或紧急事件，请通过 %{contact_info} 联系我们。"},"bookmarked":{"title":"收藏","clear_bookmarks":"取消收藏","help":{"bookmark":"点击收藏该主题的第一个帖子","unbookmark":"点击删除本主题的所以书签"}},"bookmarks":{"not_logged_in":"抱歉，你需要登录后才能收藏","created":"已经收藏了","not_bookmarked":"你已经阅读过此帖；点击收藏","last_read":"这是你阅读过的最后一帖；点击收藏","remove":"取消收藏","confirm_clear":"你确定要清除该主题的所有收藏吗？"},"topic_count_latest":{"other":"{{count}} 个近期的主题或更新的主题。"},"topic_count_unread":{"other":"{{count}} 未读主题。"},"topic_count_new":{"other":"近期有 {{count}} 个主题。"},"click_to_show":"点击加载","preview":"预览","cancel":"取消","save":"保存更改","saving":"保存中...","saved":"已保存！","upload":"上传","uploading":"上传中...","uploading_filename":"上传“{{filename}}”中...","uploaded":"上传成功！","enable":"启用","disable":"停用","undo":"重置","revert":"撤销","failed":"失败","switch_to_anon":"进入匿名模式","switch_from_anon":"退出匿名模式","banner":{"close":"隐藏横幅。","edit":"编辑该横幅 \u003e\u003e"},"choose_topic":{"none_found":"没有找到主题。","title":{"search":"通过标题、URL 或者 ID 搜索主题：","placeholder":"在此输入主题标题"}},"queue":{"topic":"主题：","approve":"通过","reject":"否决","delete_user":"删除用户","title":"需要审核","none":"没有帖子需要审核。","edit":"编辑","cancel":"取消","view_pending":"查看待审核帖子","has_pending_posts":{"other":"这个主题有 \u003cb\u003e{{count}}\u003c/b\u003e 个帖子等待审核"},"confirm":"保存更改","delete_prompt":"你确定要删除\u003cb\u003e%{username}\u003c/b\u003e吗？这将删除用户的所有帖子并封禁这个邮箱和 IP 地址。","approval":{"title":"等待审核中","description":"我们已经保存了你的帖子，不过帖子需要由管理员先审核才能显示。请耐心。","pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 个帖子待审核。"},"ok":"确认"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e发起了\u003ca href='{{topicUrl}}'\u003e该主题\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e发起了\u003ca href='{{topicUrl}}'\u003e该主题\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e回复了\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e回复了\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e回复了\u003ca href='{{topicUrl}}'\u003e该主题\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e回复了\u003ca href='{{topicUrl}}'\u003e该主题\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e提到了\u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e提到了\u003ca href='{{user2Url}}'\u003e你\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003e你\u003c/a\u003e提到了\u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"发起人 \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"发起人 \u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e","sent_by_user":"发送人 \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"发送人 \u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e"},"directory":{"filter_name":"按用户名检索","title":"用户","likes_given":"送出赞","likes_received":"获得赞","topics_entered":"浏览","topics_entered_long":"浏览过的主题","time_read":"阅读时长","topic_count":"主题","topic_count_long":"发布的主题","post_count":"回复","post_count_long":"回复数","no_results":"没有找到结果。","days_visited":"访问","days_visited_long":"访问天数","posts_read":"阅读","posts_read_long":"阅读帖子","total_rows":{"other":"%{count} 位用户"}},"groups":{"empty":{"posts":"小组的成员从未发表帖子。","members":"小组没有成员。","mentions":"小组从未被提及过。","messages":"小组从未发送过消息。","topics":"小组的成员从未发表主题。"},"add":"添加","selector_placeholder":"添加成员","owner":"所有者","visible":"小组对所有用户可见","index":"小组","title":{"other":"小组"},"members":"成员","topics":"主题","posts":"帖子","mentions":"提及","messages":"消息","alias_levels":{"title":"谁能@该小组和发送消息？","nobody":"没有人","only_admins":"管理员","mods_and_admins":"版主与管理员","members_mods_and_admins":"组员、版主与管理员","everyone":"任何人"},"trust_levels":{"title":"这些用户加入时，将自动赋予信任等级：","none":"无"},"notifications":{"watching":{"title":"跟踪","description":"你将会在该消息中的每个新帖子发布后收到通知，并且会显示新回复数量。"},"watching_first_post":{"title":"跟踪","description":"你只会收到此组中每个新主题的第一帖的通知。"},"tracking":{"title":"跟踪","description":"你会在别人@你或回复你时收到通知，并且新帖数量也将在这些主题后显示。"},"regular":{"title":"常规","description":"如果有人@名字提及你或回复你，将通知你。"},"muted":{"title":"静音","description":"你不会收到组内关于新主题中的任何通知。"}}},"user_action_groups":{"1":"送出赞","2":"获得赞","3":"收藏","4":"主题","5":"回复","6":"回应","7":"提到","9":"引用","11":"编辑","12":"发送","13":"收件","14":"待定"},"categories":{"all":"所有分类","all_subcategories":"全部","no_subcategory":"无","category":"分类","category_list":"显示分类列表","reorder":{"title":"重新分类排序","title_long":"重新对分类列表进行排序","fix_order":"固定排序","fix_order_tooltip":"不是所有分类都有单独的排序编号，可能能会导致出错。","save":"保存排序","apply_all":"应用","position":"位置"},"posts":"新帖","topics":"主题","latest":"最新","latest_by":"最新发表：","toggle_ordering":"排序控制","subcategories":"子分类","topic_sentence":{"other":"%{count} 主题"},"topic_stat_sentence":{"other":"在过去一%{unit}中有 %{count} 个新主题。"}},"ip_lookup":{"title":"IP 地址查询","hostname":"主机名","location":"位置","location_not_found":"(未知)","organisation":"组织","phone":"电话","other_accounts":"使用此 IP 地址的其他用户：","delete_other_accounts":"删除 %{count}","username":"用户名","trust_level":"信任等级","read_time":"阅读时间","topics_entered":"进入的主题","post_count":"# 帖子","confirm_delete_other_accounts":"确定要删除这些账户？"},"user_fields":{"none":"（选择一项）"},"user":{"said":"{{username}}：","profile":"个人资料","mute":"防打扰","edit":"修改设置","download_archive":"下载我的帖子","new_private_message":"发新私信","private_message":"私信","private_messages":"私信","activity_stream":"活动","preferences":"设置","expand_profile":"展开","bookmarks":"收藏","bio":"个人信息","invited_by":"邀请人","trust_level":"信任等级","notifications":"通知","statistics":"统计","desktop_notifications":{"label":"桌面通知","not_supported":"通知功能暂不支持该浏览器。抱歉。","perm_default":"启用通知","perm_denied_btn":"拒绝授权","perm_denied_expl":"你拒绝了通知提醒的权限。设置浏览器以启用通知提醒。","disable":"停用通知","enable":"启用通知","each_browser_note":"注意：你必须在你使用的所用浏览器中更改这项设置。"},"dismiss_notifications":"忽略所有","dismiss_notifications_tooltip":"标记所有未读通知为已读","disable_jump_reply":"回复后不跳转至新帖子","dynamic_favicon":"在浏览器图标中显示主题更新数量","external_links_in_new_tab":"在新标签页打开外部链接","enable_quoting":"在选择文字时显示引用回复按钮","change":"修改","moderator":"{{user}}是版主","admin":"{{user}}是管理员","moderator_tooltip":"用户是版主","admin_tooltip":"用户是管理员","blocked_tooltip":"这个用户已被封禁","suspended_notice":"该用户将被禁止登录，直至 {{date}}。","suspended_reason":"原因：","github_profile":"Github","email_activity_summary":"活动摘要","mailing_list_mode":{"label":"邮件列表模式","enabled":"启用邮件列表模式","instructions":"此设置将覆盖活动摘要。\u003cbr /\u003e\n静音主题和分类不包含在这些邮件中。\n","daily":"发送每日更新","individual":"为每个新帖发送一封邮件通知","many_per_day":"为每个新帖给我发送邮件 (大约每天 {{dailyEmailEstimate}} 封)","few_per_day":"为每个新帖给我发送邮件 (大约每天 2 封 )"},"tag_settings":"标签","watched_tags":"监看","watched_tags_instructions":"你将自动监看有这些标签的所有主题。你将会收到所有新的帖子和主题的通知，新帖数量也会显示在主题旁边。","tracked_tags":"跟踪","tracked_tags_instructions":"你将自动跟踪这些标签的所有主题，新帖数量将会显示在主题旁边。","muted_tags":"静音","muted_tags_instructions":"你将不会收到有这些标签的任何新主题通知，它们也不会出现在最新主题列表。","watched_categories":"监看","watched_categories_instructions":"你将自动监看这些分类中的所有主题。你将会收到所有新的帖子和主题通知，新帖数量也将显示在主题旁边。","tracked_categories":"跟踪","tracked_categories_instructions":"你将自动跟踪这些分类中的所有主题。新帖数量将会显示在主题旁边。","watched_first_post_categories":"监看头一帖","watched_first_post_categories_instructions":"在这些分类里面，每一个新主题的头一帖，将通知你。","watched_first_post_tags":"监看头一帖","watched_first_post_tags_instructions":"在有了这些标签的每一个新主题，你将会收到头一帖通知。","muted_categories":"静音","muted_categories_instructions":"在这些分类里面，你将不会收到任何新主题通知，它们也不会出现在最新主题列表。","delete_account":"删除我的帐号","delete_account_confirm":"你真的要永久删除自己的账号吗？删除之后无法恢复！","deleted_yourself":"你的帐号已被删除。","delete_yourself_not_allowed":"你目前不能删除自己的帐号。联系管理员帮助你删除帐号。","unread_message_count":"消息","admin_delete":"删除","users":"用户","muted_users":"静音","muted_users_instructions":"抑制来自这些用户的所有通知。","muted_topics_link":"显示已静音的主题","watched_topics_link":"显示已监看的主题","automatically_unpin_topics":"当我完整阅读了主题时自动解除置顶。","staff_counters":{"flags_given":"采纳标记","flagged_posts":"被标记","deleted_posts":"已删除","suspensions":"禁用","warnings_received":"警告"},"messages":{"all":"所有","inbox":"收件箱","sent":"已发送","archive":"存档","groups":"我的小组","bulk_select":"选择消息","move_to_inbox":"移动到收件箱","move_to_archive":"存档","failed_to_move":"移动选中消息失败（可能你的网络出问题了）","select_all":"全选"},"change_password":{"success":"（邮件已发送）","in_progress":"（正在发送邮件）","error":"（错误）","action":"发送密码重置邮件","set_password":"设置密码"},"change_about":{"title":"更改个人信息","error":"提交修改时出错了"},"change_username":{"title":"更换用户名","confirm":"确定更换用户名？你的帖子和@提及你的引用将失效。","taken":"抱歉，此用户名已经有人使用了。","error":"修改你的用户名时出错了。","invalid":"此用户名不合法，用户名只能包含字母和数字"},"change_email":{"title":"更换邮箱","taken":"抱歉，此邮箱不可用。","error":"修改你的邮箱时出错了，可能邮箱已经被使用了？","success":"我们已经发送了一封确认信到该邮箱，请按照邮箱内指示完成确认。"},"change_avatar":{"title":"更换头像","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e头像，基于：","gravatar_title":"在 Gravatar 网站上更改你的头像","refresh_gravatar_title":"刷新你的 Gravatar 头像","letter_based":"默认头像","uploaded_avatar":"自定义图片","uploaded_avatar_empty":"上传自定义图片","upload_title":"上传图片","upload_picture":"上传图片","image_is_not_a_square":"注意：图片不是正方形的，我们裁剪了部分图像。","cache_notice":"更改了头像成功，但是鉴于浏览器缓存可能需要一段时间后才会生效。"},"change_profile_background":{"title":"个人资料背景","instructions":"显示在个人资料页面中，上传的图片将被居中且默认宽度为 850px。"},"change_card_background":{"title":"用户卡片背景","instructions":"显示在用户卡片中，上传的图片将被居中且默认宽度为 590px。"},"email":{"title":"邮箱","instructions":"不会公开显示","ok":"将通过邮件验证确认","invalid":"请填写正确的邮箱地址","authenticated":"邮箱已经由 {{provider}} 验证了。","frequency_immediately":"如果你没有阅读过摘要邮件中的相关内容，将立即发送电子邮件给你。","frequency":{"other":"仅在 {{count}} 分钟内没有访问时发送邮件给你。"}},"name":{"title":"昵称","instructions":"你的昵称（可选）","instructions_required":"你的昵称","too_short":"昵称过短","ok":"昵称可用"},"username":{"title":"用户名","instructions":"你注册的用户名","short_instructions":"其他人可以用 @{{username}} 来提及你","available":"用户名可用","global_match":"邮箱与用户名匹配","global_mismatch":"已被占用。试试 {{suggestion}} ？","not_available":"不可用。试试 {{suggestion}} ？","too_short":"用户名过短","too_long":"用户名过长","checking":"查看用户名是否可用...","enter_email":"找到此用户，请输入对应邮箱","prefilled":"邮箱与用户匹配成功"},"locale":{"title":"界面语言","instructions":"用户界面语言。将在你刷新页面后改变。","default":"默认"},"password_confirmation":{"title":"请再次输入密码"},"last_posted":"最后发帖","last_emailed":"最后邮寄","last_seen":"最后活动","created":"加入时间","log_out":"登出","location":"地点","card_badge":{"title":"用户卡片徽章"},"website":"网站","email_settings":"邮箱","like_notification_frequency":{"title":"用户被赞时通知提醒","always":"始终","first_time_and_daily":"每天首个被赞","first_time":"历史首个被赞","never":"从不"},"email_previous_replies":{"title":"邮件底部包含历史回复","unless_emailed":"首次","always":"始终","never":"从不"},"email_digests":{"title":"长期未访问时发送热门主题和回复的摘要邮件","every_30_minutes":"每半小时","every_hour":"每小时","daily":"每天","every_three_days":"每三天","weekly":"每周","every_two_weeks":"每两周"},"include_tl0_in_digests":"摘要邮件中包含新用户的内容","email_in_reply_to":"邮件中包含回复你的内容节选","email_direct":"当有人引用和回复我的帖子、@我或邀请我至主题时，发送邮件提醒","email_private_messages":"有人发消息给我时邮件提醒","email_always":"即使我在论坛中活跃时也发送邮件提醒","other_settings":"其它","categories_settings":"分类","new_topic_duration":{"label":"近期主题条件：","not_viewed":"未读主题","last_here":"上次访问后发布","after_1_day":"一天内发布","after_2_days":"两天内发布","after_1_week":"一周内发布","after_2_weeks":"两周内发布"},"auto_track_topics":"自动跟踪我浏览的主题","auto_track_options":{"never":"从不","immediately":"立即","after_30_seconds":"30秒后","after_1_minute":"1分钟后","after_2_minutes":"2分钟后","after_3_minutes":"3分钟后","after_4_minutes":"4分钟后","after_5_minutes":"5分钟后","after_10_minutes":"10分钟后"},"invited":{"search":"输入以搜索邀请...","title":"邀请","user":"邀请用户","sent":"已发送","none":"没有未接受状态的邀请。","truncated":{"other":"只显示前 {{count}} 个邀请。"},"redeemed":"确认邀请","redeemed_tab":"已确认","redeemed_tab_with_count":"已确认（{{count}}）","redeemed_at":"已确认","pending":"待验证邀请","pending_tab":"等待中","pending_tab_with_count":"待确认（{{count}}）","topics_entered":"已阅主题","posts_read_count":"已读帖子","expired":"邀请已过期。","rescind":"移除","rescinded":"邀请已删除","reinvite":"重新发送邀请","reinvite_all":"重发所有邀请","reinvited":"邀请已重新发送","reinvited_all":"所有邀请已重新发送！","time_read":"阅读时间","days_visited":"访问天数","account_age_days":"账号建立天数","create":"发送邀请","generate_link":"复制邀请链接","generated_link_message":"\u003cp\u003e邀请链接成功生成！\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003e邀请链接仅对下列邮件地址有效：\u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"你从未邀请过他人。你可以发送单个邀请，或者\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e上传批量邀请文件\u003c/a\u003e一次邀请多人。","text":"通过文件批量邀请","uploading":"上传中...","success":"文件上传成功，当操作完成时将通过消息通知你。","error":"在上传 '{{filename}}' 时出现错误：{{message}}"}},"password":{"title":"密码","too_short":"密码过短","common":"密码过于简单","same_as_username":"密码不能与用户名相同","same_as_email":"密码不能与邮箱相同","ok":"密码符合要求","instructions":"至少 %{count} 个字符"},"summary":{"title":"概要","stats":"统计","time_read":"阅读时间","topic_count":{"other":"创建的主题"},"post_count":{"other":"发表的帖子"},"likes_given":{"other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e 送出赞"},"likes_received":{"other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e 获得赞"},"days_visited":{"other":"访问天数"},"posts_read":{"other":"阅读帖子"},"bookmark_count":{"other":"收藏"},"top_replies":"热门回复","no_replies":"暂无回复。","more_replies":"更多回复","top_topics":"热门主题","no_topics":"暂无主题。","more_topics":"更多主题","top_badges":"热门徽章","no_badges":"暂无徽章。","more_badges":"更多徽章","top_links":"热门链接","no_links":"暂无链接","most_liked_by":"谁赞最多","most_liked_users":"赞谁最多","most_replied_to_users":"最多回复至","no_likes":"暂无赞"},"associated_accounts":"登录","ip_address":{"title":"最后使用的 IP 地址"},"registration_ip_address":{"title":"注册 IP 地址"},"avatar":{"title":"头像","header_title":"个人页面、消息、书签和设置"},"title":{"title":"头衔"},"filters":{"all":"全部"},"stream":{"posted_by":"发送人","sent_by":"发送时间","private_message":"私信","the_topic":"本主题"}},"loading":"载入中...","errors":{"prev_page":"无法载入","reasons":{"network":"网络错误","server":"服务器出错","forbidden":"禁止访问","unknown":"错误","not_found":"页面不存在"},"desc":{"network":"请检查网络状态","network_fixed":"网络似乎恢复正常了","server":"错误代码：{{status}}","forbidden":"好像不能进行此操作","not_found":"没有这个页面","unknown":"出了点小问题"},"buttons":{"back":"返回","again":"重试","fixed":"载入"}},"close":"关闭","assets_changed_confirm":"网站刚更新了，刷新使用新版本？","logout":"你已登出用户。","refresh":"刷新","read_only_mode":{"enabled":"站点正处于只读模式。你可以继续浏览，但是回复、赞和其他操作暂时被禁用。","login_disabled":"只读模式下不允许登录。","logout_disabled":"站点在只读模式下无法登出。"},"too_few_topics_and_posts_notice":"让我们\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e开始讨论！\u003c/a\u003e目前有 \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e 个主题和 \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e 个帖子。新访客需要能够阅读和回复一些讨论。","too_few_topics_notice":"让我们\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e开始讨论！\u003c/a\u003e目前有 \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e 个主题。新访客需要能够阅读和回复一些讨论。","too_few_posts_notice":"让我们\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e开始讨论！\u003c/a\u003e目前有 \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e 个帖子。新访客需要能够阅读和回复一些讨论。","logs_error_rate_notice":{"rate":{"other":"%{count} 错误/%{duration}"}},"learn_more":"了解更多...","year":"年","year_desc":"365 天内创建的主题","month":"月","month_desc":"30 天内创建的主题","week":"周","week_desc":"7 天内创建的主题","day":"天","first_post":"头一帖","mute":"静音","unmute":"取消静音","last_post":"最后帖","last_reply_lowercase":"最后回复","replies_lowercase":{"other":"回复"},"signup_cta":{"sign_up":"注册","hide_session":"明天提醒我","hide_forever":"不了","hidden_for_session":"好的，我会在明天提醒你。不过你随时都可以使用“登录”来创建账户。","intro":"你好！:heart_eyes: 看起来你挺喜欢这样的讨论，可是你还没有注册账户。","value_prop":"当你创建账户后，我们可以准确地记录你的阅读进度，这样你能够在下一次访问时回到你上次阅读到的地方。你也可以选择接受新帖子的网页和邮件通知。并且你可以赞任何帖子来分享你的感谢。:heartbeat:"},"summary":{"enabled_description":"你正在查看主题的精简摘要版本：一些社群公认有意思的帖子。","description":"有 \u003cb\u003e{{replyCount}}\u003c/b\u003e 个回复。","description_time":"有 \u003cb\u003e{{replyCount}}\u003c/b\u003e 个回复，大约要花 \u003cb\u003e{{readingTime}} 分钟\u003c/b\u003e阅读。","enable":"概括本主题","disable":"显示所有帖子"},"deleted_filter":{"enabled_description":"这个主题包含已删除的帖子，他们已经被隐藏。","disabled_description":"显示了主题中已删除的帖子。","enable":"隐藏已删除的帖子","disable":"显示已删除的帖子"},"private_message_info":{"title":"私信","invite":"邀请其他...","remove_allowed_user":"确定将 {{name}} 从本条消息中移除？","remove_allowed_group":"确定将 {{name}} 从本条消息中移除？"},"email":"邮箱","username":"用户名","last_seen":"最后活动","created":"创建时间","created_lowercase":"创建时间","trust_level":"用户级别","search_hint":"用户名、电子邮件或 IP 地址","create_account":{"title":"创建用户","failed":"出问题了，有可能这个邮箱已经被注册了。试试忘记密码链接？"},"forgot_password":{"title":"重置密码","action":"我忘记了我的密码","invite":"输入你的用户名或邮箱地址，我们会发送密码重置邮件给你。","reset":"重置密码","complete_username":"如果你的账户名 \u003cb\u003e%{username}\u003c/b\u003e 存在，你将马上收到一封电子邮件，以重置密码。","complete_email":"如果你的账户 \u003cb\u003e%{email}\u003c/b\u003e 存在，你将马上收到一封电子邮件，以重置密码。","complete_username_found":"你的账户名 \u003cb\u003e%{username}\u003c/b\u003e 存在，你将马上收到一封电子邮件，以重置密码。","complete_email_found":"你的账户 \u003cb\u003e%{email}\u003c/b\u003e 存在，你将马上收到一封电子邮件，以重置密码。","complete_username_not_found":"没有找到用户 \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"没有找到用户 \u003cb\u003e%{email}\u003c/b\u003e "},"login":{"title":"登录","username":"用户","password":"密码","email_placeholder":"电子邮件或者用户名","caps_lock_warning":"大写锁定开启","error":"出错了","rate_limit":"请请稍后再重试","blank_username_or_password":"请输入你的邮件地址或用户名，以及密码。","reset_password":"重置密码","logging_in":"登录中...","or":"或","authenticating":"验证中...","awaiting_confirmation":"你的帐号尚未激活，点击忘记密码链接以重新发送激活邮件。","awaiting_approval":"你的帐号尚未被论坛版主审核。请等待一段时间，当你的帐号被审核时会收到一封电子邮件。","requires_invite":"抱歉，本论坛仅接受邀请注册。","not_activated":"你还不能登录。我们已经发送了一封邮件至 \u003cb\u003e{{sentTo}}\u003c/b\u003e，请打开它并完成账号激活。","not_allowed_from_ip_address":"你使用的 IP 地址已被封禁。","admin_not_allowed_from_ip_address":"你不能从这个 IP 地址以管理员身份登录。","resend_activation_email":"点击此处重新发送激活邮件。","sent_activation_email_again":"我们又向 \u003cb\u003e{{currentEmail}}\u003c/b\u003e 发送了一封激活邮件，邮件送达可能需要几分钟；请检查一下你邮箱的垃圾邮件文件夹。","to_continue":"请登录","preferences":"需要登入后更改设置","forgot":"我记不清账号详情了","google":{"title":"使用 Google 帐号登录","message":"正在通过 Google 帐号验证登录（请确保浏览器没有禁止弹出窗口）"},"google_oauth2":{"title":"使用 Google 帐号登录","message":"正在通过 Google 帐号验证登录（请确保浏览器没有禁止弹出窗口）"},"twitter":{"title":"使用 Twitter 帐号登录","message":"正在通过 Twitter 帐号验证登录（请确保浏览器没有禁止弹出窗口）"},"instagram":{"title":"用 Instagram 登录","message":"正在通过 Instagram 帐号验证登录（请确保浏览器没有禁止弹出窗口）"},"facebook":{"title":"使用 Facebook 帐号登录","message":"正在通过 Facebook 帐号验证登录（请确保浏览器没有禁止弹出窗口）"},"yahoo":{"title":"使用 Yahoo 帐号登录","message":"正在通过 Yahoo 帐号验证登录（请确保浏览器没有禁止弹出窗口）"},"github":{"title":"使用 GitHub 帐号登录","message":"正在通过 GitHub 帐号验证登录（请确保浏览器没有禁止弹出窗口）"}},"emoji_set":{"apple_international":"Apple/国际化","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"更多…","options":"选项","whisper":"密语","add_warning":"正式警告","toggle_whisper":"折叠或展开密语","posting_not_on_topic":"你想回复哪一个主题？","saving_draft_tip":"保存中...","saved_draft_tip":"已保存","saved_local_draft_tip":"已本地保存","similar_topics":"你的主题有点类似于...","drafts_offline":"离线草稿","duplicate_link":"似乎你的链接 \u003cb\u003e{{domain}}\u003c/b\u003e 在\u003ca href='{{post_url}}'\u003e{{ago}}\u003c/a\u003e已经由\u003cb\u003e@{{username}}\u003c/b\u003e回复了 － 确定再次提交吗？","error":{"title_missing":"标题为空","title_too_short":"标题过短，至少 {{min}} 个字","title_too_long":"标题过长，最多 {{max}} 个字","post_missing":"帖子不能为空","post_length":"帖子至少应有 {{min}} 个字","try_like":"试试 \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e 按钮？","category_missing":"未选择分类"},"save_edit":"保存编辑","reply_original":"回复原始主题","reply_here":"在此回复","reply":"回复","cancel":"取消","create_topic":"创建主题","create_pm":"私信","title":"或 Ctrl + 回车","users_placeholder":"添加用户","title_placeholder":"一句话告诉讨论什么...","edit_reason_placeholder":"编辑理由","show_edit_reason":"添加理由","reply_placeholder":"在此键入。使用Markdown，BBCode，或HTML格式。可拖拽或粘贴图片。","view_new_post":"浏览新帖。","saving":"保存中","saved":"已保存！","saved_draft":"帖子还没发表，点击继续","uploading":"上传中...","show_preview":"显示预览 \u0026raquo;","hide_preview":"\u0026laquo; 隐藏预览","quote_post_title":"引用整个帖子","bold_title":"加粗","bold_text":"加粗示例","italic_title":"斜体","italic_text":"斜体示例","link_title":"链接","link_description":"输入链接描述","link_dialog_title":"插入链接","link_optional_text":"可选标题","link_url_placeholder":"http://example.com","quote_title":"引用","quote_text":"引用","code_title":"预格式化文本","code_text":"文字缩进 4 格","paste_code_text":"输入或粘贴代码","upload_title":"上传","upload_description":"在此输入上传资料的描述","olist_title":"数字列表","ulist_title":"符号列表","list_item":"列表条目","heading_title":"标题","heading_text":"标题头","hr_title":"分割线","help":"Markdown 编辑帮助","toggler":"隐藏或显示编辑面板","modal_ok":"确认","modal_cancel":"取消","cant_send_pm":"抱歉，你不能向 %{username} 发送消息。","admin_options_title":"本主题可选设置","auto_close":{"label":"自动关闭主题时间：","error":"请输入一个有效值。","based_on_last_post":"以最后回复的时间开始计时","all":{"examples":"输入小时数（24），绝对时间（17:30）或时间戳（2013-11-22 14:00）。"},"limited":{"units":"(# 小时数）","examples":"输入小时数（24）。"}}},"notifications":{"title":"使用@提到你，回复你的内容、消息以及其他的通知","none":"现在无法载入通知","empty":"未发现通知","more":"看历史通知","total_flagged":"被标记帖子的总数","mentioned":"\u003ci title='被提及' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='小组被提及' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='引用' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='回复' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='回复' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='编辑' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='赞' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='赞' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}、{{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"other":"\u003ci title='赞' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}、{{username2}}\u003c/span\u003e和其他 {{count}} 人\u003c/span\u003e{{description}}\u003c/p\u003e"},"private_message":"\u003ci title='私信' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='私信' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='邀请至主题' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='已接受你的邀请' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e已接受你的邀请\u003c/p\u003e","moved_post":"\u003ci title='移动了帖子' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e移动了{{description}}\u003c/p\u003e","linked":"\u003ci title='关联帖子' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}\u003c/p\u003e","granted_badge":"\u003ci title='徽章授予' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003e获得“{{description}}”\u003c/p\u003e","watching_first_post":"\u003ci title='新主题' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e新主题\u003c/span\u003e{{description}}\u003c/p\u003e","group_message_summary":{"other":"\u003ci title='小组收件箱中的消息' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} 条消息在{{group_name}}组的收件箱中\u003c/p\u003e"},"alt":{"mentioned":"被提及","quoted":"被引用","replied":"回复","posted":"发自","edited":"编辑你的帖子","liked":"赞了你的帖子","private_message":"私信来自","invited_to_private_message":"私信邀请自","invited_to_topic":"主题邀请自","invitee_accepted":"介绍邀请自","moved_post":"你的帖子被移动自","linked":"链接至你的帖子","granted_badge":"勋章授予","group_message_summary":"在小组收件箱中的消息"},"popup":{"mentioned":"{{username}}在“{{topic}}”提到了你 - {{site_title}}","group_mentioned":"{{username}}在“{{topic}}”提到了你 - {{site_title}}","quoted":"{{username}}在“{{topic}}”引用了你的帖子 - {{site_title}}","replied":"{{username}}在“{{topic}}”回复了你 - {{site_title}}","posted":"{{username}}在“{{topic}}”中发布了帖子 - {{site_title}}","private_message":"{{username}}在“{{topic}}”中给你发送了一个私信 - {{site_title}}","linked":"{{username}}在“{{topic}}”中链接了你的帖子 - {{site_title}}"}},"upload_selector":{"title":"插入图片","title_with_attachments":"上传图片或文件","from_my_computer":"来自我的设备","from_the_web":"来自网络","remote_tip":"图片链接","remote_tip_with_attachments":"链接到图片或文件 {{authorized_extensions}}","local_tip":"从你的设备中选择图片","local_tip_with_attachments":"从你的设备 {{authorized_extensions}} 选择图片或文件","hint":"你也可以通过拖放至编辑器的方式来上传","hint_for_supported_browsers":"可以拖放或复制粘帖至编辑器以上传","uploading":"上传中","select_file":"选择文件","image_link":"链接图片到"},"search":{"sort_by":"排序","relevance":"最相关","latest_post":"最后发帖","most_viewed":"最多阅读","most_liked":"最多赞","select_all":"全选","clear_all":"清除所有","too_short":"你的搜索词太短。","result_count":{"other":"搜索\u003cspan class='term'\u003e“{{term}}”\u003c/span\u003e有 {{count}} 条相关结果"},"title":"搜索主题、帖子、用户或分类","no_results":"没有找到结果。","no_more_results":"没有找到更多结果。","search_help":"搜索帮助","searching":"搜索中...","post_format":"#{{post_number}} 来自于 {{username}}","context":{"user":"搜索 @{{username}} 的帖子","category":"搜索 #{{category}} 分类","topic":"只搜索本主题","private_messages":"搜索消息"}},"hamburger_menu":"转到另一个主题列表或分类","new_item":"新","go_back":"返回","not_logged_in_user":"显示当前活动和设置的用户页面","current_user":"转到用户页面","topics":{"bulk":{"unlist_topics":"未在列表的主题","reset_read":"设为未读","delete":"删除主题","dismiss":"忽略","dismiss_read":"忽略所有未读主题","dismiss_button":"忽略...","dismiss_tooltip":"仅忽略新帖子或停止跟踪主题","also_dismiss_topics":"停止追踪这些主题，这样这些主题就不再显示为未读了","dismiss_new":"设为已读","toggle":"切换至批量选择","actions":"批量操作","change_category":"更改分类","close_topics":"关闭主题","archive_topics":"存档主题","notification_level":"更改通知等级","choose_new_category":"选择新分类：","selected":{"other":"已选择 \u003cb\u003e{{count}}\u003c/b\u003e个主题"},"change_tags":"修改标签","choose_new_tags":"为主题选择新标签：","changed_tags":"主题的标签被修改"},"none":{"unread":"你没有未读主题。","new":"你没有新主题可读。","read":"你尚未阅读任何主题。","posted":"你尚未在任何主题中发帖。","latest":"没有新的主题。","hot":"没有热门主题。","bookmarks":"你没有收藏任何主题。","category":"{{category}}分类中没有主题。","top":"没有最佳主题。","search":"没有搜索结果。","educate":{"new":"\u003cp\u003e这里显示了近期主题列表。\u003c/p\u003e\u003cp\u003e默认情况下，以下主题将显示在近期列表。如果是最近 2 天内创建的，还会显示一个\u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003e近期\u003c/span\u003e标志。\u003cp\u003e你可以在\u003ca href=\"%{userPrefsUrl}\"\u003e用户设置\u003c/a\u003e中更改要显示哪些内容。\u003c/p\u003e","unread":"\u003cp\u003e这里显示你的未读主题。\u003c/p\u003e\u003cp\u003e默认情况下，下述主题会被放在未读中。并且会在旁边显示未读的数量\u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e。如果你：\u003c/p\u003e\u003cul\u003e\u003cli\u003e创建了该主题\u003c/li\u003e\u003cli\u003e回复了该主题\u003c/li\u003e\u003cli\u003e阅读该主题超过 4 分钟\u003c/li\u003e\u003c/ul\u003e\u003cp\u003e或者你在主题底部的通知控制中选择了跟踪或监看。\u003c/p\u003e\u003cp\u003e你可以在\u003ca href=\"%{userPrefsUrl}\"\u003e用户设置\u003c/a\u003e中修改未读设置。\u003c/p\u003e"}},"bottom":{"latest":"没有更多主题可看了。","hot":"没有更多热门主题可看了。","posted":"没有更多已发布主题可看了。","read":"没有更多已阅主题可看了。","new":"没有更多新主题可看了。","unread":"没有更多未读主题了。","category":"没有更多{{category}}分类的主题了。","top":"没有更多最佳主题了。","bookmarks":"没有更多收藏的主题了。","search":"没有更多搜索结果了。"}},"topic":{"unsubscribe":{"stop_notifications":"你将收到更少的关于\u003cstrong\u003e{{title}}\u003c/strong\u003e的通知","change_notification_state":"你现在的通知状态是"},"filter_to":{"other":"本主题中的 {{count}} 帖"},"create":"发新主题","create_long":"创建新的主题","private_message":"开始发私信","archive_message":{"help":"移动消息到存档","title":"存档"},"move_to_inbox":{"title":"移动到收件箱","help":"移动消息到收件箱"},"list":"主题","new":"新主题","unread":"未读","new_topics":{"other":"{{count}} 新主题"},"unread_topics":{"other":"{{count}} 未读主题"},"title":"主题","invalid_access":{"title":"这是私密主题","description":"抱歉，你没有没有权限浏览此主题。","login_required":"此主题需要登录后浏览。"},"server_error":{"title":"载入主题失败","description":"抱歉，无法载入主题。网络连接可能出问题了。请重试一次。如果始终无法加载，请联系我们。"},"not_found":{"title":"未找到主题","description":"抱歉，无法找到此主题。可能已经被删除了。"},"total_unread_posts":{"other":"这个主题中，你有 {{count}} 条未读的帖子"},"unread_posts":{"other":"这个主题中，你有 {{count}} 条未读的帖子"},"new_posts":{"other":"自你上一次阅读此主题后，又有 {{count}} 个新帖子发表了"},"likes":{"other":"本主题已得到 {{number}} 个赞"},"back_to_list":"返回列表","options":"主题选项","show_links":"显示此主题中的链接","toggle_information":"切换主题详情","read_more_in_category":"想阅读更多？浏览{{catLink}}中的其他主题，或{{latestLink}}。","read_more":"想阅读更多？{{catLink}}或{{latestLink}}。","browse_all_categories":"浏览所有分类","view_latest_topics":"查阅最新主题","suggest_create_topic":"创建一个新的主题吧！","jump_reply_up":"转到更早的回复","jump_reply_down":"转到更新的回复","deleted":"此主题已被删除","auto_close_notice":"本主题将在%{timeLeft}自动关闭。","auto_close_notice_based_on_last_post":"在最后一个帖子 %{duration} 无人回复关闭帖子的时间。","auto_close_title":"自动关闭设置","auto_close_save":"保存","auto_close_remove":"不要自动关闭该主题","timeline":{"back":"返回","back_description":"回到最后一个未读帖子","replies_short":"%{current} / %{total}"},"progress":{"title":"主题进度","go_top":"顶部","go_bottom":"底部","go":"前往","jump_bottom":"跳至最后一个帖子","jump_prompt":"跳至帖子","jump_prompt_long":"你想跳转至哪一贴？","jump_bottom_with_number":"跳至第 %{post_number} 帖","total":"全部帖子","current":"当前帖子"},"notifications":{"title":"改变你收到该主题通知的频率","reasons":{"mailing_list_mode":"邮件列表模式已启用，将以邮件通知你关于该主题的回复。","3_10":"因为你正监看该主题上的标签，你将会收到通知。","3_6":"因为你正在监看该分类，你将会收到通知。","3_5":"因为你开始自动监看该主题，你将会收到通知。","3_2":"因为你正在监看该主题，你将会收到通知。","3_1":"因为你创建了这个主题，你将会收到通知。","3":"因为你正在监看该主题，你将会收到通知。","2_8":"因为你正在跟踪该分类，你将收到通知。","2_4":"因为你在该主题内发表了回复，所以你将收到相关通知。","2_2":"因为你正在跟踪该主题，你将收到通知。","2":"因为你\u003ca href=\"/users/{{username}}/preferences\"\u003e阅读了该主题\u003c/a\u003e，所以你将收到相关通知。","1_2":"如果有人提及你的 @名字或回复你，将通知你。","1":"如果有人提及你的 @名字或回复你，将通知你。","0_7":"你将忽略关于该分类的所有通知。","0_2":"你将忽略关于该主题的所有通知。","0":"你将忽略关于该主题的所有通知。"},"watching_pm":{"title":"监看","description":"消息有新回复时提醒我，并显示新回复数量。"},"watching":{"title":"监看","description":"在此主题里，每一个新回复将通知你，还将显示新回复的数量。"},"tracking_pm":{"title":"跟踪","description":"在消息标题后显示新回复数量。你只会在别人@你或回复你的帖子时才会收到通知。"},"tracking":{"title":"跟踪","description":"将为该主题显示新回复的数量。如果有人提及你的 @名字或回复你，将通知你。"},"regular":{"title":"普通","description":"如果有人提及你的 @名字或回复你，将通知你。"},"regular_pm":{"title":"普通","description":"如果有人提及你的 @名字或回复你，将通知你。"},"muted_pm":{"title":"静音","description":"不会收到该消息的任何通知。"},"muted":{"title":"静音","description":"你不会收到此主题的任何通知，它也不会出现在最新主题列表。"}},"actions":{"recover":"撤销删除主题","delete":"删除主题","open":"打开主题","close":"关闭主题","multi_select":"选择帖子...","auto_close":"自动关闭...","pin":"置顶主题...","unpin":"取消置顶主题...","unarchive":"取消存档主题","archive":"存档主题","invisible":"隐藏主题","visible":"取消隐藏主题","reset_read":"重置阅读数据","make_public":"设置为公共主题","make_private":"设置为私信"},"feature":{"pin":"置顶主题","unpin":"取消置顶主题","pin_globally":"全局置顶主题","make_banner":"横幅主题","remove_banner":"取消横幅主题"},"reply":{"title":"回复","help":"开始为该主题撰写回复"},"clear_pin":{"title":"取消置顶","help":"取消本主题的置顶状态，将不再固定显示在主题列表顶部。"},"share":{"title":"分享","help":"分享指向这个主题的链接"},"flag_topic":{"title":"标记","help":"背地里标记该帖以示警示，或发送关于它的私下通知","success_message":"你已经成功标记该主题。"},"feature_topic":{"title":"置顶主题","pin":"将该主题置于{{categoryLink}}分类最上方至","confirm_pin":"已有{{count}}个置顶主题。太多的置顶主题可能会困扰新用户和访客。确定想在该分类再置顶一个主题？","unpin":"从{{categoryLink}}分类最上方移除主题。","unpin_until":"从{{categoryLink}}分类最上方移除主题或者移除于\u003cstrong\u003e%{until}\u003c/strong\u003e。","pin_note":"允许用户取消置顶。","pin_validation":"置顶该主题需要一个日期。","not_pinned":"{{categoryLink}}没有置顶主题。","already_pinned":{"other":"{{categoryLink}}分类的置顶主题数：\u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"将主题置于所有主题列表最上方至","confirm_pin_globally":"已有{{count}}个全局置顶主题。太多的置顶主题可能会困扰新用户和访客。确定想再全局置顶一个主题？","unpin_globally":"将主题从所有主题列表的最上方移除。","unpin_globally_until":"从所有主题列表最上方移除主题或者移除于\u003cstrong\u003e%{until}\u003c/strong\u003e。","global_pin_note":"允许用户取消全局置顶。","not_pinned_globally":"没有全局置顶的主题。","already_pinned_globally":{"other":"全局置顶的主题数：\u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"将主题设置为出现在所有页面顶端的横幅主题。","remove_banner":"移除所有页面顶端的横幅主题。","banner_note":"用户能点击关闭隐藏横幅。且只能设置一个横幅主题。","no_banner_exists":"没有横幅主题。","banner_exists":"当前\u003cstrong class='badge badge-notification unread'\u003e设置\u003c/strong\u003e了横幅主题。"},"inviting":"邀请中...","automatically_add_to_groups":"邀请将把用户加入小组：","invite_private":{"title":"邀请至消息","email_or_username":"受邀人的邮箱或用户名","email_or_username_placeholder":"电子邮件地址或者用户名","action":"邀请","success":"成功邀请了用户至该消息。","success_group":"成功邀请了小组至该消息。","error":"抱歉，邀请时出了点小问题。","group_name":"小组名"},"controls":"主题控制操作","invite_reply":{"title":"邀请","username_placeholder":"用户名","action":"发送邀请","help":"通过电子邮件或通知邀请其他人到该主题","to_forum":"将发送一封简洁的邮件，让你的朋友无需注册即可用链接参与讨论。","sso_enabled":"输入其用户名，邀请其人到本主题。","to_topic_blank":"输入其用户名或者 Email 地址，邀请其人到本主题。","to_topic_email":"你输入了邮箱地址。我们将发送一封邮件邀请，让你的朋友可直接回复该主题。","to_topic_username":"你输入了用户名。我们将发送一个至该主题链接的邀请通知。","to_username":"输入你想邀请的人的用户名。我们将发送一个至该主题链接的邀请通知。","email_placeholder":"name@example.com","success_email":"我们发了一封邮件邀请\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e。邀请被接受后你会收到通知。检查用户页中的邀请标签页来追踪你的邀请。","success_username":"我们已经邀请了该用户参与该主题。","error":"抱歉，我们不能邀请这个人。可能他已经被邀请了？（邀请有频率限制）"},"login_reply":"登录以回复","filters":{"n_posts":{"other":"{{count}} 个帖子"},"cancel":"取消过滤"},"split_topic":{"title":"拆分主题","action":"拆分主题","topic_name":"新主题名","error":"拆分主题时发生错误。","instructions":{"other":"你将创建一个新的主题，并包含你选择的 \u003cb\u003e{{count}}\u003c/b\u003e 个帖子。"}},"merge_topic":{"title":"合并主题","action":"合并主题","error":"合并主题时发生错误。","instructions":{"other":"请选择一个主题以便移动这 \u003cb\u003e{{count}}\u003c/b\u003e 个帖子。"}},"merge_posts":{"title":"合并选择的帖子","action":"合并选择的帖子","error":"合并选择的帖子试出错。"},"change_owner":{"title":"更改帖子作者","action":"更改作者","error":"更改帖子作者时发生错误。","label":"帖子的新作者","placeholder":"新作者的用户名","instructions":{"other":"请选择\u003cb\u003e{{old_user}}\u003c/b\u003e创建的 {{count}} 个帖子的新作者。"},"instructions_warn":"要注意关于帖子的通知不会被转移给新作者。\u003cbr\u003e警告：目前，与帖子关联的任何数据都不会转移至新用户。谨慎使用。"},"change_timestamp":{"title":"修改时间","action":"修改时间","invalid_timestamp":"不能是未来的时间。","error":"更改主题时间时发生错误。","instructions":"请为主题选择新的时间。主题中的所有帖子将按照相同的时间差更新。"},"multi_select":{"select":"选择","selected":"已选择（{{count}}）","select_replies":"选择以及回复其的帖子","delete":"删除所选","cancel":"取消选择","select_all":"全选","deselect_all":"全不选","description":{"other":"已选择 \u003cb\u003e{{count}}\u003c/b\u003e 个帖子。"}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"引述回复","edit":"编辑 {{replyAvatar}} {{username}}发表的{{link}}","edit_reason":"理由：","post_number":"帖子 {{number}}","last_edited_on":"最后修改于","reply_as_new_topic":"回复为联结主题","continue_discussion":"自 {{postLink}} 继续讨论：","follow_quote":"转到所引用的帖子","show_full":"显示所有帖子","show_hidden":"查看隐藏内容","deleted_by_author":{"other":"（帖子被作者删除，如无标记将在 %{count} 小时后自动删除）"},"expand_collapse":"展开/折叠","gap":{"other":"查看 {{count}} 个隐藏回复"},"unread":"未读帖子","has_replies":{"other":"{{count}} 回复"},"has_likes":{"other":"{{count}} 赞"},"has_likes_title":{"other":"{{count}} 人赞了该贴"},"has_likes_title_only_you":"你赞了该贴","has_likes_title_you":{"other":"你和其他 {{count}} 人赞了该贴"},"errors":{"create":"抱歉，在创建你的帖子时发生了错误。请重试。","edit":"抱歉，在编辑你的帖子时发生了错误。请重试。","upload":"抱歉，在上传文件时发生了错误。请重试。","file_too_large":"文件过大（最大 {{max_size_kb}}KB）。为什么不就大文件上传至云存储服务后再分享链接呢？","too_many_uploads":"抱歉，一次只能上传一张图片。","too_many_dragged_and_dropped_files":"抱歉，一次只能上传 10 个文件。","upload_not_authorized":"抱歉，你不能上传此类型文件（可上传的文件类型有：{{authorized_extensions}}）。","image_upload_not_allowed_for_new_user":"抱歉，新用户无法上传图片。","attachment_upload_not_allowed_for_new_user":"抱歉，新用户无法上传附件。","attachment_download_requires_login":"抱歉，你需要登录后才能下载附件。"},"abandon":{"confirm":"确定要放弃编辑帖子吗？","no_value":"否","yes_value":"是"},"via_email":"通过邮件发表的帖子","via_auto_generated_email":"通过自动生成邮件发表的帖子","whisper":"设置帖子为密语，只对版主可见","wiki":{"about":"这个帖子是可多人协作的帖子"},"archetypes":{"save":"保存选项"},"few_likes_left":"谢谢你的热情！你今天的赞快用完了。","controls":{"reply":"回复本帖","like":"赞一下此帖","has_liked":"已赞","undo_like":"取消赞","edit":"编辑本帖","edit_anonymous":"抱歉，需要登录后才能编辑该贴。","flag":"背地里标记该帖以示警示，或发送关于它的私下通知","delete":"删除本帖","undelete":"恢复本帖","share":"分享指向这个帖子的链接","more":"更多","delete_replies":{"confirm":{"other":"同时删除 {{count}} 个回复这个帖子的相关帖子么？"},"yes_value":"是，一并删除相关回复","no_value":"否，仅删除该帖"},"admin":"帖子管理","wiki":"成为维基","unwiki":"关闭多人协作","convert_to_moderator":"添加管理人员颜色标识","revert_to_regular":"移除管理人员颜色标识","rebake":"重建 HTML","unhide":"显示","change_owner":"更改作者"},"actions":{"flag":"标记","defer_flags":{"other":"推迟处理标记"},"undo":{"off_topic":"撤回标记","spam":"撤回标记","inappropriate":"撤回标记","bookmark":"取消收藏","like":"取消赞","vote":"撤销投票"},"people":{"off_topic":"标记为偏离主题","spam":"标记为垃圾信息","inappropriate":"不恰当的言辞","notify_moderators":"通知版主","notify_user":"发送私信","bookmark":"收藏","like":"赞了它","vote":"已投票"},"by_you":{"off_topic":"你标记其偏离主题","spam":"你标记其为垃圾信息","inappropriate":"你标记其为不恰当的言辞","notify_moderators":"你标记了本帖要求管理人员处理","notify_user":"你已经通知了该用户","bookmark":"你以收藏了该帖","like":"你赞了它","vote":"你已投票"},"by_you_and_others":{"off_topic":{"other":"你和其他 {{count}} 人标记其偏离主题"},"spam":{"other":"你和其他 {{count}} 人标记其为垃圾信息"},"inappropriate":{"other":"你和其他 {{count}} 人标记其为不恰当的言辞"},"notify_moderators":{"other":"你和其他 {{count}} 人标记了本帖要求管理人员处理"},"notify_user":{"other":"你和其他 {{count}} 人发了消息给该用户"},"bookmark":{"other":"你和其他 {{count}} 人收藏了这个帖子"},"like":{"other":"你和其他 {{count}} 人赞了它"},"vote":{"other":"你和其他 {{count}} 人已投票"}},"by_others":{"off_topic":{"other":"{{count}} 人标记其偏离主题"},"spam":{"other":"{{count}} 人标记其为垃圾信息"},"inappropriate":{"other":"{{count}} 人标记其为不恰当的言辞"},"notify_moderators":{"other":"{{count}} 人标记本帖要求管理人员处理"},"notify_user":{"other":"{{count}} 人给这个用户发送了消息"},"bookmark":{"other":"{{count}} 人收藏了这个帖子"},"like":{"other":"{{count}} 人赞了它"},"vote":{"other":"{{count}} 人已投票"}}},"delete":{"confirm":{"other":"确定要删除这些帖子吗？"}},"merge":{"confirm":{"other":"确定要合并这 {{count}} 个帖子吗？"}},"revisions":{"controls":{"first":"第一版","previous":"上一版","next":"下一版","last":"最新版","hide":"隐藏版本历史","show":"显示版本历史","revert":"还原至该版本","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"行内显示渲染后的页面，并标示增加和删除的内容","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"并排显示渲染后的页面，分开标示增加和删除的内容","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"并排显示源码，分开标示增加和删除的内容","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e 原始"}}}},"category":{"can":"能够\u0026hellip; ","none":"（未分类）","all":"所有分类","choose":"选择分类\u0026hellip;","edit":"编辑","edit_long":"编辑","view":"浏览分类的主题","general":"常规","settings":"设置","topic_template":"主题模板","tags":"标签","tags_allowed_tags":"仅在该分类内可以使用的标签","tags_allowed_tag_groups":"仅在该分类内可以使用的标签组","tags_placeholder":"（可选）允许使用的标签列表","tag_groups_placeholder":"（可选）允许使用的标签组列表","delete":"删除分类","create":"新分类","create_long":"创建新的分类","save":"保存分类","slug":"分类 Slug","slug_placeholder":"（可选）用于分类的 URL","creation_error":"创建此分类时发生了错误。","save_error":"在保存此分类时发生了错误。","name":"分类名称","description":"描述","topic":"分类主题","logo":"分类标志图片","background_image":"分类背景图片","badge_colors":"徽章颜色","background_color":"背景色","foreground_color":"前景色","name_placeholder":"应该简明扼要。","color_placeholder":"任何网页颜色","delete_confirm":"你确定要删除此分类吗？","delete_error":"在删除此分类时发生了错误。","list":"列出分类","no_description":"请为本分类添加描述信息。","change_in_category_topic":"访问分类主题来编辑描述信息","already_used":"此色彩已经被另一个分类使用","security":"安全性","special_warning":"警告：这个分类是已经自动建立好的分类，它的安全设置不能被更改。如果你不想要使用这个分类，直接删除它，而不是另作他用。","images":"图片","auto_close_label":"该时间段后自动关闭主题：","auto_close_units":"小时","email_in":"自定义进站电子邮件地址：","email_in_allow_strangers":"接受无账号的匿名用户的邮件","email_in_disabled":"站点设置中已经禁用通过邮件发表新主题。欲启用通过邮件发表新主题，","email_in_disabled_click":"启用“邮件发表”设置。","suppress_from_homepage":"不在主页中显示这个分类。","allow_badges_label":"允许在这个分类中授予徽章","edit_permissions":"编辑权限","add_permission":"添加权限","this_year":"今年","position":"位置","default_position":"默认位置","position_disabled":"分类按照其活跃程度的顺序显示。要固定分类列表的显示顺序，","position_disabled_click":"启用“固定分类位置”设置。","parent":"上级分类","notifications":{"watching":{"title":"监看","description":"你将自动监看这些分类中的所有主题。每一个主题中的每一个新帖子，将通知你，还将显示新回复的数量。"},"watching_first_post":{"title":"监看头一帖","description":"在这些分类里面，只有每一个新主题的头一个帖子，将通知你。"},"tracking":{"title":"跟踪","description":"你将自动跟踪这些分类中的所有主题。如果有人提及你的 @名字或回复你，将通知你，还将显示新回复的数量。"},"regular":{"title":"普通","description":"如果有人提及你的 @名字或回复你，将通知你。"},"muted":{"title":"静音","description":"在这些分类里面，你将不会收到任何新主题通知，它们也不会出现在最新主题列表。"}}},"flagging":{"title":"感谢你帮助我们建设文明社群！","action":"标记帖子","take_action":"立即执行","notify_action":"消息","official_warning":"正式警告","delete_spammer":"删除垃圾发布者","yes_delete_spammer":"确定","ip_address_missing":"（N/A）","hidden_email_address":"（隐藏）","submit_tooltip":"提交私有标记","take_action_tooltip":"立即采取标记到达限制值时的措施，而不是等待更多的社群标记","cant":"抱歉，现在你不能标记本帖。","notify_staff":"私下通知管理人员","formatted_name":{"off_topic":"偏题","inappropriate":"不合适","spam":"广告"},"custom_placeholder_notify_user":"请具体说明，有建设性的，再友好一些。","custom_placeholder_notify_moderators":"让我们知道你关心地是什么，并尽可能地提供相关链接和例子。","custom_message":{"more":{"other":"还差 {{count}} 个..."},"left":{"other":"剩余 {{count}}"}}},"flagging_topic":{"title":"感谢你帮助我们建设文明社群！","action":"标记帖子","notify_action":"消息"},"topic_map":{"title":"主题概要","participants_title":"主要发帖者","links_title":"热门链接","links_shown":"显示更多链接...","clicks":{"other":"%{count} 次点击"}},"post_links":{"about":"为本帖展开更多链接","title":{"other":"%{count} 更多"}},"topic_statuses":{"warning":{"help":"这是一个正式的警告。"},"bookmarked":{"help":"你已经收藏了此主题"},"locked":{"help":"这个主题被关闭；不再允许新的回复"},"archived":{"help":"本主题已归档；即已经冻结，无法修改"},"locked_and_archived":{"help":"这个主题被关闭并存档；不再允许新的回复，并不能改变"},"unpinned":{"title":"解除置顶","help":"主题已经解除置顶；它将以默认顺序显示"},"pinned_globally":{"title":"全局置顶","help":"本主题已全局置顶；它始终会在最新列表以及它所属的分类中置顶"},"pinned":{"title":"置顶","help":"本主题已置顶；它将始终显示在它所属分类的顶部"},"invisible":{"help":"本主题被设置为不显示在主题列表中，并且只能通过直达链接来访问"}},"posts":"帖子","posts_long":"本主题有 {{number}} 个帖子","original_post":"原始帖","views":"浏览","views_lowercase":{"other":"浏览"},"replies":"回复","views_long":"本主题已经被浏览过 {{number}} 次","activity":"活动","likes":"赞","likes_lowercase":{"other":"赞"},"likes_long":"本主题已有 {{number}} 次赞","users":"用户","users_lowercase":{"other":"用户"},"category_title":"分类","history":"历史","changed_by":"由 {{author}}","raw_email":{"title":"原始邮件","not_available":"不可用！"},"categories_list":"分类列表","filters":{"with_topics":"%{filter}主题","with_category":"%{category}的%{filter}主题","latest":{"title":"最新","title_with_count":{"other":"最新（{{count}}）"},"help":"有了新帖的活动主题"},"hot":{"title":"热门","help":"最近最受欢迎的主题"},"read":{"title":"已读","help":"你已经阅读过的主题"},"search":{"title":"搜索","help":"搜索所有主题"},"categories":{"title":"分类","title_in":"分类 - {{categoryName}}","help":"归入各种类别的所有主题"},"unread":{"title":"未读","title_with_count":{"other":"未读（{{count}}）"},"help":"你目前监看或跟踪有了未读帖子的主题","lower_title_with_count":{"other":"{{count}} 条未读"}},"new":{"lower_title_with_count":{"other":"{{count}} 近期"},"lower_title":"近期","title":"近期","title_with_count":{"other":"近期（{{count}}）"},"help":"最近几天里创建的主题"},"posted":{"title":"我的帖子","help":"你发表过帖子的主题"},"bookmarks":{"title":"书签","help":"你标上书签的主题"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}}（{{count}}）"},"help":"{{categoryName}}分类中热门的主题"},"top":{"title":"热门","help":"在最近的一年，一月，一周或一天最活跃的主题","all":{"title":"不限时间"},"yearly":{"title":"年度"},"quarterly":{"title":"季度的"},"monthly":{"title":"月度"},"weekly":{"title":"每周"},"daily":{"title":"每天"},"all_time":"不限时间","this_year":"年","this_quarter":"季度","this_month":"月","this_week":"周","today":"今天","other_periods":"跳至顶部"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点。\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","permission_types":{"full":"创建 / 回复 / 阅读","create_post":"回复 / 阅读","readonly":"阅读"},"lightbox":{"download":"下载"},"search_help":{"title":"搜索帮助"},"keyboard_shortcuts_help":{"title":"键盘快捷键","jump_to":{"title":"转至","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e 首页","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e 最新","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e 近期","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e 未读","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e 分类","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e 热门","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e 书签","profile":"\u003cb\u003eg\u003c/b\u003e 然后 \u003cb\u003ep\u003c/b\u003e 个人页面","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e 私信"},"navigation":{"title":"导航","jump":"\u003cb\u003e#\u003c/b\u003e 前往帖子 #","back":"\u003cb\u003eu\u003c/b\u003e 返回","up_down":"\u003cb\u003ek\u003c/b\u003e 或 \u003cb\u003ej\u003c/b\u003e 移动选择焦点 \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e 然后 \u003cb\u003e回车\u003c/b\u003e 打开选择的主题","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e 或 \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e 下一个/前一个段落"},"application":{"title":"应用","create":"\u003cb\u003ec\u003c/b\u003e 创建新主题","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e 打开汉堡菜单","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e 打开用户菜单","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e 显示更新主题","search":"\u003cb\u003e/\u003c/b\u003e 搜索","help":"\u003cb\u003e?\u003c/b\u003e 打开键盘帮助","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e 然后 \u003cb\u003er\u003c/b\u003e 解除新/帖子提示","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e 然后 \u003cb\u003et\u003c/b\u003e 解除主题提示","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e 退出"},"actions":{"title":"动作","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e 切换主题收藏状态","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e 置顶/截至置顶主题","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e 分享主题","share_post":"\u003cb\u003es\u003c/b\u003e 分享帖子","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e 回复为联结主题","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e 回复主题","reply_post":"\u003cb\u003er\u003c/b\u003e 回复帖子","quote_post":"\u003cb\u003eq\u003c/b\u003e 引用帖子","like":"\u003cb\u003el\u003c/b\u003e 赞帖子","flag":"\u003cb\u003e!\u003c/b\u003e 标记帖子","bookmark":"\u003cb\u003eb\u003c/b\u003e 收藏帖子","edit":"\u003cb\u003ee\u003c/b\u003e 编辑帖子","delete":"\u003cb\u003ed\u003c/b\u003e 删除帖子","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e 忽略主题","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e 常规 (默认) 主题","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e 追踪主题","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e 看主题"}},"badges":{"earned_n_times":{"other":"授予徽章 %{count} 次"},"granted_on":"授予于%{date}","others_count":"其他有该徽章的人（%{count}）","title":"徽章","allow_title":"能用作头衔","multiple_grant":"能被授予多次","badge_count":{"other":"%{count} Badges"},"more_badges":{"other":"+%{count} 更多"},"granted":{"other":"%{count} 授予"},"select_badge_for_title":"选择一个徽章作为你的头衔使用","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"开始"},"community":{"name":"社区"},"trust_level":{"name":"Trust Level"},"other":{"name":"其它"},"posting":{"name":"发帖"}}},"google_search":"\u003ch3\u003e用 Google 搜索\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"所有标签","selector_all_tags":"所有标签","selector_no_tags":"无标签","changed":"标签被修改：","tags":"标签","choose_for_topic":"为此主题选择可选标签","delete_tag":"删除标签","delete_confirm":"确定要删除这个标签吗？","rename_tag":"重命名标签","rename_instructions":"标签的新名称：","sort_by":"排序方式：","sort_by_count":"总数","sort_by_name":"名称","manage_groups":"管理标签组","manage_groups_description":"管理标签的小组","filters":{"without_category":"%{tag}的%{filter}主题","with_category":"%{filter} %{tag}主题在%{category}","untagged_without_category":"无标签的%{filter}主题","untagged_with_category":"%{category}无标签的%{filter}主题"},"notifications":{"watching":{"title":"监看","description":"你将自动监看该标签中的所有主题。新的帖子和主题将会通知你，未读和新帖的数量也将出现在主题旁边。"},"watching_first_post":{"title":"监看头一帖","description":"在这个标签中，只有每一个新主题的头一个帖子，将通知你。"},"tracking":{"title":"跟踪","description":"你将自动跟踪这个标签里的所有主题。未读和新帖的数量将显示在主题旁边。"},"regular":{"title":"普通","description":"如果有人提及你的 @名字或给你回帖，将通知你。"},"muted":{"title":"静音","description":"在这个标签中，你将不会收到任何新主题通知，它们也不会出现在你的未读列表上面。"}},"groups":{"title":"标签组","about":"将标签分组以便管理。","new":"新标签组","tags_label":"标签组内标签：","parent_tag_label":"上级标签：","parent_tag_placeholder":"可选","parent_tag_description":"未设置上级标签前小组内标签无法使用。","one_per_topic_label":"只可给主题设置一个该组内的标签","new_name":"新标签组名","save":"保存","delete":"删除","confirm_delete":"确定要删除此标签组吗？"},"topics":{"none":{"unread":"你没有未读主题。","new":"你没有新的主题","read":"你尚未阅读任何主题。","posted":"你尚未在任何主题中发帖。","latest":"没有最新主题。","hot":"没有热门主题。","bookmarks":"你还没有收藏主题。","top":"没有最佳主题。","search":"没有搜索结果。"},"bottom":{"latest":"没有更多的最新主题。","hot":"没有更多的热门话题。","posted":"没有更多的发布主题。","read":"没有更多已阅主题可看了。","new":"没有更多近期主题可看了。","unread":"没有更多未读主题了。","top":"没有更多最佳主题了。","bookmarks":"没有更多收藏的主题了。","search":"没有更多搜索结果了。"}}},"invite":{"custom_message":"让你的邀请稍稍个人化一些吧，写个","custom_message_link":"留言","custom_message_placeholder":"输入留言","custom_message_template_forum":"你好，你应该来我们这个论坛！","custom_message_template_topic":"你好，我觉得你可能会喜欢这个主题！"},"poll":{"voters":{"other":"投票者"},"total_votes":{"other":"总票数"},"average_rating":"平均评分：\u003cstrong\u003e%{average}\u003c/strong\u003e。","public":{"title":"投票是公开的。"},"multiple":{"help":{"at_least_min_options":{"other":"至少选择 \u003cstrong\u003e%{count}\u003c/strong\u003e 个选项"},"up_to_max_options":{"other":"最多选择 \u003cstrong\u003e%{count}\u003c/strong\u003e 个选项"},"x_options":{"other":"选择 \u003cstrong\u003e%{count}\u003c/strong\u003e 个选项"},"between_min_and_max_options":"选择 \u003cstrong\u003e%{min}\u003c/strong\u003e 至 \u003cstrong\u003e%{max}\u003c/strong\u003e 个选项"}},"cast-votes":{"title":"投你的票","label":"现在投票！"},"show-results":{"title":"显示投票结果","label":"显示结果"},"hide-results":{"title":"返回到你的投票","label":"隐藏结果"},"open":{"title":"开启投票","label":"开启","confirm":"你确定要开启这个投票么？"},"close":{"title":"关闭投票","label":"关闭","confirm":"你确定要关闭这个投票？"},"error_while_toggling_status":"对不起，改变投票状态时出错了。","error_while_casting_votes":"对不起，投票时出错了。","error_while_fetching_voters":"对不起，显示投票者时出错了。","ui_builder":{"title":"创建投票","insert":"插入投票","help":{"options_count":"输入至少 2 个选项"},"poll_type":{"label":"类型","regular":"单选","multiple":"多选","number":"评分"},"poll_config":{"max":"最大","min":"最小","step":"梯级"},"poll_public":{"label":"显示投票人"},"poll_options":{"label":"每行输入一个调查选项"}}},"type_to_filter":"输入过滤条件...","admin":{"title":"Discourse 管理员","moderator":"版主","dashboard":{"title":"仪表盘","last_updated":"最近更新于：","version":"安装的版本","up_to_date":"你正在运行最新的论坛版本。","critical_available":"有一个关键更新可用。","updates_available":"目前有可用更新。","please_upgrade":"请升级！","no_check_performed":"检测更新未执行，请确保 sidekiq 在正常运行。","stale_data":"最近一次检查更新未执行，请确保 sidekiq 在正常运行。","version_check_pending":"看来你最近刚更新过。太棒了！","installed_version":"已安装","latest_version":"最新版本","problems_found":"你安装的论坛目前有以下问题：","last_checked":"上次检查","refresh_problems":"刷新","no_problems":"找不到问题.","moderators":"版主：","admins":"管理员：","blocked":"禁止参与讨论:","suspended":"禁止登录","private_messages_short":"私信","private_messages_title":"私信","mobile_title":"移动","space_free":"{{size}} 空闲","uploads":"上传","backups":"备份","traffic_short":"流量","traffic":"应用 web 请求","page_views":"API 请求","page_views_short":"API 请求","show_traffic_report":"显示详细的流量报告","reports":{"today":"今天","yesterday":"昨天","last_7_days":"7天以内","last_30_days":"30天以内","all_time":"所有时间内","7_days_ago":"7天之前","30_days_ago":"30天之前","all":"全部","view_table":"表格","view_graph":"图表","refresh_report":"刷新报告","start_date":"开始日期","end_date":"结束日期","groups":"所有小组"}},"commits":{"latest_changes":"最近的更新：请经常升级！","by":"来自"},"flags":{"title":"标记","old":"历史","active":"待处理","agree":"确认标记","agree_title":"确认这个标记有效且正确","agree_flag_modal_title":"确认标记并执行...","agree_flag_hide_post":"确认标记（隐藏帖子并发送私信）","agree_flag_hide_post_title":"隐藏帖子并自动发送消息要求用户修改","agree_flag_restore_post":"确认 (还原帖子)","agree_flag_restore_post_title":"还原这篇帖子","agree_flag":"确认标记","agree_flag_title":"确认标记，不对帖子进行操作","defer_flag":"推迟处理","defer_flag_title":"移除标记；这次不处理。","delete":"删除","delete_title":"删除标记指向的帖子。","delete_post_defer_flag":"删除帖子并推迟处理标记","delete_post_defer_flag_title":"删除此帖；如果这是这个主题内的第一篇帖子则删除主题","delete_post_agree_flag":"删除帖子并确认标记","delete_post_agree_flag_title":"删除此帖；如果这是这个主题内的第一篇帖子则删除主题","delete_flag_modal_title":"删除并...","delete_spammer":"删除垃圾发布者","delete_spammer_title":"移除该用户及其的所有帖子和主题。","disagree_flag_unhide_post":"否决（显示帖子）","disagree_flag_unhide_post_title":"删除此帖的所有标记并使其重新可见","disagree_flag":"否决","disagree_flag_title":"否却该标记（该标记无效或不正确）","clear_topic_flags":"完成","clear_topic_flags_title":"主题的问题已经已被调查且提案已被解决。单击\u003cstrong\u003e完成\u003c/strong\u003e以删除报告。","more":"（更多回复...）","dispositions":{"agreed":"已确认","disagreed":"被否决","deferred":"已推迟"},"flagged_by":"标记者","resolved_by":"处理者","took_action":"立即执行","system":"系统","error":"出错了","reply_message":"回复","no_results":"当前没有标记。","topic_flagged":"\u003cstrong\u003e主题\u003c/strong\u003e已经被标记。","visit_topic":"浏览主题才能操作","was_edited":"帖子在第一次标记后被编辑","previous_flags_count":"这篇帖子已经被标记了 {{count}} 次。","summary":{"action_type_3":{"other":"偏离主题 x{{count}}"},"action_type_4":{"other":"不当内容 x{{count}}"},"action_type_6":{"other":"自定义 x{{count}}"},"action_type_7":{"other":"自定义 x{{count}}"},"action_type_8":{"other":"广告 x{{count}}"}}},"groups":{"primary":"主要小组","no_primary":"(无主要小组)","title":"小组","edit":"编辑小组","refresh":"刷新","new":"新小组","selector_placeholder":"输入用户名","name_placeholder":"小组名，不能含有空格，与用户名规则一致","about":"在这里编辑小组的名字和成员","group_members":"小组成员","delete":"删除","delete_confirm":"删除这个小组吗？","delete_failed":"无法删除小组。如果该小组是自动生成的，则不可删除。","delete_member_confirm":"从小组“%{group}”中移除“%{username}”？","delete_owner_confirm":"移除“%{username}”的权限？","name":"名字","add":"添加","add_members":"添加成员","custom":"定制","bulk_complete":"用户已被添加到小组。","bulk":"批量添加到小组","bulk_paste":"粘贴用户名邮件列表，一行一个：","bulk_select":"（选择一个小组）","automatic":"自动","automatic_membership_email_domains":"用户注册时邮箱域名若与列表完全匹配则自动添加至这个小组：","automatic_membership_retroactive":"应用同样的邮件域名规则添加已经注册的用户","default_title":"小组内所有用户的默认头衔","primary_group":"自动设置为主要小组","group_owners":"所有者","add_owners":"添加所有者","incoming_email":"自定义进站电子邮件地址","incoming_email_placeholder":"输入邮箱地址"},"api":{"generate_master":"生成主 API 密钥","none":"当前没有可用的 API 密钥。","user":"用户","title":"API","key":"API 密钥","generate":"生成","regenerate":"重新生成","revoke":"撤销","confirm_regen":"确定要用新的 API 密钥替代该密钥？","confirm_revoke":"确定要撤销该密钥？","info_html":"API 密钥可以用来通过 JSON 调用创建和更新主题。","all_users":"所有用户","note_html":"请\u003cstrong\u003e安全地\u003c/strong\u003e保管密钥，任何拥有该密钥的用户可以使用它以论坛任何用户的名义发帖。"},"plugins":{"title":"插件","installed":"安装的插件","name":"名字","none_installed":"你没有安装任何插件。","version":"版本","enabled":"启用？","is_enabled":"是","not_enabled":"否","change_settings":"更改设置","change_settings_short":"设置","howto":"如何安装插件？"},"backups":{"title":"备份","menu":{"backups":"备份","logs":"日志"},"none":"无可用备份","read_only":{"enable":{"title":"开启只读模式","label":"开启只读模式","confirm":"你确定要开启只读模式么？"},"disable":{"title":"关闭只读模式","label":"关闭只读模式"}},"logs":{"none":"暂无日志"},"columns":{"filename":"文件名","size":"大小"},"upload":{"label":"上传","title":"上传备份至实例","uploading":"上传中...","success":"“{{filename}}”已成功上传。","error":"上传“{{filename}}”时出错：{{message}}"},"operations":{"is_running":"已有操作正在执行","failed":"{{operation}}执行失败。请检查日志。","cancel":{"label":"取消","title":"取消当前操作","confirm":"你确定要取消当前操作吗？"},"backup":{"label":"备份","title":"建立一个备份","confirm":"你确定要开始建立一个备份吗？","without_uploads":"是（不包括文件）"},"download":{"label":"下载","title":"下载该备份"},"destroy":{"title":"删除备份","confirm":"你确定要删除该备份吗？"},"restore":{"is_disabled":"站点设置中禁用了恢复功能。","label":"恢复","title":"恢复该备份","confirm":"你确定要从该备份中恢复吗？"},"rollback":{"label":"回滚","title":"将数据库回滚到之前的工作状态","confirm":"你确定要将数据库回滚到之前的工作状态吗？"}}},"export_csv":{"user_archive_confirm":"你确定要下载你的帖子吗？","success":"导出开始，完成后你将被通过消息通知。","failed":"导出失败。请检查日志。","rate_limit_error":"帖子只能每天下载一次，请明天再重试。","button_text":"导出","button_title":{"user":"以CSV格式导出所有用户列表","staff_action":"以CSV格式导出所有管理人员操作历史记录","screened_email":"以 CSV 格式导出所有已显示的电子邮件列表。","screened_ip":"以 CSV 格式导出所有已显示的IP地址列表。","screened_url":"以 CSV 格式导出所有已显示的URL列表。"}},"export_json":{"button_text":"导出"},"invite":{"button_text":"发送邀请","button_title":"发送邀请"},"customize":{"title":"定制","long_title":"站点定制","css":"CSS","header":"头部","top":"顶部","footer":"底部","embedded_css":"嵌入的 CSS","head_tag":{"text":"\u003c/head\u003e","title":"将在 \u003c/head\u003e 标签前插入的 HTML"},"body_tag":{"text":"\u003c/body\u003e","title":"将在 \u003c/body\u003e 标签前插入的 HTML"},"override_default":"覆盖缺省值？","enabled":"启用？","preview":"预览","undo_preview":"移除预览","rescue_preview":"默认样式","explain_preview":"以自定义样式浏览此网页","explain_undo_preview":"返回目前使用中的自定义样式","explain_rescue_preview":"以默认样式浏览此网页","save":"保存","new":"新建","new_style":"新样式","import":"导入","import_title":"选择一个文件或者粘贴文本","delete":"删除","delete_confirm":"删除本定制内容？","about":"修改站点的 CSS 样式表和 HTML 头部。添加一个自定义方案开始。","color":"颜色","opacity":"透明度","copy":"复制","email_templates":{"title":"邮件模板","subject":"主题","multiple_subjects":"这个邮件模板包括多个主题。","body":"内容","none_selected":"选择一个邮件模板开始编辑。","revert":"撤销更变","revert_confirm":"你确定要撤销你的更变吗？"},"css_html":{"title":"CSS/HTML","long_title":"自定义 CSS 和 HTML"},"colors":{"title":"颜色","long_title":"颜色方案","about":"颜色方案让你能够让你在不写 CSS 的情况下更改色彩。添加一种颜色以开始。","new_name":"新的颜色方案","copy_name_prefix":"复制于","delete_confirm":"删除这个颜色方案？","undo":"重置","undo_title":"撤销你对这个颜色的编辑至上一次保存的状态。","revert":"撤销","revert_title":"重置这个颜色至 Discourse 的默认颜色方案","primary":{"name":"主要","description":"大部分的文字、图标和边框。"},"secondary":{"name":"次要","description":"主要背景颜色和一些按钮的文字颜色。"},"tertiary":{"name":"再次","description":"链接、一些按钮、提示和强调颜色。"},"quaternary":{"name":"备选","description":"导航链接"},"header_background":{"name":"顶栏背景","description":"站点顶栏背景颜色"},"header_primary":{"name":"顶栏主要","description":"顶栏的文字和图标"},"highlight":{"name":"高亮","description":"页面中高亮元素的背景色，如帖子和主题。"},"danger":{"name":"危险","description":"危险操作如删除帖子和主题的高亮颜色"},"success":{"name":"成功","description":"用于指示操作成功。"},"love":{"name":"赞","description":"赞按钮的颜色。"}}},"email":{"title":"邮件","settings":"设置","templates":"模板","preview_digest":"预览","sending_test":"发送测试邮件...","error":"\u003cb\u003e错误\u003c/b\u003e - %{server_error}","test_error":"发送测试邮件时遇到问题。请再检查一遍邮件设置，确认你的主机没有封锁邮件链接，然后重试。","sent":"已发送","skipped":"跳过","bounced":"退回","received":"收到","rejected":"拒绝","sent_at":"发送时间","time":"时间","user":"用户","email_type":"邮件类型","to_address":"目的地址","test_email_address":"测试电子邮件地址","send_test":"发送测试电子邮件","sent_test":"已发送！","delivery_method":"发送方式","preview_digest_desc":"预览发送给不活跃用户的摘要邮件内容。","refresh":"刷新","format":"格式","html":"html","text":"text","last_seen_user":"用户最后登录时间:","reply_key":"回复关键字","skipped_reason":"跳过理由","incoming_emails":{"from_address":"来自","to_addresses":"发至","cc_addresses":"抄送","subject":"主题","error":"错误","none":"没有找到进站邮件。","modal":{"title":"进站邮件详情","error":"错误","headers":"头部","subject":"主题","body":"内容","rejection_message":"拒绝邮件"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"主题...","error_placeholder":"错误"}},"logs":{"none":"未发现日志。","filters":{"title":"过滤器","user_placeholder":"username","address_placeholder":"name@example.com","type_placeholder":"摘要、注册…","reply_key_placeholder":"回复键","skipped_reason_placeholder":"原因"}}},"logs":{"title":"日志","action":"操作","created_at":"创建","last_match_at":"最近匹配","match_count":"匹配","ip_address":"IP","topic_id":"主题 ID","post_id":"帖子 ID","category_id":"分类 ID","delete":"删除","edit":"编辑","save":"保存","screened_actions":{"block":"封禁","do_nothing":"无操作"},"staff_actions":{"title":"管理人员操作","instructions":"点击用户名和操作可以过滤列表。点击头像可以访问用户个人页面。","clear_filters":"显示全部","staff_user":"管理人员","target_user":"目标用户","subject":"主题","when":"时间","context":"环境","details":"详情","previous_value":"之前","new_value":"新建","diff":"差别","show":"显示","modal_title":"详情","no_previous":"没有之前的值。","deleted":"没有新的值。记录被删除。","actions":{"delete_user":"删除用户","change_trust_level":"更改信任等级","change_username":"修改用户名","change_site_setting":"更改站点设置","change_site_customization":"更改站点自定义","delete_site_customization":"删除站点自定义","change_site_text":"更改站点文字","suspend_user":"封禁用户","unsuspend_user":"解禁用户","grant_badge":"授予徽章","revoke_badge":"撤销徽章","check_email":"检查电子邮件","delete_topic":"删除主题","delete_post":"删除帖子","impersonate":"检视","anonymize_user":"匿名用户","roll_up":"回退 IP 封禁","change_category_settings":"更改分类设置","delete_category":"删除分类","create_category":"创建分类","block_user":"封禁用户","unblock_user":"解封用户","grant_admin":"授予管理员权限","revoke_admin":"撤销管理员权限","grant_moderation":"授予版主权限","revoke_moderation":"撤销版主权限","backup_operation":"备份操作","deleted_tag":"删除的标签","renamed_tag":"重命名的标签","revoke_email":"撤销邮件"}},"screened_emails":{"title":"被屏蔽的邮件地址","description":"当有人试图用以下邮件地址注册时，将受到阻止或其它系统操作。","email":"邮件地址","actions":{"allow":"允许"}},"screened_urls":{"title":"被屏蔽的 URL","description":"以下是垃圾信息发布者使用过的 URL。","url":"URL","domain":"域名"},"screened_ips":{"title":"被屏蔽的 IP","description":"受监视的 IP 地址，使用“放行”可将 IP 地址加入白名单。","delete_confirm":"确定要撤销对 IP 地址为 %{ip_address} 的规则？","roll_up_confirm":"你确定要将常用的 IP 地址归类为子网地址吗？","rolled_up_some_subnets":"成功地折叠了 IP 封禁记录至这些子网： %{subnets}。","rolled_up_no_subnet":"无法折叠。","actions":{"block":"封禁","do_nothing":"放行","allow_admin":"允许管理"},"form":{"label":"新：","ip_address":"IP地址","add":"添加","filter":"搜索"},"roll_up":{"text":"折叠","title":"如果有至少 'min_ban_entries_for_roll_up' 个记录，创建一个子网封禁记录"}},"logster":{"title":"错误日志"}},"impersonate":{"title":"检视用户视角","help":"使用此工具来检视其他用户的帐号以方便调试。你应该在完成后立即退出。","not_found":"无法找到该用户。","invalid":"抱歉，你不能以此用户角度检视。"},"users":{"title":"用户","create":"添加管理员用户","last_emailed":"最后一次邮寄","not_found":"抱歉，在我们的系统中此用户名不存在。","id_not_found":"抱歉，在我们的系统中此用户 id 不存在。","active":"活跃","show_emails":"显示邮件","nav":{"new":"新建","active":"活跃","pending":"未审核","staff":"管理人员","suspended":"禁止登录","blocked":"禁止参与讨论","suspect":"怀疑"},"approved":"已批准？","approved_selected":{"other":"审核通过用户（{{count）"},"reject_selected":{"other":"审核拒绝用户（{{count}}）"},"titles":{"active":"已激活用户","new":"新用户","pending":"等待审核用户","newuser":"信任等级为0的用户（新用户）","basic":"信任等级为1的用户（基本用户）","member":"信任等级为2的用户（成员）","regular":"信任等级为3的用户（活跃）","leader":"信任等级为4的用户（资深）","staff":"管理人员","admins":"管理员","moderators":"版主","blocked":"被封用户","suspended":"被禁用户","suspect":"嫌疑用户"},"reject_successful":{"other":"成功拒绝 %{count} 个用户。"},"reject_failures":{"other":"成功拒绝 %{count} 个用户。"},"not_verified":"未验证","check_email":{"title":"显示用户电子邮件","text":"显示"}},"user":{"suspend_failed":"禁止此用户时发生了错误 {{error}}","unsuspend_failed":"解禁此用户时发生了错误 {{error}}","suspend_duration":"该用户将被封禁多久？","suspend_duration_units":"（天）","suspend_reason_label":"为什么封禁该用户？该理由将公开显示在用户个人页面上，当其尝试登录时，也看到这条理由。尽量简洁。","suspend_reason":"封禁的理由","suspended_by":"封禁操作者：","delete_all_posts":"删除所有帖子","suspend":"禁止","unsuspend":"解禁","suspended":"已禁止？","moderator":"版主？","admin":"管理员？","blocked":"已封?","staged":"暂存？","show_admin_profile":"管理员","edit_title":"编辑头衔","save_title":"保存头衔","refresh_browsers":"强制浏览器刷新","refresh_browsers_message":"消息发送至所有用户！","show_public_profile":"显示公开介绍","impersonate":"检视角度","ip_lookup":"IP 查询","log_out":"退出","logged_out":"用户在所有设备都已退出","revoke_admin":"吊销管理员资格","grant_admin":"赋予管理员资格","revoke_moderation":"吊销论坛版主资格","grant_moderation":"赋予论坛版主资格","unblock":"解封","block":"封号","reputation":"声誉","permissions":"权限","activity":"活动","like_count":"送出赞 / 获得赞","last_100_days":"在最近 100 天","private_topics_count":"私有主题数量","posts_read_count":"已阅帖子数量","post_count":"发表的帖子数量","topics_entered":"已查看的主题数量","flags_given_count":"提交标记数量","flags_received_count":"被他人标记数量","warnings_received_count":"收到警告","flags_given_received_count":"给出的标记 / 收到的标记","approve":"批准","approved_by":"批准人","approve_success":"用户已被批准， 激活邮件已发送。","approve_bulk_success":"成功！所有选定的用户已批准并通知。","time_read":"阅读时间","anonymize":"匿名用户","anonymize_confirm":"你确定要匿名化该账户信息吗？这将改变用户名和邮件地址，并且重置所有个人主页信息。","anonymize_yes":"是的，匿名化该账户","anonymize_failed":"在匿名化该账户时遇到问题。","delete":"删除用户","delete_forbidden_because_staff":"不能删除管理员和版主。","delete_posts_forbidden_because_staff":"不能完全删除管理员和版主的帖子。","delete_forbidden":{"other":"用户如果有帖子将不能删除。在试图尝试删除一个用户前删除所有的帖子（%{count} 天前的帖子不能被删除）"},"cant_delete_all_posts":{"other":"不能删除所有帖子。一些帖子发表于 %{count} 天前。（设置项：delete_user_max_post_age）"},"cant_delete_all_too_many_posts":{"other":"不能删除所有帖子，因为用户有超过 %{count} 个帖子。（delete_all_posts_max）"},"delete_confirm":"你确定要删除这个用户吗？这个操作是不可逆的！","delete_and_block":"删除并\u003cb\u003e封禁\u003c/b\u003e该邮件地址和IP地址","delete_dont_block":"仅删除","deleted":"该用户已被删除。","delete_failed":"在删除用户时发生了错误。请确保删除该用户前删除了该用户的所有帖子。","send_activation_email":"发送激活邮件","activation_email_sent":"激活邮件已发送。","send_activation_email_failed":"在发送激活邮件时发生了错误。","activate":"激活帐号","activate_failed":"在激活用户帐号时发生了错误。","deactivate_account":"停用帐号","deactivate_failed":"在停用用户帐号时发生了错误。","unblock_failed":"在解除用户帐号封禁时发生了错误。","block_failed":"在封禁用户帐号时发生了错误。","block_confirm":"你确定要封禁用户吗？他们将没有办法创建任何主题或者帖子。","block_accept":"是的，封禁用户","bounce_score":"累计退信分值","reset_bounce_score":{"label":"重置","title":"重置累计退信分值为 0"},"deactivate_explanation":"已停用的用户必须重新验证他们的电子邮件。","suspended_explanation":"一个被封禁的用户不能登录。","block_explanation":"被封禁的用户不能发表主题或者评论。","staged_explanation":"暂存用户只能通过邮件回复指定主题。","bounce_score_explanation":{"none":"近期该邮箱没有退信。","some":"近期该邮箱有少量退信。","threshold_reached":"近期该邮箱有过多退信。"},"trust_level_change_failed":"改变用户等级时出现了一个问题。","suspend_modal_title":"被禁用户","trust_level_2_users":"二级信任等级用户","trust_level_3_requirements":"信任等级 3 要求","trust_level_locked_tip":"信任等级已经被锁定，系统将不会升降用户的信任等级","trust_level_unlocked_tip":"信任等级已经解锁，系统将自动升降用户的信任等级","lock_trust_level":"锁定信任等级","unlock_trust_level":"解锁信任等级","tl3_requirements":{"title":"信任等级3的要求","table_title":{"other":"这最近 %{count} 天："},"value_heading":"当前","requirement_heading":"要求","visits":"访问","days":"天数","topics_replied_to":"回复的主题","topics_viewed":"已读主题","topics_viewed_all_time":"已阅的主题 (全部)","posts_read":"已读帖子","posts_read_all_time":"已读的帖子 (全部)","flagged_posts":"被标记的帖子","flagged_by_users":"标记其的用户","likes_given":"送出赞","likes_received":"获得赞","likes_received_days":"获得赞：独立天数","likes_received_users":"获得赞：每用户","qualifies":"符合信任等级3要求","does_not_qualify":"不符合信任等级3要求","will_be_promoted":"将在近期被提升。","will_be_demoted":"将在近期被降级。","on_grace_period":"目前在升级宽限期，不会被降级。","locked_will_not_be_promoted":"信任等级被锁定。将不再被提升。","locked_will_not_be_demoted":"信任等级被锁定。将不再被降级。"},"sso":{"title":"单点登录","external_id":"外部 ID","external_username":"用户名","external_name":"名字","external_email":"电子邮件","external_avatar_url":"头像URL"}},"user_fields":{"title":"用户属性","help":"增加用户能填写的字段。","create":"创建用户属性 ","untitled":"无标题","name":"字段名称","type":"字段类型","description":"字段描述信息","save":"保存","edit":"编辑","delete":"删除","cancel":"取消","delete_confirm":"你确定要删除这个用户字段么？","options":"选项","required":{"title":"在注册时需要填写？","enabled":"必填","disabled":"可选"},"editable":{"title":"在注册后可以修改？","enabled":"可修改","disabled":"不可修改"},"show_on_profile":{"title":"在个人信息页显示？","enabled":"在个人信息页显示","disabled":"未在个人信息页显示"},"show_on_user_card":{"title":"在用户卡片上显示？","enabled":"在用户卡片上显示","disabled":"在用户卡片上隐藏"},"field_types":{"text":"文本字段","confirm":"确认","dropdown":"下拉菜单"}},"site_text":{"description":"你可以自定义论坛的任意文本。请按以下搜索：","search":"搜索你想要编辑的文本","title":"文本内容","edit":"编辑","revert":"撤销更变","revert_confirm":"你确定要撤销你的更变吗？","go_back":"返回搜索","recommended":"我们建议自定义以下文本以符合你的需求：","show_overriden":"只显示修改过的"},"site_settings":{"show_overriden":"只显示修改过的","title":"设置","reset":"重置为默认","none":"无","no_results":"找不到结果。","clear_filter":"清除","add_url":"增加链接","add_host":"添加主机","categories":{"all_results":"全部","required":"必填","basic":"基本设置","users":"用户","posting":"发帖","email":"电子邮件","files":"文件","trust":"信任等级","security":"安全性","onebox":"Onebox","seo":"搜索引擎优化","spam":"垃圾信息","rate_limits":"频率限制","developer":"开发者","embedding":"嵌入","legal":"法律信息","uncategorized":"未分类","backups":"备份","login":"登录","plugins":"插件","user_preferences":"用户设置","tags":"标签","search":"搜索"}},"badges":{"title":"徽章","new_badge":"新徽章","new":"新建","name":"名称","badge":"徽章","display_name":"显示名称","description":"描述","long_description":"详情","badge_type":"徽章分类","badge_grouping":"小组","badge_groupings":{"modal_title":"徽章组"},"granted_by":"授予由","granted_at":"授予于","reason_help":"（一个至主题或帖子的链接）","save":"保存","delete":"删除","delete_confirm":"你确定要删除此徽章吗？","revoke":"撤销","reason":"理由","expand":"展开 \u0026hellip;","revoke_confirm":"你确定要撤销此徽章吗？","edit_badges":"编辑徽章","grant_badge":"授予徽章","granted_badges":"已授予的徽章","grant":"授予","no_user_badges":"%{name}尚未被授予任何徽章。","no_badges":"没有可供授予的徽章。","none_selected":"选择一个徽章开始","allow_title":"允许将徽章用作头衔","multiple_grant":"能被授予多次","listable":"在公共徽章页面显示徽章","enabled":"启用徽章系统","icon":"图标","image":"图片","icon_help":"使用 Font Awesome class 或者图片的链接","query":"徽章查询（SQL）","target_posts":"查询到的帖子","auto_revoke":"每天运行撤销查询","show_posts":"在徽章页面显示被授予帖子的徽章","trigger":"开关","trigger_type":{"none":"每日更新","post_action":"当用户操作一个帖子时","post_revision":"当用户编辑或者创建帖子时","trust_level_change":"当用户信任等级改变时","user_change":"当用户被编辑或创建时","post_processed":"在帖子被处理之后"},"preview":{"link_text":"预览将授予的徽章","plan_text":"预览查询计划","modal_title":"徽章查询预览","sql_error_header":"查询时出错。","error_help":"查看下列关于徽章查询的帮助链接。","bad_count_warning":{"header":"警告！","text":"有授予的样本消失。这在徽章查询返回用户 ID 或者帖子 ID 不存在的时候发生。这可能导致未预期的结果发生——请再次检查你的查询。"},"no_grant_count":"没有徽章可以被授予。","grant_count":{"other":"已授予 \u003cb\u003e%{count}\u003c/b\u003e 个徽章。"},"sample":"样本：","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e因 %{link} 帖子","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e因在\u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e时的 %{link} 帖子","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e在\u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"增加所有人可用的 emoji。（高端技巧：一次性拖进多个文件）","add":"增加新的 Emoji","name":"名称","image":"图片","delete_confirm":"你确定要删除 :%{name}: emoji 么？"},"embedding":{"get_started":"如果你想要将 Discourse 嵌入至其他网站，添加他们的主机地址。","confirm_delete":"你确定要删除这个主机吗？","sample":"使用下列 HTML 代码至你的站点创建和嵌入 Discourse 主题。把\u003cb\u003eREPLACE_ME\u003c/b\u003e 替换成你将嵌入至的网址。","title":"嵌入","host":"允许的主机","edit":"编辑","category":"发布到分类","add_host":"增加主机","settings":"嵌入设置","feed_settings":"源设置","feed_description":"为你的站点提供一份 RSS/ATOM 源能改善 Discourse 导入你的内容的能力","crawling_settings":"爬虫设置","crawling_description":"当 Discourse 为你的帖子创建了主题时，如果没有 RSS/ATOM 流存在，它将尝试从 HTML 中解析内容。有时分离其中的内容时可能是很有挑战性的，所以我们提供了指定 CSS 规则的能力来帮助分离过程。","embed_by_username":"主题创建者的用户名","embed_post_limit":"嵌入的最大帖子数量。","embed_username_key_from_feed":"从流中拉取 Discourse 用户名的 Key ","embed_truncate":"截断嵌入的帖子","embed_whitelist_selector":"使用 CSS 选择器选择允许的嵌入元素","embed_blacklist_selector":"使用 CSS 选择器移除嵌入元素","embed_classname_whitelist":"允许 CSS class 名称","feed_polling_enabled":"通过 RSS/ATOM 导入帖子","feed_polling_url":"用于抓取的 RSS/ATOM 流的 URL","save":"保存嵌入设置"},"permalink":{"title":"永久链接","url":"URL","topic_id":"主题 ID","topic_title":"主题","post_id":"帖子 ID","post_title":"帖子","category_id":"分类 ID","category_title":"分类","external_url":"外部 URL","delete_confirm":"你确定要删除该永久链接？","form":{"label":"新：","add":"添加","filter":"搜索（URL 或外部 URL）"}}}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"tiny":{"less_than_x_seconds":{"one":"\u003c 1s"},"x_seconds":{"one":"1s"},"x_minutes":{"one":"1m"},"about_x_hours":{"one":"1h"},"x_days":{"one":"1d"},"about_x_years":{"one":"1y"},"over_x_years":{"one":"\u003e 1y"},"almost_x_years":{"one":"1y"}},"medium":{"x_minutes":{"one":"1 min"},"x_hours":{"one":"1 hour"},"x_days":{"one":"1 day"}},"medium_with_ago":{"x_minutes":{"one":"1 min ago"},"x_hours":{"one":"1 hour ago"},"x_days":{"one":"1 day ago"}},"later":{"x_days":{"one":"1 day later"},"x_months":{"one":"1 month later"},"x_years":{"one":"1 year later"}}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"{{count}} new or updated topic."},"topic_count_unread":{"one":"{{count}} unread topic."},"topic_count_new":{"one":"{{count}} new topic."},"queue":{"has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e1\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"1 user"}},"groups":{"title":{"one":"group"}},"categories":{"topic_sentence":{"one":"1 topic"},"topic_stat_sentence":{"one":"%{count} new topic in the past %{unit}."}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"invited":{"truncated":{"one":"Showing the first invite."}},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark"}}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}"}},"replies_lowercase":{"one":"reply"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e"},"group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e"}},"search":{"result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e topic."}}},"topic":{"filter_to":{"one":"1 post in topic"},"new_topics":{"one":"1 new topic"},"unread_topics":{"one":"1 unread topic"},"total_unread_posts":{"one":"you have 1 unread post in this topic"},"unread_posts":{"one":"you have 1 unread old post in this topic"},"new_posts":{"one":"there is 1 new post in this topic since you last read it"},"likes":{"one":"there is 1 like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"}},"filters":{"n_posts":{"one":"1 post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"change_owner":{"instructions":{"one":"Please choose the new owner of the post by \u003cb\u003e{{old_user}}\u003c/b\u003e."}},"multi_select":{"description":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e post."}}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view 1 hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes":{"one":"{{count}} Like"},"has_likes_title":{"one":"1 person liked this post"},"has_likes_title_you":{"one":"you and 1 other person liked this post"},"controls":{"delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?"}}},"actions":{"defer_flags":{"one":"Defer flag"},"by_you_and_others":{"off_topic":{"one":"You and 1 other flagged this as off-topic"},"spam":{"one":"You and 1 other flagged this as spam"},"inappropriate":{"one":"You and 1 other flagged this as inappropriate"},"notify_moderators":{"one":"You and 1 other flagged this for moderation"},"notify_user":{"one":"You and 1 other sent a message to this user"},"bookmark":{"one":"You and 1 other bookmarked this post"},"like":{"one":"You and 1 other liked this"},"vote":{"one":"You and 1 other voted for this post"}},"by_others":{"off_topic":{"one":"1 person flagged this as off-topic"},"spam":{"one":"1 person flagged this as spam"},"inappropriate":{"one":"1 person flagged this as inappropriate"},"notify_moderators":{"one":"1 person flagged this for moderation"},"notify_user":{"one":"1 person sent a message to this user"},"bookmark":{"one":"1 person bookmarked this post"},"like":{"one":"1 person liked this"},"vote":{"one":"1 person voted for this post"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?"}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go..."},"left":{"one":"1 remaining"}}},"topic_map":{"clicks":{"one":"1 click"}},"post_links":{"title":{"one":"1 more"}},"views_lowercase":{"one":"view"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (1)"}},"unread":{"title_with_count":{"one":"Unread (1)"},"lower_title_with_count":{"one":"1 unread"}},"new":{"lower_title_with_count":{"one":"1 new"},"title_with_count":{"one":"New (1)"}},"category":{"title_with_count":{"one":"{{categoryName}} (1)"}}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time"},"badge_count":{"one":"1 Badge"},"more_badges":{"one":"+1 More"},"granted":{"one":"1 granted"}},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option"}}}},"details":{"title":"Hide Details"},"admin":{"flags":{"summary":{"action_type_3":{"one":"off-topic"},"action_type_4":{"one":"inappropriate"},"action_type_6":{"one":"custom"},"action_type_7":{"one":"custom"},"action_type_8":{"one":"spam"}}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"users":{"approved_selected":{"one":"approve user"},"reject_selected":{"one":"reject user"},"reject_successful":{"one":"Successfully rejected 1 user."},"reject_failures":{"one":"Failed to reject 1 user."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)"},"tl3_requirements":{"table_title":{"one":"In the last day:"}}},"site_settings":{"categories":{"user_api":"User API"}},"badges":{"preview":{"grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned."}}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'zh_CN';
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
//! locale : chinese (zh-cn)
//! author : suupic : https://github.com/suupic
//! author : Zeno Zeng : https://github.com/zenozeng

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var zh_cn = moment.defineLocale('zh-cn', {
        months : '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'.split('_'),
        monthsShort : '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
        weekdays : '星期日_星期一_星期二_星期三_星期四_星期五_星期六'.split('_'),
        weekdaysShort : '周日_周一_周二_周三_周四_周五_周六'.split('_'),
        weekdaysMin : '日_一_二_三_四_五_六'.split('_'),
        longDateFormat : {
            LT : 'Ah点mm分',
            LTS : 'Ah点m分s秒',
            L : 'YYYY-MM-DD',
            LL : 'YYYY年MMMD日',
            LLL : 'YYYY年MMMD日Ah点mm分',
            LLLL : 'YYYY年MMMD日ddddAh点mm分',
            l : 'YYYY-MM-DD',
            ll : 'YYYY年MMMD日',
            lll : 'YYYY年MMMD日Ah点mm分',
            llll : 'YYYY年MMMD日ddddAh点mm分'
        },
        meridiemParse: /凌晨|早上|上午|中午|下午|晚上/,
        meridiemHour: function (hour, meridiem) {
            if (hour === 12) {
                hour = 0;
            }
            if (meridiem === '凌晨' || meridiem === '早上' ||
                    meridiem === '上午') {
                return hour;
            } else if (meridiem === '下午' || meridiem === '晚上') {
                return hour + 12;
            } else {
                // '中午'
                return hour >= 11 ? hour : hour + 12;
            }
        },
        meridiem : function (hour, minute, isLower) {
            var hm = hour * 100 + minute;
            if (hm < 600) {
                return '凌晨';
            } else if (hm < 900) {
                return '早上';
            } else if (hm < 1130) {
                return '上午';
            } else if (hm < 1230) {
                return '中午';
            } else if (hm < 1800) {
                return '下午';
            } else {
                return '晚上';
            }
        },
        calendar : {
            sameDay : function () {
                return this.minutes() === 0 ? '[今天]Ah[点整]' : '[今天]LT';
            },
            nextDay : function () {
                return this.minutes() === 0 ? '[明天]Ah[点整]' : '[明天]LT';
            },
            lastDay : function () {
                return this.minutes() === 0 ? '[昨天]Ah[点整]' : '[昨天]LT';
            },
            nextWeek : function () {
                var startOfWeek, prefix;
                startOfWeek = moment().startOf('week');
                prefix = this.diff(startOfWeek, 'days') >= 7 ? '[下]' : '[本]';
                return this.minutes() === 0 ? prefix + 'dddAh点整' : prefix + 'dddAh点mm';
            },
            lastWeek : function () {
                var startOfWeek, prefix;
                startOfWeek = moment().startOf('week');
                prefix = this.unix() < startOfWeek.unix()  ? '[上]' : '[本]';
                return this.minutes() === 0 ? prefix + 'dddAh点整' : prefix + 'dddAh点mm';
            },
            sameElse : 'LL'
        },
        ordinalParse: /\d{1,2}(日|月|周)/,
        ordinal : function (number, period) {
            switch (period) {
            case 'd':
            case 'D':
            case 'DDD':
                return number + '日';
            case 'M':
                return number + '月';
            case 'w':
            case 'W':
                return number + '周';
            default:
                return number;
            }
        },
        relativeTime : {
            future : '%s内',
            past : '%s前',
            s : '几秒',
            m : '1 分钟',
            mm : '%d 分钟',
            h : '1 小时',
            hh : '%d 小时',
            d : '1 天',
            dd : '%d 天',
            M : '1 个月',
            MM : '%d 个月',
            y : '1 年',
            yy : '%d 年'
        },
        week : {
            // GB/T 7408-1994《数据元和交换格式·信息交换·日期和时间表示法》与ISO 8601:1988等效
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return zh_cn;

}));
moment.fn.shortDateNoYear = function(){ return this.format('MMMDo'); };
moment.fn.shortDate = function(){ return this.format('ll'); };
moment.fn.longDate = function(){ return this.format('lll'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
