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
r += "이 카테고리에 ";
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
r += "is <a href='/unread'>1개의 안 읽은</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "개의 안 읽은</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1개의 새로운</a> 주제가";
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
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
})() + " 새로운</a> 주제가";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " 남아 있고, ";
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
r += " 주제도 확인해보세요.";
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
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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

MessageFormat.locale.ko = function ( n ) {
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
I18n.translations = {"ko":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"바이트"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}천","millions":"{{number}}백만"}},"dates":{"time":"a h:mm","long_no_year":"M D a h:mm","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"YYYY MMM D a h:mm","long_with_year_no_time":"YYYY MMM D","full_with_year_no_time":"YYYY MMMM Do","long_date_with_year":"'YY MMM D.  LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"'YY MMM D","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"'YY MMM D \u003cbr/\u003eLT","wrap_ago":"%{date} 전","tiny":{"half_a_minute":"\u003c 1분","less_than_x_seconds":{"other":"\u003c %{count}초"},"x_seconds":{"other":"%{count}초 전"},"x_minutes":{"other":"%{count}분 전"},"about_x_hours":{"other":"%{count}시간"},"x_days":{"other":"%{count}일 전"},"about_x_years":{"other":"%{count}년"},"over_x_years":{"other":"\u003e %{count}년"},"almost_x_years":{"other":"%{count}년"},"date_month":"MMM D","date_year":"'YY MMM"},"medium":{"x_minutes":{"other":"%{count}분"},"x_hours":{"other":"%{count}시간"},"x_days":{"other":"%{count}일"},"date_year":"'YY MMM D"},"medium_with_ago":{"x_minutes":{"other":"%{count}분 전"},"x_hours":{"other":"%{count}시간 전"},"x_days":{"other":"%{count}일 전"}},"later":{"x_days":{"other":"%{count}일 후"},"x_months":{"other":"%{count}달 후"},"x_years":{"other":"%{count}년 후"}},"previous_month":"이전 달","next_month":"다음 달"},"share":{"topic":"주제를 공유합니다.","post":"게시글 #%{postNumber}","close":"닫기","twitter":"twitter로 공유","facebook":"Facebook으로 공유","google+":"Google+로 공유","email":"이메일로 공유"},"action_codes":{"split_topic":"이 주제를 ${when} 분리","invited_user":"%{who}이(가) %{when}에 초대됨","removed_user":"%{who}이(가) %{when}에 삭제됨","autoclosed":{"enabled":"%{when}에 닫힘","disabled":"%{when}에 열림"},"closed":{"enabled":"%{when}에 닫힘","disabled":"%{when}에 열림"},"archived":{"enabled":"%{when} 보관","disabled":"%{when} 보관 취소"},"pinned":{"enabled":"%{when} 고정","disabled":"%{when} 고정 취소"},"pinned_globally":{"enabled":"%{when} 전역적으로 고정","disabled":"%{when} 고정취소"},"visible":{"enabled":"%{when} 목록에 게시","disabled":"%{when} 목록에서 감춤"}},"topic_admin_menu":"주제 관리자 기능","emails_are_disabled":"관리자가 이메일 송신을 전체 비활성화 했습니다. 어떤 종류의 이메일 알림도 보내지지 않습니다.","s3":{"regions":{"us_east_1":"미국 동부 (N. 버지니아)","us_west_1":"미국 서부 (N. 캘리포니아)","us_west_2":"미국 서부 (오레곤)","us_gov_west_1":"AWS GovCloud(US)","eu_west_1":"유럽연합 (아일랜드)","eu_central_1":"유럽연합 (프랑크푸르트)","ap_southeast_1":"아시아 태평양 (싱가폴)","ap_southeast_2":"아시아 태평양 (시드니)","ap_northeast_1":"아시아 태평양 (토쿄)","ap_northeast_2":"아시아 태평양 (서울)","sa_east_1":"남 아메리카 (상파울로)"}},"edit":"이 주제의 제목과 카테고리 편집","not_implemented":"죄송합니다. 아직 사용할 수 없는 기능입니다.","no_value":"아니오","yes_value":"예","generic_error":"죄송합니다. 오류가 발생하였습니다.","generic_error_with_reason":"오류가 발생하였습니다: %{error}","sign_up":"회원가입","log_in":"로그인","age":"나이","joined":"가입함","admin_title":"관리자","flags_title":"신고","show_more":"더 보기","show_help":"옵션","links":"링크","links_lowercase":{"other":"링크"},"faq":"FAQ","guidelines":"가이드라인","privacy_policy":"개인보호 정책","privacy":"개인정보처리방침","terms_of_service":"서비스 이용약관","mobile_view":"모바일로 보기","desktop_view":"PC로 보기","you":"당신","or":"또는","now":"방금 전","read_more":"더 읽기","more":"더","less":"덜","never":"전혀","every_30_minutes":"매 30분 마다","every_hour":"매 한시간 마다","daily":"매일","weekly":"매주","every_two_weeks":"격주","every_three_days":"3일마다","max_of_count":"최대 {{count}}","alternation":"또는","character_count":{"other":"{{count}} 자"},"suggested_topics":{"title":"추천 주제","pm_title":"추천 메세지"},"about":{"simple_title":"About","title":"About %{title}","stats":"사이트 통계","our_admins":"관리자","our_moderators":"운영자","stat":{"all_time":"전체","last_7_days":"지난 7일","last_30_days":"최근 30일"},"like_count":"좋아요","topic_count":"주제","post_count":"게시글","user_count":"새로운 사용자","active_user_count":"활성화된 사용자","contact":"문의","contact_info":"사이트 운영과 관련된 사항이나 요청이 있으시다면 이메일 %{contact_info}로 연락주시기 바랍니다."},"bookmarked":{"title":"북마크","clear_bookmarks":"북마크 제거","help":{"bookmark":"북마크하려면 이 주제의 첫번째 게시글을 클릭하세요","unbookmark":"북마크를 제거하려면 이 주제의 첫 번째 게시글을 클릭하세요"}},"bookmarks":{"not_logged_in":"죄송합니다. 게시물을 즐겨찾기에 추가하려면 로그인을 해야 합니다.","created":"이 게시글을 북마크 하였습니다.","not_bookmarked":"이 게시물을 읽으셨습니다. 즐겨찾기에 추가하려면 클릭하세요.","last_read":"마지막으로 읽으신 게시물입니다. 즐겨찾기에 추가하려면 클릭하세요.","remove":"북마크 삭제","confirm_clear":"정말 이 주제의 모든 북마크를 제거하시겠습니까?"},"topic_count_latest":{"other":"{{count}} 새 주제 혹은 업데이트된 주제"},"topic_count_unread":{"other":"{{count}} 읽지 않은 주제"},"topic_count_new":{"other":"{{count}}개의 새로운 주제"},"click_to_show":"보려면 클릭하세요.","preview":"미리보기","cancel":"취소","save":"변경사항 저장","saving":"저장 중...","saved":"저장 완료!","upload":"업로드","uploading":"업로드 중...","uploading_filename":"{{filename}} 업로드 중...","uploaded":"업로드 완료!","enable":"활성화","disable":"비활성화","undo":"실행 취소","revert":"되돌리기","failed":"실패","banner":{"close":"배너 닫기","edit":"이 배너 수정 \u003e\u003e"},"choose_topic":{"none_found":"주제를 찾을 수 없습니다.","title":{"search":"이름, url, ID로 주제 검색","placeholder":"여기에 주제 제목을 입력하세요"}},"queue":{"topic":"주제:","approve":"승인","reject":"거절","delete_user":"사용자 삭제","title":"승인 필요","none":"리뷰할 포스트가 없습니다.","edit":"편집","cancel":"취소","view_pending":"대기중인 게시글","has_pending_posts":{"other":"이 주제에는 \u003cb\u003e{{count}}\u003c/b\u003e개의 승인 대기중인 게시글이 있습니다."},"confirm":"변경사항 저장","delete_prompt":"정말로 \u003cb\u003e%{username}\u003c/b\u003e; 회원을 삭제하시겠습니까? 게시글이 모두 삭제되고 IP와 이메일이 차단됩니다.","approval":{"title":"게시글 승인 필요","description":"새로운 게시글이 있습니다. 그러나 이 게시글이 보여지려면 운영자의 승인이 필요합니다.","pending_posts":{"other":"대기중인 게시글이 \u003cstrong\u003e{{count}}\u003c/strong\u003e개 있습니다."},"ok":"확인"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{topicUrl}}'\u003e주제\u003c/a\u003e를 게시함","you_posted_topic":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 \u003ca href='{{topicUrl}}'\u003e주제\u003c/a\u003e를 게시함","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이  \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e 게시글에 답글 올림","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e 게시글에 답글 올림","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{topicUrl}}'\u003e주제\u003c/a\u003e에 답글 올림","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 \u003ca href='{{topicUrl}}'\u003e주제\u003c/a\u003e에 답글 올림","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e를 멘션함","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{user2Url}}'\u003e나\u003c/a\u003e를 멘션함","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003e내\u003c/a\u003e가 \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e님을 멘션함","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e에 의해 게시됨","posted_by_you":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 게시함","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이 보냄","sent_by_you":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 보냄"},"directory":{"filter_name":"아이디로 필터","title":"사용자","likes_given":"제공한","likes_received":"받은","topics_entered":"읽음","topics_entered_long":"읽은 주제","time_read":"읽은 시간","topic_count":"주제","topic_count_long":"생성된 주제","post_count":"답글","post_count_long":"답글","no_results":"결과가 없습니다.","days_visited":"조회수","days_visited_long":"일일 조회수","posts_read":"읽음","posts_read_long":"게시글 읽음","total_rows":{"other":"%{count} 사용자"}},"groups":{"empty":{"posts":"이 그룹의 구성원에 의해 작성된 게시물은 없습니다.","members":"이 그룹에는 구성원이 없습니다.","mentions":"이 그룹에 대한 언급이 없습니다.","messages":"이 그룹에 대한 메시지는 없습니다.","topics":"이 그룹의 구성원에 의해 작성된 주제글이 없습니다."},"add":"추가","selector_placeholder":"멤버 추가","owner":"소유자","visible":"모든 사용자에게 보이는 그룹입니다.","title":{"other":"그룹"},"members":"멤버","topics":"주제","posts":"게시글","mentions":"멘션","messages":"메시지","alias_levels":{"title":"누가 이 그룹에 메시지와 @멘션을 보낼 수 있습니까?","nobody":"0명","only_admins":"관리자 전용","mods_and_admins":"운영자 및 관리자만","members_mods_and_admins":"그룹 멤버, 운영자, 관리자만","everyone":"모두"},"trust_levels":{"title":"멤버들이 추가되면 회원등급이 자동으로 부여됩니다:","none":"없음"},"notifications":{"watching":{"title":"알림 : 주시 중","description":"이 메시지에 새로운 답글이 있을 때 알림을 받게 되며 새로운 답글의 개수는 표시됩니다."},"tracking":{"title":"알림 : 새 글 표시 중","description":"누군가 당신의 @아이디 로 언급했거나 당신의 글에 답글이 달릴 때 알림을 받게 됩니다."},"regular":{"title":"알림 : 일반","description":"누군가 당신의 @아이디 로 언급했거나 당신의 글에 답글이 달릴 때 알림을 받게 됩니다."},"muted":{"title":"알림 : 끔","description":"이 메시지에 대해 어떠한 알림도 받지 않지 않습니다."}}},"user_action_groups":{"1":"선사한 '좋아요'","2":"받은 '좋아요'","3":"북마크","4":"주제","5":"답글","6":"응답","7":"멘션","9":"인용","11":"편집","12":"보낸 편지함","13":"받은 편지함","14":"대기"},"categories":{"all":"전체 카테고리","all_subcategories":"모든 하위 카테고리","no_subcategory":"없음","category":"카테고리","category_list":"카테고리 목록 표시","reorder":{"title":"카테고리 순서변경","title_long":"카테고리 목록 재구성","fix_order":"위치 고정","fix_order_tooltip":"카데고리에 고유 위치가 표시되지 않은 게 있습니다. 이 경우 예기치 않은 문제를 일으킬 수 있습니다.","save":"순서 저장","apply_all":"적용","position":"위치"},"posts":"게시글","topics":"주제","latest":"최근","latest_by":"가장 최근","toggle_ordering":"정렬 컨트롤 토글","subcategories":"하위 카테고리","topic_stat_sentence":{"other":"지난 %{unit} 동안 %{count}개의 새로운 주제가 있습니다."}},"ip_lookup":{"title":"IP Address Lookup","hostname":"Hostname","location":"위치","location_not_found":"(알수없음)","organisation":"소속","phone":"전화","other_accounts":"현재 IP주소의 다른 계정들:","delete_other_accounts":"삭제 %{count}","username":"아이디","trust_level":"TL","read_time":"읽은 시간","topics_entered":"입력된 제목:","post_count":"포스트 개수","confirm_delete_other_accounts":"정말 이 계정들을 삭제하시겠습니까?"},"user_fields":{"none":"(옵션을 선택하세요)"},"user":{"said":"{{username}}:","profile":"프로필","mute":"알림 끄기","edit":"환경 설정 편집","download_archive":"내 게시글 다운로드","new_private_message":"새로운 메시지","private_message":"메시지","private_messages":"메시지","activity_stream":"활동","preferences":"환경 설정","expand_profile":"확장","bookmarks":"북마크","bio":"내 소개","invited_by":"(이)가 초대했습니다.","trust_level":"신뢰도","notifications":"알림","statistics":"통계","desktop_notifications":{"label":"데스크탑 알림","not_supported":"안타깝게도 지금 사용하고 계시는 브라우저는 알림을 지원하지 않습니다.","perm_default":"알림 켜기","perm_denied_btn":"권한 거부","perm_denied_expl":"통지를 위한 허용을 거절했었습니다. 브라우저 설정을 통해서 통지를 허용해주세요.","disable":"알림 비활성화","enable":"알림 활성화","each_browser_note":"노트: 사용하시는 모든 브라우저에서 이 설정을 변경해야합니다."},"dismiss_notifications_tooltip":"읽지 않은 알림을 모두 읽음으로 표시","disable_jump_reply":"댓글을 작성했을 때, 새로 작성한 댓글로 화면을 이동하지 않습니다.","dynamic_favicon":"새 글이나 업데이트된 글 수를 브라우저 아이콘에 보이기","external_links_in_new_tab":"모든 외부 링크를 새 탭에 열기","enable_quoting":"강조 표시된 텍스트에 대한 알림을 사용합니다","change":"변경","moderator":"{{user}}님은 운영자입니다","admin":"{{user}}님은 관리자 입니다","moderator_tooltip":"이 회원은 운영자 입니다","admin_tooltip":"이 회원은 관리자입니다.","blocked_tooltip":"이 회원은 차단되었습니다","suspended_notice":"이 회원은 {{date}}까지 접근 금지 되었습니다.","suspended_reason":"이유: ","github_profile":"Github","email_activity_summary":"활동 요약","watched_categories":"지켜보기","tracked_categories":"추적하기","muted_categories":"알림 끄기","muted_categories_instructions":"이 카테고리 내의 새 주제에 대해 어떠한 알림도 받을 수 없으며, 최근의 주제도 나타나지 않습니다.","delete_account":"내 계정 삭제","delete_account_confirm":"정말로 계정을 삭제할까요? 이 작업은 되돌릴 수 없습니다.","deleted_yourself":"계정이 삭제 되었습니다.","delete_yourself_not_allowed":"지금은 계정을 삭제할 수 없습니다. 관리자에게 연락해 주세요.","unread_message_count":"메시지","admin_delete":"삭제","users":"회원","muted_users":"알람 끄기","muted_users_instructions":"이 회원이 보낸 알림 모두 숨김","muted_topics_link":"알림을 끈 주제 보기","automatically_unpin_topics":"글 끝에 다다르면 자동으로 주제 고정을 해제합니다.","staff_counters":{"flags_given":"유용한 신고","flagged_posts":"신고된 글","deleted_posts":"삭제된 글","suspensions":"정지시킨 계정","warnings_received":"경고"},"messages":{"all":"전체","inbox":"수신함","sent":"보냄","archive":"저장됨","groups":"내 그룹","bulk_select":"메시지 선택","move_to_inbox":"수신함으로 이동","move_to_archive":"보관하기","failed_to_move":"선택한 메시지를 이동할 수 없습니다 (아마도 네트워크가 다운됨)","select_all":"모두 선택"},"change_password":{"success":"(이메일 전송)","in_progress":"(이메일 전송 중)","error":"(오류)","action":"비밀번호 재설정 메일 보내기","set_password":"비밀번호 설정"},"change_about":{"title":"내 소개 변경","error":"값을 바꾸는 중 에러가 발생했습니다."},"change_username":{"title":"아이디 변경","taken":"죄송합니다. 이미 사용 중인 아이디입니다.","error":"아이디를 변경하는 중에 오류가 발생했습니다.","invalid":"아이디가 잘못되었습니다. 숫자와 문자를 포함해야합니다."},"change_email":{"title":"이메일 변경","taken":"죄송합니다. 해당 이메일은 사용 할 수 없습니다.","error":"이메일 변경 중 오류가 발생했습니다. 이미 사용 중인 이메일인지 확인해주세요.","success":"이메일 발송이 완료되었습니다. 확인하신 후 절차에 따라주세요."},"change_avatar":{"title":"프로필 사진 변경","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e 기반","gravatar_title":"Gravata 웹사이트에서 아바타 바꾸기","refresh_gravatar_title":"Gravatar 새로고침","letter_based":"자동 생성된 아바타","uploaded_avatar":"커스텀 사진","uploaded_avatar_empty":"커스텀 사진 추가","upload_title":"프로필 사진 업로드","upload_picture":"사진 업로드","image_is_not_a_square":"경고: 정사각형 이미지가 아니기 때문에 사진을 수정하였습니다.","cache_notice":"프로필 사진을 바꾸는데 성공했습니다만 브라우져 캐쉬로 인해 보여지기까지 시간이 조금 걸립니다."},"change_profile_background":{"title":"프로필 배경","instructions":"프로필 배경은 가운데를 기준으로 표시되며 850px이 기본 가로 사이즈 입니다."},"change_card_background":{"title":"사용자 카드 배경","instructions":"배경 이미지는 가운데를 기준으로 표시되며 590px이 기본 가로 사이즈 입니다."},"email":{"title":"이메일","instructions":"절대로 공개되지 않습니다.","ok":"내 이메일로 확인 메일이 전송됩니다.","invalid":"유효한 이메일 주소를 입력해주세요.","authenticated":"내 이메일이 {{provider}}에 의해 인증되었습니다.","frequency_immediately":"만약 전송된 메일을 읽지 않았을 경우, 즉시 메일을 다시 보내드립니다.","frequency":{"other":"최근  {{count}}분 동안접속하지 않을 경우에만 메일이 전송됩니다."}},"name":{"title":"이름","instructions":"이름을 적어주세요. (선택사항)","instructions_required":"이름","too_short":"이름이 너무 짧습니다.","ok":"사용 가능한 이름입니다."},"username":{"title":"아이디","instructions":"중복될 수 없으며 띄어쓰기 사용이 불가합니다. 짧을 수록 좋아요.","short_instructions":"@{{username}}으로 멘션이 가능합니다.","available":"아이디\u001d로 사용가능합니다.","global_match":"이메일이 등록된 아이디와 연결되어 있습니다.","global_mismatch":"이미 등록된 아이디입니다. 다시 시도해보세요. {{suggestion}}","not_available":"사용할 수 없는 아이디입니다. 다시 시도해보세요. {{suggestion}}","too_short":"아이디가 너무 짧습니다","too_long":"아이디가 너무 깁니다.","checking":"사용가능한지 확인 중...","enter_email":"아이디를 찾았습니다. 일치하는 이메일을 입력해주세요.","prefilled":"이메일이 등록된 아이디와 연결되어 있습니다."},"locale":{"title":"인터페이스 언어","instructions":"UI 언어. 변경 후 새로 고침하면 반영됩니다.","default":"(기본)"},"password_confirmation":{"title":"비밀번호를 재입력해주세요."},"last_posted":"마지막글","last_emailed":"마지막 이메일","last_seen":"마지막 접속","created":"생성일","log_out":"로그아웃","location":"위치","card_badge":{"title":"사용자 카드 배지"},"website":"웹사이트","email_settings":"이메일","like_notification_frequency":{"title":"누군가 '좋아요' 해주면 알려주기","always":"항상","never":"절대"},"email_previous_replies":{"title":"이메일 밑부분에 이전 댓글을 포함합니다.","unless_emailed":"예전에 발송된 것이 아닌 한","always":"항상","never":"절대"},"email_digests":{"every_30_minutes":"매 30분 마다","every_hour":"매 시간","daily":"매일","every_three_days":"매 3일마다","weekly":"매주","every_two_weeks":"격주"},"email_in_reply_to":"이메일에 글 응답내용을 발췌해서 포함하기 ","email_direct":"누군가 나를 인용했을 때, 내 글에 답글을 달았을때, 내 이름을 멘션했을때 혹은 토픽에 나를 초대했을 떄 이메일 보내기","email_private_messages":"누군가 나에게 메시지를 보냈을때 이메일 보내기","email_always":"사이트를 이용중 일 때도 이메일 알림 보내기","other_settings":"추가 사항","categories_settings":"카테고리","new_topic_duration":{"label":"새글을 정의해주세요.","not_viewed":"아직 보지 않았습니다.","last_here":"마지막 방문이후 작성된 주제","after_1_day":"지난 하루간 생성된 주제","after_2_days":"지난 2일간 생성된 주제","after_1_week":"최근 일주일간 생성된 주제","after_2_weeks":"지난 2주간 생성된 주제"},"auto_track_topics":"마지막 방문이후 작성된 주제","auto_track_options":{"never":"하지않음","immediately":"즉시","after_30_seconds":"30초 후","after_1_minute":"1분 후","after_2_minutes":"2분 후","after_3_minutes":"3분 후","after_4_minutes":"4분 후","after_5_minutes":"5분 후","after_10_minutes":"10분 후"},"invited":{"search":"검색","title":"초대","user":"사용자 초대","sent":"보냄","none":"승인을 기다리는 초대가 더이상 없습니다.","truncated":{"other":"앞 {{count}}개의 초대를 보여줍니다."},"redeemed":"초대를 받았습니다.","redeemed_tab":"Redeemed","redeemed_tab_with_count":"교환된 ({{count}})","redeemed_at":"에 초대되었습니다.","pending":"초대를 보류합니다.","pending_tab":"보류","pending_tab_with_count":"지연 ({{count}})","topics_entered":"읽은 주제","posts_read_count":"글 읽기","expired":"이 초대장의 기한이 만료되었습니다.","rescind":"삭제","rescinded":"초대가 제거되었습니다.","reinvite":"초대 메일 재전송","reinvited":"초대 메일 재전송 됨","time_read":"읽은 시간","days_visited":"일일 방문","account_age_days":"일일 계정 나이","create":"이 포럼에 친구를 초대하기","generate_link":"초대 링크 복사","generated_link_message":"\u003cp\u003e초대 링크가 성공적으로 생성되었습니다!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003e초대 링크는 다음 이메일에 한해 유효합니다: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"아직 아무도 초대하지 않았습니다. 초대장을 각각 보내거나, \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003euploading a bulk invite file\u003c/a\u003e을 이용하여 단체 초대를 보낼 수 있습니다.","text":"파일로 대량 초대하기","uploading":"업로드 중...","success":"파일이 성공적으로 업로드되었습니다. 완료되면 메시지로 알려드리겠습니다.","error":"'{{filename}}': {{message}} 업로드중 에러가 있었습니다."}},"password":{"title":"비밀번호","too_short":"암호가 너무 짧습니다.","common":"That password is too common.","same_as_username":"비밀번호가 아이디와 동일합니다.","same_as_email":"비밀번호가 이메일과 동일합니다.","ok":"적절한 암호입니다.","instructions":"글자 수가 %{count}자 이상이어야 합니다."},"summary":{"title":"요약","stats":"통계","time_read":"읽은 시간","topic_count":{"other":"작성 시간"},"post_count":{"other":"작성 시간"},"likes_given":{"other":"좋아요"},"likes_received":{"other":"받음"},"top_replies":"인기 댓글","more_replies":"답글 더 보기","top_topics":"인기 주제","more_topics":"주제 더 보기","top_badges":"인기 배지","no_badges":"아직 배지가 없습니다.","more_badges":"배지 더 보기"},"associated_accounts":"로그인","ip_address":{"title":"마지막 IP 주소"},"registration_ip_address":{"title":"IP Address 등록"},"avatar":{"title":"프로필 사진","header_title":"프로필, 메시지, 북마크 그리고 설정"},"title":{"title":"호칭"},"filters":{"all":"전체"},"stream":{"posted_by":"에 의해 작성되었습니다","sent_by":"에 의해 전송되었습니다","private_message":"메시지","the_topic":"주제"}},"loading":"로딩 중...","errors":{"prev_page":"로드하는 중","reasons":{"network":"네트워크 에러","server":"서버 에러","forbidden":"접근 거부됨","unknown":"에러","not_found":"페이지를 찾을 수 없습니다"},"desc":{"network":"접속상태를 확인해주세요.","network_fixed":"문제가 해결된 것으로 보입니다.","server":"에러 코드: {{status}}","forbidden":"볼 수 있도록 허용되지 않았습니다.","not_found":"에구, 어플리케이션이 없는 URL를 가져오려고 시도했습니다.","unknown":"문제가 발생했습니다."},"buttons":{"back":"뒤로가기","again":"다시시도","fixed":"페이지 열기"}},"close":"닫기","assets_changed_confirm":"사이트가 업데이트 되었습니다. 새로고침하시겠습니까?","logout":"로그아웃 되었습니다.","refresh":"새로고침","read_only_mode":{"enabled":"이 사이트는 현재 읽기전용 모드입니다. 브라우징은 가능하지만, 댓글달기, 좋아요 등 다른 행위들은 현재 비활성화 되어있습니다.","login_disabled":"사이트가 읽기 전용모드로 되면서 로그인은 비활성화되었습니다."},"too_few_topics_and_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e토론을 시작하시죠!\u003c/a\u003e 현재 \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e 주제와 \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e 글이 있습니다. 새 방문자에게는 읽고 응답할 대화거리가 필요합니다.","too_few_topics_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e토론을 시작하시죠!\u003c/a\u003e 현재 \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e 주제가 있습니다. 새 방문자에게는 읽고 응답할 대화거리가 필요합니다.","too_few_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e토론을 시작하시죠!\u003c/a\u003e 현재 \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e 글이 있습니다. 새 방문자에게는 읽고 응답할 대화거리가 필요합니다.","learn_more":"더 배우기","year":"년","year_desc":"지난 365일간 생성된 주제","month":"월","month_desc":"지난 30일간 생성된 주제","week":"주","week_desc":"지난 7일간 생성된 주제","day":"일","first_post":"첫 번째 글","mute":"음소거","unmute":"음소거 해제","last_post":"최근 글","last_reply_lowercase":"마지막 답글","replies_lowercase":{"other":"답글"},"signup_cta":{"sign_up":"회원가입","hide_session":"내일 다시 알려주기","hide_forever":"사양합니다.","hidden_for_session":"알겠습니다. 내일 다시 물어볼께요. 언제든지 '로그인'을 통해서도 계정을 만들 수 있습니다.","intro":"안녕하세요! :heart_eyes: 글읽기는 좋아하시는데 아직 회원가입은 안하신 것 같네요.","value_prop":"회원가입 하시면 글을 어디까지 읽으셨는지 저희가 기억하기 때문에, 언제든지 마지막 읽은 위치로 바로 돌아갈 수 있답니다. 그리고 새글이 뜰때마다 이 화면과 이메일로 알림을 받을수도 있고, 좋아요를 클릭해서 글에 대한 애정을 표현하실 수도 있어요. :heartbeat:"},"summary":{"enabled_description":"현재 커뮤니티에서 가장 인기있는 주제의 요약본을 보고 있습니다:","description":"댓글이 \u003cb\u003e{{replyCount}}개\u003c/b\u003e 있습니다.","description_time":"댓글이 \u003cb\u003e{{replyCount}}개\u003c/b\u003e 있고 다 읽는데 \u003cb\u003e{{readingTime}} 분\u003c/b\u003e이 걸립니다.","enable":"이 주제를 요약","disable":"모든 포스트 보기"},"deleted_filter":{"enabled_description":"이 주제는 삭제된 글들을 포함하고 있습니다. 삭제된 글을 보이지 않습니다.","disabled_description":"삭제된 글들을 표시하고 있습니다.","enable":"삭제된 글 숨김","disable":"삭제된 글 보기"},"private_message_info":{"title":"메시지","invite":"다른 사람 초대","remove_allowed_user":"{{name}}에게서 온 메시지를 삭제할까요?"},"email":"이메일","username":"아이디","last_seen":"마지막 접속","created":"생성","created_lowercase":"최초 글","trust_level":"회원등급","search_hint":"아이디, 이메일 혹은 IP 주소","create_account":{"title":"회원 가입","failed":"뭔가 잘못되었습니다. 이 메일은 등록이 되어있습니다. 비밀번호를 잊으셨다면 비밀번호 찾기를 눌러주세요."},"forgot_password":{"title":"비밀번호 재설정","action":"비밀번호를 잊어버렸습니다.","invite":"사용자 이름 또는 이메일 주소를 입력하시면 비밀번호 재설정 이메일을 보내드립니다.","reset":"암호 재설정","complete_username":"자신의 아이디가 \u003cb\u003e%{username}\u003c/b\u003e이라면, 곧 비밀번호 초기화 방법과 관련된 안내 메일을 받게 됩니다.","complete_email":"만약 계정이 \u003cb\u003e%{email}\u003c/b\u003e과 일치한다면, 비밀번호를 재설정하는 방법에 대한 이메일을 곧 받게 됩니다.","complete_username_found":"\u003cb\u003e%{username}\u003c/b\u003e과 일치하는 계정을 찾았습니다. 비밀번호를 초기화하는 방법이 담긴 메일을 발송하였으니 확인하여 주십시요.","complete_email_found":"\u003cb\u003e%{email}\u003c/b\u003e과 일치하는 계정을 찾았습니다. 비밀번호를 초기화하는 방법이 담긴 메일을 발송하였으니 확인하여 주십시요.","complete_username_not_found":"\u003cb\u003e%{username}\u003c/b\u003e과 일치하는 계정이 없습니다.","complete_email_not_found":"\u003cb\u003e%{email}\u003c/b\u003e과 일치하는 계정이 없습니다."},"login":{"title":"로그인","username":"사용자","password":"비밀번호","email_placeholder":"이메일 주소 또는 사용자 이름","caps_lock_warning":"Caps Lock 켜짐","error":"알 수없는 오류","rate_limit":"다시 로그인 하기전에 잠시만 기다려주세요.","blank_username_or_password":"이메일 또는 사용자명과 비밀번호를 입력해 주세요.","reset_password":"암호 재설정","logging_in":"로그인 중..","or":"또는","authenticating":"인증 중...","awaiting_confirmation":"계정 활성화를 기다리고 있습니다. 다른 인증 이메일을 받고 싶으면 비밀번호 찾기를 누르세요.","awaiting_approval":"스태프가 아직 내 계정을 승인하지 않았습니다. 승인되면 이메일을 받게됩니다.","requires_invite":"죄송합니다. 초대를 받은 사람만 이용하실 수 있습니다.","not_activated":"아직 로그인 할 수 없습니다. 계정을 만들었을때 \u003cb\u003e {{sentTo}} \u003c/b\u003e 주소로 인증 이메일을 보냈습니다. 계정을 활성화하려면 해당 이메일의 지침을 따르십시오.","not_allowed_from_ip_address":"이 IP 주소에서 로그인 할 수 없습니다.","admin_not_allowed_from_ip_address":"You can't log in as admin from that IP address.","resend_activation_email":"다시 인증 이메일을 보내려면 여기를 클릭하세요.","sent_activation_email_again":"\u003cb\u003e {{currentEmail}} \u003c/b\u003e 주소로 인증 이메일을 보냈습니다. 이메일이 도착하기까지 몇 분 정도 걸릴 수 있습니다. 또한 스팸 메일을 확인하십시오.","to_continue":"로그인 해주세요","preferences":"사용자 환경을 변경하려면 로그인이 필요합니다.","forgot":"내 계정의 상세내역 기억하지 않는다.","google":{"title":"Google","message":"Google 인증 중(팝업 차단을 해제 하세요)"},"google_oauth2":{"title":"with Google","message":"구글을 통해 인증 중 (파업이 허용되어 있는지 확인해주세요.)"},"twitter":{"title":"with Twitter","message":"Twitter 인증 중(팝업 차단을 해제 하세요)"},"facebook":{"title":"with Facebook","message":"Facebook 인증 중(팝업 차단을 해제 하세요)"},"yahoo":{"title":"Yahoo","message":"Yahoo 인증 중(팝업 차단을 해제 하세요)"},"github":{"title":"GitHub","message":"GitHub 인증 중(팝업 차단을 해제 하세요)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"이모지 :)","more_emoji":"더보기...","options":"온셥","whisper":"귓속말","add_warning":"공식적인 경고입니다.","toggle_whisper":"귀속말 켜고 끄기","posting_not_on_topic":"어떤 주제에 답글을 작성하시겠습니까?","saving_draft_tip":"저장 중...","saved_draft_tip":"저장 완료","saved_local_draft_tip":"로컬로 저장됩니다.","similar_topics":"작성하려는 내용과 비슷한 주제들...","drafts_offline":"초안","error":{"title_missing":"제목은 필수 항목입니다","title_too_short":"제목은 최소 {{min}} 글자 이상이어야 합니다.","title_too_long":"제목은 {{max}} 글자 이상일 수 없습니다.","post_missing":"글 내용은 필수 입니다.","post_length":"글은 최소 {{min}} 글자 이상이어야 합니다.","try_like":"\u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e 버튼을 사용해 보셨나요?","category_missing":"카테고리를 선택해주세요."},"save_edit":"편집 저장","reply_original":"기존 주제에 대해 답글을 작성합니다.","reply_here":"여기에 답글을 작성하세요.","reply":"답글 전송","cancel":"취소","create_topic":"새 주제 쓰기","create_pm":"메시지","title":"혹은 Ctrl + Enter 누름","users_placeholder":"사용자 추가","title_placeholder":"이야기 나누고자 하는 내용을 한문장으로 적는다면?","edit_reason_placeholder":"why are you editing?","show_edit_reason":"(add edit reason)","reply_placeholder":"여기에 타이핑 하세요. 마크다운 또는 BBCode, HTML 포맷을 이용하세요. 이미지를 끌어오거나 붙여넣기 하세요.","view_new_post":"새로운 글을 볼 수 있습니다.","saving":"저장 중...","saved":"저장 완료!","saved_draft":"작성중인 글이 있습니다. 계속 작성하려면 여기를 클릭하세요.","uploading":"업로딩 중...","show_preview":"미리보기를 보여줍니다 \u0026laquo;","hide_preview":"\u0026laquo; 미리보기를 숨기기","quote_post_title":"전체 글을 인용","bold_title":"굵게","bold_text":"굵게하기","italic_title":"강조","italic_text":"강조하기","link_title":"하이퍼링크","link_description":"링크 설명을 입력","link_dialog_title":"하이퍼링크 삽입","link_optional_text":"옵션 제목","quote_title":"인용구","quote_text":"인용구","code_title":"코드 샘플","code_text":"미리 지정된 양식 사용은 4개의 띄어쓰기로 들여쓰세요.","upload_title":"업로드","upload_description":"업로드 설명을 입력","olist_title":"번호 매기기 목록","ulist_title":"글 머리 기호 목록","list_item":"주제","heading_title":"표제","heading_text":"표제","hr_title":"수평선","help":"마크다운 편집 도움말","toggler":"작성 패널을 숨기거나 표시","modal_ok":"OK","modal_cancel":"취소","cant_send_pm":"죄송합니다. %{username}님에게 메시지를 보낼 수 없습니다.","admin_options_title":"이 주제에 대한 옵션 설정","auto_close":{"label":"주제 자동-닫기 시간:","error":"유효한 값은 눌러주세요.","based_on_last_post":"적어도 주제의 마지막 글이 이만큼 오래되지 않았으면 닫지 마세요.","all":{"examples":"시간을 숫자(24이하)로 입력하거나 분을 포함한 시간(17:30) 혹은 타임스탬프(2013-11-22 14:00) 형식으로 입력하세요."},"limited":{"units":"(# 시간)","examples":"시간에 해당하는 숫자를 입력하세요. (24)"}}},"notifications":{"title":"@name 언급, 글과 주제에 대한 답글, 개인 메시지 등에 대한 알림","none":"현재 알림을 불러올 수 없습니다.","more":"이전 알림을 볼 수 있습니다.","total_flagged":"관심 표시된 총 글","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003e'{{description}}' 배지를 받았습니다.\u003c/p\u003e","group_message_summary":{"other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{group_name}} 메시지상자에 {{count}}개의 메시지가 있습니다\u003c/p\u003e"},"alt":{"mentioned":"멘션 by","quoted":"인용  by","replied":"답글을 전송했습니다.","posted":"포스트 by","edited":"당신 글이 다음 이용자에 의해 수정","liked":"당신의 글을 좋아했음.","private_message":"다음 사람에게서온 개인 메시지","invited_to_private_message":"다음 사람으로부터 개인 메시지가 초대됨","invited_to_topic":"다음 사람으로부터 한 주제로 초대됨","invitee_accepted":"다음 사람에 의해 초대가 수락됨.","moved_post":"다음 사람에 의해서 당신의 글이 이동됨","linked":"당신 글로 링크하기","granted_badge":"배지가 수여됨.","group_message_summary":"그룹 메시지함의 메시지"},"popup":{"mentioned":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 나를 멘션했습니다","group_mentioned":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 당신을 언급했습니다","quoted":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 나를 인용했습니다","replied":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 내게 답글을 달았습니다","posted":"\"{{topic}}\" - {{site_title}}에서 {{username}}님이 글을 게시하였습니다","private_message":"{{username}}가 비공개 메시지를 \"{{topic}}\" - {{site_title}} 에 작성했습니다","linked":"{{username}}님이  \"{{topic}}\" - {{site_title}}에 내 글을 링크했습니다"}},"upload_selector":{"title":"이미지 추가하기","title_with_attachments":"이미지 또는 파일 추가하기","from_my_computer":"컴퓨터에서 가져오기","from_the_web":"인터넷에서 가져오기","remote_tip":"이미지 링크","remote_tip_with_attachments":"이미니자 파일 링크 {{authorized_extensions}}","local_tip":"기기에서 이미지 선택","local_tip_with_attachments":"디바이스에서 이미지나 파일을 선택하세요 {{authorized_extensions}}","hint":"(드래그\u0026드랍으로 업로드 가능)","hint_for_supported_browsers":"편집창에 이미지를 끌어다 놓거나 붙여넣기 할 수도 있습니다","uploading":"업로드 중입니다...","select_file":"파일 선택","image_link":"이 이미지를 누르면 이동할 링크"},"search":{"sort_by":"다음으로 정렬","relevance":"관련성","latest_post":"가장 최근 글","most_viewed":"가장 많이 본","most_liked":"가장 많이 좋아요를 받은","select_all":"모두 선택","clear_all":"다 지우기","result_count":{"other":"\u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e 검색결과 {{count}} 개"},"title":"주제, 글, 사용자, 카테고리 검색","no_results":"검색 결과가 없습니다","no_more_results":"더 이상 결과가 없습니다.","search_help":"검색 도움말","searching":"검색중...","post_format":"#{{post_number}} by {{username}}","context":{"user":"@{{username}}의 글 검색","topic":"이 주제를 검색","private_messages":"메시지 검색"}},"hamburger_menu":"다른 주제 목록이나 카테고리로 가기","new_item":"새로운","go_back":"돌아가기","not_logged_in_user":"user page with summary of current activity and preferences","current_user":"사용자 페이지로 이동","topics":{"bulk":{"unlist_topics":"주제 내리기","reset_read":"읽기 초기화","delete":"주제 삭제","dismiss":"해지","dismiss_read":"읽지않음 전부 해지","dismiss_button":"해지...","dismiss_tooltip":"새 글을 무시하거나 주제 추적 멈추기","also_dismiss_topics":"이 주제를 더 이상 추적하지 않고 읽지 않은 글에서 표시하지 않음","dismiss_new":"새글 제거","toggle":"주제 복수 선택","actions":"일괄 적용","change_category":"카테고리 변경","close_topics":"주제 닫기","archive_topics":"주제 보관하기","notification_level":"알림 설정 변경","choose_new_category":"주제의 새로운 카테고리를 선택","selected":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e개의 주제가 선택되었습니다."}},"none":{"unread":"읽지 않은 주제가 없습니다.","new":"읽을 새로운 주제가 없습니다.","read":"아직 어떠한 주제도 읽지 않았습니다.","posted":"아직 어떠한 주제도 작성되지 않았습니다.","latest":"최신 주제가 없습니다.","hot":"인기있는 주제가 없습니다.","bookmarks":"아직 북마크한 주제가 없습니다.","category":"{{category}}에 주제가 없습니다.","top":"Top 주제가 없습니다.","search":"검색 결과가 없습니다.","educate":{"new":"\u003cp\u003e회원님의 주제는 여기에 나타납니다.\u003c/p\u003e\u003cp\u003e기본적으로 생긴 지 이틀 안된 주제는 새것으로 간주하고 \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e 표시가 뜹니다.\u003c/p\u003e\u003cp\u003e바꾸고 싶으면 \u003ca href=\"%{userPrefsUrl}\"\u003e환경설정\u003c/a\u003e으로 가보세요.\u003c/p\u003e","unread":"\u003cp\u003e회원님이 읽지 않은 주제는 여기에 나타납니다.\u003c/p\u003e\u003cp\u003e기본적으로 주제는 읽지 않은 것으로 간주하고 다음과 같은 조건 중 하나를 만족하면 읽지 않은 글갯수 \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e 을 표시합니다:\u003c/p\u003e\u003cul\u003e\u003cli\u003e주제 만들기\u003c/li\u003e\u003cli\u003e주제에 댓글달기\u003c/li\u003e\u003cli\u003e주제를 4분 이상 읽기\u003c/li\u003e\u003c/ul\u003e\u003cp\u003e또는 주제를 추적하거나 지켜보기 위해 각 주제의 밑부분에 달린 알림제어판에서 설정하는 경우도 포합됩니다.\u003c/p\u003e\u003cp\u003e설정을 바꾸려면 \u003ca href=\"%{userPrefsUrl}\"\u003e환경설정\u003c/a\u003e 페이지로 가세요.\u003c/p\u003e"}},"bottom":{"latest":"더 이상 읽을 최신 주제가 없습니다","hot":"더 이상 읽을 인기있는 주제가 없습니다","posted":"더 이상 작성된 주제가 없습니다","read":"더 이상 읽을 주제가 없습니다","new":"더 이상 읽을 새로운 주제가 없습니다.","unread":"더 이상 읽지 않은 주제가 없습니다","category":"더 이상 {{category}}에 주제가 없습니다","top":"더 이상 인기 주제가 없습니다.","bookmarks":"더이상 북마크한 주제가 없습니다.","search":"더이상 검색 결과가 없습니다."}},"topic":{"unsubscribe":{"stop_notifications":"\u003cstrong\u003e{{title}}\u003c/strong\u003e에 대한 알림은 이제 덜 받게 됩니다.","change_notification_state":"현재 당신의 알림 설정 : "},"create":"새 주제 만들기","create_long":"새로운 주제 만들기","private_message":"메시지 시작","archive_message":{"help":"메시지를 아카이브로 옮기기","title":"저장됨"},"move_to_inbox":{"title":"수신함으로 이동","help":"메시지를 편지함으로 되돌리기"},"list":"주제 목록","new":"새로운 주제","unread":"읽지 않은","new_topics":{"other":"{{count}}개의 새로운 주제"},"unread_topics":{"other":"{{count}}개의 읽지 않은 주제"},"title":"주제","invalid_access":{"title":"이 주제는 비공개입니다","description":"죄송합니다. 그 주제에 접근 할 수 없습니다!","login_required":"해당 주제를 보려면 로그인이 필요합니다."},"server_error":{"title":"주제를 불러오지 못했습니다","description":"죄송합니다. 연결 문제로 인해 해당 주제를 불러올 수 없습니다. 다시 시도하십시오. 문제가 지속되면 문의해 주시기 바랍니다"},"not_found":{"title":"주제를 찾을 수 없습니다","description":"죄송합니다. 주제를 찾을 수 없습니다. 아마도 운영자에 의해 삭제된 것 같습니다."},"total_unread_posts":{"other":"이 주제에 {{count}}개의 읽지 않을 게시 글이 있습니다."},"unread_posts":{"other":"이 주제에 {{count}}개의 읽지 않을 게시 글이 있습니다."},"new_posts":{"other":"최근 읽은 이후 {{count}}개 글이 이 주제에 작성되었습니다."},"likes":{"other":"이 주제에 {{count}}개의 '좋아요'가 있습니다."},"back_to_list":"주제 리스트로 돌아갑니다.","options":"주제 옵션","show_links":"이 주제에서 링크를 표시합니다.","toggle_information":"주제의 세부 정보를 토글합니다.","read_more_in_category":"더 읽을거리가 필요하신가요? {{catLink}} 또는 {{latestLink}}를 살펴보세요.","read_more":"{{catLink}} 또는 {{latestLink}}에서 더 많은 토픽들을 찾으실 수 있습니다","browse_all_categories":"모든 카테고리 보기","view_latest_topics":"최신 주제 보기","suggest_create_topic":"새 주제를 작성 해 보실래요?","jump_reply_up":"이전 답글로 이동","jump_reply_down":"이후 답글로 이동","deleted":"주제가 삭제되었습니다","auto_close_notice":"이 주제는 곧 자동으로 닫힙니다. %{timeLeft}.","auto_close_notice_based_on_last_post":"이 주제는 마지막 답글이 달린 %{duration} 후 닫힙니다.","auto_close_title":"자동으로 닫기 설정","auto_close_save":"저장","auto_close_remove":"이 주제를 자동으로 닫지 않기","progress":{"title":"진행 중인 주제","go_top":"맨위","go_bottom":"맨아래","go":"이동","jump_bottom":"최근 글로 이동","jump_bottom_with_number":"jump to post %{post_number}","total":"총 글","current":"현재 글"},"notifications":{"reasons":{"3_6":"이 카테고리를 보고 있어서 알림을 받게 됩니다.","3_5":"자동으로 이 글을 보고있어서 알림을 받게 됩니다.","3_2":"이 주제를 보고있어서 알림을 받게 됩니다.","3_1":"이 주제를 생성하여서 알림을 받게 됩니다.","3":"이 주제를 보고있어서 알림을 받게 됩니다.","2_8":"이 주제를 추적하고 있어서 알림을 받게 됩니다.","2_4":"이 주제에 답글을 게시하여서 알림을 받게 됩니다.","2_2":"이 주제를 추적하고 있어서 알림을 받게 됩니다.","2":"이 주제를 읽어서 알림을 받게 됩니다. \u003ca href=\"/users/{{username}}/preferences\"\u003e(설정)\u003c/a\u003e","1_2":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다.","1":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다.","0_7":"이 주제에 관한 모든 알림을 무시하고 있습니다.","0_2":"이 주제에 관한 모든 알림을 무시하고 있습니다.","0":"이 주제에 관한 모든 알림을 무시하고 있습니다."},"watching_pm":{"title":"알림 : 주시 중","description":"이 메시지에 새로운 답글이 있을 때 알림을 받게 되며 새로운 답글의 개수는 표시됩니다."},"watching":{"title":"주시 중","description":"이 주제에 새로운 답글이 있을 때 알림을 받게 되며 새로운 답글의 개수는 표시됩니다."},"tracking_pm":{"title":"알림 : 새 글 표시 중","description":"이 메시지의 읽지않은 응답의 수가 표시됩니다. 누군가 내 @아이디를 멘션했거나 내게 답글을 작성하면 알림을 받습니다."},"tracking":{"title":"새 글 표시 중","description":"이 주제의 새로운 답글의 수가 표시됩니다. 누군가 내 @아이디를 멘션했거나 내게 답글을 작성하면 알림을 받습니다."},"regular":{"title":"알림 : 일반","description":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다."},"regular_pm":{"title":"알림 : 일반","description":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다."},"muted_pm":{"title":"알림 : 끔","description":"이 메시지에 대해 어떠한 알림도 받지 않지 않습니다."},"muted":{"title":"알림 없음","description":"이 주제에 대해 어떠한 알림도 받지 않고 최신글 목록에도 나타나지 않을 것입니다."}},"actions":{"recover":"주제 다시 복구","delete":"주제 삭제","open":"주제 열기","close":"주제 닫기","multi_select":"글 선택","auto_close":"자동으로 닫기...","pin":"주제 고정...","unpin":"주제 고정 취소...","unarchive":"주제 보관 취소","archive":"주제 보관","invisible":"목록에서 제외하기","visible":"목록에 넣기","reset_read":"값 재설정"},"feature":{"pin":"주제 고정","unpin":"주제 고정 취소","pin_globally":"전체 공지글로 설정하기","make_banner":"배너 주제","remove_banner":"배너 주제 제거"},"reply":{"title":"답글","help":"이 주제에 대한 답글 작성 시작"},"clear_pin":{"title":"고정 취소","help":"더 이상 목록의 맨 위에 표시하지 않도록 이 주제의 고정 상태를 해제합니다."},"share":{"title":"공유","help":"이 주제의 링크를 공유"},"flag_topic":{"title":"신고하기","help":"이 주제를 주의깊게 보거나 비밀리에 주의성 알림을 보내기 위해 신고합니다","success_message":"신고했습니다"},"feature_topic":{"title":"주요 주제로 설정","pin":" {{categoryLink}} 카테고리 주제 목록 상단에 고정 until","confirm_pin":"이미 {{count}}개의 고정된 주제가 있습니다. 너무 많은 주제가 고정되어 있으면 새로운 사용자나 익명사용자에게 부담이 될 수 있습니다. 정말로 이 카테고리에 추가적으로 주제를 고정하시겠습니까?","unpin":"이 주제를 {{categoryLink}} 카테고리 상단에서 제거 합니다.","unpin_until":"{{categoryLink}} 카테고리 주제 목록 상단에서 이 주제를 제거하거나 \u003cstrong\u003e%{until}\u003c/strong\u003e까지 기다림.","pin_note":"개별적으로 사용자가 주제 고정을 취소할 수 있습니다.","pin_validation":"주제를 고정하려면 날짜를 지정해야 합니다.","not_pinned":" {{categoryLink}} 카테고리에 고정된 주제가 없습니다.","already_pinned":{"other":"{{categoryLink}}에 고정된 주제 개수: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"모든 주제 목록 상단 고정 until","confirm_pin_globally":"이미 {{count}}개의 주제가 전체 공지로 고정되어 있습니다. 너무 많은 주제가 고정되어 있으면 새로운 사용자나 익명사용자에게 부담이 될 수 있습니다. 정말로 이 주제를 전체 공지로 고정하겠습니까?","unpin_globally":"모든 주제 목록 상단에서 이 주제를 제거","unpin_globally_until":"모든 주제 목록 상단에서 이 주제를 제거하거나 \u003cstrong\u003e%{until}\u003c/strong\u003e까지 기다림.","global_pin_note":"개별적으로 사용자가 주제 고정을 취소할 수 있습니다.","not_pinned_globally":"전체 공지된 주제가 없습니다.","already_pinned_globally":{"other":"전체 공지된 주제 개수: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"이 주제를 모든 페이지의 상단에 나타나는 배너로 만들기","remove_banner":"모든 페이지에서 나타나는 배너에서 제거","banner_note":"사용자는 배너를 닫음으로써 배너를 나타나지 않게 할 수 있습니다. 단지 어떤 기간동안 딱 하나의 주제만이 배너로 지정 가능합니다.","no_banner_exists":"배너 주제가 없습니다.","banner_exists":"현재 배너 주제가 \u003cstrong class='badge badge-notification unread'\u003e있습니다\u003c/strong\u003e."},"inviting":"초대 중...","invite_private":{"title":"초대 메시지","email_or_username":"초대하려는 이메일 또는 아이디","email_or_username_placeholder":"이메일 또는 아이디","action":"초대","success":"사용자가 메세지에 참여할 수 있도록 초대했습니다.","error":"죄송합니다. 해당 사용자를 초대하는 도중 오류가 발생했습니다.","group_name":"그룹명"},"invite_reply":{"title":"초대하기","username_placeholder":"아이디","action":"초대장 보내기","help":"이메일을 통해 다른 사람을 이 주제에 초대합니다.","to_forum":"친구에게 요약 이메일을 보내고 이 포럼에 가입할 수 있도록 링크를 전송합니다.","sso_enabled":"이 주제에 초대하고 싶은 사람의 아이디를 입력하세요.","to_topic_blank":"이 주제에 초대하고 싶은 사람의 아이디나 이메일주소를 입력하세요.","to_topic_email":"이메일 주소를 입력하셨습니다. 친구들에게 이 주제에 답변 달기가 가능하도록 조치하는 초대장을 보내겠습니다.","to_topic_username":"아이디를 입력하셨습니다. 이 주제에 초대하는 링크와 함께 알림을 보내겠습니다.","to_username":"초대하려는 사용자의 아이디를 입력하세요. 이 주제에 초대하는 링크와 함께 알림을 보내겠습니다.","email_placeholder":"이메일 주소","success_email":"\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e로 초대장을 발송했습니다. 초대를 수락하면 알려 드리겠습니다. 초대상태를 확인하려면 사용자 페이지에서 '초대장' 탭을 선택하세요.","success_username":"사용자가 이 주제에 참여할 수 있도록 초대했습니다.","error":"그 사람을 초대할 수 없습니다. 혹시 이미 초대하진 않았나요?  (Invites are rate limited)"},"login_reply":"로그인하고 답글 쓰기","filters":{"n_posts":{"other":"{{count}} 글"},"cancel":"필터 제거"},"split_topic":{"title":"새로운 주제로 이동","action":"새로운 주제로 이동","topic_name":"새로운 주제 이름","error":"새로운 주제로 이동시키는데 문제가 발생하였습니다.","instructions":{"other":"새로운 주제를 생성하여, 선택한 \u003cb\u003e{{count}}\u003c/b\u003e개의 글로 채우려고 합니다."}},"merge_topic":{"title":"이미 있는 주제로 옮기기","action":"이미 있는 주제로 옮기기","error":"이 주제를 이동시키는데 문제가 발생하였습니다.","instructions":{"other":" \u003cb\u003e{{count}}\u003c/b\u003e개의 글을 옮길 주제를 선택해주세요."}},"change_owner":{"title":"글 소유자 변경","action":"작성자 바꾸기","error":"작성자를 바꾸는 중 에러가 발생하였습니다.","label":"글의 새로운 작성자","placeholder":"새로운 작성자의 아이디","instructions":{"other":"\u003cb\u003e{{old_user}}\u003c/b\u003e(이)가 작성한 글의 새로운 작성자를 선택해주세요."},"instructions_warn":"이 글에 대한 알림이 새 사용자에게 자동으로 이전되지 않습니다.\n\u003cbr\u003e경고: 글과 연관된 데이터가 새로운 사용자로 이전되지 않습니다. 주의해서 사용하세요."},"change_timestamp":{"title":"타임스탬프 변경","action":"타임스탬프 변경","invalid_timestamp":"타임스탬프는 미래값으로 할 수 없습니다.","error":"주제의 시간을 변경하는 중 오류가 발생하였습니다."},"multi_select":{"select":"선택","selected":"({{count}})개가 선택됨","select_replies":"선택 + 답글","delete":"선택 삭제","cancel":"선택을 취소","select_all":"전체 선택","deselect_all":"전체 선택 해제","description":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e개의 개시글을 선택하셨어요."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"인용한 답글","edit":"{{link}} {{replyAvatar}} {{username}} 편집","edit_reason":"Reason: ","post_number":"{{number}}번째 글","last_edited_on":"마지막으로 편집:","reply_as_new_topic":"연결된 주제로 답글 작성하기","continue_discussion":"{{postLink}}에서 토론을 계속:","follow_quote":"인용 글로 이동","show_full":"전체 글 보기","show_hidden":"숨겨진 내용을 표시","deleted_by_author":{"other":"(작성자에 의해 취소된 글입니다. 글이 신고된 것이 아닌 한 %{count} 시간 뒤에 자동으로 삭제됩니다)"},"expand_collapse":"확장/축소","gap":{"other":"{{count}}개의 숨겨진 답글 보기"},"unread":"읽지 않은 포스트","has_replies":{"other":"{{count}} 답글"},"has_likes":{"other":"{{count}} 좋아요"},"has_likes_title":{"other":"{{count}}명이 이 글을 좋아합니다"},"has_likes_title_only_you":"당신이 이 글을 좋아합니다.","has_likes_title_you":{"other":"당신 외  {{count}}명이 이 글을 좋아합니다"},"errors":{"create":"죄송합니다. 글을 만드는 동안 오류가 발생했습니다. 다시 시도하십시오.","edit":"죄송합니다. 글을 수정하는 중에 오류가 발생했습니다. 다시 시도하십시오.","upload":"죄송합니다. 파일을 업로드하는 동안 오류가 발생했습니다. 다시 시도하십시오.","too_many_uploads":"한번에 한 파일만 업로드 하실 수 있습니다.","upload_not_authorized":"업로드 하시려는 파일 확장자는 사용이 불가능합니다 (사용가능 확장자: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 이미지를 업로드 하실 수 없습니다.","attachment_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 파일 첨부를 업로드 하실 수 없습니다.","attachment_download_requires_login":"죄송합니다. 첨부 파일을 받으려면 로그인이 필요합니다."},"abandon":{"confirm":"글 작성을 취소 하시겠습니까?","no_value":"아니오","yes_value":"예"},"via_email":"이 주제는 이메일을 통해 등록되었습니다.","whisper":"이 포스트는 운영자를 위한 비공개 귓말입니다.","wiki":{"about":"이 글은 위키(wiki) 입니다."},"archetypes":{"save":"옵션 저장"},"controls":{"reply":"이 글에 대한 답글을 작성합니다.","like":"이 글을 좋아합니다.","has_liked":"이 글을 좋아합니다.","undo_like":"'좋아요' 취소","edit":"이 글 편집","edit_anonymous":"이 주제를 수정하려면 먼저 로그인을 해야합니다.","flag":"이 주제에 관심을 가지기 위해 깃발을 표시해두고 개인적으로 알림을 받습니다","delete":"이 글을 삭제합니다.","undelete":"이 글 삭제를 취소합니다.","share":"이 글에 대한 링크를 공유합니다.","more":"더","delete_replies":{"confirm":{"other":"이 글에 작성된 {{count}}개의 댓글도 삭제하시겠습니까?"},"yes_value":"예, 답글도 삭제합니다.","no_value":"아니오, 글만 삭제합니다."},"admin":"관리자 기능","wiki":"위키 만들기","unwiki":"위키 제거하기","convert_to_moderator":"스태프 색상 추가하기","revert_to_regular":"스태프 색상 제거하기","rebake":"HTML 다시 빌드하기","unhide":"숨기지 않기","change_owner":"소유자 변경"},"actions":{"flag":"신고하기","defer_flags":{"other":"신고 보류하기"},"undo":{"off_topic":"신고 취소","spam":"신고 취소","inappropriate":"신고 취소","bookmark":"북마크 취소","like":"좋아요 취소","vote":"투표 취소"},"people":{"off_topic":"주제에서 벗어났다고 신고했습니다","spam":"스팸으로 신고했습니다","inappropriate":"부적절한 글로 신고했습니다","notify_moderators":"운영자에게 알렸습니다","notify_user":"글쓴이에게 메시지를 보냈습니다","bookmark":"북마크 했습니다","like":"좋아해요","vote":"이곳에 투표했습니다"},"by_you":{"off_topic":"이글을 주제에서 벗어났다고 신고했습니다","spam":"이글을 스팸으로 신고했습니다","inappropriate":"이 글을 부적절한 컨텐츠로 신고했습니다","notify_moderators":"운영자에게 알렸습니다","notify_user":"글쓴이에게 메시지를 보냈습니다","bookmark":"이 글을 북마크했습니다","like":"좋아해요","vote":"이 글에 투표했습니다"},"by_you_and_others":{"off_topic":{"other":"당신 외 {{count}}명이 주제에서 벗어났다고 신고했습니다"},"spam":{"other":"당신 외 {{count}}명이 스팸이라고 신고했습니다"},"inappropriate":{"other":"당신 외 {{count}}명이 부적절한 컨텐츠라고 신고했습니다"},"notify_moderators":{"other":"당신 외 {{count}}명이 운영자에게 알렸습니다"},"notify_user":{"other":"당신 외 {{count}}명이 글쓴이에게 메시지를 보냈습니다"},"bookmark":{"other":"당신 외 {{count}}명이 북마크 했습니다"},"like":{"other":"당신 외 {{count}}명이 좋아합니다"},"vote":{"other":"당신 외 {{count}}명이 이 글에 투표했습니다"}},"by_others":{"off_topic":{"other":"{{count}}명이 주제에서 벗어났다고 신고했습니다"},"spam":{"other":"{{count}}명의 스팸이라고 신고했습니다"},"inappropriate":{"other":"{{count}}명이 부적절한 컨텐츠라고 신고했습니다"},"notify_moderators":{"other":"{{count}}명이 운영자에게 알렸습니다"},"notify_user":{"other":"{{count}}명이 글쓴이에게 메시지를 보냈습니다"},"bookmark":{"other":"{{count}}명이 북마크했습니다"},"like":{"other":"{{count}}명이 좋아합니다"},"vote":{"other":"{{count}}명이 이 글에 투표했습니다"}}},"delete":{"confirm":{"other":"모든 글들을 삭제하시겠습니까?"}},"revisions":{"controls":{"first":"초판","previous":"이전 판","next":"다음 판","last":"최신판","hide":"편집 기록 가리기","show":"편집 기록 보기","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Show the rendered output with additions and removals inline","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Show the rendered output diffs side-by-side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Raw source diff를 양쪽으로 보기","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Raw"}}}},"category":{"can":"허용","none":"(카테고리 없음)","all":"모든 카테고리","choose":"카테고리를 선택하세요\u0026hellip;","edit":"편집","edit_long":"카테고리 편집","view":"카테고리 안의 주제 보기","general":"일반","settings":"설정","topic_template":"주제 템플릿","delete":"카테고리 삭제","create":"새 카테고리","create_long":"새 카테고리 만들기","save":"카테고리 저장","slug":"카테고리 Slug","slug_placeholder":"(Optional) dashed-words for url","creation_error":"카테고리 생성 중 오류가 발생했습니다.","save_error":"카테고리 저장 중 오류가 발생했습니다.","name":"카테고리 이름","description":"설명","topic":"카테고리 주제","logo":"카테고리 로고 이미지","background_image":"카테고리 백그라운드 이미지","badge_colors":"배지 색상","background_color":"배경 색상","foreground_color":"글씨 색상","name_placeholder":"짧고 간결해야합니다","color_placeholder":"웹 색상","delete_confirm":"이 카테고리를 삭제 하시겠습니까?","delete_error":"카테고리를 삭제하는 동안 오류가 발생했습니다.","list":"카테고리 목록","no_description":"이 카테고리에 대한 설명을 추가해주세요.","change_in_category_topic":"설명 편집","already_used":"이 색은 다른 카테고리에서 사용되고 있습니다.","security":"보안","images":"이미지","auto_close_label":"주제 자동 닫기 :","auto_close_units":"시간","email_in":"incoming 메일 주소 수정","email_in_allow_strangers":"계정이 없는 익명 유저들에게 이메일을 받습니다.","email_in_disabled":"이메일로 새 주제 작성하기 기능이 비활성화되어 있습니다. 사이트 설정에서 '이메일로 새 주제 작성하기'를 활성화 해주세요.","email_in_disabled_click":"\"email in\" 활성화","suppress_from_homepage":"홈페이지에서 이 카테고리를 감춥니다.","allow_badges_label":"배지가 이 카테고리에서 주어질 수 있도록 허용","edit_permissions":"권한 수정","add_permission":"권한 추가","this_year":"올해","position":"위치","default_position":"기본 위치","position_disabled":"카테고리는 활동량에 따라서 표시됩니다. 목록 내의 카테고리 순서를 지정하하려면","position_disabled_click":"\"카테고리 위치 고정\" 설정을 활성화 시키십시요.","parent":"부모 카테고리","notifications":{"watching":{"title":"주시 중"},"tracking":{"title":"새 글 표시 중"},"regular":{"title":"알림 : 일반","description":"누군가 내 @아아디 으로 멘션했거나 당신의 글에 답글이 달릴 때 알림을 받게 됩니다."},"muted":{"title":"알림 꺼짐"}}},"flagging":{"title":"우리 커뮤니티 질서를 지키는데 도와주셔서 감사합니다!","action":"글 신고했습니다","take_action":"조치하기","notify_action":"메시지 보내기","delete_spammer":"네, 스패머 회원을 삭제합니다","yes_delete_spammer":"예, 스팸 회원을 삭제합니다","ip_address_missing":"(알 수 없음)","hidden_email_address":"(숨김)","submit_tooltip":"비밀 신고하기","take_action_tooltip":"커뮤니티의 신고 수가 채워지기 기다리지 않고, 바로 신고 수를 제재 수준까지 채웁니다.","cant":"죄송합니다, 지금은 이 글을 신고할 수 없습니다","formatted_name":{"off_topic":"주제에 벗어났습니다","inappropriate":"부적절 컨텐츠입니다","spam":"스팸입니다"},"custom_placeholder_notify_user":"구체적이고, 건설적이며, 항상 친절하세요.","custom_placeholder_notify_moderators":"구체적으로 회원님이 걱정하는 내용과 가능한 모든 관련된 링크를 제공해주세요."},"flagging_topic":{"title":"우리 커뮤니티 질서를 지키는데 도와주셔서 감사합니다!","action":"주제 신고하기","notify_action":"메시지 보내기"},"topic_map":{"title":"주제 요약","participants_title":"빈번한 게시자","links_title":"인기 링크","clicks":{"other":"%{count}번 클릭"}},"topic_statuses":{"warning":{"help":"공식적인 주의입니다."},"bookmarked":{"help":"북마크한 주제"},"locked":{"help":"이 주제는 폐쇄되었습니다. 더 이상 새 답글을 받을 수 없습니다."},"archived":{"help":"이 주제는 보관중입니다. 고정되어 변경이 불가능합니다."},"unpinned":{"title":"핀 제거","help":"이 주제는 핀 제거 되었습니다. 목록에서 일반적인 순서대로 표시됩니다."},"pinned_globally":{"title":"핀 지정됨 (전역적)"},"pinned":{"title":"핀 지정됨","help":"이 주제는 고정되었습니다. 카테고리의 상단에 표시됩니다."},"invisible":{"help":"이 주제는 목록에서 제외됩니다. 주제 목록에 표시되지 않으며 링크를 통해서만 접근 할 수 있습니다."}},"posts":"글","posts_long":"이 주제의 글 수는 {{number}}개 입니다.","original_post":"원본 글","views":"조회수","views_lowercase":{"other":"조회"},"replies":"답변","views_long":"이 주제는 {{number}}번 읽혔습니다.","activity":"활동","likes":"좋아요","likes_lowercase":{"other":"좋아요"},"likes_long":"이 주제에 {{number}}개의 '좋아요'가 있습니다.","users":"사용자","users_lowercase":{"other":"사용자"},"category_title":"카테고리","history":"기록","changed_by":"{{author}}에 의해","raw_email":{"title":"Raw 이메일","not_available":"Raw 이메일이 가능하지 않습니다."},"categories_list":"카테고리 목록","filters":{"with_topics":"%{filter} 주제","with_category":"%{filter} %{category} 주제","latest":{"title":"최근글","title_with_count":{"other":"최근글 ({{count}})"},"help":"가장 최근 주제"},"hot":{"title":"인기 있는 글","help":"가장 인기있는 주제 중 하나를 선택"},"read":{"title":"읽기","help":"마지막으로 순서대로 읽은 주제"},"search":{"title":"검색","help":"모든 주제 검색"},"categories":{"title":"카테고리","title_in":"카테고리 - {{categoryName}}","help":"카테고리별로 그룹화 된 모든 주제"},"unread":{"title":"읽지 않은 글","title_with_count":{"other":"읽지 않은 글 ({{count}})"},"help":"지켜보거나 추적 중인 읽지 않은 주제","lower_title_with_count":{"other":"{{count}} unread"}},"new":{"lower_title_with_count":{"other":"{{count}} new"},"lower_title":"new","title":"새글","title_with_count":{"other":"새글 ({{count}})"},"help":"며칠 내에 만들어진 주제"},"posted":{"title":"내 글","help":"내가 게시한 글"},"bookmarks":{"title":"북마크","help":"북마크된 주제"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}}카테고리의 최신 주제"},"top":{"title":"인기글","help":"작년 또는 지난 달, 지난 주, 어제에 활발했던 주제","all":{"title":"전체 시간"},"yearly":{"title":"연"},"quarterly":{"title":"분기마다"},"monthly":{"title":"월"},"weekly":{"title":"주"},"daily":{"title":"일"},"all_time":"전체 시간","this_year":"년","this_quarter":"분기","this_month":"월","this_week":"주","today":"오늘","other_periods":"상단 보기"}},"browser_update":"안타깝게도 \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003e사용하시는 브라우저가 오래되어서 이 사이트를 이용하기 어렵습니다.\u003c/a\u003e. \u003ca href=\"http://browsehappy.com\"\u003e브라우저를 업그레이드 하시기 바랍니다.\u003c/a\u003e.","permission_types":{"full":"생성 / 답글 / 보기","create_post":"답글 / 보기","readonly":"보기"},"keyboard_shortcuts_help":{"jump_to":{"title":"이동"}},"badges":{"title":"배지","badge_count":{"other":"%{count}개의 배지"}},"poll":{"voters":{"other":"투표자"},"total_votes":{"other":"전체 투표"},"average_rating":"평균: \u003cstrong\u003e%{average}\u003c/strong\u003e.","cast-votes":{"title":"표 던지기","label":"지금 투표!"},"show-results":{"title":"투표 결과 표시","label":"결과 보기"},"hide-results":{"title":"투표로 돌아가기","label":"결과 숨기기"},"open":{"title":"투표 열기","label":"열기","confirm":"투표를 여시겠습니까?"},"close":{"title":"투표 닫기","label":"닫기","confirm":"정말 이 투표를 닫으시겠어요?"}},"type_to_filter":"필터를 입력하세요","admin":{"title":"Discourse 운영","moderator":"운영자","dashboard":{"title":"대시보드","last_updated":"대시보드 최근 업데이트:","version":"버전","up_to_date":"최신상태입니다!","critical_available":"중요 업데이트를 사용할 수 있습니다.","updates_available":"업데이트를 사용할 수 있습니다.","please_upgrade":"업그레이드하세요.","no_check_performed":"A check for updates has not been performed. Ensure sidekiq is running.","stale_data":"A check for updates has not been performed lately. Ensure sidekiq is running.","version_check_pending":"최근에 업데이트 되었군요! 환상적입니다!!","installed_version":"설치됨","latest_version":"최근","problems_found":"몇몇의 문제들은 Disocouse 설치 과정에서 나타납니다.","last_checked":"마지막으로 확인","refresh_problems":"새로고침","no_problems":"아무런 문제가 발견되지 않았습니다.","moderators":"운영자:","admins":"관리자:","blocked":"블락됨:","suspended":"접근금지:","private_messages_short":"메시지","private_messages_title":"메시지","mobile_title":"모바일","space_free":"{{size}} free","uploads":"업로드","backups":"백업","traffic_short":"트래픽","traffic":"어플리케이션 웹 요청","page_views":"API 요청","page_views_short":"API 응답","show_traffic_report":"자세한 트래픽 리포트 보기","reports":{"today":"오늘","yesterday":"어제","last_7_days":"최근 7일","last_30_days":"최근 30일","all_time":"모든 시간","7_days_ago":"7일","30_days_ago":"30일","all":"전체","view_table":"테이블","refresh_report":"보고서 새로고침","start_date":"시작일","end_date":"종료일","groups":"모든 그룹"}},"commits":{"latest_changes":"최근 변경 사항: 자주 업데이트하십시오!","by":"에 의해"},"flags":{"title":"신고","old":"지난","active":"활성화된","agree":"동의","agree_title":"이 신고가 올바르고 타당함을 확인합니다","agree_flag_modal_title":"동의 및 ...","agree_flag_hide_post":"동의 (글 숨기기 + 개인 메시지 보내기)","agree_flag_hide_post_title":"이 글을 숨기고 글쓴이에게 글을 수정하라고 개인메시지 자동발송하기","agree_flag_restore_post":"동의 (글 복원)","agree_flag_restore_post_title":"글을 복원하기","agree_flag":"신고에 동의함","agree_flag_title":"신고에 동의하며 글이 수정되지 않도록 유지하기","defer_flag":"연기","defer_flag_title":"신고 제거하기. 별도추가조치는 더이상 필요없습니다","delete":"삭제","delete_title":"신고에서 멘션된 글 삭제하기","delete_post_defer_flag":"글을 삭제하고 신고를 보류함","delete_post_defer_flag_title":"글을 삭제하고 첫번째 글이면 주제 삭제하기","delete_post_agree_flag":"글을 삭제하고 신고에 동의함","delete_post_agree_flag_title":"글을 삭제하고 첫번째 글이면 주제 삭제하기","delete_flag_modal_title":"삭제하고..","delete_spammer":"스패머 삭제","delete_spammer_title":"글쓴이의 모든 글과 주제를 삭제하고 회원계정도 제거하기","disagree_flag_unhide_post":"동의안함 (글 숨김 취소)","disagree_flag_unhide_post_title":"글의 모든 신고를 삭제하고 글을 볼 수 있도록 변경","disagree_flag":"동의안함","disagree_flag_title":"신고를 유효하지 않거나 올바르지 않은 것으로 거부함","clear_topic_flags":"완료","clear_topic_flags_title":"주제 조사를 끝냈고 이슈를 해결했습니다. 신고를 지우기 위해 완료를 클릭하세요","more":"(더 많은 답글...)","dispositions":{"agreed":"agreed","disagreed":"disagreed","deferred":"유예 중인"},"flagged_by":"신고 한 사람","resolved_by":"해결 by","took_action":"처리하기","system":"System","error":"뭔가 잘못 됐어요","reply_message":"답글","no_results":"신고가 없습니다.","topic_flagged":"이 \u003cstrong\u003e 주제 \u003c/strong\u003e는 신고 되었습니다.","visit_topic":"처리하기 위해 주제로 이동","was_edited":"첫 신고 이후에 글이 수정되었음","previous_flags_count":"이 글은 이미 {{count}}번 이상 신고 되었습니다.","summary":{"action_type_3":{"other":"off-topic x{{count}}"},"action_type_4":{"other":"부적절한 x{{count}}"},"action_type_6":{"other":"custom x{{count}}"},"action_type_7":{"other":"custom x{{count}}"},"action_type_8":{"other":"스팸 x{{count}}"}}},"groups":{"primary":"주 그룹","no_primary":"(주 그룹이 없습니다.)","title":"그룹","edit":"그룹 수정","refresh":"새로고침","new":"새로운","selector_placeholder":"아이디를 입력하세요","name_placeholder":"그룹 이름, 사용자 이름처럼 빈칸 없이 작성","about":"회원과 이름을 변경","group_members":"그룹 멤버","delete":"삭제","delete_confirm":"이 그룹을 삭제 하시겠습니까?","delete_failed":"이것은 자동으로 생성된 그룹입니다. 삭제할 수 없습니다.","delete_member_confirm":"'%{group}' 그룹에서 '%{username}'을 제외시키겠습니까?","delete_owner_confirm":"'%{username}' 님에게서 소유자권한을 제거할까요?","name":"이름","add":"추가","add_members":"사용자 추가하기","custom":"Custom","bulk_complete":"회원들이 그룹에 추가되었습니다.","bulk":"그룹에 한꺼번에 추가하기","bulk_paste":"한 줄당 하나씩 아이디 또는 이메일 리스트를 붙여넣기 하세요.","bulk_select":"(그룹을 선택하세요)","automatic":"자동화","automatic_membership_email_domains":"이 목록의 있는 항목과 사용자들이  등록한 이메일 도메인이 일치할때 이 그룹에 포함","automatic_membership_retroactive":"이미 등록된 사용자에게 같은 이메일 도메인 규칙 적용하기","default_title":"Default title for all users in this group","primary_group":"Automatically set as primary group","group_owners":"소유자","add_owners":"소유자 추가하기","incoming_email_placeholder":"이메일 주소를 입력하세요"},"api":{"generate_master":"마스터 API 키 생성","none":"지금 활성화된 API 키가 없습니다.","user":"사용자","title":"API","key":"API 키","generate":"API 키 생성","regenerate":"API 키 재생성","revoke":"폐지","confirm_regen":"API 키를 새로 발급 받으시겠습니까?","confirm_revoke":"API 키를 폐지하겠습니까?","info_html":"당신의 API 키는 JSON콜을 이용하여 주제를 생성하거나 수정할 수 있습니다.","all_users":"전체 유저","note_html":"이 키의 \u003cstrong\u003e보안에 특별히 주의\u003c/strong\u003e하세요. 이 키를 아는 모든 사용자는 다른 사용자의 이름으로 글을 작성할 수 있습니다."},"plugins":{"title":"플러그인","installed":"설치된 플러그인","name":"이름","none_installed":"설치된 플러그인이 없습니다.","version":"버전","enabled":"활성화?","is_enabled":"예","not_enabled":"아니요","change_settings":"설정 변경","change_settings_short":"설정","howto":"플러그인은 어떻게 설치하나요?"},"backups":{"title":"백업","menu":{"backups":"백업","logs":"로그"},"none":"가능한 백업이 없습니다.","logs":{"none":"아직 로그가 없어요."},"columns":{"filename":"파일명","size":"크기"},"upload":{"label":"업로드","title":"백업을 업로드","uploading":"업로드 중...","success":"'{{filename}}' 파일이 성공적으로 업로드 되었습니다.","error":"'{{filename}}' 파일 업로드중 에러가 발생하였습니다. ({{message}})"},"operations":{"is_running":"실행 중입니다.","failed":"{{operation}} 작업 실행하지 못했습니다. 로그를 확인해 주세요.","cancel":{"label":"취소","title":"현제 작업 취소하기","confirm":"정말로 현재 작업을 취소하시겠습니까?"},"backup":{"label":"백업","title":"백업 생성","confirm":"새로운 백업을 시작할까요?","without_uploads":"예 (파일을 포함하지 않음)"},"download":{"label":"다운로드","title":"백업 다운로드"},"destroy":{"title":"백업 삭제","confirm":"정말 이 백업을 삭제할까요?"},"restore":{"is_disabled":"사이트 설정에서 '복구 기능'이 비활성화 되어있습니다.","label":"복구","title":"백업을 이용하여 복구","confirm":"정말 이 백업으로 복원할까요?"},"rollback":{"label":"롤백","title":"데이터베이스를 이전 workiong state로 되돌리기","confirm":"데이타베이스를 이전 상태로 롤백 또는 되돌리기 할까요?"}}},"export_csv":{"user_archive_confirm":"정말로 내 글을 다운로드 받습니까?","success":"Export initiated, you will be notified via message when the process is complete.","failed":"내보내기가 실패했습니다. 로그를 확인해주세요","rate_limit_error":"글은 하루에 한번 다운로드 받을 수 있습니다. 내일 다시 시도해주십시요.","button_text":"내보니기","button_title":{"user":"모든 사용자 목록을 CSV 형식으로 내보내기","staff_action":"모든 스태프 행동 로그를 CSV 형식으로 내보내기","screened_email":"모든 이메일 목록을 CSV 형식으로 내보내기","screened_ip":"모든 표시된 IP 목록을 CSV 형식으로 내보내기","screened_url":"모든 표시된 URL 목록을 CSV 형식으로 내보내기"}},"export_json":{"button_text":"내보니기"},"invite":{"button_text":"초대장 보내기","button_title":"초대장 보내기"},"customize":{"title":"사용자 지정","long_title":"사이트 사용자 지정","css":"CSS","header":"헤더","top":"Top","footer":"푸터(하단영역)","embedded_css":"Embedded CSS","head_tag":{"text":"\u003c/head\u003e","title":"\u003c/head\u003e 태그 전에 들어갈 HTML"},"body_tag":{"text":"\u003c/body\u003e","title":"\u003c/body\u003e 태그 전에 들어갈 HTML"},"override_default":"표준 스타일 시트를 포함하지 마십시오","enabled":"사용가능?","preview":"미리 보기","undo_preview":"미리보기 삭제","rescue_preview":"기본 스타일","explain_preview":"이 커스텀 스타일시트를 적용한 상태로 사이트를 봅니다.","explain_undo_preview":"현재 적용되어 있는 커스톰 스타일시트로 돌아갑니다.","explain_rescue_preview":"기본 스타일시트를 적용한 상태로 사이트를 봅니다.","save":"저장","new":"새 사용자 지정","new_style":"새로운 스타일","import":"가져오기","import_title":"파일을 선택하거나 텍스트를 붙여넣으세요","delete":"삭제","delete_confirm":"이 정의를 삭제 하시겠습니까?","about":"사이트 Customization은 사이트의 스타일시트와 해더를 수정할 수 있게 해줍니다. 새로운 것을 추가하거나 기존 것을 선택해서 편집하세요.","color":"색","opacity":"투명도","copy":"복사","email_templates":{"title":"이메일 템플릿","subject":"제목","multiple_subjects":"이 이메일 양식은 제목이 여러가지 있습니다.","body":"본문","none_selected":"편집하려는 이메일 템플릿을 선택하세요.","revert":"변경사항 취소","revert_confirm":"정말로 변경사항을 되돌리시겠습니까?"},"css_html":{"title":"CSS/HTML","long_title":"CSS, HTML 사용자 정의"},"colors":{"title":"색상","long_title":"색상 Schemes","about":"CSS 작성 없이 사이트에 사용되는 색을 수정합니다. 시작하려면 Scheme을 추가하세요.","new_name":"새로운 색 조합","copy_name_prefix":"복사본","delete_confirm":"이 컬러 스키마를 제거합니까?","undo":"실행 복귀","undo_title":"마지막 저장 상태로 색상 변경상태를 되돌리기","revert":"되돌리기","revert_title":"이 색상을 Dicsourse의 기본 색 스키마로 초기화","primary":{"name":"주요","description":"대부분의 글, 아이콘 및 테두리"},"secondary":{"name":"2차","description":"메인 백그라운드 색상, 몇몇 버튼의 텍스트 색상"},"tertiary":{"name":"3차","description":"링크, 버튼, 알림 및 강조를 위한 색"},"quaternary":{"name":"4차","description":"네비게이션 링크"},"header_background":{"name":"헤더 배경색","description":"사이트 헤더의 배경 색상"},"header_primary":{"name":"헤더 기본 색","description":"사이트 헤더에 텍스트와 아이콘"},"highlight":{"name":"하이라이트","description":"페이지 내에 강조된 글 및 주제 등의 배경색"},"danger":{"name":"위험","description":"글 삭제 등에 사용되는 강조색"},"success":{"name":"성공","description":"동작이 성공적으로 수행되었음을 알립니다."},"love":{"name":"사랑","description":"좋아요 버튼 색"}}},"email":{"title":"이메일","settings":"설정","templates":"템플릿","preview_digest":"요약 미리보기","sending_test":"테스트 메일 발송중...","error":"\u003cb\u003e에러\u003c/b\u003e - %{server_error}","test_error":"테스트 메일을 전송하는데 문제가 있습니다. 메일 설정을 다시한번 체크해보고 메일 전송이 정상인지 다시 확인하고 시도해주세요.","sent":"보냄","skipped":"생략됨","received":"전송받음","rejected":"거부됨","sent_at":"보냄","time":"시간","user":"사용자","email_type":"이메일 타입","to_address":"받는 주소","test_email_address":"테스트용 이메일 주소","send_test":"테스트 메일 전송","sent_test":"전송됨!","delivery_method":"전달 방법","preview_digest_desc":"초대 사용자들에게 보낼 요약 메일 내용 미리보기","refresh":"새로고침","format":"형식","html":"html","text":"문장","last_seen_user":"마지막으로 본 사용자","reply_key":"답글 단축키","skipped_reason":"생략 이유","incoming_emails":{"from_address":"보내는사람","to_addresses":"받는사람","cc_addresses":"참조","subject":"제목","error":"에러","none":"수신된 이메일이 없습니다.","modal":{"error":"에러","subject":"제목","body":"본문"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"제목...","error_placeholder":"에러"}},"logs":{"none":"로그가 없습니다.","filters":{"title":"필터","user_placeholder":"사용자명","address_placeholder":"name@example.com","type_placeholder":"다이제스트, 가입...","reply_key_placeholder":"답글 키","skipped_reason_placeholder":"이유"}}},"logs":{"title":"로그","action":"허용여부","created_at":"생성된","last_match_at":"마지막 방문","match_count":"방문","ip_address":"IP","topic_id":"주제 ID","post_id":"글 ID","category_id":"카테고리 ID","delete":"삭제","edit":"편집","save":"저장","screened_actions":{"block":"블락","do_nothing":"아무것도 하지 않음"},"staff_actions":{"title":"스태프 기록","instructions":"사용자 이름을 클릭하여 목록에서 차단하십시오. 프로필 사진을 클릭하여 사용자 페이지로 갑니다.","clear_filters":"전체 보기","staff_user":"스태프 사용자","target_user":"타겟 사용자","subject":"제목","when":"언제","context":"상황","details":"상세","previous_value":"이전값","new_value":"새값","diff":"차이점","show":"보기","modal_title":"상세","no_previous":"이전 값이 없습니다.","deleted":"새로운 값이 없습니다. 기록이 삭제되었습니다.","actions":{"delete_user":"회원 삭제","change_trust_level":"회원등급 변경","change_username":"아이디 변경","change_site_setting":"사이트 설정 변경","change_site_customization":"사이트 커스텀화 변경","delete_site_customization":"사이트 커스텀화 삭제","change_site_text":"site text 변경","suspend_user":"suspend user","unsuspend_user":"unsuspend user","grant_badge":"배지 부여","revoke_badge":"배지 회수","check_email":"이메일 확인","delete_topic":"주제 삭제","delete_post":"글 삭제","impersonate":"대역","anonymize_user":"anonymize user","roll_up":"roll up IP blocks","change_category_settings":"카테고리 설정 변경","delete_category":"카테고리 지우기","create_category":"카테고리 만들기","block_user":"사용자 차단","unblock_user":"사용자 차단 해제","grant_admin":"관리자권한 부여","revoke_admin":"관리자권한 회수","grant_moderation":"운영자권한 부여","revoke_moderation":"운영자권한 회수","backup_operation":"백업 작업"}},"screened_emails":{"title":"블락된 이메일들","description":"누군가가 새로운 계정을 만들면 아래 이메일 주소는 체크되고 등록은 블락됩니다, 또는 다른 조치가 취해집니다.","email":"이메일 주소","actions":{"allow":"허용"}},"screened_urls":{"title":"노출된 URL들","description":"이 목록은 사용자에 의해 스팸으로 알려진 URL 목록입니다.","url":"URL","domain":"도메인"},"screened_ips":{"title":"노출된 IP들","description":"IP 주소는 감시됩니다. \"허용\"으로 Whitelist에 등록해주세요.","delete_confirm":"%{ip_address}를 규칙에 의해 삭제할까요?","roll_up_confirm":"화면에 표시되는 IP 주소를 subnet으로 바꾸시겠습니까?","rolled_up_some_subnets":"다음의 subnet들의 IP 주소들을 차단하였습니다: %{subnets}.","rolled_up_no_subnet":"There was nothing to roll up.","actions":{"block":"블락","do_nothing":"허용","allow_admin":"관리자 허용하기"},"form":{"label":"새 IP:","ip_address":"IP 주소","add":"추가","filter":"검색"},"roll_up":{"text":"Roll up","title":"Creates new subnet ban entries if there are at least 'min_ban_entries_for_roll_up' entries."}},"logster":{"title":"에러 로그"}},"impersonate":{"title":"이 사용자 행세하기","help":"디버깅 목적으로 사용자 계정으로 로그인 할 수 있습니다. 사용이 끝나면 로그아웃하여야 합니다.","not_found":"해당 사용자를 찾을 수 없습니다.","invalid":"죄송합니다. 관리자만 접근할 수 있습니다."},"users":{"title":"사용자","create":"관리자 사용자 추가","last_emailed":"마지막 이메일","not_found":"죄송합니다, 그 이름은 시스템에 존재하지 않습니다.","id_not_found":"죄송합니다. 해당 사용자가 시스템에 없습니다.","active":"활동","show_emails":"이메일 보기","nav":{"new":"새로운 사용자","active":"활성화 사용자","pending":"보류된 사용자","staff":"스태프","suspended":"접근 금지 사용자","blocked":"블락된 사용자","suspect":"의심스러운 사용자"},"approved":"승인?","approved_selected":{"other":"승인한 사용자 ({{count}}명)"},"reject_selected":{"other":"거부한 사용자 ({{count}}명)"},"titles":{"active":"활동적인 회원","new":"신규회원","pending":"검토 대기중인 회원","newuser":"0등급 회원 (신규가입 회원)","basic":"1등급 회원 (초보 회원)","member":"2등급 회원 (부회원)","regular":"3등급 회원 (정회원)","leader":"4등급 회원 (리더)","staff":"스태프","admins":"관리자","moderators":"운영자","blocked":"블락된 사용자들","suspended":"접근 금지된 사용자들","suspect":"의심스러운 사용자들"},"reject_successful":{"other":"성공적으로 ${count}명의 사용자를 거절하였습니다."},"reject_failures":{"other":"%{count}명의 사용자를 거부하는데 실패했습니다."},"not_verified":"확인되지 않은","check_email":{"title":"사용자의 이메일 주소 표시","text":"Show"}},"user":{"suspend_failed":"이 사용자를 접근 금지하는데 오류 발생 {{error}}","unsuspend_failed":"이 사용자를 접근 허용 하는데 오류 발생 {{error}}","suspend_duration":"사용자를 몇일 접근 금지 하시겠습니까?","suspend_duration_units":"(일)","suspend_reason_label":"Why are you suspending? This text \u003cb\u003ewill be visible to everyone\u003c/b\u003e on this user's profile page, and will be shown to the user when they try to log in. Keep it short.","suspend_reason":"Reason","suspended_by":"접근 금지자","delete_all_posts":"모든 글을 삭제합니다","suspend":"접근 금지","unsuspend":"접근 허용","suspended":"접근 금지?","moderator":"운영자?","admin":"관리자?","blocked":"블락","staged":"격리조치?","show_admin_profile":"관리자","edit_title":"제목 수정","save_title":"제목 저장","refresh_browsers":"브라우저 새로 고침","refresh_browsers_message":"모든 클라이언트에게 메시지 보내기","show_public_profile":"공개 프로필 보기","impersonate":"사용자로 로그인하기","ip_lookup":"IP Lookup","log_out":"로그아웃","logged_out":"사용자가 모든 디바이스에서 로그아웃 되었습니다.","revoke_admin":"관리자 권한 회수","grant_admin":"관리자 권한 부여","revoke_moderation":"운영자 권한 회수","grant_moderation":"운영자 권한 부여","unblock":"언블락","block":"블락","reputation":"평판","permissions":"권한","activity":"활동","like_count":"준/받은 '좋아요'","last_100_days":"지난 100일간","private_topics_count":"비공개 주제 수","posts_read_count":"글 읽은 수","post_count":"글 수","topics_entered":"읽은 주제 수","flags_given_count":"작성한 신고","flags_received_count":"받은 신고","warnings_received_count":"받은 경고","flags_given_received_count":"준/받은 신고","approve":"승인","approved_by":"승인자","approve_success":"인증 이메일이 발송되었습니다.","approve_bulk_success":"성공! 모든 선택된 사용자는 인증되었고 통보되었습니다.","time_read":"읽은 시간","anonymize":"익명 사용자","anonymize_confirm":"Are you SURE you want to anonymize this account? This will change the username and email, and reset all profile information.","anonymize_yes":"Yes, anonymize this account","anonymize_failed":"There was a problem anonymizing the account.","delete":"사용자 삭제","delete_forbidden_because_staff":"관리자 및 운영자 계정은 삭제할 수 없습니다.","delete_posts_forbidden_because_staff":"관리자와 운영자의 글은 삭제할 수 없습니다.","delete_forbidden":{"other":"사용자가 작성한 글이 있으면 사용자를 삭제 할 수 없습니다. 사용자를 삭제 하기 전에 사용자가 작성한 글을 모두 삭제해야 합니다. (%{count}일 이전에 작성한 글은 삭제할 수 없습니다.)"},"cant_delete_all_posts":{"other":"전체글을 삭제할 수 없습니다. 몇개의 글은 %{count}일 이전에 작성되었습니다. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"other":"이 사용자는 %{count}개 이상 글을 작성하였기 때문에 모든 글을 삭제 할 수 없습니다. (delete_all_posts_max 설정참고)"},"delete_confirm":"정말 이 사용자를 삭제하시겠습니다? 삭제하면 복구 할 수 없습니다.","delete_and_block":"이 이메일과 IP주소를 삭제하고 차단하기","delete_dont_block":"삭제만 하기","deleted":"사용자가 삭제되었습니다.","delete_failed":"해당 사용자를 삭제하는 동안 오류가 발생했습니다. 모든 글은 사용자를 삭제하기 전에 삭제해야합니다.","send_activation_email":"인증 메일 보내기","activation_email_sent":"인증 메일을 보냈습니다.","send_activation_email_failed":"인증 메일 전송중 오류 %{error}","activate":"계정 활성화","activate_failed":"사용자 활성화에 문제가 있습니다.","deactivate_account":"계정 비활성화","deactivate_failed":"사용자 비활성에 문제가 있습니다.","unblock_failed":"사용자 언블락에 문제가 있습니다.","block_failed":"사용자 블락에 문제가 있습니다.","block_confirm":"정말로 이 사용자를 차단하겠습니까? 차단된 사용자는 어떠한 주제나나 글도 작성할 수 없습니다.","block_accept":"네, 이 사용자를 차단합니다.","deactivate_explanation":"비활성화 사용자는 이메일 인증을 다시 받아야합니다.","suspended_explanation":"접근 금지된 유저는 로그인 할 수 없습니다.","block_explanation":"차단된 사용자는 글을 작성하거나 주제를 작성할 수 없습니다.","trust_level_change_failed":"회원등급 변경에 실패했습니다.","suspend_modal_title":"거부된 사용자","trust_level_2_users":"2등급 회원들","trust_level_3_requirements":"회원등급 3 이상이어야 합니다.","trust_level_locked_tip":"회원등급이 고정되었습니다. 시스템이 회원등급을 올리거나 내리지 않을 것입니다.","trust_level_unlocked_tip":"회원등급 고정이 풀렸습니다. 시스템이 회원등급을 자동적으로 올리거나 내릴 것입니다.","lock_trust_level":"회원등급 고정","unlock_trust_level":"회원등급 고정 해제","tl3_requirements":{"title":"3등급 회원이 되기 위한 자격","value_heading":"값","requirement_heading":"자격요건","visits":"방문횟수","days":"일","topics_replied_to":"댓글 달은 주제 개수","topics_viewed":"열어본 주제 개수","topics_viewed_all_time":"열어본 주제 개수 (전체 기간)","posts_read":"읽은 글 갯수","posts_read_all_time":"읽은 글 갯수 (전체 기간)","flagged_posts":"신고당한 글 갯수","flagged_by_users":"신고한 회원수","likes_given":"'좋아요' 선물한 횟수","likes_received":"'좋아요' 받은 횟수","likes_received_days":"한번이라도 '좋아요' 받아본 날짜횟수","likes_received_users":"한번이라도 '좋아요' 선물해준 회원수","qualifies":"3등급회원 자격을 만족합니다","does_not_qualify":"3등급회원 자격을 만족하지 않습니다","will_be_promoted":"곧 승급 됩니다.","will_be_demoted":"곧 강등됩니다.","on_grace_period":"현재 승급 유예 기간이므로 강등되지 않습니다.","locked_will_not_be_promoted":"회원등급이 고정되었습니다. 승급되지 않을 것입니다.","locked_will_not_be_demoted":"회원등급이 고정되었습니다. 강등되지 않을 것입니다."},"sso":{"title":"Single Sign On","external_id":"External ID","external_username":"아이디","external_name":"Name","external_email":"Email","external_avatar_url":"프로필 사진 URL"}},"user_fields":{"title":"사용자 필드","help":"사용자가 입력할 수 있는 필드를 추가","create":"사용자 필드 생성하기","untitled":"무제","name":"필드명","type":"필드 속성","description":"필드 설명","save":"저장","edit":"편집","delete":"삭제","cancel":"취소","delete_confirm":"사용자 필드를 삭제할까요?","options":"온셥","required":{"title":"회원가입시 필수항목?","enabled":"필수","disabled":"필수 아님"},"editable":{"title":"가입 후 편집 가능?","enabled":"편집 가능","disabled":"편집 불가"},"show_on_profile":{"title":"다른 사람이 프로필을 볼수 있게할까요?","enabled":"프로필에 표시","disabled":"프로필에 표시하지 않기"},"field_types":{"text":"텍스트 필드","confirm":"확인","dropdown":"드롭다운"}},"site_text":{"description":"포럼에 있는 그 어떤 텍스트도 수정이 가능합니다. 아래의 검색기능을 통해 시작하세요.","search":"편집하고 싶은 텍스트를 검색하세요.","title":"텍스트 콘텐츠","edit":"편집","revert":"변경사항 취소","revert_confirm":"정말로 변경사항을 되돌리시겠습니까?","go_back":"검색으로 돌아가기","recommended":"다음의 텍스트를 요구에 맞게 편집하는 것을 권장:","show_overriden":"Override 된 설정만 보여주기"},"site_settings":{"show_overriden":"수정된 것만 표시","title":"사이트 설정","reset":"기본값으로 재설정","none":"없음","no_results":"No results found.","clear_filter":"Clear","add_url":"URL 추가","add_host":"Host 추가","categories":{"all_results":"전체","required":"필수","basic":"기본 설정","users":"회원","posting":"글","email":"이메일","files":"파일","trust":"회원등급","security":"보안","onebox":"Onebox","seo":"검색엔진최적화(SEO)","spam":"스팸","rate_limits":"제한","developer":"개발자","embedding":"Embedding","legal":"법률조항","uncategorized":"카테고리 없음","backups":"백업","login":"로그인","plugins":"플러그인","user_preferences":"회원 환경설정"}},"badges":{"title":"배지","new_badge":"새 배지","new":"New","name":"이름","badge":"배지","display_name":"표시 이름","description":"설명","badge_type":"배지 종류","badge_grouping":"그룹","badge_groupings":{"modal_title":"배지 그룹으로 나누기"},"granted_by":"배지 부여자","granted_at":"배지 수여일","reason_help":"(주제 또는 댓글로 가는 링크)","save":"저장","delete":"삭제","delete_confirm":"정말로 이 배지를 삭제할까요?","revoke":"회수","reason":"이유","expand":"확장 \u0026hellip;","revoke_confirm":"정말로 이 배지를 회수할까요?","edit_badges":"배지 수정","grant_badge":"배지 부여","granted_badges":"부여된 배지","grant":"부여","no_user_badges":"%{name}님은 배지가 없습니다.","no_badges":"받을 수 있는 배지가 없습니다.","none_selected":"시작하려면 배지를 선택하세요","allow_title":"배지를 칭호로 사용 가능하도록 허용","multiple_grant":"중복 부여할 수 있도록 허용","listable":"공개 배지 페이지에 표시되는 배지입니다.","enabled":"배지 기능 사용","icon":"아이콘","image":"이미지","icon_help":"이미지 주소로 Font Awesome 클래스 또는 URL을 사용합니다","query":"배지 쿼리(SQL)","target_posts":"글들을 대상으로 하는 쿼리","auto_revoke":"회수 쿼리를 매일 실행","show_posts":"배지 페이지에서 배지를 받게한 글을 보여줍니다.","trigger":"Trigger","trigger_type":{"none":"매일 업데이트","post_action":"회원이 글에 액션을 할 때","post_revision":"회원이 새글을 쓰거나 글을 수정할 때","trust_level_change":"회원등급이 바뀔 때","user_change":"회원이 생성되거나 수정될 때"},"preview":{"link_text":"수여된 배지 미리보기","plan_text":"쿼리 플랜 미리보기","modal_title":"배지 쿼리 미리보기","sql_error_header":"질의 중 오류가 발생했습니다","error_help":"배지 쿼리 도움말을 보려면 다음 링크를 확인하세요.","bad_count_warning":{"header":"주의!","text":"사라진 배지 샘플이 있습니다. 배지 query가 존재하지 않는 user ID나 post ID를 반환할 경우 발생합니다. 예상하지 못한 결과를 일으킬 수 있으니 query를 다시 한번 확인하세요."},"no_grant_count":"할당된 배지가 없습니다.","grant_count":{"other":"\u003cb\u003e%{count}\u003c/b\u003e개의 배지가 할당됨."},"sample":"샘플:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link} at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"이모지","help":"모든 사람이 쓸 수 있는 이모지를 추가합니다. (팁: 여러개 파일을 한 번에 드래그 \u0026 드롭할 수 있어요)","add":"새 이모지 추가","name":"이름","image":"이미지","delete_confirm":"정말로 :%{name}: 이모지를 삭제할까요?"},"embedding":{"get_started":"다른 웹사이트에 Discourse를 임베드하려면 호스트 추가부터 하세요","confirm_delete":"정말로 host를 삭제할까요?","sample":"Discourse 주제를 웨사이트에 삽입(embed)하기 위해 다음 HTML코드를 이용하세요. \u003cb\u003eREPLACE_ME\u003c/b\u003e 부분을 당신이 삽입하려는 웹사이트의 정식URL로 교체 하면 됩니다.","title":"삽입(Embedding)","host":"허용 Host","edit":"편집","category":"카테고리에 게시","add_host":"Host 추가","settings":"삽입(Embedding) 설정","feed_settings":"피드 설정","feed_description":"당신 사이트의 RSS/ATOM 피드를 알려주시면 Discourse가 그 사이트 컨텐트를 더 잘 가져올 수 있습니다.","crawling_settings":"크롤러 설정","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"주제 생성 시 사용할 회원 이름","embed_post_limit":"삽입(embed)할 글 최대갯수","embed_username_key_from_feed":"피드에서 discourse usename을 꺼내오기 위한 키(key)","embed_truncate":"임베드된 글 뒷부분 잘라내기","embed_whitelist_selector":"CSS selector for elements that are allowed in embeds","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","feed_polling_enabled":"RSS/ATOM으로 글 가져오기","feed_polling_url":"긁어올 RSS/ATOM 피드 URL","save":"삽입(Embedding) 설정 저장하기"},"permalink":{"title":"고유링크","url":"URL","topic_id":"주제 ID","topic_title":"주제","post_id":"글 ID","post_title":"글","category_id":"카테고리 ID","category_title":"카테고리","external_url":"외부 URL","delete_confirm":"정말로 이 고유 링크를 삭제하시겠습니까?","form":{"label":"새로운:","add":"추가","filter":"검색 (URL 혹은 외부 URL)"}}}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"timeline_date":"MMM YYYY","tiny":{"less_than_x_seconds":{"one":"\u003c 1s"},"x_seconds":{"one":"1s"},"x_minutes":{"one":"1m"},"about_x_hours":{"one":"1h"},"x_days":{"one":"1d"},"about_x_years":{"one":"1y"},"over_x_years":{"one":"\u003e 1y"},"almost_x_years":{"one":"1y"}},"medium":{"x_minutes":{"one":"1 min"},"x_hours":{"one":"1 hour"},"x_days":{"one":"1 day"}},"medium_with_ago":{"x_minutes":{"one":"1 min ago"},"x_hours":{"one":"1 hour ago"},"x_days":{"one":"1 day ago"}},"later":{"x_days":{"one":"1 day later"},"x_months":{"one":"1 month later"},"x_years":{"one":"1 year later"}}},"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}","invited_group":"invited %{who} %{when}","removed_group":"removed %{who} %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"ap_south_1":"Asia Pacific (Mumbai)","cn_north_1":"China (Beijing)"}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"{{count}} new or updated topic."},"topic_count_unread":{"one":"{{count}} unread topic."},"topic_count_new":{"one":"{{count}} new topic."},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","queue":{"has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e1\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"1 user"}},"groups":{"index":"Groups","title":{"one":"group"},"notifications":{"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."}}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"},"topic_stat_sentence":{"one":"%{count} new topic in the past %{unit}."}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","watched_topics_link":"Show watched topics","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"like_notification_frequency":{"first_time_and_daily":"First time a post is liked and daily","first_time":"First time a post is liked"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","invited":{"truncated":{"one":"Showing the first invite."},"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"no_replies":"No replies yet.","no_topics":"No topics yet.","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"read_only_mode":{"logout_disabled":"Logout is disabled while the site is in read only mode."},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"replies_lowercase":{"one":"reply"},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"login":{"instagram":{"title":"with Instagram","message":"Authenticating with Instagram (make sure pop up blockers are not enabled)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","link_url_placeholder":"http://example.com","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e"}},"search":{"too_short":"Your search term is too short.","result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"context":{"category":"Search the #{{category}} category"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e topic."},"change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"new_topics":{"one":"1 new topic"},"unread_topics":{"one":"1 unread topic"},"total_unread_posts":{"one":"you have 1 unread post in this topic"},"unread_posts":{"one":"you have 1 unread old post in this topic"},"new_posts":{"one":"there is 1 new post in this topic since you last read it"},"likes":{"one":"there is 1 like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"}},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"controls":"Topic Controls","filters":{"n_posts":{"one":"1 post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_owner":{"instructions":{"one":"Please choose the new owner of the post by \u003cb\u003e{{old_user}}\u003c/b\u003e."}},"change_timestamp":{"instructions":"Please select the new timestamp of the topic. Posts in the topic will be updated to have the same time difference."},"multi_select":{"description":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e post."}}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view 1 hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes":{"one":"{{count}} Like"},"has_likes_title":{"one":"1 person liked this post"},"has_likes_title_you":{"one":"you and 1 other person liked this post"},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","controls":{"delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?"}}},"actions":{"defer_flags":{"one":"Defer flag"},"by_you_and_others":{"off_topic":{"one":"You and 1 other flagged this as off-topic"},"spam":{"one":"You and 1 other flagged this as spam"},"inappropriate":{"one":"You and 1 other flagged this as inappropriate"},"notify_moderators":{"one":"You and 1 other flagged this for moderation"},"notify_user":{"one":"You and 1 other sent a message to this user"},"bookmark":{"one":"You and 1 other bookmarked this post"},"like":{"one":"You and 1 other liked this"},"vote":{"one":"You and 1 other voted for this post"}},"by_others":{"off_topic":{"one":"1 person flagged this as off-topic"},"spam":{"one":"1 person flagged this as spam"},"inappropriate":{"one":"1 person flagged this as inappropriate"},"notify_moderators":{"one":"1 person flagged this for moderation"},"notify_user":{"one":"1 person sent a message to this user"},"bookmark":{"one":"1 person bookmarked this post"},"like":{"one":"1 person liked this"},"vote":{"one":"1 person voted for this post"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"muted":{"description":"You will never be notified of anything about new topics in these categories, and they will not appear in latest."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links...","clicks":{"one":"1 click"}},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"topic_statuses":{"locked_and_archived":{"help":"This topic is closed and archived; it no longer accepts new replies and cannot be changed"},"pinned_globally":{"help":"This topic is pinned globally; it will display at the top of latest and its category"}},"views_lowercase":{"one":"view"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (1)"}},"unread":{"title_with_count":{"one":"Unread (1)"},"lower_title_with_count":{"one":"1 unread"}},"new":{"lower_title_with_count":{"one":"1 new"},"title_with_count":{"one":"New (1)"}},"category":{"title_with_count":{"one":"{{categoryName}} (1)"}}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"public":{"title":"Votes are public."},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"flags":{"summary":{"action_type_3":{"one":"off-topic"},"action_type_4":{"one":"inappropriate"},"action_type_6":{"one":"custom"},"action_type_7":{"one":"custom"},"action_type_8":{"one":"spam"}}},"groups":{"incoming_email":"Custom incoming email address","flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}}},"email":{"bounced":"Bounced","incoming_emails":{"modal":{"title":"Incoming Email Details","headers":"Headers","rejection_message":"Rejection Mail"}}},"logs":{"staff_actions":{"actions":{"deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"users":{"approved_selected":{"one":"approve user"},"reject_selected":{"one":"reject user"},"reject_successful":{"one":"Successfully rejected 1 user."},"reject_failures":{"one":"Failed to reject 1 user."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)"},"bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"}},"site_settings":{"categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"long_description":"Long Description","trigger_type":{"post_processed":"After a post is processed"},"preview":{"grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned."}}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'ko';
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
//! locale : korean (ko)
//!
//! authors
//!
//! - Kyungwook, Park : https://github.com/kyungw00k
//! - Jeeeyul Lee <jeeeyul@gmail.com>

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var ko = moment.defineLocale('ko', {
        months : '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
        monthsShort : '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
        weekdays : '일요일_월요일_화요일_수요일_목요일_금요일_토요일'.split('_'),
        weekdaysShort : '일_월_화_수_목_금_토'.split('_'),
        weekdaysMin : '일_월_화_수_목_금_토'.split('_'),
        longDateFormat : {
            LT : 'A h시 m분',
            LTS : 'A h시 m분 s초',
            L : 'YYYY.MM.DD',
            LL : 'YYYY년 MMMM D일',
            LLL : 'YYYY년 MMMM D일 A h시 m분',
            LLLL : 'YYYY년 MMMM D일 dddd A h시 m분'
        },
        calendar : {
            sameDay : '오늘 LT',
            nextDay : '내일 LT',
            nextWeek : 'dddd LT',
            lastDay : '어제 LT',
            lastWeek : '지난주 dddd LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s 후',
            past : '%s 전',
            s : '몇 초',
            ss : '%d초',
            m : '일분',
            mm : '%d분',
            h : '한 시간',
            hh : '%d시간',
            d : '하루',
            dd : '%d일',
            M : '한 달',
            MM : '%d달',
            y : '일 년',
            yy : '%d년'
        },
        ordinalParse : /\d{1,2}일/,
        ordinal : '%d일',
        meridiemParse : /오전|오후/,
        isPM : function (token) {
            return token === '오후';
        },
        meridiem : function (hour, minute, isUpper) {
            return hour < 12 ? '오전' : '오후';
        }
    });

    return ko;

}));
moment.fn.shortDateNoYear = function(){ return this.format('M월 D일'); };
moment.fn.shortDate = function(){ return this.format('YYYY-M-D'); };
moment.fn.longDate = function(){ return this.format('YYYY-M-D a h:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
