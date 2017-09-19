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
r += "There ";
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
r += "is <a href='/unread'>1 unread</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " unread</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1 new</a> topic";
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
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "browse other topics in ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
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
}, "posts_likes_MF" : function(){ return "Invalid Format: SyntaxError: Expected [a-zA-Z$_] but \"%u05E2\" found.";}};

MessageFormat.locale.he = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
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
I18n.translations = {"he":{"js":{"number":{"format":{"separator":" .","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"בית","other":"בתים"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"k{{number}}","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"לפני %{date}","tiny":{"half_a_minute":"פחות מדקה","less_than_x_seconds":{"one":"פחות משנייה","other":"פחות מ-%{count} שניות"},"x_seconds":{"one":"שנייה אחת","other":"%{count} שניות"},"x_minutes":{"one":"דקה אחת","other":"%{count} דקות"},"about_x_hours":{"one":"שעה אחת","other":"%{count} שעות"},"x_days":{"one":"יום אחד","other":"%{count} ימים"},"about_x_years":{"one":"שנה אחת","other":"%{count} שנים"},"over_x_years":{"one":"יותר משנה","other":"יותר מ-%{count} שנים"},"almost_x_years":{"one":"שנה אחת","other":"%{count} שנים"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"דקה אחת","other":"%{count} דקות"},"x_hours":{"one":"שעה אחת","other":"%{count} שעות"},"x_days":{"one":"יום אחד","other":"%{count} ימים"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"לפני דקה אחת","other":"לפני %{count} דקות"},"x_hours":{"one":"לפני שעה אחת","other":"לפני %{count} שעות"},"x_days":{"one":"אתמול","other":"לפני %{count} ימים"}},"later":{"x_days":{"one":"אחרי יום אחד","other":"אחרי %{count} ימים"},"x_months":{"one":"אחרי חודש אחד","other":"אחרי {{count}}% חודשים"},"x_years":{"one":"אחרי שנה אחת","other":"אחרי {{count}}% שנים"}},"previous_month":"חודש קודם","next_month":"חודש הבא"},"share":{"topic":"שתפו קישור לפוסט זה","post":"פרסום #%{postNumber}","close":"סגור","twitter":"שתפו קישור זה בטוויטר","facebook":"שתפו קישור זה בפייסבוק","google+":"שתף קישור זה בגוגל+","email":"שלח קישור בדוא\"ל"},"action_codes":{"public_topic":"הפכו נושא זה לפומבי %{when}","private_topic":"הפכו נושא זה לפרטי %{when}","split_topic":"פצל את הפוסט %{when}","invited_user":"%{who} הוזמנו ב-%{when}","invited_group":"הזמינו %{who} %{when}","removed_user":"%{who} הוסרו ב-%{when}","removed_group":"הסירו %{who} %{when}","autoclosed":{"enabled":"סגר  %{when}","disabled":"פתח %{when}"},"closed":{"enabled":"סגר  %{when}","disabled":"פתח  %{when}"},"archived":{"enabled":"עבר לארכיון %{when}","disabled":"הוצא מהארכיון %{when}"},"pinned":{"enabled":"ננעץ %{when}","disabled":"נעיצה בוטלה %{when}"},"pinned_globally":{"enabled":"ננעץ גלובלית %{when}","disabled":"נעיצה בוטלה %{when}"},"visible":{"enabled":"נכנס לרשימה %{when}","disabled":"הוצא מהרשימה %{when}"}},"topic_admin_menu":"פעולות ניהול לפוסט","emails_are_disabled":"כל הדוא\"ל היוצא נוטרל באופן גורף על ידי מנהל אתר. שום הודעת דוא\"ל, מכל סוג שהוא, תשלח.","bootstrap_mode_enabled":"כדי להקל על הקמת האתר החדש שלכם, אתם במצב איתחול-ראשוני. כל המשתמשים החדשים יקבלו רמת אמון 1 ויקבלו סיכומים יומיים במייל. אפשרות זו תכובה אוטומטית כאשר יהיו יותר מ %{min_users} משתמשים.","bootstrap_mode_disabled":"מצב איתחול-ראשוני יכובה ב 24 השעות הקרובות.","s3":{"regions":{"us_east_1":"מזרח ארה\"ב (צפון וירג'יניה)","us_west_1":"מערב ארה\"ב (צפון קליפורניה)","us_west_2":"מערב ארה\"ב (ארגון)","us_gov_west_1":"AWS GovCloud (ארה״ב)","eu_west_1":"האיחוד האירופי (אירלנד)","eu_central_1":"האיחוד האירופי (פרנקפורט)","ap_southeast_1":"אסיה הפסיפית (סינגפור)","ap_southeast_2":"אסיה הפסיפית (סידני)","ap_south_1":"אסיה פסיפית (מומבאי)","ap_northeast_1":"אסיה הפסיפית (טוקיו)","ap_northeast_2":"אסיה הפסיפית (סיאול)","sa_east_1":"דרום אמריקה (סאו פאולו)","cn_north_1":"סין (בייג׳ינג)"}},"edit":"ערוך את הכותרת והקטגוריה של הפוסט","not_implemented":"סליחה, תכונה זו עדיין לא מומשה!","no_value":"לא","yes_value":"כן","generic_error":"סליחה, ארעה שגיאה.","generic_error_with_reason":"ארעה שגיאה: %{error}","sign_up":"הרשמה","log_in":"התחברות","age":"גיל","joined":"הצטרפו","admin_title":"ניהול","flags_title":"דגלים","show_more":"הראה עוד","show_help":"אפשרויות","links":"קישורים","links_lowercase":{"one":"קישור","other":"קישורים"},"faq":"שאלות נפוצות","guidelines":"כללי התנהלות","privacy_policy":"מדיניות פרטיות","privacy":"פרטיות","terms_of_service":"תנאי השירות","mobile_view":"תצוגת סלולרי","desktop_view":"תצוגת מחשב","you":"אתם","or":"או","now":"ממש עכשיו","read_more":"קרא עוד","more":"עוד","less":"פחות","never":"אף פעם","every_30_minutes":"מידי 30 דקות","every_hour":"כל שעה","daily":"יומית","weekly":"שבועית","every_two_weeks":"דו-שבועית","every_three_days":"כל שלושה ימים","max_of_count":"מקסימום של {{count}}","alternation":"או","character_count":{"one":"תו אחד","other":"{{count}} תווים"},"suggested_topics":{"title":"פוסטים מוצעים","pm_title":"הודעות מוצעות"},"about":{"simple_title":"אודות","title":"אודות %{title}","stats":"סטטיסטיקות אתר","our_admins":"המנהלים שלנו","our_moderators":"המנחים שלנו","stat":{"all_time":"כל הזמנים","last_7_days":"7 הימים האחרונים","last_30_days":"ב-30 הימים האחרונים"},"like_count":"לייקים","topic_count":"פוסטים","post_count":"פרסומים","user_count":"חדשים","active_user_count":"משתמשים פעילים","contact":"צרו קשר","contact_info":"במקרה של ארוע בנושא חשוב או חירומים המשפיע על האתר, אנא צרו איתנו קשר ב:%{contact_info}."},"bookmarked":{"title":"סימניה","clear_bookmarks":"ניקוי סימניות","help":{"bookmark":"הקליקו כדי ליצור סימניה לפרסום הראשון בפוסט זה","unbookmark":"הקליקו להסרת כל הסימניות בפוסט זה"}},"bookmarks":{"not_logged_in":"סליחה, עליך להיות מחובר כדי להוסיף פוסט למועדפים","created":"סימנת הודעה זו כמועדפת","not_bookmarked":"קראתם הודעה זו, לחצו להוספה למועדפים","last_read":"זו ההודעה האחרונה שקראת, לחצו להוספה למועדפים","remove":"הסר מהמועדפים","confirm_clear":"האם אתם בטוחים שאתם מעוניינים לנקות את כל הסימניות מפוסט זה?"},"topic_count_latest":{"one":"פוסט חדש או עדכון {{count}} .","other":"{{count}} פוסטים חדשים או עדכונים."},"topic_count_unread":{"one":"נושא שלא נקרא.","other":"{{count}} נושאים שלא נקראו."},"topic_count_new":{"one":"נושא חדש אחד.","other":"{{count}} נושאים חדשים."},"click_to_show":"הקליקו כדי להציג.","preview":"תצוגה מקדימה","cancel":"ביטול","save":"שמור שינויים","saving":"שומר...","saved":"נשמר!","upload":"העלה","uploading":"מעלה...","uploading_filename":"מעלה {{filename}}...","uploaded":"הועלה!","enable":"לאפשר","disable":"לנטרל","undo":"ביטול (Undo)","revert":"לחזור","failed":"נכשל","switch_to_anon":"כנסו למצב אנונימי","switch_from_anon":"צאו ממצב אנונימי","banner":{"close":"בטלו באנר זה.","edit":"עירכו באנר זה"},"choose_topic":{"none_found":"לא נמצאו פוסטים.","title":{"search":"חפש פוסט לפי שם, כתובת או מזהה:","placeholder":"הקלד את כותרת הפוסט כאן"}},"queue":{"topic":"פוסט:","approve":"לאשר","reject":"לדחות","delete_user":"מחק משתמש","title":"זקוק לאישור","none":"לא נותרו הודעות לבדיקה","edit":"ערוך","cancel":"ביטול","view_pending":"הצג הודעות ממתינות","has_pending_posts":{"one":" בנושא זה ישנו פוסט אחד הממתין לאישור","other":"בנושא זה ישנם \u003cb\u003e{{count}}\u003c/b\u003e פוסטים הממתינים לאישור"},"confirm":"שמור שינויים","delete_prompt":"האם אתם בטוחים שאתם מעוניינים למחוק את \u003cb\u003e%{username}\u003c/b\u003e? זה ימחוק את כל הפוסטים שלהם ויחסום את המייל וכתובת ה IP שלהם.","approval":{"title":"ההודעה זקוקה לאישור","description":"קיבלנו את הודעתך אך נדרש אישור של מנחה לפני שההודעה תוצג, אנא המתן בסבלנות.","pending_posts":{"one":"יש לכם פוסט \u003cstrong\u003eאחד\u003c/strong\u003e שממתין.","other":"יש לכם \u003cstrong\u003e{{count}}\u003c/strong\u003e פוסטים ממתינים."},"ok":"אשר"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e פרסם \u003ca href='{{topicUrl}}'\u003eאת הפוסט\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eאת/ה\u003c/a\u003e פרסמת \u003ca href='{{topicUrl}}'\u003eאת הפוסט\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e הגיב ל: \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eאת/ה\u003c/a\u003e הגבת ל: \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e הגיב \u003ca href='{{topicUrl}}'\u003eלפוסט הזה\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eאת/ה\u003c/a\u003e הגבת \u003ca href='{{topicUrl}}'\u003eלפוסט הזה\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e הזכיר את \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e הזכיר \u003ca href='{{user2Url}}'\u003eאותך\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eאת/ה\u003c/a\u003e הזכרת את \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"פורסם על ידי \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"פורסם על \u003ca href='{{userUrl}}'\u003eידך\u003c/a\u003e","sent_by_user":"נשלח על ידי \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"נשלח \u003ca href='{{userUrl}}'\u003eעל ידך\u003c/a\u003e"},"directory":{"filter_name":"סינון לפי שם_משתמש/ת","title":"משתמשים","likes_given":"ניתנ/ו","likes_received":"התקבל/ו","topics_entered":"נצפה","topics_entered_long":"נושאים שנצפו","time_read":"זמן קריאה","topic_count":"פוסטים","topic_count_long":"פוסטים שנוצרו","post_count":"תגובות","post_count_long":"תגובות שפורסמו","no_results":"לא נמצאו תוצאות","days_visited":"ביקורים","days_visited_long":"ימים לביקור","posts_read":"נקראו","posts_read_long":"פרסומים שנקראו","total_rows":{"one":"משתמש/ת 1","other":"%{count} משתמשים"}},"groups":{"empty":{"posts":"אין פרסום של חברים בקבוצה זו","members":"אין חברים בקבוצה זו.","mentions":"אין אזכורים של קבוצה זו.","messages":"אין מסרים לקבוצה זו.","topics":"אין נושא מטעם חברים בקבוצה זו."},"add":"הוספה","selector_placeholder":"הוספת חברים וחברות","owner":"מנהל","visible":"הקבוצה זמינה לכל המשתמשים","index":"קבוצות","title":{"one":"קבוצה","other":"קבוצות"},"members":"חברים","topics":"נושאים","posts":"הודעות","mentions":"אזכורים","messages":"הודעות","alias_levels":{"title":"מי יכול/ה לשלוח מסרים ו@לאזכר בקבוצה זו?","nobody":"אף אחד","only_admins":"רק מנהלים","mods_and_admins":"רק מנחים ומנהלים","members_mods_and_admins":"רק חברי הקבוצה, מנחים ומנהלים","everyone":"כולם"},"trust_levels":{"title":"רמת אמון הניתנת אוטומטית למשתמשים כשהם נוספים:","none":"ללא"},"notifications":{"watching":{"title":"במעקב","description":"תקבל/י הודעה על כל פרסום במסגרת כל מסר, וסך התשובות יוצג."},"watching_first_post":{"title":"צפייה בהודעה ראשונה","description":"תקבלו התראה על הפרסום הראשון בכל נושא חדש בקבוצה זו."},"tracking":{"title":"במעקב","description":"תקבלו התראה אם מישהו מזכיר את @שמכם או עונה לכם, ותופיע ספירה של תגובות חדשות."},"regular":{"title":"רגיל","description":"תקבלו התראה אם מישהו מזכיר את @שמכם או עונה לכם."},"muted":{"title":"מושתק","description":"לעולם לא תקבלו התראה על נושאים חדשים בקבוצה זו."}}},"user_action_groups":{"1":"לייקים שניתנו","2":"לייקים שהתקבלו","3":"מועדפים","4":"פוסטים","5":"תשובות","6":"תגובות","7":"אזכורים","9":"ציטוטים","11":"עריכות","12":"פריטים שנשלחו","13":"דואר נכנס","14":"ממתין"},"categories":{"all":"כל הקטגוריות","all_subcategories":"הכל","no_subcategory":"ללא","category":"קטגוריה","category_list":"הצגת גשימת קטגוריות","reorder":{"title":"שנה סדר קטגוריות","title_long":"ארגן מחדש את רשימת הקטגוריות","fix_order":"סדר מיקומים","fix_order_tooltip":"לא לכל הקטגוריות יש מספר סידורי יחודי, זה עלול לגרום לבעיות.","save":"שמור סדר","apply_all":"הפעל","position":"מיקום"},"posts":"פרסומים","topics":"פוסטים","latest":"לאחרונה","latest_by":"לאחרונה על ידי","toggle_ordering":"שנה בקר סדר","subcategories":"תתי קטגוריות","topic_sentence":{"one":"נושא אחד","other":"%{count} נושאים"},"topic_stat_sentence":{"one":"נושא חדש אחד ב-%{unit}.","other":"%{count} נושאים חדשים ב-%{unit}."}},"ip_lookup":{"title":"חיפוש כתובת IP","hostname":"שם מארח (Hostname)","location":"מיקום","location_not_found":"(לא ידוע)","organisation":"ארגון","phone":"טלפון","other_accounts":"חשבונות נוספים עם כתובת IP זו:","delete_other_accounts":"מחיקה %{count}","username":"שם משתמש","trust_level":"TL","read_time":"זמן צפייה","topics_entered":"כניסה לפוסטים","post_count":"# פרסומים","confirm_delete_other_accounts":"אתם בטוחים שברצונכם למחוק חשבונות אלו?"},"user_fields":{"none":"(בחר אפשרות)"},"user":{"said":"{{username}}:","profile":"פרופיל","mute":"השתק","edit":"ערוך העדפות","download_archive":"הורדת הפרסומים שלי","new_private_message":"הודעה חדשה","private_message":"הודעה","private_messages":"הודעות","activity_stream":"פעילות","preferences":"העדפות","expand_profile":"הרחב","bookmarks":"מועדפים","bio":"אודותיי","invited_by":"הוזמנו על ידי","trust_level":"רמת אמון","notifications":"התראות","statistics":"סטטיסטיקות","desktop_notifications":{"label":"התראות לשולחן העבודה","not_supported":"התראות לא נתמכות בדפדפן זה. מצטערים.","perm_default":"הדלק התראות","perm_denied_btn":"הרשאות נדחו","perm_denied_expl":"מנעתם הרשאה לקבלת התראות. אפשרו התראות בהגדרות הדפדפן שלכם.","disable":"כבה התראות","enable":"אפשר התראות","each_browser_note":"הערה: עליך לשנות הגדרה זו עבור כל דפדפן בנפרד."},"dismiss_notifications":"בטלו הכל","dismiss_notifications_tooltip":"סימון כל ההתראות שלא נקראו כהתראות שנקראו","disable_jump_reply":"אל תקפצו לפרסומים שלי לאחר שאני משיב/ה","dynamic_favicon":"הצג את מספר פוסטים חדשים/מעודכנים על האייקון של הדפדפן","external_links_in_new_tab":"פתח את כל הקישורים החיצוניים בעמוד חדש","enable_quoting":"אפשרו תגובת ציטוט לטקסט מסומן","change":"שנה","moderator":"{{user}} הוא מנהל","admin":"{{user}} הוא מנהל ראשי","moderator_tooltip":"משתמש זה הינו מנחה (Moderator)","admin_tooltip":"משתמש זה הינו מנהל מערכת (Admin)","blocked_tooltip":"משתמש זה חסום","suspended_notice":"המשתמש הזה מושעה עד לתאריך: {{date}}.","suspended_reason":"הסיבה: ","github_profile":"גיטהאב","email_activity_summary":"סיכום פעילות","mailing_list_mode":{"label":"מצב רשימת תפוצה","enabled":"אפשר מצב רשימת תפוצה","instructions":"הגדרה זו מוחקת את סיכום הפעילות.\u003cbr /\u003e\nנושאים מושתקים וקטוגריות לא יכללו בדוא\"ל הללו.\n","daily":"שלח עדכונים יומיים","individual":"שליחת מייל עבור כל פוסט חדש","many_per_day":"שלחו לי מייל עבור כל פוסט חדש (בערך {{dailyEmailEstimate}} ביום)","few_per_day":"שלחו לי מייל עבור כל פוסט חדש (בערך 2 ביום)"},"tag_settings":"תגיות","watched_tags":"נצפה","watched_tags_instructions":"תעקבו באופן אוטומטי אחרי כל הנושאים עם התגיות הללו. תקבלו התראה על כל הפרסומים והנושאים החדשים. מספר הפרסומים יופיע לצד כותרת הנושא.","tracked_tags":"במעקב","tracked_tags_instructions":"אתם תעקבו אוטומטית אחר כל הנושאים עם תגיות אלו. ספירה של פוסטים חדשים תופיע ליד הנושא.","muted_tags":"מושתק","muted_tags_instructions":"אתם לא תיודעו לגבי דבר בנוגע לנושאים חדשים עם תגיות אלו, והם לא יופיעו ברשימת האחרונים.","watched_categories":"עוקב","watched_categories_instructions":"תעקבו באופן אוטומטי אחרי כל הנושאים בקטגוריות אלו. תקבלו התראה על כל הפרסומים והנושאים החדשים. מספר הפרסומים יופיע לצד כותרת הנושא.","tracked_categories":"רגיל+","tracked_categories_instructions":"אתם תעקבו אוטומטית אחר כל הנושאים עם קטגוריות אלו. ספירה של פוסטים חדשים תופיע ליד הנושא.","watched_first_post_categories":"צפייה בהודעה ראשונה","watched_first_post_categories_instructions":"אתם תיודעו לגבי הפוסט הראשון בכל נושא חדש בקטגוריות אלו.","watched_first_post_tags":"צפייה בהודעה ראשונה","watched_first_post_tags_instructions":"אתם תיודעו לגבי הפוסט הראשון בכל נושא חדש בתגיות אלו.","muted_categories":"מושתק","muted_categories_instructions":"אתם לא תיודעו על שום דבר לגבי נושאים חדשים בקטגוריות אלו, והם לא יופיעו ב״אחרונים״.","delete_account":"מחק את החשבון שלי","delete_account_confirm":"אתם בטוחים שברצונכם למחוק את החשבון? לא ניתן לבטל פעולה זו!","deleted_yourself":"חשבונך נמחק בהצלחה.","delete_yourself_not_allowed":"אתם לא יכולים למחוק את חשבונכם כרגע. צרו קשר עם מנהל כדי שימחק אותו בשבילכם.","unread_message_count":"הודעות","admin_delete":"מחק","users":"משתמשים","muted_users":"מושתק","muted_users_instructions":"להשבית כל התראה ממשתמשים אלו","muted_topics_link":"הצג פוסטים שהוסתרו","watched_topics_link":"הצגת נושאים נצפים","automatically_unpin_topics":"בטל נעיצת נושאים באופן אוטומטי כאשר אני מגיע/ה לתחתית ההודעות בנושא.","apps":"אפליקציות","revoke_access":"שלילת גישה","undo_revoke_access":"ביטול שלילת גישה","api_permissions":"הרשאות:","api_approved":"אושרו:","api_read":"קריאה","api_read_write":"קריאה וכתיבה","staff_counters":{"flags_given":"דגלים שעוזרים","flagged_posts":"הודעות מדוגלות","deleted_posts":"הודעות שנמחקו","suspensions":"השעיות","warnings_received":"אזהרות"},"messages":{"all":"הכל","inbox":"דואר נכנס","sent":"נשלח","archive":"ארכיון","groups":"הקבוצות שלי","bulk_select":"בחר הודעות","move_to_inbox":"העבר לדואר נכנס","move_to_archive":"ארכיון","failed_to_move":"בעיה בהעברת ההודעות שנבחרו (אולי יש תקלה בהתחברות?)","select_all":"בחרו הכל"},"change_password":{"success":"(דואר אלקטרוני נשלח)","in_progress":"(שולח דואר אלקטרוני)","error":"(שגיאה)","action":"שלח דואר אלקטרוני לשחזור סיסמה","set_password":"הזן סיסמה"},"change_about":{"title":"שינוי בנוגע אליי","error":"ארעה שגיאה בשינוי ערך זה."},"change_username":{"title":"שנה שם משתמש","confirm":"אם תשנו את שם המשתמש שלכם, כל הציטוטים הקודמים של פוסטים שלכם ואזכורי @שמות ישברו. האם אתם בטוחים לחלוטין שזה מה שתרצו לעשות?","taken":"סליחה, שם המשתמש הזה תפוס.","error":"ארעה שגיאה בשינוי שם המשתמש שלך.","invalid":"שם המשתמש אינו תקין. עליו לכלול רק אותיות באנגלית ומספרים."},"change_email":{"title":"שנה דואר אלקטרוני","taken":"סליחה, הכתובת הזו אינה זמינה.","error":"הייתה שגיאה בשינוי כתובת הדואר האלקטרוני שלך. אולי היא תפוסה?","success":"שלחנו דואר אלקטרוני לכתובת הדואר הזו. בבקשה עקוב אחרי הוראות האישור שם."},"change_avatar":{"title":"שינוי תמונת הפרופיל","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, מבוסס על","gravatar_title":"שנה את ה-avatar  שלך באתר-Gravatar","refresh_gravatar_title":"רענון האווטר שלכם","letter_based":"תמונת פרופיל משובצת מערכתית","uploaded_avatar":"תמונה אישית","uploaded_avatar_empty":"הוסף תמונה אישית","upload_title":"העלה את התמונה שלך","upload_picture":"העלאת תמונה","image_is_not_a_square":"אזהרה: קיצצנו את התמונה שלך; האורך והרוחב לא היו שווים.","cache_notice":"שינית את תמונת הפרופיל שלך בהצלחה אבל יכול לקחת קצת זמן    עד שהתמונה תופיע."},"change_profile_background":{"title":"שינוי רקע פרופיל","instructions":"רקעי הפרופיל ימורכזו ויוצגו ברוחב ברירת מחדל של 850px."},"change_card_background":{"title":"כרטיס הרקע של המשתמש/ת","instructions":"תמונות רקע ימורכזו ויוצגו ברוחב ברירת מחדל של 590px."},"email":{"title":"דואר אלקטרוני","instructions":"לא נצפו מעולם","ok":"נשלח לך דואר אלקטרוני לאישור","invalid":"בבקשה הכנס כתובת דואר אלקטרוני חוקית","authenticated":"כתובת הדואר האלקטרוני שלך אושרה על ידי {{provider}}","frequency_immediately":"נשלח לכם מייל מיידית אם לא קראתם את מה ששלחנו לכם עליו מייל.","frequency":{"one":"נשלח אליכם דוא\"ל רק אם לא ראינו אתכם בדקה האחרונה.","other":"נשלח אליכם דוא\"ל רק אם לא ראינו אתכם ב{{count}} הדקות האחרונות."}},"name":{"title":"שם","instructions":"שמך המלא (רשות)","instructions_required":"שמך המלא","too_short":"השם שלך קצר מידי","ok":"השם נראה טוב"},"username":{"title":"שם משתמש","instructions":"ייחודי, ללא רווחים וקצר","short_instructions":"אנשים יכולים לאזכר אותך כ @{{username}}","available":"שם המשתמש שלך פנוי","global_match":"הדואר האלקטרוני תואם את שם המשתמש הרשום","global_mismatch":"כבר רשום. נסה {{suggestion}}?","not_available":"לא זמין. נסה {{suggestion}}?","too_short":"שם המשתמש שלך קצר מידי","too_long":"שם המשתמש שלך ארוך מידי","checking":"בודק זמינות שם משתמש...","enter_email":"נמצא שם משתמש - הכנס דואר אלקטרוני תואם","prefilled":"הדואר האלקטרוני תואם לשם משתמש זה"},"locale":{"title":"שפת ממשק","instructions":"שפת ממשק המשתמש. היא תתחלף כשתרעננו את העמוד.","default":"(ברירת מחדל)"},"password_confirmation":{"title":"סיסמה שוב"},"last_posted":"פרסום אחרון","last_emailed":"נשלח לאחרונה בדואר אלקטרוני","last_seen":"נראה","created":"הצטרפו","log_out":"התנתקות","location":"מיקום","card_badge":{"title":"עיטור כרטיס משתמש/ת"},"website":"אתר","email_settings":"דואר אלקטרוני","like_notification_frequency":{"title":"הודעה כשנאהב","always":"תמיד","first_time_and_daily":"בפעם הראשונה שמישהו אוהב פוסט ומידי יום","first_time":"בפעם הראשונה שמישהו אוהב פוסט","never":"אף פעם"},"email_previous_replies":{"title":"כלול תגובות קודמות בתחתית המיילים","unless_emailed":"אלא אם נשלח לפני כן","always":"תמיד","never":"אף פעם"},"email_digests":{"title":"כאשר אינני מבקר פה, שלחו לי מייל מסכם של נושאים ותגובות פופולאריים","every_30_minutes":"מידי 30 דקות","every_hour":"שעתי","daily":"יומית","every_three_days":"כל שלושה ימים","weekly":"שבועית","every_two_weeks":"כל שבועיים"},"include_tl0_in_digests":"כללו תכנים ממשתמשים חדשים במיילים מסכמים","email_in_reply_to":"הכללת ציטוטים מתגובות לפרסומים שנשלחו בדוא\"ל","email_direct":"שלחו לי דוא\"ל כשמישהו/י מצטטים אותי, מגיבם לפרסום שלי, מזכירים את @שם_המשתמש/ת שלי, או מזמינים אותי לפוסט","email_private_messages":"שלחו לי דוא\"ל כשמישהו/י שולחים לי מסר","email_always":"שלח לי נוטיפקציות מייל גם כשאני פעיל/ה באתר. ","other_settings":"אחר","categories_settings":"קטגוריות","new_topic_duration":{"label":"פוסט יחשב כפוסט חדש כאשר","not_viewed":"עוד לא ראיתי אותם","last_here":"נוצרו מאז הביקור האחרון שלי כאן","after_1_day":"נוצר ביום האחרון","after_2_days":"נוצר במהלך היומיים האחרונים","after_1_week":"נוצר במהלך השבוע האחרון","after_2_weeks":"נוצר בשבועיים האחרונים"},"auto_track_topics":"מעקב אוטומטי פוסטים אליהם נכנסתי","auto_track_options":{"never":"אף פעם","immediately":"מיידי","after_30_seconds":"אחרי 30 שניות","after_1_minute":"אחרי דקה","after_2_minutes":"אחרי שתי דקות","after_3_minutes":"אחרי 3 דקות","after_4_minutes":"אחרי 4 דקות","after_5_minutes":"אחרי 5 דקות","after_10_minutes":"אחרי 10 דקות"},"invited":{"search":"הקלידו כדי לחפש הזמנות...","title":"הזמנות","user":"משתמש/ת שהוזמנו","sent":"נשלח","none":"אין הזמנות ממתינות להציג","truncated":{"one":"מראה את ההזמנה הראשונה.","other":"מראה את {{count}} ההזמנות הראשונות."},"redeemed":"הזמנות נוצלו","redeemed_tab":"נענו","redeemed_tab_with_count":"נוצלו ({{count}})","redeemed_at":"נפדו ב","pending":"הזמנות ממתינות","pending_tab":"ממתין","pending_tab_with_count":"ממתינות ({{count}})","topics_entered":"פוסטים נצפו","posts_read_count":"הודעות נקראו","expired":"פג תוקף ההזמנה.","rescind":"הסרה","rescinded":"הזמנה הוסרה","reinvite":"משלוח חוזר של הזמנה","reinvite_all":"שלח מחדש את כל ההזמנות","reinvited":"ההזמנה נשלחה שוב","reinvited_all":"כל ההזמנות נשלחו מחדש!","time_read":"זמן קריאה","days_visited":"מספר ימי ביקור","account_age_days":"גיל החשבון בימים","create":"שליחת הזמנה","generate_link":"העתק קישור הזמנה","generated_link_message":"\u003cp\u003eהזמנה נוצרה בהצלחה\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eלינק ההזמנה תקף רק למייל הזה:  \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"נכון לעכשיו לא הזמנת לכאן אף אחד. תוכלו לשלוח הזמנות אישיות, או להזמין כמה אנשים בבת אחת באמצעות   \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e העלאת קובץ הזמנה קבוצתית\u003c/a\u003e.","text":"הזמנה קבוצתית מקובץ","uploading":"העלאה...","success":"העלאת הקובץ החלה בהצלחה, תקבלו התראה באמצעות מסר כאשר התהליך יושלם.","error":"חלה תקלה בהעלאת \"'{{filename}}': \n{{message}}"}},"password":{"title":"סיסמה","too_short":"הסיסמה שלך קצרה מידי.","common":"הסיסמה הזו נפוצה מידי.","same_as_username":"הסיסמה שלך זהה לשם המשתמש/ת שלך.","same_as_email":"הסיסמה שלך זהה לכתובת הדוא\"ל שלך.","ok":"הסיסמה שלך נראית טוב.","instructions":"לפחות %{count} תווים."},"summary":{"title":"סיכום","stats":"סטטיסטיקות","time_read":"זמן קריאה","topic_count":{"one":"נושא נוצר","other":"נושאים נוצרו"},"post_count":{"one":"פוסט נוצר","other":"פוסטים נוצרו"},"likes_given":{"one":"ניתן \u003ci class='fa fa-heart'\u003e\u003c/i\u003e","other":"ניתנו \u003ci class='fa fa-heart'\u003e\u003c/i\u003e"},"likes_received":{"one":"התקבל \u003ci class='fa fa-heart'\u003e\u003c/i\u003e","other":"התקבלו \u003ci class='fa fa-heart'\u003e\u003c/i\u003e"},"days_visited":{"one":"יום שבוקר","other":"ימים שבוקרו"},"posts_read":{"one":"פוסט נקרא","other":"פוסטים נקראו"},"bookmark_count":{"one":"סימנייה","other":"סימניות"},"top_replies":"תגובות מובילות","no_replies":"עדיין אין תגובות.","more_replies":"תגובות נוספות","top_topics":"נושאים מובילים","no_topics":"אין נושאים עדיין.","more_topics":"נושאים נוספים","top_badges":"עיטורים מובילים","no_badges":"עדיין בלי עיטורים.","more_badges":"עיטורים נוספים","top_links":"קישורים מובילים","no_links":"עדיין ללא קישורים.","most_liked_by":"נאהב ביותר על-ידי","most_liked_users":"נאהב ביותר","most_replied_to_users":"הכי הרבה נענו","no_likes":"עדיין אין לייקים."},"associated_accounts":"התחברויות","ip_address":{"title":"כתובת IP אחרונה"},"registration_ip_address":{"title":"כתובת IP בהרשמה"},"avatar":{"title":"תמונת פרופיל","header_title":"פרופיל, הודעות, סימניות והגדרות "},"title":{"title":"כותרת"},"filters":{"all":"הכל"},"stream":{"posted_by":"פורסם על ידי","sent_by":"נשלח על ידי","private_message":"הודעה","the_topic":"הפוסט"}},"loading":"טוען...","errors":{"prev_page":"בזמן הניסיון לטעון","reasons":{"network":"שגיאת רשת","server":"שגיאת שרת","forbidden":"תקלת גישה","unknown":"תקלה","not_found":"העמוד אותו אתם מחפשים לא נמצא"},"desc":{"network":"אנא בדקו את החיבור שלכם","network_fixed":"נראה שזה חזר לעבוד.","server":"קוד שגיאה: {{status}}","forbidden":"אינכם רשאים לצפות בזה.","not_found":"אופס, ניסינו לטעון עמוד שאיננו קיים.","unknown":"משהו השתבש."},"buttons":{"back":"חזרה","again":"ניסיון נוסף","fixed":"טעינת עמוד"}},"close":"סגור","assets_changed_confirm":"האתר עבר עדכון. תרצו לרענן לגרסא המתקדמת ביותר?","logout":"נותקת מהמערכת","refresh":"רענן","read_only_mode":{"enabled":"אתר זה נמצא במצב קריאה בלבד. אנא המשיכו לשוטט, אך תגובות, לייקים, ופעולות נוספות כרגע אינם מאופשרים.","login_disabled":"התחברות אינה מתאפשרת כשהאתר במצב קריאה בלבד.","logout_disabled":"לא ניתן להתנתק בזמן שהאתר במצב של קריאה בלבד."},"too_few_topics_and_posts_notice":"בואו \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eנתחיל את הדיון הזה!\u003c/a\u003e יש כרגע \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e נושאים ו-\u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e הודעות. אורחים חדשים צריכים כמה דיונים לקרוא ולהגיב אליהם.","too_few_topics_notice":"בואו \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eנתחיל את הדיון הזה!\u003c/a\u003e יש כרגע \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e נושאים. אורחים חדשים צריכים כמה דיונים לקרוא ולהגיב אליהם.","too_few_posts_notice":"בואו \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eנתחיל את הדיון הזה!\u003c/a\u003e יש כרגע \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e הודעות. אורחים חדשים צריכים כמה דיונים לקרוא ולהגיב אליהם.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003eהגיע לגבול הגדרות האתר של %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e עבר את הגבול של הגדרות האתר ב- %{siteSettingRate}.","rate":{"one":"שגיאה ל %{duration}","other":"%{count} שגיאות\\%{duration}"}},"learn_more":"למד עוד...","year":"שנה","year_desc":"פוסטים שפורסמו ב-365 הימים האחרונים","month":"חודש","month_desc":"פוסטים שפורסמו ב-30 הימים האחרונים","week":"שבוע","week_desc":"פוסטים שפורסמו ב-7 הימים האחרונים","day":"יום","first_post":"הודעה ראשונה","mute":"השתק","unmute":"בטל השתקה","last_post":"הודעה אחרונה","last_reply_lowercase":"תגובה אחרונה","replies_lowercase":{"one":"תגובה","other":"תגובות"},"signup_cta":{"sign_up":"הרשמה","hide_session":"הזכר לי מחר","hide_forever":"לא תודה","hidden_for_session":"אוקיי, אשאל אתכם מחר. אתם כם תמיד יכולים להשתמש ב'התחברו' כדי ליצור משתמשים.","intro":"שלום לך :heart_eyes: זה נראה כאילו אתם נהנים מקריאה אבל אתם לא רשומים.","value_prop":"כשאת/ה נרשמ/ת, אנחנו זוכרים בדיוק מה קראת כך שכשתחזרו תמשיכו בדיוק איפה שהפסקתם. בנוסף תקבלו התראות דרך האתר ודרך הדואר האלקטרוני שלך כשפרסומים חדשים נוצרים ועוד משהו, את/ה יכול/ה לעשות לייק לפוסטים שאהבת. :heartbeat:"},"summary":{"enabled_description":"אתם צופים בסיכום פוסט זה: הפרסומים המעניינים ביותר כפי שסומנו על ידי הקהילה.","description":"ישנן \u003cb\u003e{{replyCount}}\u003c/b\u003e תגובות.","description_time":"יש \u003cb\u003e{{replyCount}}\u003c/b\u003e תגובות עם זמן קריאה מוערך של \u003cb\u003e{{readingTime}} דקות\u003c/b\u003e.","enable":"סכם פוסט זה","disable":"הצג את כל ההודעות"},"deleted_filter":{"enabled_description":"פוסט זה מכיל פרסומים שנמחקו ולכן אינם מוצגים.","disabled_description":"פרסומים שנמחקו בפוסט זה מוצגים כעת.","enable":"הסתר פרסומים שנמחקו","disable":"הצגת פרסומים שנמחקו"},"private_message_info":{"title":"הודעה","invite":"הזמינו אחרים...","remove_allowed_user":"האם אתם באמת רוצים להסיר את {{name}} מהודעה זו?","remove_allowed_group":"האם אתם באמת מעוניינים להסיר את {{name}} מהודעה זו?"},"email":"דוא\"ל","username":"שם משתמש","last_seen":"נצפה","created":"נוצר","created_lowercase":"נוצר/ו","trust_level":"רמת אמון","search_hint":"שם משתמש/ת, דוא\"ל או כתובת IP","create_account":{"title":"יצירת חשבון חדש","failed":"משהו לא בסדר, אולי כבר קיימת כתובת דואר אלקטרוני כזו. נסה את קישור שכחתי סיסמה."},"forgot_password":{"title":"אתחול סיסמה","action":"שכחתי את הסיסמה שלי","invite":"הזן שם משתמש או כתובת דואר אלקטרוני ונשלח לך קישור לאיפוס סיסמה","reset":"איפוס סיסמה","complete_username":"אם קיים חשבון שמתאים לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e, אתה אמור לקבל בקרוב מייל עם הוראות לאיפוס הסיסמא. ","complete_email":"במידה והחשבון מתאים לכתובת \u003cb\u003e%{email}\u003c/b\u003e, אתם אמורים לקבל בקרוב מייל עם הוראות לאיפוס הסיסמא.","complete_username_found":"מצאנו חשבון שתואם לשם המשתמש  \u003cb\u003e%{username}\u003c/b\u003e, קרוב לודאי שתקבלו דוא\"ל עם הנחיות כיצד לאתחל את הסיסמא שלכם תוך זמן קצר.","complete_email_found":"מצאנו חשבון תואם ל\u003cb\u003e%{email}\u003c/b\u003e. בתוך זמן קצר תקבלו אליו דוא\"ל עם הנחיות כיצד לאתחל את הסיסמא שלכם.","complete_username_not_found":"שום חשבון אינו תואם לשם המשתמש  \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"שום חשבון אינו תואם ל \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"התחברות","username":"משתמש","password":"סיסמה","email_placeholder":"דואר אלקטרוני או שם משתמש/ת","caps_lock_warning":"מקש Caps Lock לחוץ","error":"שגיאה לא ידועה","rate_limit":"בבקשה המתן לפני שתנסה להתחבר שוב.","blank_username_or_password":"אנא הקישור את כתובת הדוא\"ל או שם המשתמש/ת שלכם וסיסמא.","reset_password":"אפס סיסמה","logging_in":"מתחבר....","or":"או","authenticating":"מאשר...","awaiting_confirmation":"החשבון שלך ממתין להפעלה. ניתן להשתמש בקישור \"שכחתי סיסמה\" כדי לשלוח דואר אלקטרוני נוסף.","awaiting_approval":"החשבון שלך עדיין לא אושר על ידי חבר צוות. יישלח אליך דואר אלקטרוני כשהוא יאושר.","requires_invite":"סליחה, גישה לפורום הזה היא בהזמנה בלבד.","not_activated":"אינך יכול להתחבר עדיין. שלחנו לך דואר אלקטרוני להפעלת החשבון לכתובת: \u003cb\u003e{{sentTo}}\u003c/b\u003e. יש לעקוב אחר ההוראות בדואר כדי להפעיל את החשבון.","not_allowed_from_ip_address":"אינכם יכולים להתחבר מכתובת IP זו.","admin_not_allowed_from_ip_address":"אינכם יכולים להתחבר כמנהל מערכת מכתובת IP זו.","resend_activation_email":"יש ללחוץ כאן לשליחת דואר אלקטרוני חוזר להפעלת החשבון.","sent_activation_email_again":"שלחנו לך הודעת דואר אלקטרוני נוספת להפעלת החשבון לכתובת \u003cb\u003e{{currentEmail}}\u003c/b\u003e. זה יכול לקחת כמה דקות עד שיגיע, לא לשכוח לבדוק את תיבת דואר הזבל.","to_continue":"התחברו בבקשה","preferences":"אתם צריכים להיות מחוברים כדי לשנות את העדפות המשתמש שלכם.","forgot":"אין לי את פרטי החשבון שלי","google":{"title":"עם גוגל","message":"התחברות עם גוגל (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"google_oauth2":{"title":"בעזרת Google","message":"התחברות מאובטחת באמצעות גוגל (בדקו שחוסם החלונות הקופצים שלכם אינו מופעל)"},"twitter":{"title":"עם Twitter","message":"התחברות עם Twitter (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"instagram":{"title":"עם אינסטגרם","message":"אימות באמצעות אינסטגרם (וודאו שפופ-אפים אינם חסומים אצלכם)"},"facebook":{"title":"עם Facebook","message":"התחברות עם Facebook (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"yahoo":{"title":"עם Yahoo","message":"התחברות עם יאהו (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"github":{"title":"עם GitHub","message":"התחברות עם GitHub (יש לוודא שחוסם חלונות קופצים אינו פעיל)"}},"emoji_set":{"apple_international":"אפל/בינלאומי","google":"גוגל","twitter":"טוויטר","emoji_one":"Emoji One","win10":"חלונות 10"},"category_page_style":{"categories_only":"קטגוריות בלבד","categories_with_featured_topics":"קטגוריות עם נושאים מומלצים","categories_and_latest_topics":"קטגוריות ונושאים אחרונים"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"אמוג׳י :)","more_emoji":"עוד...","options":"אפשרויות","whisper":"לחישה","unlist":"לא-רשום","add_warning":"זוהי התראה רשמית.","toggle_whisper":"הפעלת Whisper","posting_not_on_topic":"לאיזה פוסט רצית להגיב?","saving_draft_tip":"שמירה...","saved_draft_tip":"נשמר","saved_local_draft_tip":"נשמר מקומית","similar_topics":"הפוסט שלך דומה ל...","drafts_offline":"טיוטות מנותקות","group_mentioned":{"one":"על ידי אזכור {{group}}, אתם עומדים ליידע \u003ca href='{{group_link}}'\u003eאדם אחד\u003c/a\u003e – אתם בטוחים?","other":"על ידי אזכור {{group}}, אתם עומדים ליידע \u003ca href='{{group_link}}'\u003e{{count}} אנשים\u003c/a\u003e – אתם בטוחים?"},"duplicate_link":"נראה שהקישור שלכם ל \u003cb\u003e{{domain}}\u003c/b\u003e כבר פורסם בנושא זה על ידי \u003cb\u003e@{{username}}\u003c/b\u003e ב \u003ca href='{{post_url}}'\u003eתגובה {{ago}}\u003c/a\u003e - האם אתם בטוחים שאתם מעוניינים לפרסם אותו שוב?","error":{"title_missing":"יש להזין כותרת.","title_too_short":"על הכותרת להיות באורך {{min}} תווים לפחות.","title_too_long":"על הכותרת להיות באורך {{max}} לכל היותר.","post_missing":"ההודעה אינה יכולה להיות ריקה.","post_length":"על ההודעה להיות באורך {{min}} תווים לפחות.","try_like":"האם ניסית את כפתור ה-\u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e","category_missing":"עליך לבחור קטגוריה."},"save_edit":"שמירת עריכה","reply_original":"תגובה לפוסט המקורי","reply_here":"תגובה כאן","reply":"תגובה","cancel":"ביטול","create_topic":"יצירת פוסט","create_pm":"הודעה","title":"או לחצו Ctrl+Enter","users_placeholder":"הוספת משתמש","title_placeholder":" במשפט אחד, במה עוסק הדיון הזה?","edit_reason_placeholder":"מדוע ערכת?","show_edit_reason":"(הוספת סיבת עריכה)","reply_placeholder":"הקלד כאן. השתמש ב Markdown, BBCode או HTML לערוך. גרור או הדבק תמונות.","view_new_post":"הצגת את ההודעה החדשה שלך.","saving":"שומר","saved":"נשמר!","saved_draft":"טיוטאת פרסום בתהליך, לחצו כדי להמשיך.","uploading":"מעלה...","show_preview":"הראה תצוגה מקדימה \u0026raquo;","hide_preview":"\u0026laquo; הסתר תצוגה מקדימה","quote_post_title":"ציטוט הודעה בשלמותה","bold_label":"B","bold_title":"מודגש","bold_text":"טקסט מודגש","italic_label":"I","italic_title":"נטוי","italic_text":"טקסט נטוי","link_title":"קישור","link_description":"הזן תיאור קישור כאן","link_dialog_title":"הזן קישור","link_optional_text":"כותרת אופציונלית","link_url_placeholder":"http://example.com","quote_title":"ציטוט","quote_text":"ציטוט","code_title":"טקסט מעוצב","code_text":"הזחה של הטקסט ב-4 רווחים","paste_code_text":"הקלידו או הדביקו קוד כאן","upload_title":"העלאה","upload_description":"הזן תיאור העלאה כאן","olist_title":"רשימה ממוספרת","ulist_title":"רשימת נקודות","list_item":"פריט ברשימה","heading_label":"H","heading_title":"כותרת","heading_text":"כותרת","hr_title":"קו אופקי","help":"עזרה על כתיבה ב-Markdown","toggler":"הסתר או הצג את פאנל העריכה","modal_ok":"אישור","modal_cancel":"ביטול","cant_send_pm":"מצטערים, אינכם יכולים לשלוח הודעה ל %{username}.","yourself_confirm":{"title":"שחכתם להוסיף נמענים?","body":"כרגע ההודעה הזו נשלחת רק אליכם!"},"admin_options_title":"אפשרויות צוות אופציונליות לפוסט זה","auto_close":{"label":"מועד סגירה אוטומטית של פוסט:","error":"הזינו בבקשה ערך תקין.","based_on_last_post":"לא לסגור עד שהפרסום האחרון בפוסט זה יהיה לפחות בגיל זה.","all":{"examples":"הזינו מספר שעות (24), שעה מדוייקת (17:30) או חותמת זמן (2013-11-22 14:00)."},"limited":{"units":"(# מספר שעות)","examples":"הזינו מספר שעות (24)."}}},"notifications":{"title":"התראות אודות אזכור @שם, תגובות לפרסומים ולפוסטים שלך, הודעות וכו'","none":"לא ניתן לטעון כעת התראות.","empty":"לא נמצאו התראות.","more":"הצגת התראות ישנות יותר","total_flagged":"סך הכל פוסטים מדוגלים","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} ו 1 אחר\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} ו {{count}} אחרים\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e אישר/ה את הזמנתך\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e הזיז/ה {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='עיטור הוענק' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eהרוויחו '{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eנושא חדש\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e הודעה {{count}} בתיבת הודעת הקבוצה  {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} הודעת בתיבת הקבוצה {{group_name}} inbox\u003c/p\u003e"},"alt":{"mentioned":"הוזכר על ידי","quoted":"צוטט על ידי","replied":"השיב","posted":"פורסם על ידי","edited":"ערוך את פרסומך על ידי","liked":"אהב את הפרסום שלך","private_message":"הודעה פרטית מ","invited_to_private_message":"הזמנה להודעה פרטית מ","invited_to_topic":"הוזמנת לפוסט חדש מ","invitee_accepted":"הזמנה התקבלה על ידי","moved_post":"הפרסום שלך הוזז על ידי","linked":"קישור לפרסום שלך","granted_badge":"עיטור הוענק","group_message_summary":"הודעות בדואר-נכנס קבוצתי"},"popup":{"mentioned":"{{username}} הזכיר אותך ב{{topic}}\" - {{site_title}}\"","group_mentioned":"{{username}} הזכיר אתכם ב \"{{topic}}\" - {{site_title}}","quoted":"{{username}} ציטט אותך ב\"{{topic}}\" - {{site_title}}","replied":"{{username}} הגיב לך ב\"{{topic}}\" - {{site_title}}","posted":"{{username}} הגיב ב\"{{topic}}\" - {{site_title}}","private_message":"{{username}} שלח לך הודעה פרטית ב\"{{topic}}\" - {{site_title}}","linked":"{{username}} קישר להודעה שלך מ\"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"הוספת תמונה","title_with_attachments":"הוספת תמונה או קובץ","from_my_computer":"מהמחשב שלי","from_the_web":"מהאינטרנט","remote_tip":"קישור לתמונה","remote_tip_with_attachments":"קישור לתמונה או לקובץ {{authorized_extensions}}","local_tip":"בחר תמונות ממכשירך","local_tip_with_attachments":"בחרו תמונות או קבצים ממכשיר {{authorized_extensions}} שלכם","hint":"(ניתן גם לגרור לעורך להעלאה)","hint_for_supported_browsers":"תוכלו גם לגרור או להדביק תמונות לעורך","uploading":"מעלה","select_file":"בחר קובץ","image_link":"קישור לתמונה יצביע ל"},"search":{"sort_by":"מיון על פי","relevance":"רלוונטיות","latest_post":"הפוסטים האחרונים","most_viewed":"הנצפה ביותר","most_liked":"האהובים ביותר","select_all":"בחר הכל","clear_all":"נקה הכל","too_short":"מילת החיפוש שלכם קצרה מידי.","result_count":{"one":"תוצאה אחת ל \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} תוצאות ל \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"חיפוש פוסטים, פרסומים, משתמשים או קטגוריות","no_results":"אין תוצאות.","no_more_results":"לא נמצאו עוד תוצאות.","search_help":"עזרה בחיפוש","searching":"מחפש ...","post_format":"#{{post_number}} מאת {{username}}","context":{"user":"חיפוש פרסומים לפי @{{username}}","category":"חפשו את הקטגוריה #{{category}}","topic":"חפשו בפוסט זה","private_messages":"חיפוש הודעות"}},"hamburger_menu":"עבור לרשימת פוסטים אחרת או קטגוריה","new_item":"חדש","go_back":"חזור אחורה","not_logged_in_user":"עמוד משתמש עם סיכום פעילות נוכחית והעדפות","current_user":"לך לעמוד המשתמש שלך","topics":{"bulk":{"unlist_topics":"הסרת נושאים","reset_read":"איפוס נקראו","delete":"מחיקת פוסטים","dismiss":"ביטול","dismiss_read":"בטלו את כל אלו שלא-נקראו","dismiss_button":"ביטול...","dismiss_tooltip":"ביטול הצגת פוסטים חדשים או מעקב אחר נושאים","also_dismiss_topics":"הפסיקו לעקוב אחרי נושאים אלו כדי שהם לא יופיעו שוב בתור לא-נקראו","dismiss_new":"ביטול חדשים","toggle":"החלף קבוצה מסומנת של פוסטים","actions":"מקבץ פעולות","change_category":"שינוי קטגוריה","close_topics":"סגירת פוסטים","archive_topics":"ארכיון הפוסטים","notification_level":"שינוי רמת התראה","choose_new_category":"בחרו את הקטגוריה עבור הפוסטים:","selected":{"one":"בחרת נושא \u003cb\u003eאחד\u003c/b\u003e.","other":"בחרת \u003cb\u003e{{count}}\u003c/b\u003e נושאים."},"change_tags":"שנו תגיות","choose_new_tags":"בחרו בתגיות חדשות עבור נושאים אלו:","changed_tags":"התגיות של נושאים אלו השתנו."},"none":{"unread":"אין לך נושאים שלא נקראו.","new":"אין לך נושאים חדשים.","read":"עדיין לא קראת אף נושא.","posted":"עדיין לא פרסמת באף נושא.","latest":"אין פוסטים מדוברים. זה עצוב.","hot":"אין פוסטים חמים.","bookmarks":"אין לך עדיין סימניות לפוסטים.","category":"אין פוסטים בקטגוריה {{category}}.","top":"אין פוסטים מובילים.","search":"אין תוצאות חיפוש","educate":{"new":"\u003cp\u003eהנושאים החדשים שלכם יופיעו כאן.\u003c/p\u003e\u003cp\u003eכברירת מחדל, נושאים נחשבים חדשים ויופיעו עם האינדיקציה \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eחדש\u003c/span\u003e אם הם נוצרו ב-2 הימים האחרונים \u003c/p\u003e\u003cp\u003eבקרו בעמוד ה\u003ca href=\"%{userPrefsUrl}\"\u003eהעדפות\u003c/a\u003e שלכם כדי לשנות זאת.\u003c/p\u003e","unread":"\u003cp\u003eהנושאים הלא נקראים שלכם יופיעו כאן.\u003c/p\u003e\u003cp\u003eכברירת מחדל, נושאים נחשבים כלא-נקראים ויציגו את הספירה \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e אם את/ה: \u003c/p\u003e \u003cul\u003e\u003cli\u003eיצרת את הנושא \u003c/li\u003e\u003cli\u003eקראת את הנושא במשך יותר מ-4 דקות\u003c/li\u003e\u003c/ul\u003e\n\u003cp\u003eאו אם הגדרת בצורה מפורשת את הנושא כנושא במעקב או בצפייה דרך מנגנון ההתראות המופיע בתחתית כל נושא. \u003c/p\u003e \u003cp\u003eבקר/י בעמוד ה\u003ca href=\"%{userPrefsUrl}\"\u003eהעדפות\u003c/a\u003e שלך כדי לשנות זאת \u003c/a\u003e"}},"bottom":{"latest":"אין עוד פוסטים מדוברים.","hot":"אין עוד פוסטים חמים.","posted":"אין עוד פוסטים שפורסמו.","read":"אין עוד פוסטים שנקראו.","new":"אין עוד פוסטים חדשים.","unread":"אין עוד פוסטים שלא נקראו.","category":"אין עוד פוסטים בקטגוריה {{category}}.","top":"אין עוד פוסטים מובילים.","bookmarks":"אין עוד סימניות לפוסטים.","search":"אין עוד תוצאות חיפוש"}},"topic":{"unsubscribe":{"stop_notifications":"תקבלו פחות התראות עבור \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"מצב ההתראות הנוכחי שלך הוא"},"filter_to":{"one":"פוסט אחד בנושא","other":"{{count}} פוסטים בנושא"},"create":"פוסט חדש","create_long":"יצירת פוסט חדש","private_message":"תחילת הודעה","archive_message":{"help":"העברת הודעה לארכיון","title":"ארכב"},"move_to_inbox":{"title":"העברה לדואר נכנס","help":"החזרת הודעה לדואר נכנס"},"list":"פוסטים","new":"פוסט חדש","unread":"לא נקרא/ו","new_topics":{"one":"פוסט חדש אחד","other":"{{count}} פוסטים חדשים"},"unread_topics":{"one":"1 שלא נקרא","other":"{{count}} פוסטים שלא נקראו"},"title":"פוסט","invalid_access":{"title":"הפוסט פרטי","description":"סליחה, איך אין לך גישה לפוסט הזה!","login_required":"עליכם להתחבר כדי לצפות בפוסט זה."},"server_error":{"title":"שגיאה בטעינת הפוסט","description":"סליחה, לא יכולנו לטעון את הפוסט הזה, ייתכן שבשל תקלת תקשורת. אנא נסי שוב. אם הבעיה נמשכת, הודיעו לנו."},"not_found":{"title":"הפוסט לא נמצא","description":"סליחה, לא יכולנו למצוא את הפוסט הזה. אולי הוא הוסר על ידי מנהל?"},"total_unread_posts":{"one":"יש לכם פרסום אחד שלא נקרא בנושא זה","other":"יש לכם {{count}} פרסומים שלא נקראו בפוסט זה"},"unread_posts":{"one":"יש לך הודעה אחת שלא נקראה בנושא הזה","other":"יש לך {{count}} הודעות ישנות שלא נקראו בפוסט הזה"},"new_posts":{"one":"יש הודעה אחת חדשה בנושא הזה מאז שקראת אותו לאחרונה","other":"יש {{count}} הודעות חדשות בפוסט הזה מאז שקראת אותו לאחרונה"},"likes":{"one":"יש לייק אחד בנושא הזה","other":"יש {{count}} לייקים בפוסט הזה"},"back_to_list":"חזרה לרשימת הפוסטים","options":"אפשרויות פוסט","show_links":"הצג קישורים בתוך הפוסט הזה","toggle_information":"הצגת פרטי פוסט","read_more_in_category":"רוצה לקרוא עוד? עיין פוסטים אחרים ב {{catLink}} או {{latestLink}}.","read_more":"רוצה לקרוא עוד? {{catLink}} or {{latestLink}}.","browse_all_categories":"עיין בכל הקטגוריות","view_latest_topics":"הצגת פוסטים מדוברים","suggest_create_topic":"לחצו כאן כדי ליצור פוסט חדש.","jump_reply_up":"קפיצה לתגובה קודמת","jump_reply_down":"קפיצה לתגובה מאוחרת","deleted":"הפוסט הזה נמחק","auto_close_notice":"הפוסט הזה ינעל אוטומטית %{timeLeft}.","auto_close_notice_based_on_last_post":"פוסט זה ייסגר %{duration} אחר התגובה האחרונה.","auto_close_title":"הגדרות נעילה אוטומטית","auto_close_save":"שמור","auto_close_remove":"אל תנעל פוסט זה אוטומטית","auto_close_immediate":{"one":"הפוסט האחרון בנושא הוא כבר בן שעה, אז הנושא ייסגר מיידית.","other":"הפוסט האחרון בנושא הוא כבר בן %{count} שעות, אז הנושא ייסגר אוטומטית."},"timeline":{"back":"חזרה","back_description":"חיזרו לפוסט האחרון שלא-נקרא על-ידיכם","replies_short":"%{current} / %{total}"},"progress":{"title":"התקדמות פוסט","go_top":"למעלה","go_bottom":"למטה","go":"קדימה","jump_bottom":"עבור להודעה האחרונה","jump_prompt":"קפיצה לפוסט","jump_prompt_long":"לאיזה פוסט הייתם רוצים לקפוץ?","jump_bottom_with_number":"קפיצה להודעה %{post_number}","total":"סך הכל הודעות","current":"הודעה נוכחית"},"notifications":{"title":"שנו את תדירות ההתראות על הנושא הזה","reasons":{"mailing_list_mode":"אתם במצב רשימת תפוצה, אז תיודעו לגבי תגובות לנושא זה באמצעות מייל.","3_10":"תקבלו התראות כיוון שאתם צופים בתג שקשור לנושא זה.","3_6":"תקבלו התראות כיוון שאת/ה עוקב אחרי קטגוריה זו.","3_5":"תקבל/י התראות כיוון שהתחלת לעקוב אחרי הפוסט הזה אוטומטית.","3_2":"תקבל/י התראות כיוון שאת/ה עוקב אחרי הפוסט הזה.","3_1":"תקבל/י התראות כיוון שאת/ה יצרת את הפוסט הזה.","3":"תקבל/י התראות כיוון שאת/ה עוקב אחרי פוסט זה.","2_8":"תקבלו התראות כיוון שאת/ה צופה בקטגוריה הזו.","2_4":"תקבל/י התראות כיוון שפרסמת תגובה לפוסט הזה.","2_2":"תקבל/י התראות כיוון שאת/ה צופה אחרי הפוסט הזה.","2":"תקבל/י התראות כיוון ש\u003ca href=\"/users/{{username}}/preferences\"\u003eקראת את הפוסט הזה\u003c/a\u003e.","1_2":"תקבלו התראה אם מישהו יזכיר את @שם_המשתמש/ת שלך או ישיב לפרסום שלך.","1":"תקבלו התראה אם מישהו יזכיר את @שם_המשתמש/ת שלך או ישיב לפרסום שלך.","0_7":"את/ה מתעלם/מתעלמת מכל ההתראות בקטגוריה זו.","0_2":"אתם מתעלמים מכל ההתראות בפוסט זה.","0":"אתם מתעלמים מכל ההתראות בפוסט זה."},"watching_pm":{"title":"עוקב","description":"תקבל/י התראה על כל תגובה חדשה בהודעה זו. בנוסף מספר התגובות שלא נקראו יופיעו ליד ההודעה. "},"watching":{"title":"עוקב","description":"תקבל/י התראה על כל תגובה חדשה בפוסט זה ומספר התגובות החדשות יוצג. "},"tracking_pm":{"title":"רגיל+","description":"כמו רגיל, בנוסף מספר התגובות החדשות יוצג ליד ההודעה. "},"tracking":{"title":"רגיל+","description":"כמו רגיל, בנוסף מספר התגובות שלא נקראו יוצג לפוסט זה. "},"regular":{"title":"רגיל","description":"תקבלו התראה אם מישהו יזכיר את @שם_המשתמש/ת שלך או ישיב לפרסום שלך."},"regular_pm":{"title":"רגיל","description":"תקבלו התראה אם מישהו יזכיר את @שם_המשתמש/ת שלך או ישיב לפרסום שלך."},"muted_pm":{"title":"מושתק","description":"לעולם לא תקבל/י התראה בנוגע להודעה זו."},"muted":{"title":"מושתק","description":"לעולם לא תיודעו לגבי דבר בנוגע לנושא זה, והוא לא יופיע ב״אחרונים״."}},"actions":{"recover":"שחזר פוסט","delete":"מחק פוסט","open":"פתח פוסט","close":"נעל פוסט","multi_select":"בחר/י פרסומים...","auto_close":"סגירה אוטומטית...","pin":"נעיצת פוסט..","unpin":"שחרור נעיצת פוסט...","unarchive":"הוצא פוסט מארכיון","archive":"הכנס פוסט לארכיון","invisible":"הסתרה","visible":"גילוי","reset_read":"אפס מידע שנקרא","make_public":"הפיכת הנושא לפומבי","make_private":"הפיכה להודעה פרטית"},"feature":{"pin":"נעיצת פוסט","unpin":"שחרור נעיצת פוסט","pin_globally":"נעיצת פוסט גלובלית","make_banner":"נושא באנר","remove_banner":"הסרת נושא באנר"},"reply":{"title":"תגובה","help":"החל בכתיבת הודעה לפוסט זה"},"clear_pin":{"title":"נקה נעיצה","help":"נקה סטטוס נעוץ של פוסט זה כדי שהוא לא יופיע עוד בראש רשימת הפוסטים שלך"},"share":{"title":"שיתוף","help":"שתפו קישור לפוסט זה"},"flag_topic":{"title":"דגל","help":"דגלו פוסט זה באופן פרטי לתשומת לב או שלחו התראה פרטית בנוגע אליו","success_message":"דיגלתם פוסט זה בהצלחה."},"feature_topic":{"title":"הצגת פוסט זה","pin":"גרמו לפוסט זה להופיע בראש קטגוריה  {{categoryLink}}  עד","confirm_pin":"יש לך כבר {{count}} פוסטים נעוצים. מספר גדול מידי של פוסטים נעוצים עשויים להכביד על משתמשים חדשים או אנונימיים. האם את/ה בטוחים שאתם רוצים להצמיד פוסט נוסף בקטגוריה זו? ","unpin":"הסרת פוסט זה מראש הקטגוריה {{categoryLink}}.","unpin_until":"גרמו לפוסט זה להופיע בראש הקטגוריה {{categoryLink}} או המתן עד \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"המשתמש/ת יכולים להסיר את הפוסט באופן עצמאי עבור עצמם.","pin_validation":"דרוש תאריך על מנת לנעוץ את הפוסט. ","not_pinned":"אין נושאים שננעצו בקטגוריה  {{categoryLink}}.","already_pinned":{"one":"נושא שננעצו, נכון לעכשיו בקטגוריה  {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"נושאים ננעצו, נכון לעכשיו, בקטגוריה  {{categoryLink}}.: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"גרמו לפוסט זה להופיע בראש כל רשימות הפוסטים עד","confirm_pin_globally":"יש לך כבר {{count}} פוסטים המוצמדים באופן גלובאלי. עודף פוסטים מוצמדים עשוי להכביד על משתמשים חדשים או אנונימיים. האם את/ה בטוחים שאתם מעוניינים להצמיד פוסט גלובאלי נוסף?","unpin_globally":"הסרת פוסט זה מראש כל רשימות הפוסטים.","unpin_globally_until":"הסרת פוסט זה מראש כל רשימות הפוסטים או המתינו עד \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"משתמשים יכולים להסיר את הצמדת הפוסט באופן עצמאי לעצמם.","not_pinned_globally":"אין נושאים נעוצים גלובאלית.","already_pinned_globally":{"one":"נושאים שכרגע נעוצים גלובאלית: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"נושאים שכרגע נעוצים גלובאלית: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"הפכו פוסט זה לבאנר אשר מופיע בראש כל העמודים.","remove_banner":"הסרת הבאנר שמופיע בראש כל העמודים.","banner_note":"משתמשים יכולים לבטל את הבאנר על ידי סגירתו. רק פוסט אחד יכול לשמש כבאנר בזמן נתון.","no_banner_exists":"אין נושא באנר","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eיש\u003c/strong\u003e כרגע נושא באנר."},"inviting":"מזמין...","automatically_add_to_groups":"הזמנה זו כוללת גם גישה לקבוצות הבאות:","invite_private":{"title":"הזמינו להודעה","email_or_username":"כתובת דואר אלקטרוני או שם משתמש של המוזמן","email_or_username_placeholder":"כתובת דואר אלקטרוני או שם משתמש","action":"הזמנה","success":"הזמנו את המשתמש להשתתף בשיחה.","success_group":"הזמנו את הקבוצה הזו להשתתף בהודעה זו.","error":"סליחה, הייתה שגיאה בהזמנת משתמש זה.","group_name":"שם הקבוצה"},"controls":"מכווני נושא","invite_reply":{"title":"הזמנה","username_placeholder":"שם משתמש","action":"שלח הזמנה","help":"הזמינו אנשים אחרים לפוסט זה דרך דואר אלקטרוני או התראות","to_forum":"נשלח מייל קצר המאפשר לחברך להצטרף באופן מיידי באמצעות לחיצה על קישור, ללא צורך בהתחברות למערכת הפורומים.","sso_enabled":"הכנס את שם המשתמש של האדם שברצונך להזמין לפוסט זה.","to_topic_blank":"הכנס את שם המשתמש או כתובת דואר האלקטרוני של האדם שברצונך להזמין לפוסט זה.","to_topic_email":"הזנת כתובת אימייל. אנחנו נשלח הזמנה שתאפשר לחברך להשיב לפוסט הזה.","to_topic_username":"הזנת שם משתמש/ת. נשלח התראה עם לינק הזמנה לפוסט הזה. ","to_username":"הכנסת את שם המשתמש של האדם שברצונך להזמין. אנו נשלח התראה למשתמש זה עם קישור המזמין אותו לפוסט זה.","email_placeholder":"name@example.com","success_email":"שלחנו הזמנה ל:  \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. נודיע לך כשהזמנה תענה. בדוק את טאב ההזמנות בעמוד המשתמש שלך בשביל לעקוב אחרי ההזמנות ששלחת. ","success_username":"הזמנו את המשתמש להשתתף בפוסט.","error":"מצטערים, לא יכלנו להזמין האיש הזה. אולי הוא כבר הוזמן בעבר? (תדירות שליחת ההזמנות מוגבלת)"},"login_reply":"התחברו כדי להשיב","filters":{"n_posts":{"one":"הודעה אחת","other":"{{count}} הודעות"},"cancel":"הסרת הסינון"},"split_topic":{"title":"העבר לפוסט חדש","action":"העבר לפוסט חדש","topic_name":"שם הפוסט החדש","error":"הייתה שגיאה בהעברת ההודעות לפוסט החדש.","instructions":{"one":"אתה עומד ליצור פוסט חדש ולמלא אותו עם ההודעה שבחרת.","other":"אתם עומדים ליצור פוסט חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e ההודעות שבחרת."}},"merge_topic":{"title":"העבר לפוסט קיים","action":"העבר לפוסט קיים","error":"התרחשה שגיאה בהעברת ההודעות לפוסט הזה.","instructions":{"one":"בבקשה בחר נושא אליו הייתי רוצה להעביר את ההודעה","other":"בבקשה בחר את הפוסט אליו תרצה להעביר את  \u003cb\u003e{{count}}\u003c/b\u003e ההודעות."}},"merge_posts":{"title":"ניזוג פוסטים שנבחרו","action":"מיזוג פוסטים שנבחרו","error":"ארעה שגיאה במיזוג הפוסטים שנבחרו."},"change_owner":{"title":"שנה בעלים של הודעות","action":"שנה בעלות","error":"התרחשה שגיאה בשינוי הבעלות של ההדעות.","label":"בעלים חדש של ההודעות","placeholder":"שם המשתמש של הבעלים החדש","instructions":{"one":"אנא בחר את הבעלים החדש של ההודעות מאת \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"אנא בחר את הבעלים החדש של {{count}} ההודעות מאת \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"יש לשים לב שהתראות על הודעה זו יועברו למשתמש החדש רטרואקטיבית.\u003cbr\u003eזהירות: כרגע, שום מידע תלוי-הודעה אינו מועבר למשתמש החדש. השתמשו בזהירות."},"change_timestamp":{"title":"שנה חותמת זמן","action":"זנה חותמת זמן","invalid_timestamp":"חותמת זמן לא יכולה להיות בעתיד","error":"הייתה שגיאה בשינוי חותמת הזמן של הפוסט","instructions":"אנא בחרו את חותמת הזמן החדשה של הפוסט. פרסומים בפוסט יועדכנו לאותם הפרשי זמנים."},"multi_select":{"select":"בחירה","selected":"נבחרו ({{count}})","select_replies":"נבחרו +תגובות","delete":"מחק נבחרים","cancel":"בטל בחירה","select_all":"בחר הכל","deselect_all":"בחר כלום","description":{"one":"בחרת הודעה אחת.","other":"בחרת \u003cb\u003e{{count}}\u003c/b\u003e הודעות."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"תגובה עם ציטוט","edit":"עורך את {{link}} {{replyAvatar}} {{username}}","edit_reason":"סיבה: ","post_number":"הודעה {{number}}","last_edited_on":"הודעה נערכה לאחרונה ב","reply_as_new_topic":"תגובה כפוסט מקושר","continue_discussion":"ממשיך את הדיון מ {{postLink}}:","follow_quote":"מעבר להודעה המצוטטת","show_full":"הראה הודעה מלאה","show_hidden":"הצגת תוכן מוסתר.","deleted_by_author":{"one":"(ההודעה בוטלה על ידי הכותב, היא תמחק אוטומטית בעוד %{count} שעות אלא אם תסומן בדגל)","other":"(ההודעה בוטלה על ידי הכותבים, היא תמחק אוטומטית בעוד %{count} שעות אלא אם כן היא תדוגל)"},"expand_collapse":"הרחב/צמצם","gap":{"one":"הצג הודעה אחת שהוסתרה","other":"הצג {{count}} הודעות שהוסתרו"},"unread":"הפוסט טרם נקרא","has_replies":{"one":"תגובה אחת","other":"{{count}} תגובות"},"has_likes":{"one":"לייק אחד","other":"{{count}} לייקים "},"has_likes_title":{"one":"מישהו אחד אהב את התגובה הזו","other":"{{count}} אנשים אהבו את התגובה הזו"},"has_likes_title_only_you":"אתם אהבתם את התגובה הזו","has_likes_title_you":{"one":"אתם ועוד מישהו אהבתם את הפוסט הזה","other":"אתם ו {{count}} אנשים אחרים אהבתם את הפוסט הזה"},"errors":{"create":"סליחה, הייתה שגיאה ביצירת ההודעה שלך. אנא נסה שנית.","edit":"סליחה, הייתה שגיאה בעריכת ההודעה שלך. אנא נסה שנית.","upload":"סליחה, הייתה שגיאה בהעלאת הקובץ שלך. אנא נסה שנית","file_too_large":"מצטערים, הקובץ גדול מידי (הגודל המירבי הוא {{max_size_kb}}kb). אולי תקצו להעלות קבצים גדולים לשירות שיתוף בענן ולשתף את הקישור.","too_many_uploads":"סליחה, אך ניתן להעלות רק קובץ אחת כל פעם.","too_many_dragged_and_dropped_files":"מצטערים, אתם יכולים להעלות עד 10 קבצים בו זמנית.","upload_not_authorized":"סליחה, אך סוג הקובץ שאתם מנסים להעלות אינו מורשה (סיומות מורשות: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"סליחה, משתמשים חדשים לא יכולים להעלות תמונות.","attachment_upload_not_allowed_for_new_user":"סליחה, משתמשים חדשים לא יכולים להעלות קבצים.","attachment_download_requires_login":"מצטערים, עליכם להיות מחוברים כדי להוריד את הקבצים המצורפים."},"abandon":{"confirm":"האם אתם רוצים לנטוש את ההודעה שלכם?","no_value":"לא, שמור אותה","yes_value":"כן, נטוש"},"via_email":"פרסום זה הגיע באמצעות דוא\"ל","via_auto_generated_email":"פוסט זה הגיע דרך מייל שנוצר אוטומטית","whisper":"פרסום זה הוא לחישה פרטית לצוות האתר","wiki":{"about":"פוסט זה הוא ויקי"},"archetypes":{"save":"שמור אפשרויות"},"few_likes_left":"תודה שאתם מפזרים אהבה! נותרו לכם מעט לייקים להיום.","controls":{"reply":"התחל לכתוב תגובה להודעה זו","like":"תן לייק להודעה זו","has_liked":"אהבת פוסט זה","undo_like":"בטל 'אהוב'","edit":"ערוך הודעה זו","edit_anonymous":"מצטערים, אך עליכם להיות מחוברים בכדי לערוך פרסום זה.","flag":"דגלו הודעה זו באופן פרטי לתשומת לב או שלחו התראה פרטית עליה","delete":"מחק הודעה זו","undelete":"שחזר הודעה זו","share":"שיתוף קישור להודעה זו","more":"עוד","delete_replies":{"confirm":{"one":"אתם רוצים למחוק את התגובה הישירה להודעה זו?","other":"אתם רוצים למחוק את {{count}} התגובות הישירות להודעה זו?"},"yes_value":"כן, מחק גם את התגובות","no_value":"לא, רק את ההודעה"},"admin":"פרסום פעולות מנהל/ת","wiki":"יצירת wiki","unwiki":"הסרת ה-Wiki","convert_to_moderator":"הוספת צבע צוות","revert_to_regular":"הסרת צבע צוות","rebake":"בנייה מחודשת של HTML","unhide":"הסרת הסתרה","change_owner":"שינוי בעלות"},"actions":{"flag":"דיגול","defer_flags":{"one":"דחיית סימון","other":"דחיית דגלים"},"undo":{"off_topic":"ביטול דיגול","spam":"ביטול דיגול","inappropriate":"ביטול דיגול","bookmark":"בטל העדפה","like":"בטל לייק","vote":"בטל הצבעה"},"people":{"off_topic":"דוגל כאוף-טופיק","spam":"דוגל כספאם","inappropriate":"דוגל כלא ראוי","notify_moderators":"דווח לעורכים","notify_user":"נשלחה הודעה","bookmark":"סומן","like":"אהבו את זה","vote":"הצביעו לזה"},"by_you":{"off_topic":"דיגלתם פרסום זה כאוף-טופיק","spam":"דיגלתם את זה כספאם","inappropriate":"דיגלתם את זה כלא ראוי","notify_moderators":"דיגלתם זאת עבור המנחים","notify_user":"שלחת הודעה למשתמש זה","bookmark":"סימנת הודעה זו כמועדפת","like":"נתת לזה לייק","vote":"הצבעת להודעה זו"},"by_you_and_others":{"off_topic":{"one":"אתם ועוד אחד דיגלתם את זה כאוף-טופיק","other":"אתם ועוד {{count}} אנשים אחרים דיגלתם את זה כאוף-טופיק"},"spam":{"one":"אתם ועוד אחד דיגלתם את זה כספאם","other":"אתם ועוד {{count}} אנשים אחרים דיגלתם את זה כספאם"},"inappropriate":{"one":"אתם ועוד אחד דיגלתם את זה כלא ראוי","other":"אתם ועוד {{count}} אנשים אחרים דיגלתם את זה כלא ראוי"},"notify_moderators":{"one":"אתם ועוד אחד דיגלתם את זה עבור המנחים","other":"אתם ועוד {{count}} אנשים אחרים דיגלתם את זה למנחים"},"notify_user":{"one":"אתה ו-1 נוסף שלחתם הודעה למשתמש הזה. ","other":"אתה ו{{count}} אנשים נוספים שלחתם הודעה למשתמש הזה"},"bookmark":{"one":"אתה ועוד אחד סימנתם הודעה זו כמועדפת","other":"אתה ועוד {{count}} אנשים אחרים סימנתם הודעה זו כמועדפת"},"like":{"one":"אתה ועוד אחד נתתם לייק לזה","other":"אתה ועוד {{count}} אנשים אחרים נתתם לייק לזה"},"vote":{"one":"אתה ועוד אחד הצבעת להודעה זו","other":"אתה ועוד {{count}} אנשים אחרים הצבעתם להודעה זו"}},"by_others":{"off_topic":{"one":"אדם אחד דיגל את זה כאוף-טופיק","other":"{{count}} אנשים סמנו את זה כאוף-טופיק"},"spam":{"one":"אדם אחד דיגל את זה כספאם","other":"{{count}} אנשים דיגלו את זה כספאם"},"inappropriate":{"one":"אדם אחד דיגל את זה כלא ראוי","other":"{{count}} אנשים דיגלו את זה כלא ראוי"},"notify_moderators":{"one":"אדם אחד דיגל את זה למנחים","other":"{{count}} אנשים דיגלו את זה למנחים"},"notify_user":{"one":"אדם אחד שלח הודעה למשתמש זה","other":"{{count}} שלחו הודעה למשתמש זה"},"bookmark":{"one":"אדם אחד סימן הודעה זו כמועדפת","other":"{{count}} אנשים סימנו הודעה זו כמועדפת"},"like":{"one":"אדם אחד נתן לזה לייק","other":"{{count}} אנשים נתנו לזה לייק"},"vote":{"one":"אדם אחד הצביע להודעה זו","other":"{{count}} אנשים הצביעו להודעה זו"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?","other":"Are you sure you want to delete all those posts?"}},"merge":{"confirm":{"one":"אתם בטוחים שאתם מעוניינים למזג את הפוסטים האלו?","other":"אתם בטוחים שאתם מעוניינים למזג את {{count}} הפוסטים האלו?"}},"revisions":{"controls":{"first":"מהדורה ראשונה","previous":"מהדורה קודמת","next":"מהדורה באה","last":"מהדורה אחרונה","hide":"הסתרת שינויים","show":"הצגת שינויים","revert":"חזרה לגרסה זו","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{קודם}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{נוכחי}}\u003c/strong\u003e / {כוללl}}"},"displays":{"inline":{"title":"הצג את הפלט עם תוספות והסרות בתוכו","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"הצג את הפרשי הפלט אחד ליד השני","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"הציגו את ההבדלי המקור הגולמיים זה לצד זה","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e גלם"}}}},"category":{"can":"יכול\u0026hellip; ","none":"(ללא קטגוריה)","all":"כל הקטגוריות","choose":"בחר קטגוריה\u0026hellip;","edit":"ערוך","edit_long":"עריכה","view":"הצג פוסטים בקטגוריה","general":"כללי","settings":"הגדרות","topic_template":"תבנית פוסט","tags":"תגיות","tags_allowed_tags":"תגיות שניתנות לשימוש בקטגוריה זו בלבד:","tags_allowed_tag_groups":"קבוצות תגים שניתנות לשימוש בקטגוריה זו:","tags_placeholder":"(אופציונלי) רשימת תגים מותרים","tag_groups_placeholder":"(אופציונלי) רשימת קבוצות תגים","delete":"מחק קטגוריה","create":"קטגוריה חדשה","create_long":"צור קטגוריה חדשה","save":"שמור קטגוריה","slug":"כתובת חלזונית לקטגוריה","slug_placeholder":"(אופציונאלי) מלים-מחוברות-במקפים-לכתובת-URL","creation_error":"ארעה שגיאה במהלך יצירת הקטגוריה הזו.","save_error":"ארעה שגיאה בשמירת הקטגוריה הזו","name":"שם הקטגוריה","description":"תיאור","topic":"נושא הקטגוריה","logo":"תמונת לוגו לקטגוריה","background_image":"תמונת רקע לקטגוריה","badge_colors":"צבעי העיטורים","background_color":"צבע רקע","foreground_color":"צבע קדמי","name_placeholder":"מילה או שתיים לכל היותר","color_placeholder":"כל צבע אינטרנטי","delete_confirm":"האם אתה בטוח שברצונך למחוק את הקטגוריה הזו?","delete_error":"ארעה שגיאה במחיקת הקטגוריה.","list":"הצג קטגוריות","no_description":"אנא הוסיפו תיאור לקטגוריה זו.","change_in_category_topic":"ערוך תיאור","already_used":"הצבע הזה בשימוש על ידי קטגוריה אחרת","security":"אבטחה","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","images":"תמונות","auto_close_label":"נעל פוסטים אוטומטית אחרי:","auto_close_units":"שעות","email_in":"כתובת דואר נכנס מותאמת אישית:","email_in_allow_strangers":"קבלת דוא\"ל ממשתמשים אנונימיים ללא חשבונות במערכת הפורומים","email_in_disabled":"האפשרות פרסום פוסטים חדשים דרך הדוא\"ל נוטרלה דרך הגדרות האתר. לאפשר פרסום באמצעות  משלוח דוא\"ל.","email_in_disabled_click":"אפשרו את את ההגדרה \"דוא\"ל נכנס\"","suppress_from_homepage":"הרחק קטגוריה זו מהעמוד הראשי","allow_badges_label":"הרשו לתגים (badges) להיות מוענקים בקטגוריה זו","edit_permissions":"ערוך הרשאות","add_permission":"הוסף הרשאה","this_year":"השנה","position":"מיקום","default_position":"מיקום ברירת מחדל","position_disabled":"קטגוריות יוצגו על פס סדר הפעילות. כדי לשלוט בסדר הקטגורייות ברשימה,","position_disabled_click":"אפשרו את ההגדרה \"סדר קטגוריות קבוע\".","parent":"קטגורית אם","notifications":{"watching":{"title":"עוקב","description":"תצפו באופן אוטומטי בכל הנושאים שבקטגוריות אלו. תקבל התראה על כל פרסום חדש בכל אחד מהנושאים בקטגוריה ואת מספר התגובות לכל אחד מהם."},"watching_first_post":{"title":"צפייה בהודעה ראשונה","description":"תקבלו התראה על הפרסום הראשון בכל אחד מהנושאים בקטגוריות אלו."},"tracking":{"title":"רגיל+","description":"אתם תעקבו אוטומטית אחרי כל הנושאים בקטגוריות אלו. אתם תיודעו אם מישהו מזכיר את @שמכם או עונה לכם, וספירה של תגובות חדשות תופיע לכם."},"regular":{"title":"נורמלי","description":"תקבלו התראה אם מישהו יזכיר את @שם_המשתמש/ת שלך או ישיב לפרסום שלך."},"muted":{"title":"מושתק","description":"לא תקבלו התראות על נושאים חדשים בקטגוריות אלו, והם לא יופיעו בעמוד הלא נקראו שלך."}}},"flagging":{"title":"תודה על עזרתך לשמירה על תרבות הקהילה שלנו!","action":"דגלו פוסט","take_action":"בצע פעולה","notify_action":"הודעה","official_warning":"אזהרה רשמית","delete_spammer":"מחק ספאמר","yes_delete_spammer":"כן, מחק ספאמר","ip_address_missing":"(N/A)","hidden_email_address":"(מוסתר)","submit_tooltip":"שלחו את הדגל הפרטי","take_action_tooltip":"הגעה באופן מיידי למספר הסימונים האפשרי, במקום להמתין לסימונים נוספים מן הקהילה","cant":"סליחה, לא ניתן לדגל פוסט זה כרגע.","notify_staff":"הודעה לצוות באופן פרטי","formatted_name":{"off_topic":"מחוץ לנושא הפוסט","inappropriate":"לא ראוי","spam":"זהו ספאם"},"custom_placeholder_notify_user":"היה ממוקד, חיובי ואדיב תמיד.","custom_placeholder_notify_moderators":"ספר לנו מה בדיוק מטריד אותך וצרף קישורים רלוונטיים ודוגמאות במידת האפשר.","custom_message":{"at_least":{"one":"הכניסו לפחות תו אחד","other":"הכניסו לפחות {{count}} תווים"},"more":{"one":"נשאר אחד","other":"{{count}} נשארו..."},"left":{"one":"נותר אחד","other":"{{count}} נותרו"}}},"flagging_topic":{"title":"תודה על עזרתך לשמירה על תרבות הקהילה שלנו!","action":"דגלו נושא","notify_action":"הודעה"},"topic_map":{"title":"סיכום פוסט","participants_title":"מפרסמים מתמידים","links_title":"לינקים פופלארים","links_shown":"הצגת קישורים נוספים...","clicks":{"one":"לחיצה אחת","other":"%{count} לחיצות"}},"post_links":{"about":"הרחיבו לינקים נוספים לפוסט זה","title":{"one":"עוד 1","other":"עוד %{count}"}},"topic_statuses":{"warning":{"help":"זוהי אזהרה רשמית."},"bookmarked":{"help":"יצרת סימניה לפוסט זה"},"locked":{"help":"הפוסט הזה נעול, הוא לא מקבל יותר תגובות חדשות"},"archived":{"help":"הפוסט הזה אוכסן בארכיון; הוא הוקפא ולא ניתן לשנותו"},"locked_and_archived":{"help":"הפוסט הזה סגור ומאורכב. לא ניתן להגיב בו יותר או לשנות אותו. "},"unpinned":{"title":"הורד מנעיצה","help":"פוסט זה אינו מקובע עבורך; הוא יופיע בסדר הרגיל"},"pinned_globally":{"title":"נעוץ גלובאלית","help":"הנושא הזה נעוץ בכל האתר; הוא יוצג בראש הקטגוריה שלו כחדש ביותר"},"pinned":{"title":"נעוץ","help":"פוסט זה מקובע עבורך, הוא יופיע בראש הקטגוריה"},"invisible":{"help":"פוסט זה מוסתר; הוא לא יוצג ברשימות הפוסטים, וזמין רק באמצעות קישור ישיר."}},"posts":"הודעות","posts_long":"יש {{number}} הודעות בפוסט הזה","original_post":"הודעה מקורית","views":"צפיות","views_lowercase":{"one":"צפיה","other":"צפיות"},"replies":"תגובות","views_long":"הפוסט הזה נצפה {{number}} פעמים","activity":"פעילות","likes":"לייקים","likes_lowercase":{"one":"לייק","other":"לייקים"},"likes_long":"יש {{number}} לייקים לפוסט הזה","users":"משתמשים","users_lowercase":{"one":"משתמש","other":"משתמשים"},"category_title":"קטגוריה","history":"היסטוריה","changed_by":"מאת {{author}}","raw_email":{"title":"גלם הדוא\"ל","not_available":"לא זמין!"},"categories_list":"רשימת קטגוריות","filters":{"with_topics":"%{filter} פוסטים","with_category":"%{filter} %{category} פוסטים","latest":{"title":"פורסמו לאחרונה","title_with_count":{"one":"האחרון (1)","other":"({{count}}) פורסמו לאחרונה"},"help":"פוסטים עם תגובות לאחרונה"},"hot":{"title":"חם","help":"מבחר הפוסטים החמים ביותר"},"read":{"title":"נקרא","help":"פוסטים שקראת, לפי סדר קריאתם"},"search":{"title":"חיפוש","help":"חיפוש בכל הפוסטים"},"categories":{"title":"קטגוריות","title_in":"קטגוריה - {{categoryName}}","help":"כל הפוסטים תחת הקטגוריה הזו"},"unread":{"title":"לא נקרא","title_with_count":{"one":"לא נקרא(1)","other":"לא נקראו ({{count}})"},"help":"פוסטים שאתם כרגע צופים או עוקבים אחריהם עם פרסומים שלא נקראו","lower_title_with_count":{"one":"לא נקרא (1)","other":"לא נקראו {{count}} "}},"new":{"lower_title_with_count":{"one":"חדש (1)","other":"{{count}} חדשים"},"lower_title":"חדש","title":"חדש","title_with_count":{"one":"חדש (1)","other":"חדשים ({{count}})"},"help":"פרסומים נוצרו בימים האחרונים"},"posted":{"title":"ההודעות שלי","help":"פוסטים בהם פרסמת"},"bookmarks":{"title":"סימניות","help":"פוסטים עבורם יצרת סימניות"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"פוסטים מדוברים בקטגוריה {{categoryName}}"},"top":{"title":"מובילים","help":"הפוסטים הפעילים ביותר בשנה, חודש, שבוע או יום האחרונים","all":{"title":"תמיד"},"yearly":{"title":"שנתי"},"quarterly":{"title":"רבעוני"},"monthly":{"title":"חודשי"},"weekly":{"title":"שבועי"},"daily":{"title":"יומי"},"all_time":"כל הזמנים","this_year":"שנה","this_quarter":"רבעוני","this_month":"חודש","this_week":"שבוע","today":"היום","other_periods":"ראה חלק עליון"}},"browser_update":"למרבה הצער, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eהדפדפן שלכם זקן מידי מכדי לעבוד באתר זה.\u003c/a\u003e. אנא \u003ca href=\"http://browsehappy.com\"\u003eשדרגו את הדפדפן שלכם\u003c/a\u003e.","permission_types":{"full":"צרו / תגובה/ צפייה","create_post":"תגובה / צפייה","readonly":"צפה"},"lightbox":{"download":"הורדה"},"search_help":{"title":"עזרה בחיפוש"},"keyboard_shortcuts_help":{"title":"קיצורי מקלדת","jump_to":{"title":"קפצו אל","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e בית","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e אחרונים","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e חדשים","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e לא-נקראו","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e קטגוריות","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e מובילים","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e סימניות","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e פרופיל","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e הודעות"},"navigation":{"title":"ניווט","jump":"\u003cb\u003e#\u003c/b\u003e מעבר לפוסט #","back":"\u003cb\u003eu\u003c/b\u003e חזרה","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e הזיזו בחירה \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e פתחו נושא נבחר","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e תחום הבא/קודם"},"application":{"title":"אפליקציה","create":"\u003cb\u003ec\u003c/b\u003e יצירת נושא חדש","notifications":"\u003cb\u003en\u003c/b\u003e פתיחת התראות","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e פתיחת תפריט המבורגר","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e פתיחת תפריט משתמש","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e הצגת נושאים שהתעדכנו","search":"\u003cb\u003e/\u003c/b\u003e חיפוש","help":"\u003cb\u003e?\u003c/b\u003e פתיחת קיצורי מקשים","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e בטלו חדשים/פוסטים","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e בטלו נושאים","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e התנתקות"},"actions":{"title":"פעולות","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e נעצו/בטלו נעיצה בנושא","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e שיתוף נושא","share_post":"\u003cb\u003es\u003c/b\u003e שיתוף פוסט","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e מענה כנושא קשור","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e ענו לנושא","reply_post":"\u003cb\u003er\u003c/b\u003e תגובה לפוסט","quote_post":"\u003cb\u003eq\u003c/b\u003e ציטוט פוסט","like":"\u003cb\u003el\u003c/b\u003e אהבו פוסט","flag":"\u003cb\u003e!\u003c/b\u003e דגלו פוסט","bookmark":"\u003cb\u003eb\u003c/b\u003e סימון פוסט","edit":"\u003cb\u003ee\u003c/b\u003e עריכת פוסט","delete":"\u003cb\u003ed\u003c/b\u003e מחיקת פוסט","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e השתקת נושא","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e נושא רגיל","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e עקבו אחר נושא","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e צפו בנושא"}},"badges":{"earned_n_times":{"one":"הרוויחו עיטור זה פעם אחת","other":"הרוויחו עיטור זה %{count} פעמים"},"granted_on":"הוענק %{date}","others_count":"אחרים עם עיטור זה (%{count})","title":"עיטורים","allow_title":"כותרת פנויה","multiple_grant":"ניתן מספר פעמים","badge_count":{"one":"1 עיטורים","other":"%{count} עיטורים"},"more_badges":{"one":"+1 נוסף","other":"+%{count} נוספים"},"granted":{"one":"הוענק","other":"%{count} הוענקו"},"select_badge_for_title":"בחרו בעיטור לשימוש בכותרת שלכם","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"מתחילים"},"community":{"name":"קהילה"},"trust_level":{"name":"רמת אמון"},"other":{"name":"אחר"}}},"google_search":"\u003ch3\u003eחפשו באמצעות גוגל\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eגוגל\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"כל התגיות","selector_all_tags":"כל התגיות","selector_no_tags":"ללא תגיות","changed":"תגיות ששונו:","tags":"תגיות","choose_for_topic":"בחרו תגים אופציונציים לנושא זה","delete_tag":"מחק תגית","delete_confirm":"האם אתם בטוחים שאתם מעוניינים למחוק את התגית הזו?","rename_tag":"שנו תגית","rename_instructions":"בחרו שם חדש לתגית:","sort_by":"סידור לפי:","sort_by_count":"ספירה","sort_by_name":"שם","manage_groups":"נהלו קבוצות תגים","manage_groups_description":"הגדירו קבוצות כדי לארגן תגיות","filters":{"without_category":"%{filter} %{tag} נושאים","with_category":"%{filter} %{tag} נושאים ב%{category}","untagged_without_category":"%{filter} נושאים לא מתוייגים","untagged_with_category":"%{filter} נושאים ללא תגיות ב %{category}"},"notifications":{"watching":{"title":"צופים","description":"אתם תצפו אוטומטית בכל הנושאים עם תג זה. אתם תיודעו לגבי כל הפוסטים החדשים והנושאים, בנוסף - הספירה של לא-נקראו ופוסטים חדשים גם תופיע ליד הנושא."},"watching_first_post":{"title":"צפייה בהודעה ראשונה","description":"תקבלו התראה רק על הפרסום הראשון בכל נושא חדש עם התגית הזו."},"tracking":{"title":"במעקב","description":"אתם תעקבו אוטומטית אחרי כל הנושאים עם תגית זו. ספירה של לא-נקראו ופוסטים חדשים תופיע ליד הנושא."},"regular":{"title":"רגיל","description":"אתם תיודעו אם מישהו מזכיר את @שמכם או עונה לפוסט שלכם."},"muted":{"title":"מושתק","description":"אתם תיודעו לגבי כל דבר בנוגע לנושאים חדשים עם תג זה, והם לא יופיעו בטאב ה״לא-נקראו״ שלכם."}},"groups":{"title":"תייגו קבוצות","about":"הוסיפו תגיות לקבוצות כדי לנהל אותן ביתר קלות.","new":"קבוצה חדשה","tags_label":"תגיות בקבוצה זו:","parent_tag_label":"תג הורה:","parent_tag_placeholder":"אופציונלי","parent_tag_description":"תגיות מקבוצה זו לא ניתנות לשימוש אלא אם תגית ההורה קיימת.","one_per_topic_label":"הגבלה של תג אחד לכל נושא מקבוצה זו","new_name":"קבוצת תגיות חדשה","save":"שמור","delete":"מחק","confirm_delete":"האם אתם בטוחים שאתם מעוניינים למחוק את קבוצת התגיות הזו?"},"topics":{"none":{"unread":"אין לכם נושאים שלא נקראו.","new":"אין לכם נושאים חדשים.","read":"טרם קראתם נושאים.","posted":"עדיין לא פרסמתם באף נושא.","latest":"אין נושאים אחרונים.","hot":"אין נושאים חמים.","bookmarks":"עדיין אין לכם נושאים מסומנים.","top":"אין נושאים מובילים.","search":"אין תוצאות חיפוש."},"bottom":{"latest":"אין יותר נושאים אחרונים.","hot":"אין יותר נושאים חמים.","posted":"אין יותר נושאים שפורסמו.","read":"אין יותר נושאים שניקראו.","new":"אין יותר נושאים חדשים.","unread":"אין יותר נושאים שלא נקראו.","top":"אין יותר נושאים מובילים.","bookmarks":"אין יותר נושאים שסומנו.","search":"אין יותר תוצאות חיפוש"}}},"invite":{"custom_message":"הפכו את ההזמנה שלכם לקצת יותר אישי על ידי כתיבת","custom_message_link":"הודעה מותאמת-אישית","custom_message_placeholder":"הכניסו את הודעתכם האישית","custom_message_template_forum":"הי, כדאי לכם להצטרף לפורום הזה!","custom_message_template_topic":"הי, חשבתי שנושא זה יעניין אתכם!"},"poll":{"voters":{"one":"מצביע","other":"מצביעים"},"total_votes":{"one":"מספר הצבעות כולל","other":"מספר הצבעות כולל"},"average_rating":"דירוג ממוצע: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"הצבעות הן פומביות."},"multiple":{"help":{"at_least_min_options":{"one":"בחרו לפחות אפשרות אחת","other":"בחרו לפחות \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות"},"up_to_max_options":{"one":"בחרו לכל היותר אפשרות אחת.","other":"בחרו עד \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות"},"x_options":{"one":"בחרו אפשרות אחת","other":"בחרו \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות"},"between_min_and_max_options":"בחרו בין \u003cstrong\u003e%{min}\u003c/strong\u003e ל-\u003cstrong\u003e%{max}\u003c/strong\u003e אפשרויות"}},"cast-votes":{"title":"הצביעו","label":"הצביעו עכשיו!"},"show-results":{"title":"להציג את תוצאות הסקר","label":"הצגת תוצאות"},"hide-results":{"title":"חזרה להצבעות שלך","label":"הסתרת תוצאות"},"open":{"title":"פתיחת הסקר","label":"פתיחה","confirm":"האם את/ה בטוח/ה שאת/ה רוצה לפתוח את הסקר הזה?"},"close":{"title":"סגירת הסקר","label":"סגירה","confirm":"האם אתם בטוחים שאתם רוצים לסגור סקר זה?"},"error_while_toggling_status":"מצטערים, חלה שגיאה בשינוי המצב של סקר זה.","error_while_casting_votes":"מצטערים, ארעה שגיאה בהצבעתכם.","error_while_fetching_voters":"מצטערים, ארעה שגיאה בהצגת המצביעים.","ui_builder":{"title":"בניית סקר","insert":"הכנסת סקר","help":{"options_count":"הכניסו לפחות 2 אפשרויות"},"poll_type":{"label":"סוג","regular":"בחירה בודדת","multiple":"בחירה מרובה","number":"ציון מספרי"},"poll_config":{"max":"מקסימום","min":"מינימום","step":"צעד"},"poll_public":{"label":"הציג מי הצביעו"},"poll_options":{"label":"הכניסו אפשרות בחירה אחת בכל שורה"}}},"type_to_filter":"הקלד לסינון...","admin":{"title":"ניהול Discourse","moderator":"מנהל","dashboard":{"title":"לוח בקרה","last_updated":"עדכון אחרון של לוח הבקרה:","version":"גירסה","up_to_date":"אתם מעודכנים!","critical_available":"עדכון קריטי מוכן להתקנה.","updates_available":"עדכונים מוכנים.","please_upgrade":"בבקשה שדרג!","no_check_performed":"לא בוצעה בדיקה לעדכונים. וודא ש-sidekiq פועל.","stale_data":"לא בוצעה בדיקת עדכונים לאחרונה. וודא ש-sidekiq פועל.","version_check_pending":"נראה שעדכנת לאחרונה. פנטסטי!","installed_version":"הותקן","latest_version":"אחרונה","problems_found":"נמצאו מספר בעיות עם התקנת Discourse שלך:","last_checked":"נבדק לאחרונה","refresh_problems":"רענן","no_problems":"לא נמצאו בעיות.","moderators":"מנהלים:","admins":"מנהלים ראשיים:","blocked":"חסומים:","suspended":"מושעים:","private_messages_short":"הודעות","private_messages_title":"הודעות","mobile_title":"סלולר","space_free":"{{size}} חופשיים","uploads":"העלאות","backups":"גיבויים","traffic_short":"תנועה","traffic":"בקשות יישום web","page_views":"בקשות API","page_views_short":"בקשות API","show_traffic_report":"הצגת דו\"ח תנועה מפורט","reports":{"today":"היום","yesterday":"אתמול","last_7_days":"בשבעת הימים האחרונים","last_30_days":"ב-30 הימים האחרונים","all_time":"כל הזמן","7_days_ago":"לפני שבעה ימים","30_days_ago":"לפני 30 ימים","all":"הכל","view_table":"טבלא","view_graph":"גרף","refresh_report":"רענון דו\"ח","start_date":"תאריך התחלה","end_date":"תאריך סיום","groups":"כל הקבוצות"}},"commits":{"latest_changes":"שינויים אחרונים: בבקשה עדכן תכופות!","by":"על ידי"},"flags":{"title":"דגלים","old":"ישן","active":"פעיל","agree":"הסכמה","agree_title":"אישור דגל זה כתקין ונכון","agree_flag_modal_title":"הסכמה ו...","agree_flag_hide_post":"קבחה (הסתרת פרסום + שליחת מסר פרטי)","agree_flag_hide_post_title":"הסתרת הודעה זו ושליחה אוטומטית של  הודעה פרטית למשתמש/ת שמאיצה בהם לערוך אותה","agree_flag_restore_post":"הסכמה (שחזור הפרסום)","agree_flag_restore_post_title":"שחזור פרסום זה","agree_flag":"הסכמה עם הדגל","agree_flag_title":"הסכמה עם הדגל ושמירת הפרסום ללא שינוי","defer_flag":"דחייה","defer_flag_title":"הסרה של דגל זה; הוא אינו דורש פעולה כעת.","delete":"מחיקה","delete_title":"מחיקת הפוסט שהדגל מצביע עליו.","delete_post_defer_flag":"מחיקת הפוסט ודחיית הדגל","delete_post_defer_flag_title":"מחיקת הפרסום; אם זהו הפרסום הראשון, מחיקת הפוסט","delete_post_agree_flag":"מחיקת הפוסט והסכמה עם הדגל","delete_post_agree_flag_title":"מחיקת פרסום; אם זהו הפרסום הראשון, מחיקת הפוסט","delete_flag_modal_title":"מחיקה ו...","delete_spammer":"מחיקת ספאמר","delete_spammer_title":"הסרת המשתמש/ת וכל הפרסומים והפוסטים של משתמש/ת אלו.","disagree_flag_unhide_post":"אי-קבלה (הצגה מחדש של הפרסום)","disagree_flag_unhide_post_title":"הסרה של כל הדגלים מהפרסום הזה והחזרתו למצב תצוגה","disagree_flag":"אי קבלה","disagree_flag_title":"התעלמות מהדגל היות שאינו תקין או אינו נכון","clear_topic_flags":"סיום","clear_topic_flags_title":"הפוסט נבדק והבעיה נפתרה. לחצו על סיום כדי להסיר את הדגלים.","more":"(עוד תגובות...)","dispositions":{"agreed":"התקבל","disagreed":"לא התקבל","deferred":"נדחה"},"flagged_by":"דוגל על ידי","resolved_by":"נפתר על ידי","took_action":"ננקטה פעוללה","system":"מערכת","error":"משהו השתבש","reply_message":"תגובה","no_results":"אין דגלים.","topic_flagged":"\u003cstrong\u003eהפוסט\u003c/strong\u003e הזה דוגל.","visit_topic":"בקרו בפוסט כדי לנקוט פעולה","was_edited":"הפוסט נערך לאחר הדיגול הראשון","previous_flags_count":"פוסט זה כבר דוגל {{count}} פעמים.","summary":{"action_type_3":{"one":"אוף-טופיק","other":"אוף-טופיק x{{count}}"},"action_type_4":{"one":"לא ראוי","other":"לא ראוי x{{count}}"},"action_type_6":{"one":"מותאם אישית","other":"מותאם אישית x{{count}}"},"action_type_7":{"one":"מותאם אישית","other":"מותאם אישית x{{count}}"},"action_type_8":{"one":"ספאם","other":"ספאם x{{count}}"}}},"groups":{"primary":"קבוצה ראשית","no_primary":"(אין קבוצה ראשית)","title":"קבוצות","edit":"ערוך קבוצות","refresh":"רענן","new":"חדש","selector_placeholder":"הזינו שם משתמש/ת","name_placeholder":"שם הקבוצה, ללא רווחים, בזהה לחוקי שם המשתמש","about":"ערוך את חברות הקבוצה שלך והשמות כאן","group_members":"חברי הקבוצה","delete":"מחק","delete_confirm":"למחוק קבוצה זו?","delete_failed":"לא ניתן למחוק קבוצה זו. אם זו קבוצה אוטומטית, היא בלתי ניתנת למחיקה.","delete_member_confirm":"להסיר את '%{username}' מהקבוצה '%{group}' ?","delete_owner_confirm":"הסרת הרשאות מנהל עבור '%{username}'?","name":"שם","add":"הוספה","add_members":"הוספת חברים וחברות","custom":"מותאם","bulk_complete":"המשתמשים התווספו לקבוצה.","bulk":"הוספ","bulk_paste":"הדביקו רשימה של שמות משתמש או כתובות אימייל, אחת בכל שורה:","bulk_select":"(בחר קבוצה)","automatic":"אוטומטי","automatic_membership_email_domains":"משתמשים אשר נרשמים עם מארח דוא\"ל שתואם בדיוק לאחד מהרשימה, יוספו באופן אוטומטי לקבוצה זו:","automatic_membership_retroactive":"החלת כלל מארח דוא\"ל זהה כדי להוסיף משתמשים רשומים","default_title":"ברירת המחדל לכל המשתמשים בקבוצה זו","primary_group":"קבע כקבוצה ראשית באופן אוטומטי","group_owners":"מנהלים","add_owners":"הוספת מנהלים","incoming_email":"התאימו אישית כתובת מייל נכנס","incoming_email_placeholder":"הכניסו כתובת מייל","flair_url_placeholder":"(אופציונלי) URL של תמונה","flair_bg_color_placeholder":"(אופציונלי) ערך צבע ב Hex","flair_preview":"תצוגה מקדימה"},"api":{"generate_master":"ייצר מפתח מאסטר ל-API","none":"אין מפתחות API פעילים כרגע.","user":"משתמש","title":"API","key":"מפתח API","generate":"ייצר","regenerate":"ייצר מחדש","revoke":"שלול","confirm_regen":"אתה בטוח שברצונך להחליף את מפתח ה-API באחד חדש?","confirm_revoke":"אתם בטוחים שברצונכם לשלול את המפתח הזה?","info_html":"מפתח הAPI שלך יאפשר לך ליצור ולעדכן פוסטים בעזרת קריאות JSON.","all_users":"כל המשתמשים","note_html":"שמרו על מפתח זה \u003cstrong\u003eסודי\u003c/strong\u003e, כל משתמש שיחזיק בו יוכל לייצר פרסומים שרירותית, כאילו היה כל משתמש/ת אחרים."},"plugins":{"title":"הרחבות (Plugins)","installed":"הרחבות מותקנות","name":"שם","none_installed":"אין לך הרחבות מותקנות","version":"גרסה","enabled":"מאופשר?","is_enabled":"Y","not_enabled":"N","change_settings":"שינוי הגדרות","change_settings_short":"הגדרות","howto":"איך אני מתקין/מתקינה הרחבות?"},"backups":{"title":"גיבויים","menu":{"backups":"גיבויים","logs":"לוגים"},"none":"אין גיבויים זמינים.","read_only":{"enable":{"title":"אפשרו מצב קריאה-בלבד","label":"אפשר קריאה-בלבד","confirm":"האם אתם בטוחים שאתם מעוניינים לאפשר מצב של קריאה-בלבד?"},"disable":{"title":"בטל מצב קריאה-בלבד","label":"בטל קריאה-בלבד"}},"logs":{"none":"עדיין אין לוגים..."},"columns":{"filename":"שם קובץ","size":"גודל"},"upload":{"label":"העלה","title":"טען גיבוי לinstance הזה","uploading":"מעלה...","success":"'{{filename}}' הועלה בהצלחה.","error":"הייתה שגיאה במהלך העלאת '{{filename}}': {{message}}"},"operations":{"is_running":"פעולה רצה כרגע...","failed":"ה{{operation}} נכשלה. אנא בדוק את הלוגים.","cancel":{"label":"ביטול","title":"בטל את הפעולה הנוכחית","confirm":"אתם בטוחים שברצונכם לבטל את הפעולה הנוכחית?"},"backup":{"label":"גבה","title":"צור גיבוי","confirm":"האם תרצו להתחיל גיבוי חדש?","without_uploads":"כן (ללא הכללת קבצים)"},"download":{"label":"הורד","title":"הורד את הגיבוי"},"destroy":{"title":"הסר את הגיבוי","confirm":"אתם בטוחים שברצונכם להשמיד את הגיבוי הזה?"},"restore":{"is_disabled":"שחזור אינו מאופשר לפי הגדרות האתר.","label":"שחזר","title":"שחזר את הגיבוי","confirm":"האם אתם בטוחים שאתם מעוניינים לשחזר את הגיבוי הזה?"},"rollback":{"label":"חזור לאחור","title":"הזחר את מסד הנתונים למצב עבודה קודם","confirm":"האם אתם בטוחים שאתם מעוניינים להשיב את בסיס הנתונים למצב קודם?"}}},"export_csv":{"user_archive_confirm":"האם אתם בטוחים שאתם רוצים להוריד את הפרסומים שלכם?","success":"יצוא החל, תקבלו הודעה כשהתהליך יסתיים","failed":"הייצוא נכשל. אנא בדקו ברישומי הלוג.","rate_limit_error":"ניתן להוריד פרסומים פעם ביום, אנא נסו שוב מחר.","button_text":"ייצוא","button_title":{"user":"יצוא רשימת המשתמשים המלאה בפורמט CSV.","staff_action":"יצוא רשימת פעולות הצוות בפורמט CSV.","screened_email":"יצוא רשימת דוא\"ל מלאה בפורמט CSV","screened_ip":"יצוא רשימת IP מלאה בפורמט CSV","screened_url":"יצוא רשימת URL מלאה בפורמט CSV"}},"export_json":{"button_text":"ייצוא"},"invite":{"button_text":"משלוח הזמנות","button_title":"משלוח הזמנות"},"customize":{"title":"התאמה אישית","long_title":"התאמה של האתר","css":"CSS","header":"כותרת","top":"למעלה","footer":"כותרת תחתית","embedded_css":"Embedded CSS","head_tag":{"text":"\u003c/head\u003e","title":"קוד HTML שיוכנס לפני התגית \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"קוד HTML שיוכנס לפני התגית \u003c/body\u003e"},"override_default":"אל תכלול את ה-Stylesheet הסטנדרטי","enabled":"מאופשר?","preview":"תצוגה מקדימה","undo_preview":"הסרת התצוגה המקדימה","rescue_preview":"ברירת מחדל סגנונית","explain_preview":"הצג את האתר על פי גיליון הסגנונות המותאם הזה","explain_undo_preview":"חזרה לגיליון הסגנונות המותאם המופעל כרגע","explain_rescue_preview":"צפיה באתר עם גליון הסגנונות העיצובי של ברירת המחדל","save":"שמור","new":"חדש","new_style":"סגנון חדש","import":"יבוא","import_title":"בחר קובץ או הדביקו טקסט","delete":"מחק","delete_confirm":"מחק את ההתאמה הזו?","about":"שינוי סגנונות CSS וכותרות HTML באתר. הוספת התאמות כדי להתחיל לערוך.","color":"צבע","opacity":"טשטוש","copy":"העתק","email_templates":{"title":"תבניות דואר אלקטרוני","subject":"נושא","multiple_subjects":"תבנית מייל זו מכילה מספר נושאים.","body":"הודעה","none_selected":"בחרו תבנית דואר אלקטרוני לעריכה.","revert":"ביטול שינויים","revert_confirm":"האם ברצונכם לבטל את השינויים?"},"css_html":{"title":"CSS/HTML","long_title":"התאמת CSS ו-HTML"},"colors":{"title":"צבעים","long_title":"סכמת צבעים","about":"סכמת צבעים מאפשרת לך לשנות את הצבעים שבשימוש האתר ללא כתיבת קוד CSS. בחרו או הוסיפו סכימה אחת כדי להתחיל.","new_name":"סכמת צבעים חדשה","copy_name_prefix":"העתק של","delete_confirm":"מחק את סכמת הצבעים הזאת?","undo":"ביטול (Unfo)","undo_title":"ביטול השינויים לצבע זה מאז הפעם שעברה שהוא נשמר.","revert":"לחזור","revert_title":"אתחול צבע זה לפי סכימת ברירת המחדל של Discourse.","primary":{"name":"ראשי","description":"רוב הטקסט, הייקונים והמסגרות."},"secondary":{"name":"משני","description":"צבע הרקע העיקי, וצבע הטקסט של חלק מהכפתורים."},"tertiary":{"name":"שלישוני","description":"קישורים, כפתורים, עדכונים וצבע מבטא."},"quaternary":{"name":"רבעוני","description":"קישורי ניווט."},"header_background":{"name":"רקע כותרת","description":"צבע הרקע של כותרת האתר."},"header_primary":{"name":"כותר עיקרי","description":"טקסט ואייקונים בכותרת האתר."},"highlight":{"name":"הדגשה","description":"צבע הרקע של אלמנטים מודגשים בעמוד, כמו הודעות ופוסטים."},"danger":{"name":"זהירות","description":"צבע הדגשה של פעולות כמו מחיקת הודעות ופוסטים."},"success":{"name":"הצלחה","description":"משמש כדי לסמן פעולה מוצלחת."},"love":{"name":"חבב","description":"צבע הרקע של הכפתור \"חבב\""}}},"email":{"title":"מיילים","settings":"הגדרות","templates":"תבניות","preview_digest":"תצוגה מקדימה של סיכום","sending_test":"שולח דואר אלקטרוני לבדיקה...","error":"\u003cb\u003eשגיאה\u003c/b\u003e - %{server_error}","test_error":"הייתה בעיה בשליחת הדואר האלקטרוני. בבקשה בדוק את ההגדרות שלך ונסה שנית.","sent":"נשלח","skipped":"דולג","bounced":"הוחזר","received":"התקבל","rejected":"נדחה","sent_at":"נשלח ב","time":"זמן","user":"משתמש","email_type":"סוג דואר אלקטרוני","to_address":"לכתובת","test_email_address":"כתובת דואר אלקטרוני לבדיקה","send_test":"שליחת מייל בדיקה","sent_test":"נשלח!","delivery_method":"שיטת העברה","preview_digest_desc":"תצוגה מקדימה של מייל סיכום שנשלח למשתמשים לא פעילים. ","refresh":"רענן","format":"פורמט","html":"html","text":"טקסט","last_seen_user":"משתמש שנראה לאחרונה:","reply_key":"מפתח תגובה","skipped_reason":"דלג על סיבה","incoming_emails":{"from_address":"מאת","to_addresses":"אל","cc_addresses":"העתק","subject":"נושא","error":"שגיאה","none":"לא נמצאו מיילים נכנסים.","modal":{"title":"פרטי מייל שנכנס","error":"שגיאה","headers":"כותרות","subject":"נושא","body":"גוף","rejection_message":"מייל דחייה"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"נושא...","error_placeholder":"שגיאה"}},"logs":{"none":"לא נמצאו לוגים.","filters":{"title":"סינון","user_placeholder":"username","address_placeholder":"name@example.com","type_placeholder":"digest, signup...","reply_key_placeholder":"מפתח תגובה","skipped_reason_placeholder":"סיבה"}}},"logs":{"title":"לוגים","action":"פעולה","created_at":"נוצר","last_match_at":"הותאם לאחרונה","match_count":"תואם","ip_address":"IP","topic_id":"זהות (ID) פוסט","post_id":"זהות (ID) פרסום","category_id":"מזהה קטגוריה","delete":"מחק","edit":"ערוך","save":"שמור","screened_actions":{"block":"חסום","do_nothing":"עשה כלום"},"staff_actions":{"title":"פעולות צוות","instructions":"הקליקו על שמות משתמשים ופעולות כדי לסנן את הרשימה. הקליקו על תמונות פרופיל כדי ללכת לעמודי המשתמשים.","clear_filters":"הראה הכל","staff_user":"משתמש חבר צוות","target_user":"משתמש מטרה","subject":"נושא","when":"מתי","context":"הקשר","details":"פרטים","previous_value":"הקודם","new_value":"חדש","diff":"הפרש","show":"הראה","modal_title":"פרטים","no_previous":"אין ערך קודם.","deleted":"אין ערך חדש. הרשומה נמחקה.","actions":{"delete_user":"מחק משתמש","change_trust_level":"שנה רמת אמון","change_username":"שינוי שם משתמש/ת","change_site_setting":"שנה הגדרות אתר","change_site_customization":"שנה התאמת אתר","delete_site_customization":"מחק התאמת אתר","change_site_text":"שינוי טקסט אתר","suspend_user":"השעה משתמש","unsuspend_user":"בטל השהיית משתמש","grant_badge":"העניקו עיטור","revoke_badge":"שללו עיטור","check_email":"בדיקת דוא\"ל","delete_topic":"מחיקת פוסט","delete_post":"מחיקת פרסום","impersonate":"התחזה","anonymize_user":"הפיכת משתמש/ת לאנונימיים","roll_up":"roll up IP blocks","change_category_settings":"שינוי הגדרות קטגוריה","delete_category":"מחק קטגוריה","create_category":"יצירת קטגוריה","block_user":"חסום משתמש","unblock_user":"בטל חסימת משתמש","grant_admin":"הענק ניהול","revoke_admin":"שללו אדמיניסטרציה","grant_moderation":"העניקו הנחיה","revoke_moderation":"שללו הנחיה","backup_operation":"פעולת גיבוי","deleted_tag":"תגית נמחקה","renamed_tag":"תגית שונתה","revoke_email":"שללו מייל"}},"screened_emails":{"title":"הודעות דואר מסוננות","description":"כשמישהו מנסה ליצור חשבון חדש, כתובות הדואר האלקטרוני הבאות ייבדקו וההרשמה תחסם או שיבוצו פעולות אחרות.","email":"כתובת דואר אלקטרוני","actions":{"allow":"לאפשר"}},"screened_urls":{"title":"כתובות מסוננות","description":"הכתובות הרשומות כאן היו בשימוש בהודעות  מאת משתמשים שזוהו כספאמרים.","url":"כתובת","domain":"שם מתחם"},"screened_ips":{"title":"כתובות IP מסוננות","description":"כתובות IP שנצפות כרגע. השתמש בכפתור \"אפשר\" בשביל לבטל חסימת כתובת","delete_confirm":"אתה בטוח שברצונך להסיר את הכלל עבור הכתובת %{ip_address}?","roll_up_confirm":"Are you sure you want to roll up commonly screened IP addresses into subnets?","rolled_up_some_subnets":"ערכי IP אסורים גולגלו בהצלחה לרשתות המשנה הבאות: %{subnets}.","rolled_up_no_subnet":"לא היה שום דבר לגלגל","actions":{"block":"חסום","do_nothing":"אפשר","allow_admin":"אפשרו אדמין."},"form":{"label":"חדש:","ip_address":"כתובת IP","add":"הוסף","filter":"חיפוש"},"roll_up":{"text":"גלגול (Roll up)","title":"יוצר ערכי איסור משנה חדשים, אם יש לפחות 'min_ban_entries_for_roll_up' ערכים."}},"logster":{"title":"רישום תקלות"}},"impersonate":{"title":"התחזות","help":"השתמשו בכלי כזה כדי להתחזות לחשבון משתמש לצרכי דיבוג. עליכם להתנתק ברגע שתסיימו.","not_found":"לא ניתן למצוא את המשתמש הזה.","invalid":"סליחה, אך אינך מורשה להתחזות למשתמש הזה."},"users":{"title":"משתמשים","create":"הוסף מנהל","last_emailed":"נשלח בדואר אלקטרוני לאחרונה","not_found":"סליחה, שם המשתמש הזה אינו קיים במערכת שלנו.","id_not_found":"מצטערים, זהות המשתמש/ת אינה קיימת במערכת שלנו.","active":"פעיל","show_emails":"הצגת דוא\"לים","nav":{"new":"חדש","active":"פעיל","pending":"ממתין","staff":"צוות","suspended":"מושעים","blocked":"חסום","suspect":"חשודים"},"approved":"מאושר?","approved_selected":{"one":"אשר משתמש","other":"אשרו משתמשים ({{count}})"},"reject_selected":{"one":"דחו משתמש","other":"דחו משתמשים ({{count}})"},"titles":{"active":"הפעל משתמשים","new":"משתמשים חדשים","pending":"משתמשים שממתינים לבדיקה","newuser":"משתמשים ברמת אמון 0 (משתמש חדש)","basic":"משתמשים ברמת אמון 1 (משתמש בסיסי)","member":"משתמשים בדרגת אמון 2 (חברים)","regular":"משתמשים בדרגת אמון 3 (רגילים)","leader":"משתמשים בדרגת אמון 4 (מובילים)","staff":"צוות","admins":"מנהלים ראשיים","moderators":"מנהלים","blocked":"משתמשים חסומים","suspended":"משתמשים מושעים","suspect":"משתמשים חשודים"},"reject_successful":{"one":"משתמש אחד נדחה בהצלחה.","other":"%{count} משתמשים נדחו בהצלחה."},"reject_failures":{"one":"דחיית משתמש נכשלה.","other":"דחיית %{count} משתמשים נכשלה."},"not_verified":"לא מאומת","check_email":{"title":"חשיפת כתובת הדוא\"ל של המשתמש/ת","text":"הצגה"}},"user":{"suspend_failed":"משהו נכשל בהשעיית המשתמש הזה {{error}}","unsuspend_failed":"משהו נכשל בביטול השהיית המשתמש הזה {{error}}","suspend_duration":"למשך כמה זמן יהיה המשתמש מושעה?","suspend_duration_units":"(ימים)","suspend_reason_label":"מדוע אתה משעה? הטקסט הזה \u003cb\u003eיהיה נראה לכולם\u003c/b\u003e בעמוד המשתמש הזה, ויוצג למשתמש כשינסה להתחבר. נסה לשמור עליו קצר.","suspend_reason":"סיבה","suspended_by":"הושעה על ידי","delete_all_posts":"מחק את כל ההודעות","suspend":"השעה","unsuspend":"בטל השעייה","suspended":"מושעה?","moderator":"מנהל?","admin":"מנהל ראשי?","blocked":"חסום?","show_admin_profile":"מנהל ראשי","edit_title":"ערוך כותרת","save_title":"שמור כותרת","refresh_browsers":"הכרח רענון דפדפן","refresh_browsers_message":"ההודעה נשלחה לכל הלקוחות!","show_public_profile":"הצג פרופיל פומבי","impersonate":"התחזה","ip_lookup":"חיפוש IP","log_out":"התנתקות","logged_out":"המשתמש/ת התנתקו בכל המכשירים","revoke_admin":"שלול ניהול ראשי","grant_admin":"הענק ניהול ראשי","revoke_moderation":"שללו הנחיה","grant_moderation":"העניקו הנחיה","unblock":"בטל חסימה","block":"חסום","reputation":"מוניטין","permissions":"הרשאות","activity":"פעילות","like_count":"לייקים שהוענקו / התקבלו","last_100_days":"ב-100 הימים האחרונים","private_topics_count":"פוסטים פרטיים","posts_read_count":"הודעות שנקראו","post_count":"הודעות שנוצרו","topics_entered":"פוסטים שנצפו","flags_given_count":"דגלים שניתנו","flags_received_count":"דגלים שהתקבלו","warnings_received_count":"התקבלו אזהרות","flags_given_received_count":"דגלים שניתנו / התקבלו","approve":"אשר","approved_by":"אושר על ידי","approve_success":"משתמש אושר ונשלחה לו הודעות דואר אלקטרוני עם הוראות הפעלה","approve_bulk_success":"הצלחה! כל המשתמשים שנבחרו אושרו ויודעו על כך.","time_read":"זמן קריאה","anonymize":"הפיכת משתמש/ת לאנונימיים","anonymize_confirm":"האם אתם ב-ט-ו-ח-י-ם שאתם רוצים להפוך חשבון זה לאנונימי? פעולה זו תשנה את שם המשתמש וכתובת הדוא\"ל ותאתחל את כל המידע בפרופיל.","anonymize_yes":"כן, הפיכת חשבון זה לאנונימי","anonymize_failed":"התרחשה בעיה בהפיכת חשבון זה לאנונימי.","delete":"מחק משתמש","delete_forbidden_because_staff":"לא ניתן למחוק מנהלים ראשיים ומנהלים.","delete_posts_forbidden_because_staff":"לא ניתן למחוק את כל הפרסומים של מנהלי מערכת ומפקחים.","delete_forbidden":{"one":"לא ניתן למחוק משתמשים אם יש להם הודעות. מחקו את כל ההודעות לפני ניסיון מחיקה של משתמש. (הודעות ישנות יותר מיום אחד לא ניתן למחוק.)","other":"לא ניתן למחוק משתמשים אם יש להם הודעות. מחקו את כל ההודעות לפני ניסיון מחיקה של משתמש. (הודעות ישנות יותר מ-%{count} ימים לא ניתן למחוק.)"},"cant_delete_all_posts":{"one":"לא ניתן למחוק את כל ההודעות. חלק מההודעות ישנות יותר מ-%{count} ימים. (הגדרת delete_user_max_post_age.)","other":"לא ניתן למחוק את כל ההודעות. חלק מההודעות ישנות יותר מ-%{count} ימים. (הגדרת delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"לא ניתן למחוק את כל ההודעות מפני שלמשתמש/ת יותר מהודעה אחת. (delete_all_posts_max)","other":"לא ניתן למחוק את כל ההודעות בגלל שלמשתמשים יותר מ-{count}% הודעות. (delete_all_posts_max)"},"delete_confirm":"האם אתם ב-ט-ו-ח-י-ם שאתם רוצים למחוק משתמש זה? פעולה זו קבועה ובלתי הפיכה!","delete_and_block":"מחיקה ו\u003cb\u003eחסימת\u003c/b\u003e כתובת דוא\"ל וכתובת IP אלה","delete_dont_block":"מחיקה בלבד","deleted":"המשתמש נמחק.","delete_failed":"הייתה שגיאה במחיקת המשתמש. יש לוודא שכל ההודעות נמחקו לפני ניסיון למחוק את המשתמש.","send_activation_email":"שלח הודעת הפעלת חשבון","activation_email_sent":"נשלחה הודעת הפעלת חשבון","send_activation_email_failed":"הייתה בעיה בשליחת הודעת האישור. %{error}","activate":"הפעלת חשבון","activate_failed":"הייתה בעיה בהפעלת המשתמש.","deactivate_account":"נטרל חשבון","deactivate_failed":"הייתה בעיה בנטרול חשבון המשתמש.","unblock_failed":"הייתה בעיה בביטול חסימת המשתמש.","block_failed":"הייתה בעיה בחסימת המשתמש.","block_confirm":"האם אתם בטוחים שאתם מעוניינים לחסום משתמש זה? הם לא יוכלו ליצור נושאים או פוסטים נוספים.","block_accept":"כן, חסום משתמש זה","bounce_score":"ניקוד-החזר","reset_bounce_score":{"label":"איפוס","title":"איפוס ניקוד-החזר"},"deactivate_explanation":"חשבון משתמש מנוטרל נדרש לוודא דואר אלקטרוני מחדש.","suspended_explanation":"משתמש מושעה לא יכול להתחבר.","block_explanation":"משתמש חסום לא יכול לפרסם הודעות או פוסטים.","bounce_score_explanation":{"none":"לא התקבלו החזרים לאחרונה מהמייל הזה.","some":"כמה החזרים התרחשו לאחרונה מהמייל הזה.","threshold_reached":"התקבלו יותר מידי החזרים מהמייל הזה."},"trust_level_change_failed":"הייתה בעיה בשינוי רמת האמון של המשתמש.","suspend_modal_title":"השעה משתמש","trust_level_2_users":"משתמשי רמת אמון 2","trust_level_3_requirements":"דרישות רמת אמון 3","trust_level_locked_tip":"רמות האמון נעולה, המערכת לא תקדם או או תנמיך משתמשים","trust_level_unlocked_tip":"רמת האמון אינן נעולות, המערכת תקדם ותנמיך דרגות של משתמשים","lock_trust_level":"נעילת רמת אמון","unlock_trust_level":"שחרור רמת אמון מנעילה","tl3_requirements":{"title":"דרישות עבור רמת אמון 3","table_title":{"one":"ביום האחרון:","other":"ב %{count} הימים האחרונים:"},"value_heading":"ערך","requirement_heading":"דרישה","visits":"ביקורים","days":"ימים","topics_replied_to":"פוסטים להם הגיבו","topics_viewed":"פוסטים שנצפו","topics_viewed_all_time":"פוסטים שנצפו (בכל זמן)","posts_read":"פרסומים שנקראו","posts_read_all_time":"פרסומים שנקראו (בכל זמן)","flagged_posts":"הודעות מדוגלות","flagged_by_users":"משתמשים שדיגלו","likes_given":"לייקים שהוענקו","likes_received":"לייקים שהתקבלו","likes_received_days":"לייקים שהתקבלו: לפי ימים ","likes_received_users":"לייקים שהתקבלו: לפי משתמשים","qualifies":"דרישות עבור רמת אמון 3","does_not_qualify":"אין עומד בדרישות עבור רמת אמון 3.","will_be_promoted":"יקודם בקרוב.","will_be_demoted":"הורדה קרובה בדרגה.","on_grace_period":"כרגע בתקופת חחסד של העלאה בדרכה, לא תתבצע הורדה בטבלה.","locked_will_not_be_promoted":"רמת האמון נעולה. לא תתבצע העלאה בדרגה.","locked_will_not_be_demoted":"רמת האמןו נעולה. לא תתבצע הורדה בדרגה."},"sso":{"title":"התחברות חד פעמית","external_id":"ID חיצוני","external_username":"שם משתמש","external_name":"שם","external_email":"כתובת דוא\"ל","external_avatar_url":"כתובת URL לתמונת הפרופיל"}},"user_fields":{"title":"שדות משתמש","help":"הוסיפו שדות שהמשתמשים שלכם יכולים למלא.","create":"יצירת שדה משתמש","untitled":"ללא שם","name":"שם שדה","type":"סוג השדה","description":"תיאור השדה","save":"שמירה","edit":"עריכה","delete":"מחיקה","cancel":"ביטול","delete_confirm":"האם אתם בטוחים שאתם רוצים למחוק את שדה המשתמש הזה?","options":"אפשרויות","required":{"title":"נדרש בעת הרשמה?","enabled":"נדרש","disabled":"לא נדרש"},"editable":{"title":"ניתן לערוך לאחר הרשמה?","enabled":"ניתן לערוך","disabled":"לא ניתן לערוך"},"show_on_profile":{"title":"להצגה בפרופיל הפומבי?","enabled":"הצגה בפרופיל","disabled":"לא מוצג בפרופיל"},"show_on_user_card":{"title":"הצגה על כרטיס משתמש?","enabled":"מוצג על כרטיס משתמש","disabled":"לא מוצג על כרטיס משתמש"},"field_types":{"text":"שדה טקסט","confirm":"אישור","dropdown":"נגלל"}},"site_text":{"description":"אתם יכולים להתאים כל טקסט בפורום שלכם. בבקשה התחילו בחיפוש אחרי:","search":"חפשו טקסט שברצונכם לערוך","title":"תוכן טקסטואלי","edit":"ערוך","revert":"בטל שינויים","revert_confirm":"האם אתם בטוחים שאתם מעוניינים לבטל את השינויים שלכם?","go_back":"חזרה לחיפוש","recommended":"אנחנו ממליצים להתאים את הטקסט הבא כדי להתאימו לצרכים שלכם:","show_overriden":"הציגו רק דרוסים"},"site_settings":{"show_overriden":"הצג רק הגדרות ששונו","title":"הגדרות","reset":"אתחול","none":"ללא","no_results":"לא נמצאו תוצאות.","clear_filter":"נקה","add_url":"הוספת כתובת URL","add_host":"הוסיפו מארח","categories":{"all_results":"הכל","required":"נדרש","basic":"התקנה בסיסית","users":"משתמשים","posting":"פרסומים","email":"דואר אלקטרוני","files":"קבצים","trust":"רמת אמון","security":"אבטחה","onebox":"Onebox","seo":"SEO","spam":"ספאם","rate_limits":"מגבלות קצב","developer":"מפתח","embedding":"הטמעה","legal":"משפטי","user_api":"API של משתמש","uncategorized":"אחר","backups":"גיבויים","login":"התחברות","plugins":"הרחבות","user_preferences":"הגדרות משתמש","tags":"תגיות","search":"חיפוש"}},"badges":{"title":"עיטורים","new_badge":"עיטור חדש","new":"חדש","name":"שם","badge":"עיטור","display_name":"שם תצוגה","description":"תיאור","long_description":"תאור ארוך","badge_type":"סוג עיטור","badge_grouping":"קבוצה","badge_groupings":{"modal_title":"קבוצות עיטורים"},"granted_by":"הוענק ע\"י","granted_at":"הוענק ב","reason_help":"(קישור לפרסום או לפוסט)","save":"שמור","delete":"מחק","delete_confirm":"אתם בטוחים שברצונכם למחוק את העיטור הזה?","revoke":"שלול","reason":"סיבה","expand":"הרחבה \u0026hellip;","revoke_confirm":"אתם בטוחים שברצונכם לשלול את העיטור הזה?","edit_badges":"עירכו עיטורים","grant_badge":"העניקו עיטור","granted_badges":"עיטורים שהוענקו","grant":"הענק","no_user_badges":"ל%{name} לא הוענקו תגים.","no_badges":"אין עיטורים שניתן להעניק.","none_selected":"בחרו תג כדי להתחיל","allow_title":"אפשר לתג להיות בשימוש ככותרת.","multiple_grant":"יכולים להינתן מספר פעמים","listable":"הצגת תגים בעמוד התגים הפומבי","enabled":"אפשרו עיטור","icon":"סמליל","image":"תמונה","icon_help":"השתמשו ב-class בשם Font Awesome או ב-URL לתמונה","query":"שאילתת עיטור (SQL)","target_posts":"פרסומי מטרות שאילתה","auto_revoke":"הפעלת שאילתת ביטול יומית","show_posts":"הצגת הפוסט על הענקת התגים בעמוד התגים","trigger":"הפעלה","trigger_type":{"none":"רענון יומי","post_action":"כשמשתמש משנה פוסט","post_revision":"כשמשתש משנה או יוצר פוסט","trust_level_change":"כשמשתמש משנה רמת אמון","user_change":"כשמשתמש נערך או נוצר","post_processed":"לאחר שפוסט מעובד"},"preview":{"link_text":"הצגה מקדימה של עיטורים שהוענקו","plan_text":"הצגה מקדימה עם query plan","modal_title":"הצגה מקדימה של שאילתת תגים (Badge Query Preview)","sql_error_header":"התרחשה תקלה עם השאילתה","error_help":"ראו את הקישורים הבאים לעזרה עם שאילתת תגים.","bad_count_warning":{"header":"זהירות!","text":"ישנן דוגמאות הענקה חסרות. זה קורה כחיפוש תגים מחזיר זהות (ID) של משתמש או פרסום שאינם קיימים. זה עלול לגרום לתוצאות לא צפויות מאוחר יותר - אנא בדקו שוב את מחרוזת החיפוש שלכם."},"no_grant_count":"אין עיטורים להקצאה.","grant_count":{"one":"עיטור אחד להקצאה.","other":"\u003cb\u003e%{count}\u003c/b\u003e עיטורים להקצאה."},"sample":"דוגמא:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e לפרסום ב %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e לפרסום ב %{link} ב \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e ב \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"אמוג'י","help":"הוספת אמוג'י חדש אשר יהיה זמין לכולם. (טיפ של מקצוענים: גררו והנחיו כמה קבצים בבת אחת)","add":"הוספת אמוג'י חדש","name":"שם","image":"תמונה","delete_confirm":"האם אתם בטוחים שאתם רוצים למחוק את האמוג'י :%{name}:?"},"embedding":{"get_started":"אם ברצונך לשלב את דיסקורס באתר אחר, התחל בהוספת המערך שלו (host). ","confirm_delete":"האם אתם בטוחים שאתם רוצים למחוק את הhost הזה? ","sample":"השתמש בקוד HTML הבא באתר שלך על מנת ליצור נושאי דיסקורס משולבים. החלף \u003cb\u003eREPLACE_ME\u003c/b\u003e בURL הקאנוני של העמוד שבו אתה מכניס נושא מכונן. ","title":"שילוב (embedding)","host":"מארחים הורשו","edit":"ערוך","category":"פרסם לקטגוריה","add_host":"הוסיפו מארח","settings":"הגדרות הטמעה","feed_settings":"הגדרות פיד","feed_description":"לספק פיד RSS/ATOM לאתרך יכול לשפר את היכולת של דיסקורס ליבא את התוכן שלך.","crawling_settings":"Crawler Settings","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"שם משתמש ליצירת פוסט","embed_post_limit":"מספר מקסימלי של פרסומים להטמעה.","embed_username_key_from_feed":"מפתח למשיכת שם המשתמש ב-discourse מהפיד.","embed_title_scrubber":"ביטוי רגולרי שמשמש כדי לנקות את הכותרת של פוסטים","embed_truncate":"חיתוך הפרסומים המוטמעים.","embed_whitelist_selector":"בוררי CSS לאלמנטים שיותר להטמיע.","embed_blacklist_selector":"בוררי CSS לאלמנטים שיוסרו מן ההטמעות.","embed_classname_whitelist":"שמות מחלקות CSS מאושרות","feed_polling_enabled":"יבוא פרסומים דרך RSS/ATOM","feed_polling_url":"URL of RSS/ATOM feed to crawl","save":"שמור הגדרות הטמעה"},"permalink":{"title":"קישורים קבועים","url":"כתובת","topic_id":"מזהה לפוסט","topic_title":"פוסט","post_id":"מזהה לפרסום","post_title":"הודעה","category_id":"מזהה לקטגוריה","category_title":"קטגוריה","external_url":"ID חיצוני","delete_confirm":"אתה בטוח שברצונך למחוק את הלינק הקבוע?","form":{"label":"חדש:","add":"הוסף","filter":"חפש (כתובת או כתובת חיצונית)"}}}}},"en":{"js":{"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""}},"composer":{"toggle_unlisted":"Toggle Unlisted","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?"},"keyboard_shortcuts_help":{"actions":{"bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic"}},"badges":{"badge_grouping":{"posting":{"name":"Posting"}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_bg_color":"Avatar Flair Background Color"},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","staged_explanation":"A staged user can only post via email in specific topics."},"embedding":{"path_whitelist":"Path Whitelist"}}}}};
I18n.locale = 'he';
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
//! locale : Hebrew (he)
//! author : Tomer Cohen : https://github.com/tomer
//! author : Moshe Simantov : https://github.com/DevelopmentIL
//! author : Tal Ater : https://github.com/TalAter

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var he = moment.defineLocale('he', {
        months : 'ינואר_פברואר_מרץ_אפריל_מאי_יוני_יולי_אוגוסט_ספטמבר_אוקטובר_נובמבר_דצמבר'.split('_'),
        monthsShort : 'ינו׳_פבר׳_מרץ_אפר׳_מאי_יוני_יולי_אוג׳_ספט׳_אוק׳_נוב׳_דצמ׳'.split('_'),
        weekdays : 'ראשון_שני_שלישי_רביעי_חמישי_שישי_שבת'.split('_'),
        weekdaysShort : 'א׳_ב׳_ג׳_ד׳_ה׳_ו׳_ש׳'.split('_'),
        weekdaysMin : 'א_ב_ג_ד_ה_ו_ש'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D [ב]MMMM YYYY',
            LLL : 'D [ב]MMMM YYYY HH:mm',
            LLLL : 'dddd, D [ב]MMMM YYYY HH:mm',
            l : 'D/M/YYYY',
            ll : 'D MMM YYYY',
            lll : 'D MMM YYYY HH:mm',
            llll : 'ddd, D MMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[היום ב־]LT',
            nextDay : '[מחר ב־]LT',
            nextWeek : 'dddd [בשעה] LT',
            lastDay : '[אתמול ב־]LT',
            lastWeek : '[ביום] dddd [האחרון בשעה] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'בעוד %s',
            past : 'לפני %s',
            s : 'מספר שניות',
            m : 'דקה',
            mm : '%d דקות',
            h : 'שעה',
            hh : function (number) {
                if (number === 2) {
                    return 'שעתיים';
                }
                return number + ' שעות';
            },
            d : 'יום',
            dd : function (number) {
                if (number === 2) {
                    return 'יומיים';
                }
                return number + ' ימים';
            },
            M : 'חודש',
            MM : function (number) {
                if (number === 2) {
                    return 'חודשיים';
                }
                return number + ' חודשים';
            },
            y : 'שנה',
            yy : function (number) {
                if (number === 2) {
                    return 'שנתיים';
                } else if (number % 10 === 0 && number !== 10) {
                    return number + ' שנה';
                }
                return number + ' שנים';
            }
        },
        meridiemParse: /אחה"צ|לפנה"צ|אחרי הצהריים|לפני הצהריים|לפנות בוקר|בבוקר|בערב/i,
        isPM : function (input) {
            return /^(אחה"צ|אחרי הצהריים|בערב)$/.test(input);
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 5) {
                return 'לפנות בוקר';
            } else if (hour < 10) {
                return 'בבוקר';
            } else if (hour < 12) {
                return isLower ? 'לפנה"צ' : 'לפני הצהריים';
            } else if (hour < 18) {
                return isLower ? 'אחה"צ' : 'אחרי הצהריים';
            } else {
                return 'בערב';
            }
        }
    });

    return he;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
