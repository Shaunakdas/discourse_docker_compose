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
r += "Teil on ";
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
r += "is <a href='/unread'>1 lugemata</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " lugemata </a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["et"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1 uus</a> teema";
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
})() + " uut</a> teemat";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["et"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " jäänud, või ";
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
r += "\nby priit.varik, a month ago";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Selles teemas on ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 vastus";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " vastust";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["et"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "kõrge meeldimiste / postituste suhtega";
return r;
},
"med" : function(d){
var r = "";
r += "väga kõrge meeldimiste / postituste suhtega";
return r;
},
"high" : function(d){
var r = "";
r += "eriti kõrge meeldimiste / postituste suhtega";
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

MessageFormat.locale.et = function ( n ) {
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
I18n.translations = {"et":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Bait","other":"Baiti"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"hh:mm","timeline_date":"MMM YYYY","long_no_year":"D. MMMM hh:mm","long_no_year_no_time":"D. MMMM","full_no_year_no_time":"Do MMMM","long_with_year":"D. MMMM, YYYY hh:mm","long_with_year_no_time":"D. MMMM, YYYY","full_with_year_no_time":"Do MMMM, YYYY","long_date_with_year":"D. MMMM, 'YY LT","long_date_without_year":"D. MMMM, LT","long_date_with_year_without_time":"D. MMMM, 'YY","long_date_without_year_with_linebreak":"D. MMMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D. MMMM, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} tagasi","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1p","other":"%{count}p"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"D. MMMM","date_year":"MMMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} min"},"x_hours":{"one":"1 tund","other":"%{count} tundi"},"x_days":{"one":"1 päev","other":"%{count} päeva"},"date_year":"D. MMMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 min tagasi","other":"%{count} min tagasi"},"x_hours":{"one":"1 tund tagasi","other":"%{count} tundi tagasi"},"x_days":{"one":"1 päev tagasi","other":"%{count} päeva tagasi"}},"later":{"x_days":{"one":"1 päev hiljem","other":"%{count} päeva hiljem"},"x_months":{"one":"1 kuu hiljem","other":"%{count} kuud hiljem"},"x_years":{"one":"1 aasta hiljem","other":"%{count} aastat hiljem"}},"previous_month":"Eelmine Kuu","next_month":"Järgmine Kuu"},"share":{"topic":"jaga teema viidet","post":"post nr%{postNumber}","close":"Sulge","twitter":"Jaga seda viidet Twitteris","facebook":"jaga seda viidet Facebookis","google+":"jaga seda viidet Google-plussis","email":"Jaga viidet meiliga"},"action_codes":{"public_topic":"muutsin selle teema avalikuks %{when}","private_topic":"muutsin selle teema privaatseks %{when}","split_topic":"poolita teema %{when} juurest","invited_user":"kutsutud %{who} %{when}","invited_group":"kutsusin %{who} %{when}","removed_user":"kõrvaldatud %{who} %{when}","removed_group":"kõrvaldasin %{who} %{when}","autoclosed":{"enabled":"suletud %{when}","disabled":"avatud %{when}"},"closed":{"enabled":"suletud %{when}","disabled":"avatud %{when}"},"archived":{"enabled":"arhiveeritud %{when}","disabled":"lahti pakitud %{when}"},"pinned":{"enabled":"esiletõstetud %{when}","disabled":"esiletõstmine eemaldatud %{when}"},"pinned_globally":{"enabled":"esiletõstetud igal pool %{when}","disabled":"esiletõstmine eemaldatud %{when}"},"visible":{"enabled":"lisatud %{when}","disabled":"eemaldatud %{when}"}},"topic_admin_menu":"teema admintegevused","emails_are_disabled":"Kõik väljuvad meilid on administraatori poolt blokeeritud. Ühtegi teavitust meili teel ei saadeta.","bootstrap_mode_enabled":"Oma uue saidi lansseerimise hõlbustamiseks oled käivitusrežiimil. Kõik uued kasutajad saavad usaldustaseme 1 ja nende igapäevased kokkuvõtvad teavitused meili teel on aktiveeritud. See lülitub automaatselt välja kui kasutajate koguarv ületab %{min_users} piiri.","bootstrap_mode_disabled":"Käivitusrežiim lülitub välja järgmise 24 tunni jooksul.","s3":{"regions":{"us_east_1":"US Ida (N. Virginia)","us_west_1":"US Lääs (N. California)","us_west_2":"US Lääs (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EL (Iirimaa)","eu_central_1":"EL (Frankfurt)","ap_southeast_1":"Aasia ja Vaikne ookean (Singapur)","ap_southeast_2":"Aasia ja Vaikne ookean (Sydney)","ap_south_1":"Aasia ja Vaikse Ookeani (Mumbai)","ap_northeast_1":"Aasia ja Vaikne ookean (Tokyo)","ap_northeast_2":"Aasia ja Vaikne ookean (Seoul)","sa_east_1":"Lõuna-Ameerika (Sao Paulo)","cn_north_1":"Hiina (Beijing)"}},"edit":"muuda teema pealkirja ja liiki","not_implemented":"Seda omadust pole veel rakendatud, vabandame!","no_value":"Ei","yes_value":"Jah","generic_error":"Vabandust, tekkis viga.","generic_error_with_reason":"Tekkis viga: %{error}","sign_up":"Liitu","log_in":"Logi sisse","age":"Vanus","joined":"Liitus","admin_title":"Admin","flags_title":"Tähised","show_more":"kuva veel","show_help":"võimalused","links":"Viited","links_lowercase":{"one":"viide","other":"viited"},"faq":"KKK","guidelines":"Juhised","privacy_policy":"Privaatsuspoliitika","privacy":"Privaatsus","terms_of_service":"Teenuse tingimused","mobile_view":"Mobiilne vaade","desktop_view":"Täisvaade","you":"Sina","or":"või","now":"just nüüd","read_more":"loe edasi","more":"Veel","less":"Peida","never":"mitte kunagi","every_30_minutes":"iga 30 minuti järel","every_hour":"iga tund","daily":"iga päev","weekly":"iga nädal","every_two_weeks":"iga kahe nädala tagant","every_three_days":"iga kolme päeva tagant","max_of_count":"maksimum {{count}}-st","alternation":"või","character_count":{"one":"{{count}} sümbol","other":"{{count}} sümbolit"},"suggested_topics":{"title":"Soovitatud teemad","pm_title":"Soovitatud sõnumid"},"about":{"simple_title":"Teave","title":"Teave %{title} kohta","stats":"Statistika","our_admins":"Meie adminid","our_moderators":"Meie moderaatorid","stat":{"all_time":"Alates algusest","last_7_days":"Viimased 7 päeva","last_30_days":"Viimased 30 päeva"},"like_count":"Meeldimisi","topic_count":"Teemad","post_count":"Postitused","user_count":"Uued kasutajad","active_user_count":"Aktiivsed kasutajad","contact":"Võta meiega ühendust","contact_info":"Kriitilise vea või edasilükkamatu probleemi korral võta palun meiega ühendust aadressil %{contact_info}."},"bookmarked":{"title":"Järjehoidja","clear_bookmarks":"Kustuta järjehoidjad","help":{"bookmark":"Kliki selle teema esimesele postitusele järjehoidja lisamiseks","unbookmark":"Kliki selle teema kõigi järjehoidjate eemaldamiseks"}},"bookmarks":{"not_logged_in":"vabandust, postitusele järjehoidjate lisamiseks pead olema sisse logitud","created":"lisasid sellele postitusele järjehoidja","not_bookmarked":"oled seda postitust lugenud; kliki järjehoidja lisamiseks","last_read":"see on viimane Sinu loetud postitus; kliki järjehoidja lisamiseks","remove":"Eemalda järjehoidja","confirm_clear":"Oled kindel, et soovid selle teema kõik järjehoidjad eemaldada?"},"topic_count_latest":{"one":"{{count}} uus või täiendatud teema.","other":"{{count}} uut või täiendatud teemat."},"topic_count_unread":{"one":"{{count}} lugemata teema.","other":"{{count}} lugemata teemat."},"topic_count_new":{"one":"{{count}} uus teema.","other":"{{count}} uut teemat."},"click_to_show":"Kliki kuvamiseks.","preview":"eelvaade","cancel":"tühista","save":"Salvesta muudatused","saving":"Salvestan...","saved":"Salvestatud!","upload":"Lae üles","uploading":"Laen üles...","uploading_filename":"Laen üles {{filename}}...","uploaded":"Üles laetud!","enable":"Võimalda","disable":"Tõkesta","undo":"Ennista","revert":"Võta tagasi","failed":"Ebaõnnestus","switch_to_anon":"Sisene anonüümsesse režiimi","switch_from_anon":"Välju anonüümsest režiimist","banner":{"close":"Sulge see bänner.","edit":"Muuda seda bännerit \u003e\u003e"},"choose_topic":{"none_found":"Teemasid ei leitud.","title":{"search":"Otsi teemasid nime, url või id järgi:","placeholder":"kirjuta teema pealkiri siia"}},"queue":{"topic":"Teema:","approve":"Kinnita","reject":"Lükka tagasi","delete_user":"Kustuta kasutaja","title":"Vajab kinnitust","none":"Ülevaatamist vajavaid postitusi ei ole.","edit":"Muuda","cancel":"Tühista","view_pending":"vaata kinnitamata postitusi","has_pending_posts":{"one":"\u003cb\u003e1\u003c/b\u003e postitus selles teemas ootab kinnitamist","other":"\u003cb\u003e{{count}}\u003c/b\u003e postitust selles teemas ootavad kinnitamist"},"confirm":"Salvesta muudatused","delete_prompt":"Oled kindel, et soovid \u003cb\u003e%{username}\u003c/b\u003e kustutada? Sellega kaasneb tema kõigi postituste kustutamine ja meili- ning IP-aadresside blokeerimine.","approval":{"title":"Postitus vajab kinnitust","description":"Oleme sinu uue postituse kätte saanud, kuid see vajab enne ilmumist moderaatori kinnitust. Palume veidi kannatust. ","pending_posts":{"one":"Teil on \u003cstrong\u003e1\u003c/strong\u003e kinnitamata postitus.","other":"Sul on \u003cstrong\u003e{{count}}\u003c/strong\u003e kinnitamata postitust."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e postitas \u003ca href='{{topicUrl}}'\u003eselle teema\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eSa\u003c/a\u003e postitasid \u003ca href='{{topicUrl}}'\u003eselle teema\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastas postitusele \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eSa\u003c/a\u003e vastasid postitusele \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastas \u003ca href='{{topicUrl}}'\u003esellele teemale\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eSa\u003c/a\u003e vastasid \u003ca href='{{topicUrl}}'\u003esellele teemale\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainis kasutajat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainis \u003ca href='{{user2Url}}'\u003esind\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eSa\u003c/a\u003e mmainisid kasutajat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postitatud kasutaja \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e poolt","posted_by_you":"\u003ca href='{{userUrl}}'\u003eSinu\u003c/a\u003e postitiatud","sent_by_user":"Saadetud kasutaja \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e poolt","sent_by_you":"\u003ca href='{{userUrl}}'\u003eSinu \u003c/a\u003e saadetud"},"directory":{"filter_name":"filtreeri kasutajanime järgi","title":"Kasutajad","likes_given":"Antud","likes_received":"Saadud","topics_entered":"Vaadatud","topics_entered_long":"Vaadatud teemasid","time_read":"Lugemisele kulutatud aeg","topic_count":"Teemad","topic_count_long":"Teemasid loodud","post_count":"Vastuseid","post_count_long":"Vastuseid postitatud","no_results":"Ei leitud ühtegi tulemust.","days_visited":"Külastusi","days_visited_long":"Päevi külastatud","posts_read":"Loetud","posts_read_long":"Positusi loetud","total_rows":{"one":"1 kasutaja","other":"%{count} kasutajat"}},"groups":{"empty":{"posts":"Selle grupi liikmetelt ei ole postitusi.","members":"Selles grupis liikmeid pole.","mentions":"Seda gruppi pole mainitud.","messages":"Sellele grupile teated puuduvad.","topics":"Selle grupi liikmetelt teemasid ei ole."},"add":"Lisa","selector_placeholder":"Lisa liikmeid","owner":"omanik","visible":"Grupp on kõigile kasutajatele nähtav.","index":"Grupid","title":{"one":"grupp","other":"grupid"},"members":"Liikmed","topics":"Teemat","posts":"Postitused","mentions":"Mainimisi","messages":"Sõnumid","alias_levels":{"title":"Kes saab siia gruppi sõnumeid saata ja @mention?","nobody":"Mitte keegi","only_admins":"Vaid adminid","mods_and_admins":"Vaid moderaatorid ja adminnid","members_mods_and_admins":"Vaid grupi liikmed, moderaatorid ja adminnid","everyone":"Igaüks"},"trust_levels":{"title":"Liikmetele peale lisamist automaatselt omistatud usaldustase:","none":"Puudub"},"notifications":{"watching":{"title":"Vaatlen","description":"Sind teavitatakse igast uuest postitusest. Ühtlasi kuvatakse uute vastuste arv."},"watching_first_post":{"title":"Vaatan esimest postitust","description":"Sind teavitatakse vaid esimesest postitusest igas uues teemas selles grupis."},"tracking":{"title":"Jälgin","description":"Sind teavitatakse, kui keegi sinu @name mainib või sulle vastab. Ühtlasi kuvatakse uute vastuste arv."},"regular":{"title":"Normaalne","description":"Sind teavitatakse, kui keegi sinu @name mainib või sulle vastab."},"muted":{"title":"Vaigistatud","description":"Sind ei teavitata ühestki uuest teemast selles grupis."}}},"user_action_groups":{"1":"Meeldimisi antud","2":"Meeldimisi saadud","3":"Järjehoidjat","4":"Teemat","5":"Vastust","6":"Reaktsioone","7":"Mainimisi","9":"Tsitaate","11":"Redaktsioone","12":"Saatmisi","13":"Postkast","14":"Ootel"},"categories":{"all":"kõik liigid","all_subcategories":"kõik","no_subcategory":"mitte ükski","category":"Liik","category_list":"Kuva liigid","reorder":{"title":"Reasta liigid ümber","title_long":"Reasta liigid ümber","fix_order":"Fikseeri asukohad","fix_order_tooltip":"Osadel liikidel puudub unikaalne asukoha number, mis võib anda ettearvamatuid tulemusi.","save":"Salvesta järjestus","apply_all":"Rakenda","position":"Paiguta"},"posts":"Postitust","topics":"Teemat","latest":"Viimased","latest_by":"viimased kasutajalt","toggle_ordering":"lülita järjestus","subcategories":"Alamliigid","topic_stat_sentence":{"one":"%{count} uus teema viimase %{unit} jooksul.","other":"%{count} uut teemat viimase %{unit} jooksul."}},"ip_lookup":{"title":"IP-aadressi Otsing","hostname":"Hostinimi","location":"Asukoht","location_not_found":"(teadmata)","organisation":"Organisatsioon","phone":"Telefon","other_accounts":"Teised kontod selle IP aadressiga:","delete_other_accounts":"Kustuta %{count}","username":"kasutajanimi","trust_level":"UT","read_time":"lugemise aeg","topics_entered":"külastatud teemasid","post_count":"# postitust","confirm_delete_other_accounts":"Kindel, et soovid need kontod kustutada?"},"user_fields":{"none":"(vali võimalus)"},"user":{"said":"{{username}}:","profile":"Profiil","mute":"Vaigista","edit":"Muuda Eelistusi","download_archive":"Lae Minu Postitused alla","new_private_message":"Uus sõnum","private_message":"Sõnum","private_messages":"Sõnumid","activity_stream":"Tegevused","preferences":"Eelistused","expand_profile":"Näita veel","bookmarks":"Järjehoidjad","bio":"Minust","invited_by":"Kasutaja, kes kutsus","trust_level":"Usaldustase","notifications":"Teavitused","statistics":"Statistika","desktop_notifications":{"label":"Töölaua teavitused","not_supported":"See brauser ei toeta teavitusi. Kahju.","perm_default":"Lülita teavitused sisse","perm_denied_btn":"Pole lubatud","perm_denied_expl":"Oled teavitused keelanud. Luba teavitused oma brauseri sätetes.","disable":"Keela teavitused","enable":"Luba teavitused","each_browser_note":"Märkus: see säte tuleb muuta igas kasutusel olevas brauseris."},"dismiss_notifications":"Lükka kõik tagasi","dismiss_notifications_tooltip":"Märgi kõik lugemata teavitused loetuks","disable_jump_reply":"Ära hüppa minu postitusse peale vastamist","dynamic_favicon":"Kuva uute / muudetud teemade arvu brauseri ikoonil","external_links_in_new_tab":"Ava kõik välisviited uuel sakil","enable_quoting":"Luba esiletõstetud tekstile tsitaadiga vastata","change":"muuda","moderator":"{{user}} on moderaator","admin":"{{user}} on admin","moderator_tooltip":"See kasutaja on moderaator","admin_tooltip":"See kasutaja on admin","blocked_tooltip":"See kasutaja on blokeeritud","suspended_notice":"Selle kasutaja ligipääs on ajutiselt peatatud kuni {{date}}.","suspended_reason":"Põhjus:","github_profile":"Github","email_activity_summary":"Tegevuste kokkuvõte","mailing_list_mode":{"label":"Postiloendi režiim","enabled":"Lülita postiloendi režiim sisse","instructions":"See säte tõrjub tegevuste kokkuvõtte välja.\u003cbr /\u003e\nVaigistatud teemad ja foorumid ei kajastu nendes meilides.\n","daily":"Saada igapäevased kokkuvõtted","individual":"Saada meil iga uue postituse kohta","many_per_day":"Saada mulle meil iga uue postituse kohta (umbes {{dailyEmailEstimate}} meili päevas)","few_per_day":"Saada mulle meil iga uue postituse kohta (umbes 2 meili päevas)"},"tag_settings":"Sildid","watched_tags":"Vaadatud","watched_tags_instructions":"Sa vaatled kõiki nende siltidega uusi teemasid automaatselt. Sind teavitatakse kõigist uutest postitustest ja teemadest, koos uute postituste arvuga teema pealkirja kõrval.","tracked_tags":"Jälgitud","tracked_tags_instructions":"Sa jälgid kõiki nende siltidega uusi teemasid automaatselt. Uute postituste arv on näha teema pealkirja kõrval.","muted_tags":"Vaigistatud","muted_tags_instructions":"Sind ei teavitata ühestki uuest nende siltidega teemast, samuti ei ilmu nad viimaste teemade alla.","watched_categories":"Vaadeldav","watched_categories_instructions":"Sa vaatled nendes foorumites kõiki teemasid automaatselt. Sind teavitatakse igast uuest postitusest ja teemast, koos uute postituste arvuga teema pealkirja kõrval.","tracked_categories":"Jälgitud","tracked_categories_instructions":"Sa jälgid kõiki uusi teemasid nendes foorumites automaatselt. Lugemata ja uute postituste arv on näha teema pealkirja kõrval.","watched_first_post_categories":"Vaatan esimest postitust","watched_first_post_categories_instructions":"Sind teavitatakse esimesest postitusest igas uues teemas nendes foorumites.","watched_first_post_tags":"Vaatan esimest postitust","watched_first_post_tags_instructions":"Sind teavitatakse esimesest postitusest igas nende siltidega uues teemas.","muted_categories":"Vaigistatud","muted_categories_instructions":"Sind ei teavitata ühestki uuest teemast nendes liikides, samuti ei ilmu nad viimaste teemade alla.","delete_account":"Kustuta minu konto","delete_account_confirm":"Kas oled kindel, et soovid oma konto jäädavalt kustutada? Seda toimingut ei ole võimalik tagasi võtta!","deleted_yourself":"Konto on edukalt kustutatud.","delete_yourself_not_allowed":"Sa ei saa hetkel oma kontot kustutada. Võta ühendust administraatoriga et ta teeks seda sinu eest.","unread_message_count":"Sõnumid","admin_delete":"Kustuta","users":"Kasutajad","muted_users":"Vaigistatud","muted_users_instructions":"Summuta kõik teavitused nendelt kasutajatelt.","muted_topics_link":"Näita vaigistatud teemasid","watched_topics_link":"Näita vaatlusaluseid teemasid","automatically_unpin_topics":"Eemalda lõppu jõudmisel teemadelt automaatselt esiletõstmise märgistus.","staff_counters":{"flags_given":"kasulikud tähised","flagged_posts":"tähistatud postitused","deleted_posts":"kustutatud postitused","suspensions":"ajutised peatamised","warnings_received":"hoiatused"},"messages":{"all":"Kõik","inbox":"Postkast","sent":"Saadetud","archive":"Arhiiv","groups":"Minu grupid","bulk_select":"Vali sõnumid","move_to_inbox":"Liiguta sisendkausta","move_to_archive":"Arhiiv","failed_to_move":"Valitud sõnumite teisaldamine ebaõnnestus (võrguühendus võib olla häiritud)","select_all":"Vali kõik"},"change_password":{"success":"(meil saadetud)","in_progress":"(saadan meili)","error":"(viga)","action":"Saada parooli uuendamise meil","set_password":"Määra parool"},"change_about":{"title":"Muuda minu andmeid","error":"Välja muutmisel tekkis viga."},"change_username":{"title":"Muuda kasutajanime","confirm":"Muutes oma kasutajanime, katkevad kõik varasemad viited sinu postitustele ja @name mainimised. Oled täiesti veendunud, et soovid seda?","taken":"Vabandust, see kasutajanimi on võetud.","error":"Kasutajanime muutmisel tekkis tõrge.","invalid":"Selline kasutajanimi ei ole lubatud. Kasutada tohib ainult numbreid ja tähti"},"change_email":{"title":"Muuda meiliaadressi","taken":"Vabandust, see meiliaadress ei ole saadaval.","error":"Sinu meiliaadressi muutmisel esines tõrge. Äkki on see juba kasutuses?","success":"Saatsime sellele aadressile meili. Palun järgi seal olevaid juhiseid."},"change_avatar":{"title":"Muuda oma profiilipilti","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baseerub","gravatar_title":"Oma avatari muuda Gravatar'i veebilehel","refresh_gravatar_title":"Värskenda oma Gravatar'i","letter_based":"Süsteemi poolt määratud profiilipilt","uploaded_avatar":"Individuaalne pilt","uploaded_avatar_empty":"Lisage individuaalne pilt","upload_title":"Lae üles oma pilt","upload_picture":"Lae pilt üles","image_is_not_a_square":"Hoiatus: lõikasime pilti, kuna laius ja kõrgus ei olnud võrdsed.","cache_notice":"Oled edukalt muutnud oma profiilipildi kuid võib juhtuda, et näed seda alles mõne aja pärast."},"change_profile_background":{"title":"Profiili taustpilt","instructions":"Profiili taustad tsentreeritakse ja on vaikimisi 850 pikslit laiad."},"change_card_background":{"title":"Kasutajakaardi taustpilt","instructions":"Taustapildidd tsentreeritakse ja on vaikimisi 590 pikslit laiad."},"email":{"title":"Meiliaadress","instructions":"Avalikkusele ei näidata kunagi","ok":"Saadame sulle kinnituseks meili","invalid":"Sisesta palun korrektne meiliaadress","authenticated":"Sinu meil on autenditud {{provider}} poolt","frequency_immediately":"Saadame sulle kohe meili, kui sa ei ole seda lugenud, mille kohta meili saatsime.","frequency":{"one":"Saadame meili vaid siis, kui pole sind viimase minuti jooksul näinud.","other":"Saadame meili vaid siis, kui pole Sind viimase {{count}} minuti jooksul näinud."}},"name":{"title":"Nimi","instructions":"Sinu täisnimi (vabatahtlik)","instructions_required":"Sinu täisnimi","too_short":"Sinu antud nimi on liiga lühike","ok":"Paistab, et nimega on asjad korras"},"username":{"title":"Kasutajanimi","instructions":"Unikaalne, tühikuteta ja lühikene","short_instructions":"Inimesed võivad sind mainda nimega @{{username}}","available":"Sinu poolt valitud kasutajanimi on vaba","global_match":"Meiliaadress kattub registreeritud kasutajanimega","global_mismatch":"Juba registreeritud. Proovime {{suggestion}}?","not_available":"Pole saadaval. Proovime {{suggestion}}?","too_short":"Sinu poolt valitud kasutajanimi on liiga lühike","too_long":"Sinu poolt valitud kasutajanimi on liiga pikk","checking":"Teen kindlaks, kas kasutajanimi on vaba...","enter_email":"Kasutajanimi leitud; sisesta vastav meil","prefilled":"Meiliaadress kattub registreeritud kasutajanimega"},"locale":{"title":"Kasutujaliidese keel","instructions":"Kasutajaliidese keel. See muutub, kui lehe uuesti laed.","default":"(vaikimisi)"},"password_confirmation":{"title":"Salasõna uuesti"},"last_posted":"Viimane postitus","last_emailed":"Viimati meilitud","last_seen":"Vaadatud","created":"Liitus","log_out":"Logi välja","location":"Asukoht","card_badge":{"title":"Kasutajakaardi märgis"},"website":"Veebileht","email_settings":"Meiliaadress","like_notification_frequency":{"title":"Teavita, kui on meeldimisi","always":"Alati","first_time_and_daily":"Kui postitus on saanud esimese meeldimise ja igapäevaselt","first_time":"Kui postitus on saanud esimese meeldimise","never":"Mitte kunagi"},"email_previous_replies":{"title":"lisa eelmised vastused e-kirja lõppu","unless_emailed":"kui juba pole saadetud","always":"alati","never":"mitte kunagi"},"email_digests":{"title":"Kui ma siinset paika ei külasta, saada mulle kokkuvõtlik meil populaarsemate teemade ja vastustega.","every_30_minutes":"iga pooltund","every_hour":"iga tund","daily":"igapäevaselt","every_three_days":"iga kolme päeva tagant","weekly":"iga nädal","every_two_weeks":"iga kahe nädala tagant"},"include_tl0_in_digests":"Kajasta meili teel kokkuvõttes ka uute kasutajate loodud sisu.","email_in_reply_to":"Lisa e-kirjale katkend eelmisest vastusest","email_direct":"Teavita mind, kui keegi tsiteerib minu postitust, vastab minu postitusele, mainib minu @kasutajanime või kutsub mind teemaga liituma","email_private_messages":"Saada meilile teavitus, kui minuga kontakteerutakse sõnumi teel","email_always":"Saada mulle teavitused meilile, isegi kui ma olen siin aktiivne kasutaja","other_settings":"Muu","categories_settings":"Liigid","new_topic_duration":{"label":"Loe teemad uuteks, kui","not_viewed":"Ma ei ole neid veel vaadanud","last_here":"loodud pärast minu viimast külastust","after_1_day":"loodud viimase päeva jooksul","after_2_days":"loodud viimase kahe päeva jooksul","after_1_week":"loodud viimase nädala jooksul","after_2_weeks":"loodud viimase 2 nädala jooksul"},"auto_track_topics":"Jälgi minu külastatud teemasid automaatselt","auto_track_options":{"never":"mitte kunagi","immediately":"koheselt","after_30_seconds":"pärast 30 sekundit","after_1_minute":"pärast 1 minutit","after_2_minutes":"pärast 2 minutit","after_3_minutes":"pärast 3 minutit","after_4_minutes":"pärast 4 minutit","after_5_minutes":"pärast 5 minutit","after_10_minutes":"pärast 10 minutit"},"invited":{"search":"kirjuta kutsete otsimiseks...","title":"kutsed","user":"Kutsutud kasutaja","sent":"Saadetud","none":"Ühtegi ootel kutset ei ole kuvada","truncated":{"one":"Näitan esimest kutset.","other":"Näitan esimest {{count}} kutset."},"redeemed":"Lunastatud kutsed","redeemed_tab":"Lunastatud","redeemed_tab_with_count":"Lunastatud ({{count}})","redeemed_at":"Lunastatud","pending":"Ootel kutsed","pending_tab":"Ootel","pending_tab_with_count":"Ootel ({{count}})","topics_entered":"Vaadatud teemasid","posts_read_count":"Postitust loetud","expired":"See kutse on aegunud.","rescind":"Eemalda","rescinded":"Kutse eemaldatud","reinvite":"Saada kutse uuesti","reinvite_all":"Saada kõik kutsed uuesti","reinvited":"Kutse uuesti saadetud","reinvited_all":"Kõik kutsed uuesti saadetud","time_read":"Lugemise aeg","days_visited":"Päevi külastatud","account_age_days":"Konto vanus päevades","create":"Saada kutse","generate_link":"Kopeeri viide kutsele","generated_link_message":"\u003cp\u003eKutse viide edukalt genereeritud!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eKutse viide on kehtiv vaid selle meiliaadressi jaoks: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Sa ei ole veel kedagi siia kutsunud. Võid saata kutseid individuaalselt, või korraga tervele grupile kui \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003elaed üles masskutsete faili\u003c/a\u003e.","text":"Masskutse Failist","uploading":"Laen üles...","success":"Fail edukalt üles laetud. Sulle saabub teade, kui protsess on lõpule jõudnud.","error":"Faili '{{filename}}' üleslaadimisel tekkis viga: {{message}}"}},"password":{"title":"Parool","too_short":"Parool on liiga lühike.","common":"See parool on liiga tavaline.","same_as_username":"Parool ühtib sinu kasutajanimega.","same_as_email":"Parool ühtib sinu meiliaadressiga.","ok":"See parool on sobilik.","instructions":"Vähemalt %{count} sümbolit."},"summary":{"title":"Kokkuvõte","stats":"Statistika","time_read":"lugemise aeg","topic_count":{"one":"teema loodud","other":"teemat loodud"},"post_count":{"one":"postitus loodud","other":"postitust loodud"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e antud","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e antud"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e saadud","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e saadud"},"days_visited":{"one":"päev külastatud","other":"päevi külastatud"},"posts_read":{"one":"postitus loetud","other":"postitust loetud"},"bookmark_count":{"one":"järjehoidja","other":"järjehoidjad"},"top_replies":"Parimad vastused","no_replies":"Veel ei ole vastuseid.","more_replies":"Veel vastuseid","top_topics":"Parimad teemad","no_topics":"Veel ei ole teemasid.","more_topics":"Veel teemasid","top_badges":"Parimad märgised","no_badges":"Märgiseid veel pole","more_badges":"Veel märgiseid","top_links":"Parimad viited","no_links":"Viiteid veel pole.","most_liked_by":"Enim meeldinud kasutajale","most_liked_users":"Enim meeldinud","most_replied_to_users":"Enim vastatud teemasse","no_likes":"Meeldimisi veel pole."},"associated_accounts":"Sisselogimisi","ip_address":{"title":"Viimane IP-aadress"},"registration_ip_address":{"title":"Registreerumise IP-aadress"},"avatar":{"title":"Profiilipilt","header_title":"profiil, sõnumid, järjehoidjad ja eelistused"},"title":{"title":"Pealkiri"},"filters":{"all":"Kõik"},"stream":{"posted_by":"Postitaja","sent_by":"Saatja","private_message":"sõnum","the_topic":"teema"}},"loading":"Laen...","errors":{"prev_page":"kui üritasin laadida","reasons":{"network":"Võrgu viga","server":"Serveri viga","forbidden":"Juurdepääsust keelduti","unknown":"Viga","not_found":"Lehekülge ei leitud"},"desc":{"network":"Palun kontrolli ühendust.","network_fixed":"Näib, et see on tagasi.","server":"Veakood: {{status}}","forbidden":"Sul puudub õigus seda näha.","not_found":"Oppaa, programm proovis laadida olematut URL-i.","unknown":"Miskit läks nihu."},"buttons":{"back":"Mine tagasi","again":"Proovi uuesti","fixed":"Lae lehekülg"}},"close":"Sulge","assets_changed_confirm":"See sait on just uuendatud. Värskendan nüüd viimasele versioonile?","logout":"Sind logiti välja.","refresh":"Värskenda","read_only_mode":{"enabled":"See sait on kirjutuskaitstud režiimis. Sirvimist saab jätkata, kuid vastamine, meeldimine ja teised toimingud on hetkel blokeeritud.","login_disabled":"Sisselogimine on blokeeritud seni, kuni sait on kirjutuskaitstud režiimis.","logout_disabled":"Väljalogimine on blokeeritud kuni sait on kirjutuskaitstud režiimis."},"too_few_topics_and_posts_notice":"Tõmbame \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eselle vestluse käima!\u003c/a\u003e Hetkel on tehtud \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e teemat ja \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e postitust. Uued külastajad vajavad vestlusi, milles osaleda.","too_few_topics_notice":"Tõmbame \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eselle vestluse käima!\u003c/a\u003e Hetkel on tehtud \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e teemat. Uued külastajad vajavad vestlusi, milles osaleda.","too_few_posts_notice":"Tõmbame \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eselle vestluse käima!\u003c/a\u003e Hetkel on tehtud \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e postitust. Uued külastajad vajavad vestlusi, milles osaleda.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e on saavutanud saidi sätetes kehtestatud limiidi %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e ületab saidi sätetes kehtestatud limiiti %{siteSettingRate}.","rate":{"one":"1 viga/%{duration}","other":"%{count} viga/%{duration}"}},"learn_more":"uuri veel...","year":"aasta","year_desc":"teemat loodud viimase 365 päeva jooksul","month":"kuu","month_desc":"teemat loodud viimase 30 päeva jooksul","week":"nädal","week_desc":"teemat loodud viimase 7 päeva jooksul","day":"päev","first_post":"Esimene postitus","mute":"Vaigista","unmute":"Tühista vaigistus","last_post":"Viimane postitus","last_reply_lowercase":"viimane vastus","replies_lowercase":{"one":"vastus","other":"vastuseid"},"signup_cta":{"sign_up":"Liitu","hide_session":"Tuleta mulle homme meelde","hide_forever":"tänan, ei","hidden_for_session":"OK, küsin homme uuesti. Samuti võid konto alati 'Logi sisse' lingi alt luua.","intro":"Hei! :heart_eyes: Näib, et sulle see vestlus meeldib, kuid sa pole endale veel kontot loonud.","value_prop":"Kui oled endale konto loonud, jätame me täpselt meelde, mida oled lugenud. Nii jätkad alati sealt, kus pooleli jätsid. Samuti tulevad sulle teavitused nii siia kui ka meilile, kui ilmuvad uued postitused. Ning võid postituste juurde märkida \"meeldib\", et näidata oma poolehoidu. :heartbeat:"},"summary":{"enabled_description":"Vaatad selle teema kokkuvõtet: kõige huvipakkuvamad postitused valib kogukond.","description":"Kokku on \u003cb\u003e{{replyCount}}\u003c/b\u003e vastust.","description_time":"Kokku on \u003cb\u003e{{replyCount}}\u003c/b\u003e vastust mille lugemiseks kulub hinnanguliselt \u003cb\u003e{{readingTime}} minutit\u003c/b\u003e.","enable":"Võta see teema kokku","disable":"Näita kõiki postitusi"},"deleted_filter":{"enabled_description":"See teema sisaldab kustutatud postitusi, mis on peidetud.","disabled_description":"Selle teema kustutatud postitused on nähtaval.","enable":"Peida kustutatud postitused","disable":"Näita kustutatud postitusi"},"private_message_info":{"title":"Sõnum","invite":"Kutsu teisi...","remove_allowed_user":"Kas soovid tõesti {{name}} sellest sõnumist eemaldada?","remove_allowed_group":"Kas soovid tõesti {{name}} sellest sõnumist eemaldada?"},"email":"Meiliaadress","username":"Kasutajanimi","last_seen":"Vaadatud","created":"Loodud","created_lowercase":"loodud","trust_level":"Usaldustase","search_hint":"kasutajanimi, meil või IP-aadress","create_account":{"title":"Loo uus konto","failed":"Miski läks valesti - võimalik, et see meiliaadress on juba registreeritud. Proovi viidet unustatud parooli lehele"},"forgot_password":{"title":"Parooli uuendamine","action":"Unustasin oma parooli","invite":"Sisesta oma kasutajanimi või meiliaadress, me saadame parooli uuendamiseks meili.","reset":"Uuenda parool","complete_username":"Kui konto omaniku kasutajanimi on \u003cb\u003e%{username}\u003c/b\u003e, peaksid varsti saama meili koos parooli uuendamise juhistega.","complete_email":"Kui konto omaniku meiliaadress on \u003cb\u003e%{email}\u003c/b\u003e, peaksid varsti saama meili koos parooli uuendamise juhistega.","complete_username_found":"Leidsime konto, mille omaniku kasutajanimi on \u003cb\u003e%{username}\u003c/b\u003e - peaksid varsti saama meili koos parooli uuendamise juhistega.","complete_email_found":"Leidsime konto, mille omaniku meiliaadress on \u003cb\u003e%{email}\u003c/b\u003e, peaksid varsti saama meili koos parooli uuendamise juhistega.","complete_username_not_found":"Kasutajanimele \u003cb\u003e%{username}\u003c/b\u003e ei vasta ükski konto","complete_email_not_found":"Meiliaadressile \u003cb\u003e%{email}\u003c/b\u003e ei vasta ükski konto"},"login":{"title":"Logi sisse","username":"Kasutaja","password":"Parool","email_placeholder":"meiliaadress või kasutajanimi","caps_lock_warning":"Suurtäherežiim on sees","error":"Tundmatu viga","rate_limit":"Palun oota veidi enne järgmist sisselogimiskatset.","blank_username_or_password":"Palun sisesta oma meiliaadress või kasutajanimi ja parool.","reset_password":"Uuenda parool","logging_in":"Login sisse...","or":"Või","authenticating":"Autendin...","awaiting_confirmation":"Sinu konto ootab aktiveerimist. Kasuta unustasin parooli - viidet, et aktiveerimise meil uuesti saata.","awaiting_approval":"Sinu konto on alles meeskonna poolt kinnitamata. Saadame sulle kohe meili, kui see on heaks kiidetud.","requires_invite":"Vabandame, sellesse foorumisse pääseb ainult kutsega.","not_activated":"Sa ei saa veel sisse logida. Saatsime sulle aktiveerimise meili aadressile \u003cb\u003e{{sentTo}}\u003c/b\u003e. Järgi palun selles meilis olevaid juhiseid oma konto aktiveerimiseks.","not_allowed_from_ip_address":"Sellelt IP-aadressilt ei saa sisse logida.","admin_not_allowed_from_ip_address":"Sellelt IP-aadressilt ei saa adminina sisse logida.","resend_activation_email":"Selleks, et aktiveerimise meili uuesti saata, klikka siia.","sent_activation_email_again":"Saatsime sulle aktiveerimise meili aadressile \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Selle kohalejõudmine võib võtta mõne minuti; kontrolli kindlasti ka spämmikausta.","to_continue":"Palun logi sisse","preferences":"Oma kasutajaeelistuste muutmiseks pead olema sisse logitud.","forgot":"Ma ei mäleta oma konto üksikasju","google":{"title":"Google abil","message":"Autentimine Google abil (veendu, et hüpikaknad oleks lubatud)"},"google_oauth2":{"title":"Google abil","message":"Autentimine Google abil (veendu, et hüpikaknad oleks lubatud)"},"twitter":{"title":"Twitteri abil","message":"Autentimine Twitteri abil (veendu, et hüpikaknad oleks lubatud)"},"instagram":{"title":"Instagram'iga","message":"Autentimine Instagram'i kaudu (vaata, et hüpikaknad ei oleks keelatud)"},"facebook":{"title":"Facebooki abil","message":"Autentimine Facebooki abil (veendu, et hüpikaknad oleks lubatud)"},"yahoo":{"title":"Yahoo abil","message":"Autentimine Yahoo abil (veendu, et hüpikaknad oleks lubatud)"},"github":{"title":"GitHub abil","message":"Autentimine GitHub abil (veendu, et hüpikaknad oleks lubatud)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"veel...","options":"Võimalused","whisper":"sosista","unlist":"eemaldatud","add_warning":"See on ametlik hoiatus.","toggle_whisper":"Lülita sosistamine ümber","toggle_unlisted":"Lülita eemaldamine ümber","posting_not_on_topic":"Millisesse teemasse soovid vastata?","saving_draft_tip":"salvestan...","saved_draft_tip":"salvestatud","saved_local_draft_tip":"salvestatud lokaalselt","similar_topics":"Sinu teema sarnaneb...","drafts_offline":"mustandid vallasrežiimis","duplicate_link":"Näib, et sinu viide \u003cb\u003e{{domain}}\u003c/b\u003e oli juba postitatud teemasse kasutaja \u003cb\u003e@{{username}}\u003c/b\u003e poolt postituse \u003ca href='{{post_url}}'\u003evastuses {{ago}}\u003c/a\u003e – oled kindel, et soovid selle uuesti postitada?","error":{"title_missing":"Pealkiri on kohustuslik","title_too_short":"Pealkiri peab olema vähemalt {{min}} sümbolit pikk","title_too_long":"Pealkiri ei saa olla pikem kui {{max}} sümbolit","post_missing":"Positus ei saa olla tühi","post_length":"Postitus peab olema vähemalt {{min}} sümbolit pikk","try_like":"Kas oled proovinud \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e nuppu?","category_missing":"Pead valima liigi"},"save_edit":"Salvesta muudatused","reply_original":"Vasta algsesse teemasse","reply_here":"Vasta siin","reply":"Vasta","cancel":"Tühista","create_topic":"Loo teema","create_pm":"Sõnum","title":"Või vajuta Ctrl+Enter","users_placeholder":"Lisa kasutaja","title_placeholder":"Kuidas seda vestlust ühe lausega kirjeldada?","edit_reason_placeholder":"miks sa seda muudad?","show_edit_reason":"(lisa muutmise põhjus)","reply_placeholder":"Kirjuta siia. Kujundamiseks kasuta Markdown, BBCode, või HTML-i. Pildid võid siia lohistada või kleepida.","view_new_post":"Vaata oma uut postitust.","saving":"Salvestan","saved":"Salvestatud!","saved_draft":"Postituse mustand on pooleli. Jätkamiseks vali.","uploading":"Laen üles...","show_preview":"näita eelvaadet \u0026raquo;","hide_preview":"\u0026laquo; peida eelvaade","quote_post_title":"Tsiteeri kogu postitust","bold_title":"Rasvane","bold_text":"rasvane tekst","italic_title":"Esiletõstetud","italic_text":"esiletõstetud tekst","link_title":"Hüperlink","link_description":"sisesta viite kirjeldus siia","link_dialog_title":"Lisa hüperlink","link_optional_text":"valikuline pealkiri","link_url_placeholder":"http://example.com","quote_title":"Plokktsitaat","quote_text":"Plokktsitaat","code_title":"Eelvormindatud tekst","code_text":"taanda eelvormindatud tekst 4 tühiku võrra","paste_code_text":"kirjuta või kleebi kood siia","upload_title":"Lae üles","upload_description":"sisesta üleslaetu kirjeldus siia","olist_title":"Numberloend","ulist_title":"Täpploend","list_item":"Loendi element","heading_title":"Päis","heading_text":"Päis","hr_title":"Rõhtjoon ","help":"Markdown-i redaktori spikker","toggler":"peida või ava ladumispaneel","modal_ok":"OK","modal_cancel":"Tühista","cant_send_pm":"Kahjuks ei saa sa kasutajale %{username} sõnumit saata.","yourself_confirm":{"title":"Kas unustasid saajad lisada?","body":"Hetkel saadetakse see sõnum vaid sulle endale!"},"admin_options_title":"Meeskonna valikulised sätted selle teema jaoks","auto_close":{"label":"Teema automaatse sulgemise aeg:","error":"Palun sisesta lubatav väärtus.","based_on_last_post":"Ära sule enne, kui selle teema viimane postitus on vähemalt nii vana.","all":{"examples":"Sisesta tundide arv (24), absoluutne aeg (17:30) või ajatempel (2013-11-22 14:00)."},"limited":{"units":"(tundide arv)","examples":"Sisesta tundide arv (24)."}}},"notifications":{"title":"teavitused @name mainimiste, oma postitustele ja teemadele vastamiste, sõnumite, jne kohta","none":"Hetkel ei saa teavitusi laadida.","empty":"Teavitusi ei leitud.","more":"vaata vanemaid teavitusi","total_flagged":"tähistatud postitusi kokku","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} ja veel 1\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} ja veel {{count}} \u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e võttis Sinu kutse vastu\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e liigutas {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eTeenisid '{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eUus teema\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} sõnum Sinu {{group_name}} postkastis\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} sõnumit Sinu {{group_name}} postkastis\u003c/p\u003e"},"alt":{"mentioned":"Mainis","quoted":"Tsiteeris","replied":"Vastas","posted":"Postitas","edited":"Muuda oma postitust","liked":"Sinu postitus meeldis","private_message":"Privaatsõnum","invited_to_private_message":"Privaatsõnumit kutsus lugema","invited_to_topic":"Teemasse kutsus","invitee_accepted":"Kutse võttis vastu","moved_post":"Sinu postituse liigutas","linked":"Viide sinu postitusele","granted_badge":"Märgis antud","group_message_summary":"Sõnumeid grupi postkastis"},"popup":{"mentioned":"{{username}} mainis Sind teemas \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mainis Sind teemas \"{{topic}}\" - {{site_title}}","quoted":"{{username}} tsiteeris Sind teemas \"{{topic}}\" - {{site_title}}","replied":"{{username}} vastas Sulle teemas \"{{topic}}\" - {{site_title}}","posted":"{{username}} postitas teemasse \"{{topic}}\" - {{site_title}}","private_message":"{{username}} saatis Sulle privaatsõnumi teemas \"{{topic}}\" - {{site_title}}","linked":"{{username}} viitas Sinu postitusele teemas \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Lisa pilt","title_with_attachments":"Lisa pilt või fail","from_my_computer":"Minu seadmest","from_the_web":"Veebist","remote_tip":"viide pildile","remote_tip_with_attachments":"viide pildile või failile {{authorized_extensions}}","local_tip":"vali pildid oma seadmest","local_tip_with_attachments":"vali pildid või failid oma seadmest {{authorized_extensions}}","hint":"(üleslaadimiseks võid faili ka redaktorisse pukseerida)","hint_for_supported_browsers":"võid pildi redaktorisse ka pukseerida või kleepida","uploading":"Laen üles","select_file":"Vali fail","image_link":"viide millele Su pilt hakkab osutama"},"search":{"sort_by":"Järjesta","relevance":"Asjakohasus","latest_post":"Viimane postitus","most_viewed":"Enim vaadatud","most_liked":"Enim meeldinud","select_all":"Vali kõik","clear_all":"Puhasta kõik","too_short":"Otsitav tekst on liiga lühike.","result_count":{"one":"1 tulemus \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e kohta","other":"{{count}} tulemust \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e kohta"},"title":"otsi teemasid, postitusi, kasutajaid, või liike","no_results":"Ei leidnud midagi.","no_more_results":"Rohkem vasteid pole.","search_help":"Otsingu spikker","searching":"Otsin...","post_format":"postituse nr{{post_number}} tegi {{username}}","context":{"user":"Otsi kasutaja @{{username}} postitusi","category":"Otsi #{{category}} foorumist","topic":"Otsi sellest teemast","private_messages":"Otsi sõnumeid"}},"hamburger_menu":"mine teise teemaloetelu või liigi juurde","new_item":"uus","go_back":"tagasi","not_logged_in_user":"kasutajaleht koos toimingute ja eelistuste kokkuvõttega","current_user":"mine oma kasutajalehele","topics":{"bulk":{"unlist_topics":"Eemalda teemad loetelust","reset_read":"Nulli loetud","delete":"Kustuta teemad","dismiss":"Lükka tagasi","dismiss_read":"Lükka tagasi kõik lugemata","dismiss_button":"Lükkan tagasi...","dismiss_tooltip":"Lükka tagasi ainult uued postitused või lõpeta teemade jälgimine","also_dismiss_topics":"Lõpeta nende teemade jälgimine. Soovin, et neid enam kunagi kui lugemata teemasid esile ei tõstetaks","dismiss_new":"Lükka tagasi uued","toggle":"lülita teemade massiline ära märkimine ümber","actions":"Masstoimingud","change_category":"Muuda liiki","close_topics":"Sulge Teemad","archive_topics":"Arhiveeri Teemad","notification_level":"Muuda Teavituste Taset","choose_new_category":"Vali teemadele uus liik:","selected":{"one":"Märkisid ära \u003cb\u003e1\u003c/b\u003e teema.","other":"Märkisid ära \u003cb\u003e{{count}}\u003c/b\u003e teemat."},"change_tags":"Muuda silte","choose_new_tags":"Vali teemadele uued sildid:","changed_tags":"Nende teemade silte on muudetud."},"none":{"unread":"Sul ei ole lugemata teemasid.","new":"Sul ei ole uusi teemasid.","read":"Sa ei ole veel ühtegi teemat lugenud.","posted":"Sa ei ole veel ühtegi teemasse postitanud.","latest":"Ühtegi värsket teemat pole. Nukker.","hot":"Ühtegi kuuma teemat pole.","bookmarks":"Sul ei ole veel ühtegi järjehoidjaga teemal.","category":"Liigis {{category}} teemad puuduvad.","top":"Tippteemad puuduvad.","search":"Otsing ei andnud tulemusi.","educate":{"new":"\u003cp\u003eSinu uued teemad ilmuvad siia.\u003c/p\u003e\u003cp\u003eTeemad loetakse vaikimisi uuteks ja tähistatakse indikaatoriga \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003euus\u003c/span\u003e, kui nad loodi viimase 2 ööpäeva jooksul.\u003c/p\u003e\u003cp\u003eMuutmiseks külasta oma \u003ca href=\"%{userPrefsUrl}\"\u003eeelistuste\u003c/a\u003e lehekülge.\u003c/p\u003e","unread":"\u003cp\u003eSinu lugemata teemad ilmuvad siia.\u003c/p\u003e\u003cp\u003eTeemad loetakse vaikimisi mitteloetuteks ja varustatakse lugemata postituste loenduriga \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e kui Sa:\u003c/p\u003e\u003cul\u003e\u003cli\u003eLõid uue teema\u003c/li\u003e\u003cli\u003eVastasid teemasse\u003c/li\u003e\u003cli\u003eLugesid teemat kauem kui 4 minutit\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eVõi kui seadsid teema Jälgitavaks teavituste juhtpaneelil iga teema lõpus.\u003c/p\u003e\u003cp\u003eMuutmiseks külasta oma \u003ca href=\"%{userPrefsUrl}\"\u003eeelistuste\u003c/a\u003e lehekülge.\u003c/p\u003e"}},"bottom":{"latest":"Rohkem värskeid teemasid pole.","hot":"Rohkem kuumi teemasid pole.","posted":"Rohkem uute postitustega teemasid pole.","read":"Rohkem loetud teemasid pole.","new":"Rohkem uusi teemasid pole.","unread":"Rohkem lugemata teemasid pole.","category":"Liigis {{category}} rohkem teemasid pole.","top":"Rohkem tippteemasid pole.","bookmarks":"Rohkem järjehoidjaga teemasid pole.","search":"Rohkem otsingutulemusi pole."}},"topic":{"unsubscribe":{"stop_notifications":"Sulle saabub nüüd \u003cstrong\u003e{{title}}\u003c/strong\u003e kohta vähem teavitusi","change_notification_state":"Sinu teavituste olek on"},"create":"Uus Teema","create_long":"Loo uus Teema","private_message":"Alusta sõnumit","archive_message":{"help":"Liiguta sõnum oma arhiivi","title":"Arhiiv"},"move_to_inbox":{"title":"Liiguta Postkasti","help":"Liiguta sõnum tagasi Postkasti"},"list":"Teemad","new":"uus teema","unread":"lugemata","new_topics":{"one":"1 uus teema","other":"{{count}} uut teemat"},"unread_topics":{"one":"1 lugemata teema","other":"{{count}} lugemata teemat"},"title":"Teema","invalid_access":{"title":"Teema on privaatne","description":"Vabanda, Sul puudub juurdepääs sellele teemale!","login_required":"Selle teema nägemiseks pead sisse logima."},"server_error":{"title":"Teema laadimine ebaõnnestus","description":"Vabanda, meil ei õnnestunud seda teemat laadida, võimalik, et ühenduse vea tõttu. Proovi palun uuesti. Kui viga püsib, anna meile teada."},"not_found":{"title":"Teemat ei leitud","description":"Vabanda, meil ei õnnestunud seda teemat leida. Võimalik, et moderaator eemaldas selle?"},"total_unread_posts":{"one":"Sul on selles teemas 1 lugemata postitus","other":"Sul on selles teemas {{count}} lugemata postitust"},"unread_posts":{"one":"Sul on selles teemas 1 lugemata vana postitus","other":"Sul on selles teemas {{count}} lugemata vana postitust"},"new_posts":{"one":"selles teemas on 1 uus postitus Sinu viimasest külastusest","other":"selles teemas on {{count}} uut postitust Sinu viimasest külastusest"},"likes":{"one":"selles teemas on 1 meeldimine","other":"selles teemas on {{count}} meeldimist"},"back_to_list":"Tagasi Teemade Loendisse","options":"Teema Suvandid","show_links":"näita viiteid selles teemas","toggle_information":"lülita teema üksikasjad ümber","read_more_in_category":"Soovid veel lugeda? Vaata teisi teemasid {{catLink}} või {{latestLink}}.","read_more":"Soovid veel lugeda? {{catLink}} või {{latestLink}}.","browse_all_categories":"Vaata kõiki liike","view_latest_topics":"vaata värskeid teemasid","suggest_create_topic":"Teeks äkki teema?","jump_reply_up":"hüppa varasema vastuse juurde","jump_reply_down":"hüppa hilisema vastuse juurde","deleted":"See teema on kustutatud","auto_close_notice":"See teema sulgub %{timeLeft} pärast ise.","auto_close_notice_based_on_last_post":"See teema sulgub %{duration} peale viimast vastust.","auto_close_title":"Automaatse sulgumise sätted","auto_close_save":"Salvesta","auto_close_remove":"Ära lase sel teemal automaatselt sulguda","timeline":{"back":"Tagasi","back_description":"Mine tagasi oma viimase lugemata postituse juurde","replies_short":"%{current} / %{total}"},"progress":{"title":"teema edenemine","go_top":"üles","go_bottom":"alla","go":"mine","jump_bottom":"hüppa viimase postituse juurde","jump_prompt":"hüppa postituse juurde","jump_prompt_long":"Millise postituse juurde soovid hüpata?","jump_bottom_with_number":"hüppa postituse %{post_number} juurde","total":"postitusi kokku","current":"käesolev postitus"},"notifications":{"title":"muuda kui tihti sind sellest teemast teavitatakse","reasons":{"mailing_list_mode":"Sul on aktiveeritud postiloendi režiim, seega teavitatakse sind vastustest siia teemasse meili teel.","3_10":"Sulle saabuvad teavitused, kuna jälgid selle teemaga seotud silti.","3_6":"Sulle saabuvad teavitused, kuna vaatled seda liiki.","3_5":"Sulle saabuvad teavitused kuna hakkasid seda teemat automaatselt jälgima.","3_2":"Sulle saabuvad teavitused kuna jälgid seda teemat.","3_1":"Sulle saabuvad teavitused kuna lõid selle teema.","3":"Sulle saabuvad teavitused kuna jälgid seda teemat.","2_8":"Sulle saabuvad teavitused, kuna jälgid seda liiki.","2_4":"Sulle saabuvad teavitused kuna postitasid siia teemasse vastuse.","2_2":"Sulle saabuvad teavitused kuna jälgid seda teemat.","2":"Sulle saabuvad teavitused kuna \u003ca href=\"/users/{{username}}/preferences\"\u003eluges seda teemat\u003c/a\u003e.","1_2":"Sind teavitatakse, kui keegi Teie @name mainib või Teile vastab.","1":"Sind teavitatakse, kui keegi Sinu @name mainib või Sulle vastab.","0_7":"Eirad kõiki teavitusi selles liigis.","0_2":"Eirad kõiki teavitusi selle teema kohta.","0":"Eirad kõiki teavitusi selles liigis."},"watching_pm":{"title":"Vaatleb","description":"Saad teavituse iga uue vastuse kohta sellele sõnumile koos uute vastuste koguarvu näitamisega."},"watching":{"title":"Vaatleb","description":"Saad teavituse iga uue vastuse kohta selles teemas koos uute vastuste koguarvu näitamisega."},"tracking_pm":{"title":"Jälgib","description":"Selle sõnumi kohta näidatakse uute vastuste koguarvu. Saad teavituse kui keegi Sinu @name mainib või Sulle vastab."},"tracking":{"title":"Jälgib","description":"Selle teema kohta näidatakse uute vastuste koguarvu. Saad teavituse kui keegi Sinu @name mainib või Sulle vastab."},"regular":{"title":"Normaalne","description":"Teid teavitatakse, kui keegi Sinu @name mainib või Sulle vastab."},"regular_pm":{"title":"Normaalne","description":"Sind teavitatakse, kui keegi Sinu @name mainib või Sulle vastab."},"muted_pm":{"title":"Vaigistatud","description":"Sind ei teavitata selle sõnumi kohta mitte kunagi."},"muted":{"title":"Vaigistatud","description":"Sind ei teavitata selle teema kohta mitte kunagi ning see ei ilmu ka värskete teemade alla."}},"actions":{"recover":"Taasta teema kustutamisest","delete":"Kustuta teema","open":"Ava teema","close":"Sulge teema","multi_select":"Vali postitused...","auto_close":"Sulge automaatselt...","pin":"Tõsta teema esile...","unpin":"Eemalda teema esiletõstmine...","unarchive":"Taasta teema arhiivist","archive":"Arhiveeri teema","invisible":"Ära avalda teemade nimekirjas","visible":"Avalda teemade nimekirjas","reset_read":"Nulli andmed teema lugemise kohta","make_public":"Loo avalik teema","make_private":"Loo privaatsõnum"},"feature":{"pin":"Tõsta teema esile","unpin":"Eemalda teema esiletõstmine","pin_globally":"Tõsta teema esile igal pool","make_banner":"Tee teema bänneriks","remove_banner":"Eemalda teema bännerist"},"reply":{"title":"Vasta","help":"alusta selle teema vastuse koostamist"},"clear_pin":{"title":"Kustuta esiletõstmine","help":"Eemalda sellelt teemalt esiletõstetu staatus nii, et ta enam ei ilmuks teemade loetelu tipus"},"share":{"title":"Jaga","help":"jaga viidet sellele teemale"},"flag_topic":{"title":"Tähista","help":"tähista see teema privaatselt meelespidamiseks või saada selle kohta privaatsõnum","success_message":"Tähistasid selle teema edukalt."},"feature_topic":{"title":"Kajasta seda teemat","pin":"Lisa see teema liigi {{categoryLink}} tippu kuni","confirm_pin":"Sul on juba {{count}} esiletõstetud teemat. Liiga palju esiletõstetud teemasid võib olla uutele või anonüümsetele kasutajatele koormav. Kas soovid kindlasti selles liigis veel ühe teema esile tõsta?","unpin":"Eemalda see teema liigi {{categoryLink}} tipust.","unpin_until":"Eemalda see teema liigi {{categoryLink}} tipust või oota kuni \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Kasutajad saavad teema esiletõstmise enda jaoks individuaalselt eemaldada.","pin_validation":"Selle teema esiletõstmiseks on kuupäev nõutav.","not_pinned":"Liigis {{categoryLink}} ei ole ühtegi esiletõstetud teemat.","already_pinned":{"one":"Liigis {{categoryLink}} hetkel kinnitatud teemad: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Liigis {{categoryLink}} hetkel esiletõstetud teemad: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Lisa see teema kõikide teemaloetelude tippu kuni","confirm_pin_globally":"Sul on juba {{count}} igal pool esiletõstetud teemat. Liiga palju esiletõstetud teemasid võib olla uutele või anonüümsetele kasutajatele koormav. Kas soovid kindlasti selles liigis veel ühe teema igal pool esile tõsta?","unpin_globally":"Eemalda see teema kõikide teemaloetelude tipust.","unpin_globally_until":"Eemalda see teema kõikide teemaloetelude tipust või oota kuni \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Kasutajad saavad teema esiletõstmise enda jaoks individuaalselt eemaldada.","not_pinned_globally":"Ühtegi igal pool esiletõstetud teemat pole.","already_pinned_globally":{"one":"Hetkel globaalselt kinnitatud teemad: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Igal pool esiletõstetud teemad hetkel: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Tee sellest teemast bänner mis on nähtav iga lehe päises.","remove_banner":"Eemalda bänner kõikide lehtede päistest.","banner_note":"Kasutajad saavad bänneri peita sulgemise teel. Korraga võib bänneriks olla ainult üks teema.","no_banner_exists":"Bänner-teemat ei ole.","banner_exists":"Hetkel \u003cstrong class='badge badge-notification unread'\u003eon\u003c/strong\u003e üks bänner-teema."},"inviting":"Kutsun...","automatically_add_to_groups":"See kutse annab juurdepääsu ka gruppidele:","invite_private":{"title":"Kutsu sõnumisse","email_or_username":"Kutsutava meiliaadress või kasutajanimi","email_or_username_placeholder":"meiliaadress või kasutajanimi","action":"Kutsu","success":"Oleme kutsunud selle kasutaja sõnumis osalema.","success_group":"Oleme kutsunud selle grupi sõnumis osalema.","error":"Kahjuks tekkis selle kasutaja kutsumisel üks tõrge.","group_name":"grupi nimi"},"controls":"Teema juhtpult","invite_reply":{"title":"Kutsu","username_placeholder":"kasutajanimi","action":"Saada kutse","help":"kutsu teisi siia teemasse meili või teavitustega","to_forum":"Saadame su sõbrale lühikese meili koos viitega, mis lubab tal teemaga ühe klikiga liituda, sisselogimist nõudmata.","sso_enabled":"Sisesta selle isiku kasutajanimi, keda soovid siia teemasse kutsuda.","to_topic_blank":"Sisesta selle isiku kasutajanimi või meiliaadress, keda soovid siia teemasse kutsuda.","to_topic_email":"Sisestasid meiliaadressi. Saadame su sõbrale kutse, mis lubab tal kohe sellesse teemasse vastata.","to_topic_username":"Sisestasid kasutajanime. Saadame su sõbrale kutse, mis lubab tal viivitamatult sellesse teemasse vastata.","to_username":"Sisesta selle isiku kasutajanimi, keda soovid kutsuda. Saadame talle teavituse koos viitega, mis sisaldab kutset siia teemasse.","email_placeholder":"nimi@kuskil.ee","success_email":"Saatsime kutse kasutajale \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Teatame sulle, kui kutse on aktsepteeritud. Vaata kutsete sakki sinu saadetud kutsete osas ülevaate saamiseks.","success_username":"Oleme kutsunud selle kasutaja teemas osalema.","error":"Vabanda, meil ei õnnestunud seda kasutajat kutsuda. Kas on võimalik et ta on juba kutsutud? (Kutsete saatmise sagedus on piiratud)"},"login_reply":"Vastamiseks logi sisse","filters":{"n_posts":{"one":"1 postitus","other":"{{count}} postitust"},"cancel":"Eemalda filter"},"split_topic":{"title":"Liiguta uue teema alla","action":"liiguta uue teema alla","topic_name":"Uue teema nimi","error":"Postituste uude teemasse liigutamisel tekkis viga.","instructions":{"one":"Oled loomas uut teemat ja lisamas sinna just valitud postitust.","other":"Oled loomas uut teemat ja lisamas sinna valitud \u003cb\u003e{{count}}\u003c/b\u003e postitust."}},"merge_topic":{"title":"Liiguta olemasolevasse teemasse","action":"liiguta olemasolevasse teemasse","error":"Postituste sellesse teemasse liigutamisel tekkis viga.","instructions":{"one":"Vali teema, kuhu soovid selle postituse liigutada.","other":"Vali teema, kuhu soovid need \u003cb\u003e{{count}}\u003c/b\u003e postitust liigutada."}},"merge_posts":{"title":"Ühenda valitud postitused","action":"ühenda valitud postitused","error":"Valitud postituste ühendamisel tekkis viga."},"change_owner":{"title":"Muuda postituste omanikku","action":"muuda omanikku","error":"Postituste omanikuvahetusel tekkis viga.","label":"Postituste uus omanik","placeholder":"uue omaniku kasutajanimi","instructions":{"one":"Palun vali \u003cb\u003e{{old_user}}\u003c/b\u003e postitusele uus omanik.","other":"Palun vali \u003cb\u003e{{old_user}}\u003c/b\u003e {{count}} postitusele uus omanik."},"instructions_warn":"Pane tähele, et ühtegi teavitust selle postituse kohta ei kanta uuele kasutajale üle tagasiulatuvalt.\u003cbr\u003eHoiatus: Hetkel ei kanta uuele kasutajale üle mingeid postitustest sõltuvaid andmeid. Kasuta ettevaatlikult."},"change_timestamp":{"title":"Muuda ajatemplit","action":"muuda ajatemplit","invalid_timestamp":"Ajatempel ei saa olla tulevikus.","error":"Teema ajatempli muutmisel tekkis viga.","instructions":"Palun vali teemale uus ajatempel. Teema postituste ajad nihkuvad sama ajavahe võrra."},"multi_select":{"select":"vali","selected":"valitud ({{count}})","select_replies":"vali +vastused","delete":"kustuta valitud","cancel":"tühista valimine","select_all":"vali kõik","deselect_all":"eemalda valik kõigilt","description":{"one":"Oled valinud \u003cb\u003e1\u003c/b\u003e postituse.","other":"Oled valinud \u003cb\u003e{{count}}\u003c/b\u003e postitust."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"tsitaadiga vastus","edit":"Redigeerin {{link}} {{replyAvatar}} {{username}}","edit_reason":"Põhjus:","post_number":"postitus {{number}}","last_edited_on":"postitus viimati muudetud","reply_as_new_topic":"Vasta viitega teemale","continue_discussion":"Jätkates vestlust viitelt {{postLink}}:","follow_quote":"mine tsiteeritud postituse juurde","show_full":"Näita kogu postitust","show_hidden":"Vaata peidetud vastust","deleted_by_author":{"one":"(autori poolt tagasivõetud postitus kustutatakse automaatselt %{count} tunni pärast, kui ei ole tähistatud)","other":"(autori poolt tagasivõetud postitus kustutatakse automaatselt %{count} tunni pärast, kui ei ole tähistatud)"},"expand_collapse":"laienda/ahenda","gap":{"one":"vaata 1 peidetud vastust","other":"vaata {{count}} peidetud vastust"},"unread":"Postitus on lugemata","has_replies":{"one":"{{count}} vastus","other":"{{count}} vastust"},"has_likes":{"one":"{{count}} meeldimine","other":"{{count}} meeldimist"},"has_likes_title":{"one":"Ühele meeldis see postitus","other":"{{count}}-le meeldis see postitus"},"has_likes_title_only_you":"Sulle see postitus meeldis","has_likes_title_you":{"one":"Sulle ja veel ühele inimesele see postitus meeldis","other":"Sulle ja veel {{count}} inimesele see postitus meeldis"},"errors":{"create":"Vabandame, postituse loomisel tekkis viga. Palun proovi uuesti.","edit":"Vabandame, postituse redigeerimisel tekkis viga. Palun proovi uuesti.","upload":"Vabandame, selle faili üleslaadimisel tekkis viga. Palun proovi uuesti.","file_too_large":"Vabandame. see fail on liiga suur (maksimum on {{max_size_kb}}kB). Miks mitte laadida see suur fail mõnda failijagamisteenusesse pilves ja jagada viidet selleni?","too_many_uploads":"Vabandame, faile saab üles laadida vaid ühekaupa.","too_many_dragged_and_dropped_files":"Vabandame, faile saab üles laadida vaid kuni 10 korraga.","upload_not_authorized":"Vabandame, faili tüüp, mida püüad üles laadida, ei ole lubatud (lubatud laiendid: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Vabandame, uued kasutajad ei saa pilte üles laadida.","attachment_upload_not_allowed_for_new_user":"Vabandame, uued kasutajad ei saa manuseid üles laadida.","attachment_download_requires_login":"Vabandame, manuste allalaadimiseks pead olema sisse logitud."},"abandon":{"confirm":"Oled kindel, et soovid oma postituse hüljata?","no_value":"Ei, säilita","yes_value":"Jah, hülga"},"via_email":"see postitus saabus meili teel","via_auto_generated_email":"see postitus saabus automaatselt genereeritud meili teel","whisper":"see postitus on vaikne sosin moderaatoritele","wiki":{"about":"see postitus on wiki"},"archetypes":{"save":"Salvesta suvandid"},"few_likes_left":"Aitäh poolehoiu jagamise eest! Tänaseks on vaid mõned meeldimised jäänud jagada.","controls":{"reply":"alusta sellele postitusele vastuse koostamist","like":"lisa sellele postitusele \"meeldib\"","has_liked":"oled sellele postitusele oma meeldimise andnud","undo_like":"tühista meeldimise andmine","edit":"muuda seda postitust","edit_anonymous":"Vabandame, kuid selle postituse muutmiseks pead olema sisse logitud.","flag":"tähista see postitus privaatselt kui tähelepanu vajav või saada selle kohta privaatne teavitus","delete":"kustuta see postitus","undelete":"ennista see postitus","share":"jaga viidet sellele postitusele","more":"Veel","delete_replies":{"confirm":{"one":"Kas soovid ühtlasi kustutada vahetu vastuse sellele postitusele?","other":"Kas soovid ühtlasi kustutada {{count}} vahetut vastust sellele postitusele?"},"yes_value":"Jah, kustuta ka vastused","no_value":"Ei, ainult see postitus"},"admin":"postituse administreerimise tegevused","wiki":"Loo Wiki","unwiki":"Eemalda Wiki","convert_to_moderator":"Lisa meeskonna värv","revert_to_regular":"Eemalda meeskonna värv","rebake":"Rekonstrueeri HTML","unhide":"Too nähtavale","change_owner":"Omanikuvahetus"},"actions":{"flag":"Tähis","defer_flags":{"one":"Lükka tähis edasi","other":"Lükka tähised edasi"},"undo":{"off_topic":"Tühista tähise andmine","spam":"Tühista tähise andmine","inappropriate":"Tühista tähise andmine","bookmark":"Tühista järjehoidja lisamine","like":"Tühista meeldimise andmine","vote":"Tühista hääle andmine"},"people":{"off_topic":"tähistasin selle kui teemavälise","spam":"tähistasin selle kui spämmi","inappropriate":"tähistasin selle kui sobimatu","notify_moderators":"teavitasin moderaatoreid","notify_user":"saatsin sõnumi","bookmark":"lisasin sellele järjehoidja","like":"meeldis see","vote":"hääletasin selle poolt"},"by_you":{"off_topic":"Tähistasid selle kui teemavälise","spam":"Tähistasid selle kui spämmi","inappropriate":"Tähistasid selle kui sobimatu","notify_moderators":"Tähistasid selle modereerimiseks","notify_user":"Saatsid sellele kasutajale sõnumi","bookmark":"Lisasid sellele postitusele järjehoidja","like":"Märkisid selle kui meeldiva","vote":"Hääletasid selle postituse poolt"},"by_you_and_others":{"off_topic":{"one":"Sina ja 1 teine kasutaja tähistasite selle kui teemavälise","other":"Sina ja {{count}} teist kasutajat tähistasite selle kui teemavälise"},"spam":{"one":"Sina ja 1 teine kasutaja tähistasite selle kui spämmi","other":"Sina ja {{count}} teist kasutajat tähistasite selle kui spämmi"},"inappropriate":{"one":"Sina ja 1 teine kasutaja tähistasite selle kui sobimatu","other":"Sina ja {{count}} teist kasutajat tähistasite selle kui sobimatu"},"notify_moderators":{"one":"Sina ja 1 teine kasutaja tähistasite selle modereerimiseks","other":"Sina ja {{count}} teist kasutajat tähistasite selle modereerimiseks"},"notify_user":{"one":"Sina ja 1 teine kasutaja saatsite sellele kasutajale sõnumi","other":"Sina ja {{count}} teist kasutajat saatsite sellele kasutajale sõnumi"},"bookmark":{"one":"Sina ja 1 teine kasutaja lisasite sellele postitusele järjehoidja","other":"Sina ja {{count}} teist kasutajat lisasite sellele postitusele järjehoidja"},"like":{"one":"Sina ja 1 teine kasutaja märkisite selle kui meeldiva","other":"Sina ja {{count}} teist kasutajat märkisite selle kui meeldiva"},"vote":{"one":"Sina ja 1 teine kasutaja hääletasite selle postituse poolt","other":"Sina ja {{count}} teist kasutajat hääletasite selle postituse poolt"}},"by_others":{"off_topic":{"one":"1 kasutaja tähistas selle kui teemavälise","other":"{{count}} kasutajat tähistasid selle kui teemavälise"},"spam":{"one":"1 kasutaja tähistas selle kui spämmi","other":"{{count}} kasutajat tähistas selle kui spämmi"},"inappropriate":{"one":"1 kasutaja tähistas selle kui sobimatu","other":"{{count}} kasutajat tähistas selle kui sobimatu"},"notify_moderators":{"one":"1 kasutaja tähistas selle modereerimiseks","other":"{{count}} kasutajat tähistasid selle modereerimiseks"},"notify_user":{"one":"1 kasutaja saatis sellele kasutajale sõnumi","other":"{{count}} kasutajat saatsid sellele kasutajale sõnumi"},"bookmark":{"one":"1 kasutaja lisas sellele postitusele järjehoidja","other":"{{count}} kasutajat lisasid sellele postitusele järjehoidja"},"like":{"one":"ühele see meeldis","other":"{{count}}-le see meeldis"},"vote":{"one":"1 kasutaja hääletas selle postituse poolt","other":"{{count}} kasutajat hääletasid selle postituse poolt"}}},"delete":{"confirm":{"one":"Oled kindel, et soovid selle postituse kustutada?","other":"Oled kindel, et soovid kõik need postitused kustutada?"}},"merge":{"confirm":{"one":"Oled kindel, et soovid need postitused ühendada?","other":"Oled kindel, et soovid need {{count}} postitust ühendada?"}},"revisions":{"controls":{"first":"Esimene redaktsioon","previous":"Eelmine redaktsioon","next":"Järgmine redaktsioon","last":"Viimane redaktsioon","hide":"Peida redaktsioon","show":"Näita redaktsiooni","revert":"Ennista selleks redaktsiooniks","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Näita renderdatud väljundit koos lisamiste ja eemaldamistega tekstisiseselt","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Näita renderdatud väljundi erinevusi kõrvuti","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Näita töötlemata lähteandmete erinevusi kõrvuti","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Toores"}}}},"category":{"can":"saab\u0026hellip; ","none":"(liik puudub)","all":"Kõik liigid","choose":"Vali liik\u0026hellip;","edit":"muuda","edit_long":"Muuda","view":"Vaata teemasid liigis","general":"Üldine","settings":"Sätted","topic_template":"Teema mall","tags":"Sildid","tags_allowed_tags":"Sildid, mida saab kasutada vaid selles foorumis:","tags_allowed_tag_groups":"Siltide grupid, mida saab kasutada vaid selles foorumis:","tags_placeholder":"(Valikuline) loetelu lubatud silte","tag_groups_placeholder":"(Valikuline) loetelu lubatud siltide gruppe","delete":"Kustuta liik","create":"Uus liik","create_long":"Loo uus liik","save":"Salvesta liik","slug":"Liigi toorik","slug_placeholder":"(Valikulised) sidekriipsuga-sõnad url-i jaoks","creation_error":"Liigi loomisel tekkis viga.","save_error":"Liigi salvestamisel tekkis viga.","name":"Liigi nimetus","description":"Kirjeldus","topic":"liigi teema","logo":"Liigi logo","background_image":"Liigi taustapilt","badge_colors":"Märgise värvid","background_color":"Tausta värv","foreground_color":"Esiplaani värv","name_placeholder":"Maksimaalselt üks või kaks sõna","color_placeholder":"Mistahes veebi-sobiv värv","delete_confirm":"Oled kindel, et soovid seda liiki kustutada?","delete_error":"Liigi kustutamisel tekkis viga.","list":"Loetle liigid","no_description":"Palun lisa sellele liigile kirjeldus.","change_in_category_topic":"Muuda kirjeldust","already_used":"Teine liik juba kasutab seda värvi","security":"Turve","special_warning":"Hoiatus: See on eelseadistatud liik mille turvasätteid muuta ei saa. Kui Sa seda liiki kasutada ei soovi, kustuta see ümberkohandamise asemel.","images":"Pildid","auto_close_label":"Sulge teema automaatselt peale:","auto_close_units":"tundi","email_in":"Sissetuleva meili individuaalne aadress:","email_in_allow_strangers":"Aktsepteeri meile kontota anonüümsetelt kasutajatelt","email_in_disabled":"Uute teemade avamine meili teel on saidi sätetes välja lülitatud. Avamiseks","email_in_disabled_click":"aktiveeri säte \"sissetulev meil\".","suppress_from_homepage":"Eemalda see liik avalehelt.","allow_badges_label":"Luba selles liigis autasustamist märgistega","edit_permissions":"Muuda kasutusõigusi","add_permission":"Lisa kasutusõigus","this_year":"sel aastal","position":"positsioon","default_position":"Vaikepositsioon","position_disabled":"Liigid kuvatakse aktiivsuse järjekorras. Liikide järjestuse seadistamiseks loeteludes","position_disabled_click":"aktiveeri säte \"liikide positsioonid fikseeritud\".","parent":"Ülemliik","notifications":{"watching":{"title":"Vaatleb","description":"Sa vaatled nendes foorumites kõiki teemasid automaatselt. Sind teavitatakse igast uuest postitusest igas teemas. Ühtlasi kuvatakse uute vastuste arv."},"watching_first_post":{"title":"Vaatan esimest postitust","description":"Sind teavitatakse vaid esimesest postitusest igas uues teemas nendes foorumites."},"tracking":{"title":"Jälgib","description":"Sa vaatled kõiki nende foorumite teemasid automaatselt. Sind teavitatakse, kui keegi sinu @name mainib või sulle vastab. Ühtlasi kuvatakse uute vastuste arv."},"regular":{"title":"Normaalne","description":"Sind teavitatakse, kui keegi Sinu @name mainib või Sulle vastab."},"muted":{"title":"Vaigistatud","description":"Sind ei teavitata ühestki uuest teemast nendes liikides, samuti ei ilmu nad viimaste teemade alla."}}},"flagging":{"title":"Täname, et aitad meie kogukonna viisakust säilitada!","action":"Tähista postitus","take_action":"Tegutse","notify_action":"Sõnum","official_warning":"Ametlik hoiatus","delete_spammer":"Kustuta spämmija","yes_delete_spammer":"Jah, kustuta spämmija","ip_address_missing":"(asjassepuutumatu)","hidden_email_address":"(peidetud)","submit_tooltip":"Saada privaatne tähis","take_action_tooltip":"Liigu kohe tähise künniseni, ilma kogukonnalt täiendavaid tähiseid ootamata","cant":"Vabandame, seda postitust ei saa praegu tähistada.","notify_staff":"Hoiata meeskonda privaatselt","formatted_name":{"off_topic":"See on teemaväline","inappropriate":"See on sobimatu","spam":"See on spämm"},"custom_placeholder_notify_user":"Ole täpne, konstruktiivne ja alati lahke.","custom_placeholder_notify_moderators":"Anna meile teada, mis Sulle täpsemalt muret teeb ja võimalusel lisa asjassepuutuvaid viiteid ning näiteid."},"flagging_topic":{"title":"Täname, et aitad meie kogukonna viisakust säilitada!","action":"Tähista teema","notify_action":"Sõnum"},"topic_map":{"title":"Teema kokkuvõte","participants_title":"Sagedased postitajad","links_title":"Populaarsed viited","links_shown":"kuva veel viiteid...","clicks":{"one":"1 klikk","other":"%{count} klikki"}},"post_links":{"about":"laienda veel selles postuses olevaid viiteid","title":{"one":"1 veel","other":"%{count} veel"}},"topic_statuses":{"warning":{"help":"See on ametlik hoiatus."},"bookmarked":{"help":"Lisasid sellele teemale järjehoidja"},"locked":{"help":"See teema on suletud; uusi vastuseid lisada enam ei saa"},"archived":{"help":"See teema on arhiveeritud; kõik muudatused on külmutatud"},"locked_and_archived":{"help":"See teema on suletud ja arhiveeritud; uusi vastuseid lisada ja muudatusi teha enam ei saa"},"unpinned":{"title":"Esiletõstmine eemaldatud","help":"Oled selle teema esiletõstmise eemaldanud; kuvatakse Sulle tavalises järjestuses"},"pinned_globally":{"title":"Globaalselt esiletõstetud","help":"See teema on globaalselt esiletõstetud; kuvatakse nii uusimate kui oma liigi esimeste seas"},"pinned":{"title":"Esiletõstetud","help":"OIed selle teema on esile tõstnud; kuvatakse Sulle oma liigi esimeste seas"},"invisible":{"help":"See teema on salastatud; teda ei kuvata teemade loendites ning on kättesaadav vaid otseviite kaudu"}},"posts":"Postitused","posts_long":"selles teemas on {{number}} postitust","original_post":"Algne postitus","views":"Vaatamisi","views_lowercase":{"one":"vaatamine","other":"vaatamisi"},"replies":"Vastuseid","views_long":"seda teemat on vaadatud {{number}} korda","activity":"Aktiivsus","likes":"Meeldimisi","likes_lowercase":{"one":"meeldimine","other":"meeldimisi"},"likes_long":"selles teemas on {{number}} meeldimist","users":"Kasutajad","users_lowercase":{"one":"kasutaja","other":"kasutajad"},"category_title":"Liik","history":"Ajalugu","changed_by":"autor {{author}}","raw_email":{"title":"Täätlemata meil","not_available":"Pole saadaval!"},"categories_list":"Liikide loend","filters":{"with_topics":"%{filter} teemat","with_category":"%{filter} %{category} teemat","latest":{"title":"Värskeimad","title_with_count":{"one":"Värskeim (1)","other":"Värskeimad ({{count}})"},"help":"teemad hiljutiste postitustega"},"hot":{"title":"Kuum","help":"valik kuumimaid teemasid"},"read":{"title":"Loetud","help":"loetud teemad, viimase lugemise järjekorras"},"search":{"title":"Otsi","help":"otsi kõigist teemadest"},"categories":{"title":"Liigid","title_in":"Liik - {{categoryName}}","help":"kõik teemad liikide järgi rühmitatuna"},"unread":{"title":"Lugemata","title_with_count":{"one":"Lugemata (1)","other":"Lugemata ({{count}})"},"help":"teemad, mida vaatled või jälgid koos lugemata postitustega","lower_title_with_count":{"one":"1 lugemata","other":"{{count}} lugemata"}},"new":{"lower_title_with_count":{"one":"1 uus","other":"{{count}} uut"},"lower_title":"uus","title":"Uus","title_with_count":{"one":"Uus (1)","other":"Uusi ({{count}})"},"help":"viimase paari päeva jooksul loodud teemad"},"posted":{"title":"Minu postitused","help":"minu postitustega teemad"},"bookmarks":{"title":"Järjehoidjad","help":"järjehoidjatega teemad"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"värskeimad teemad liigis {{categoryName}}"},"top":{"title":"Juhtivad","help":"aktiivseimad teemad viimase aasta, kuu, nädala või päeva sees","all":{"title":"Alates algusest"},"yearly":{"title":"Iga-aastaselt"},"quarterly":{"title":"Kvartaalselt"},"monthly":{"title":"Igakuiselt"},"weekly":{"title":"Iganädalaselt"},"daily":{"title":"Igapäevaselt"},"all_time":"Alates algusest","this_year":"Aasta","this_quarter":"Kvartal","this_month":"Kuu","this_week":"Nädal","today":"Täna","other_periods":"vaata juhtivaid"}},"browser_update":"Kahjuks on \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eSinu brauser selle saidi kasutamiseks liiga vana\u003c/a\u003e. Palun \u003ca href=\"http://browsehappy.com\"\u003evärskenda oma brauserit\u003c/a\u003e.","permission_types":{"full":"Loo / Vasta / Vaata","create_post":"Vasta / Vaata","readonly":"Vaata"},"lightbox":{"download":"lae alla"},"search_help":{"title":"Otsi spikrist"},"keyboard_shortcuts_help":{"title":"Klaviatuuri kiirvalikud","jump_to":{"title":"Hüppa","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Avaleht","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Viimased","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Uued","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Lugemata","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Foorumid","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Parimad","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Järjehoidjad","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profiil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Sõnumid"},"navigation":{"title":"Navigatsioon","jump":"\u003cb\u003e#\u003c/b\u003e Mine postitusse #","back":"\u003cb\u003eu\u003c/b\u003e Tagasi","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Liiguta valitut \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Ava valitud teema","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Järgmine/eelmine sektsioon"},"application":{"title":"Rakendus","create":"\u003cb\u003ec\u003c/b\u003e Loo uus teema","notifications":"\u003cb\u003en\u003c/b\u003e Ava teavitused","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Ava rippmenüü","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Ava kasutajamenüü","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Näita uuendatud teemasid","search":"\u003cb\u003e/\u003c/b\u003e Otsi","help":"\u003cb\u003e?\u003c/b\u003e Ava klaviatuuri abimenüü","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Lükka Uued/Postitused tagasi","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Lükka teemad tagasi","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Logi välja"},"actions":{"title":"Tegevused","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Lülita teema järjehoidja sisse/välja\n ","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e  Kinnita/Vabasta teema","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Jaga teemat","share_post":"\u003cb\u003es\u003c/b\u003e Jaga postitust","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Vasta viidates teemale","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Vasta teemale","reply_post":"\u003cb\u003er\u003c/b\u003e Vasta postitusele","quote_post":"\u003cb\u003eq\u003c/b\u003e Tsiteeri postitust","like":"\u003cb\u003el\u003c/b\u003e Märgi postitus meeldivaks","flag":"\u003cb\u003e!\u003c/b\u003e Tähista postitus","bookmark":"\u003cb\u003eb\u003c/b\u003e Pane postitusele järjehoidja","edit":"\u003cb\u003ee\u003c/b\u003e Muuda postitust","delete":"\u003cb\u003ed\u003c/b\u003e Kustuta postitus","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Vaigista teema","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Tavaline (vaikimisi) teema","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Jälgi teemat","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Vaatle teemat"}},"badges":{"earned_n_times":{"one":"Teenis selle märgise 1 kord","other":"Teenis selle märgise %{count} korda"},"granted_on":"Märgistatud %{date}","others_count":"Teised selle märgisega (%{count})","title":"Märgised","allow_title":"saadaval tiitel","multiple_grant":"määratud mitmeid kordi","badge_count":{"one":"1 märgis","other":"%{count} märgist"},"more_badges":{"one":"+1 veel","other":"+%{count} veel"},"granted":{"one":"1 lubatud","other":"%{count} lubatud"},"select_badge_for_title":"Vali märgis, mida kasutada oma pealkirjana","none":"\u003cpole ühtegi\u003e","badge_grouping":{"getting_started":{"name":"Alustamine"},"community":{"name":"Kogukond"},"trust_level":{"name":"Usaldustase"},"other":{"name":"Muu"},"posting":{"name":"Postitan"}}},"google_search":"\u003ch3\u003eOtsi Google abil\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Kõik sildid","selector_all_tags":"kõik sildid","selector_no_tags":"sildid puuduvad","changed":"muudetud sildid:","tags":"Sildid","choose_for_topic":"Vali teemadele valikulised sildid:","delete_tag":"Kustuta silt","delete_confirm":"Oled Sa kindel, et soovid selle sildi kustutada?","rename_tag":"Nimeta silt ümber","rename_instructions":"Vali sildile uus nimi:","sort_by":"Järjesta:","sort_by_count":"üldarv","sort_by_name":"nimi","manage_groups":"Halda siltide gruppe","manage_groups_description":"Määra siltide organiseerimiseks grupid","filters":{"without_category":"%{filter} %{tag} teemat","with_category":"%{filter} %{tag} teemat %{category} foorumis","untagged_without_category":"%{filter} sildistamata teemat","untagged_with_category":"%{filter} sildistamata teemat %{category} foorumis"},"notifications":{"watching":{"title":"Vaatlen","description":"Sa vaatled kõiki selle sildiga teemasid automaatselt. Sind teavitatakse kõigist uutest postitustest ja teemadest, koos lugemata ja uute postituste arvuga teema pealkirja kõrval."},"watching_first_post":{"title":"Vaatan esimest postitust","description":"Sind teavitatakse vaid esimesest postitusest igas uues selle sildiga teemas."},"tracking":{"title":"Jälgin","description":"Sa jälgid kõiki selle sildiga uusi teemasid. Lugemata ja uute postituste arv on näha teema pealkirja kõrval."},"regular":{"title":"Tavaline","description":"Sind teavitatakse, kui keegi Sinu @name mainib või vastab Sinu positusele."},"muted":{"title":"Vaigistatud","description":"Sind ei teavitata ühestki uuest selle sildiga teemast, samuti ei ilmu nad lugemata postituste sakil."}},"groups":{"title":"Siltide grupid","about":"Hõlpsamaks haldamiseks lisa sildid gruppidesse.","new":"Uus grupp","tags_label":"Sildid selles grupis:","parent_tag_label":"Ülemsilt:","parent_tag_placeholder":"Valikuline","parent_tag_description":"Sellesse gruppi kuuluvaid silte ei saa kasutada, kui ülemsilt on puudu.","one_per_topic_label":"Vaid üks selle grupi silt teema kohta","new_name":"Uus siltide grupp","save":"Salvesta","delete":"Kustuta","confirm_delete":"Oled kindel, et soovid selle siltide grupi kustutada?"},"topics":{"none":{"unread":"Sul ei ole lugemata teemasid.","new":"Sul ei ole uusi teemasid.","read":"Sa ei ole veel ühtegi teemat lugenud.","posted":"Sa ei ole veel ühtegi teemasse postitanud.","latest":"Ühtegi värsket teemat pole.","hot":"Ühtegi kuuma teemat pole.","bookmarks":"Sul ei ole veel ühtegi järjehoidjaga teemal.","top":"Ühtegi parimat teemat pole.","search":"Otsing ei andnud tulemusi."},"bottom":{"latest":"Rohkem värskeid teemasid pole.","hot":"Rohkem kuumi teemasid pole.","posted":"Rohkem uute postitustega teemasid pole.","read":"Rohkem loetud teemasid pole.","new":"Rohkem uusi teemasid pole.","unread":"Rohkem lugemata teemasid pole.","top":"Rohkem parimaid teemasid pole.","bookmarks":"Rohkem järjehoidjaga teemasid pole.","search":"Rohkem otsingutulemusi pole."}}},"invite":{"custom_message":"Muuda oma kutse veidi personaalsemaks kirjutades","custom_message_link":"individuaalne sõnum","custom_message_placeholder":"Sisesta oma individuaalne sõnum","custom_message_template_forum":"Kuule, Sa peaksid selle foorumiga liituma!","custom_message_template_topic":"Kuule, arvan et see teema meeldiks Sulle!"},"poll":{"voters":{"one":"hääletaja","other":"hääletajad"},"total_votes":{"one":"häält kokku","other":"hääli kokku"},"average_rating":"Keskmine hinnang: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Antud hääled on avalikud."},"multiple":{"help":{"at_least_min_options":{"one":"Tee vähemalt \u003cstrong\u003e1\u003c/strong\u003e valik","other":"Tee vähemalt \u003cstrong\u003e%{count}\u003c/strong\u003e valikut"},"up_to_max_options":{"one":"Võid teha \u003cstrong\u003e1\u003c/strong\u003e valiku","other":"Võid teha kuni \u003cstrong\u003e%{count}\u003c/strong\u003e valikut"},"x_options":{"one":"Tee \u003cstrong\u003e1\u003c/strong\u003e valik","other":"Tee \u003cstrong\u003e%{count}\u003c/strong\u003e valikut"},"between_min_and_max_options":"Tee \u003cstrong\u003e%{min}\u003c/strong\u003e kuni \u003cstrong\u003e%{max}\u003c/strong\u003e valikut"}},"cast-votes":{"title":"Anna oma hääl","label":"Hääleta nüüd!"},"show-results":{"title":"Kuva hääletuse tulemused","label":"Kuva tulemused"},"hide-results":{"title":"Tagasi sinu vastuse juurde","label":"Peida tulemused"},"open":{"title":"Ava hääletus","label":"Ava","confirm":"Kas sa oled kindel, et soovid selle hääletuse avada?"},"close":{"title":"Sulge hääletus","label":"Sulge","confirm":"Kas sa oled kindel, et sa tahad antud hääletuse sulgeda?"},"error_while_toggling_status":"Kahjuks tekkis postituse staatuse ümberlülitamisel tõrge.","error_while_casting_votes":"Kahjuks tekkis hääletamise käigus tõrge.","error_while_fetching_voters":"Kahjuks tekkis hääletajate näitamise käigus tõrge.","ui_builder":{"title":"Koosta hääletus","insert":"Sisesta hääletus","help":{"options_count":"Sisesta vähemalt 2 valikut"},"poll_type":{"label":"Tüüp","regular":"Üks valik","multiple":"Mitu valikut","number":"Numbriline vastus"},"poll_config":{"max":"Maksimum","min":"Miinumum","step":"Samm"},"poll_public":{"label":"Näita vastajaid"},"poll_options":{"label":"Sisesta üks küsitluse valik rea kohta"}}},"type_to_filter":"filtreerimiseks trüki...","admin":{"title":"Discourse Admin","moderator":"Moderaator","dashboard":{"title":"Armatuurlaud","last_updated":"Armatuurlaud viimati värskendatud:","version":"Versioon","up_to_date":"Oled aja tasemel!","critical_available":"Kriitiline uuendus on saadaval.","updates_available":"Uuendused on saadaval.","please_upgrade":"Palun uuenda!","no_check_performed":"Uuenduste kontrolli pole tehtud. Kontrolli, et sidekiq töötab.","stale_data":"Uuenduste kontrolli pole ammu tehtud. Kontrolli, et sidekiq töötab.","version_check_pending":"Näib, et oled hiljuti uuendanud. Fantastiline!","installed_version":"Paigaldatud","latest_version":"Viimased","problems_found":"Leidsime Sinu Discourse paigalduses mõned probleemid:","last_checked":"Viimati kontrollitud","refresh_problems":"Värskenda","no_problems":"Probleeme ei tuvastatud.","moderators":"Moderaatorid:","admins":"Adminnid:","blocked":"Blokeeritud:","suspended":"Peatatud:","private_messages_short":"Sõnumid","private_messages_title":"Sõnumid","mobile_title":"Mobiil","space_free":"{{size}} vaba","uploads":"üleslaadimisi","backups":"varundusi","traffic_short":"Liiklus","traffic":"Rakenduse veebipäringud","page_views":"API päringuid","page_views_short":"API päringuid","show_traffic_report":"Näita liikluse detailraportit","reports":{"today":"Täna","yesterday":"Eile","last_7_days":"Viimased 7 päeva","last_30_days":"Viimased 30 päeva","all_time":"Alates algusest","7_days_ago":"7 päeva tagasi","30_days_ago":"30 päeva tagasi","all":"Kõik","view_table":"tabel","view_graph":"diagramm","refresh_report":"Värskenda raportit","start_date":"Alguskuupäev","end_date":"Lõpukuupäev","groups":"Kõik grupid"}},"commits":{"latest_changes":"Viimased muudatused: palun värskenda tihti!","by":"autor"},"flags":{"title":"Lipud","old":"Vana","active":"Aktiivne","agree":"Nõustun","agree_title":"Kinnita see tähis kui korrektne ja kehtiv","agree_flag_modal_title":"Nõustun ning...","agree_flag_hide_post":"Nõustun (peida postitus + saada PS)","agree_flag_hide_post_title":"Peida see postitus ja saada kasutajale automaatselt teade soovitusega see üle vaadata","agree_flag_restore_post":"Nõustun (taasta postitus)","agree_flag_restore_post_title":"Taasta see postitus","agree_flag":"Nõustu tähisega","agree_flag_title":"Nõustu tähisega ja ära postitust muuda","defer_flag":"Lükka edasi","defer_flag_title":"Eemalda see tähis: praegu ei ole vaja sekkuda.","delete":"Kustuta","delete_title":"Kustuta postitus, millele see tähis viitab.","delete_post_defer_flag":"Kustuta postitus ja lükka tähis edasi","delete_post_defer_flag_title":"Kustuta postitus; kui on ainus, kustuta teema","delete_post_agree_flag":"Kustuta postitus ja nõustu tähisega","delete_post_agree_flag_title":"Kustuta postitus; kui on ainus, kustuta teema","delete_flag_modal_title":"Kustuta ning...","delete_spammer":"Kustuta spämmija","delete_spammer_title":"Kustuta kasutaja ja kõik tema postitused ja teemad.","disagree_flag_unhide_post":"Ei nõustu (näita postitust)","disagree_flag_unhide_post_title":"Eemalda sellelt postituselt kõik tähised ja tee ta jälle nähtavaks","disagree_flag":"Ei nõustu","disagree_flag_title":"Lükka see tähis tagasi kui mittekorrektne või kehtetu","clear_topic_flags":"Tehtud","clear_topic_flags_title":"Teemat on uuritud a probleemid lahendatud. Tähiste eemaldamiseks kliki \"Valmis\".","more":"(veel vastuseid...)","dispositions":{"agreed":"nõustumisi","disagreed":"mittenõustumisi","deferred":"edasilükkamisi"},"flagged_by":"Tähistatud kasutaja poolt","resolved_by":"Lahendatud kasutaja poolt","took_action":"Reageeris","system":"Süsteem","error":"Miskit läks nihu","reply_message":"Vasta","no_results":"Tähised puuduvad.","topic_flagged":"See \u003cstrong\u003eteema\u003c/strong\u003e on tähistatud.","visit_topic":"Reageerimiseks külasta teemat","was_edited":"Postitust on peale esimest tähist muudetud","previous_flags_count":"Seda postitust on tähistatud juba {{count}} korda.","summary":{"action_type_3":{"one":"teemaväline","other":"teemaväline x{{count}}"},"action_type_4":{"one":"sobimatu","other":"sobimatu x{{count}}"},"action_type_6":{"one":"individuaalne","other":"individuaalne x{{count}}"},"action_type_7":{"one":"individuaalne","other":"individuaalne x{{count}}"},"action_type_8":{"one":"spämm","other":"spämm x{{count}}"}}},"groups":{"primary":"Peamine grupp","no_primary":"(peamine grupp puudub)","title":"Grupid","edit":"Muuda gruppe","refresh":"Värskenda","new":"Uus","selector_placeholder":"sisesta kasutajanimi","name_placeholder":"Grupi nimi, tühikuteta, vastab kasutajanime reeglitele","about":"Siin saad muuta oma grupi liikmelisust ja nimesid","group_members":"Grupi liikmed","delete":"Kustuta","delete_confirm":"Kustutame selle grupi?","delete_failed":"Ei suuda kustutada seda gruppi. Kui see on automaatne grupp, ei saa seda hävitada.","delete_member_confirm":"Eemalda '%{username}' grupist '%{group}'?","delete_owner_confirm":"Eemaldan kasutajalt '%{username}' omaniku õigused?","name":"Nimi","add":"Lisa","add_members":"Lisa liikmeid","custom":"Individuaalne","bulk_complete":"Kasutajad lisati gruppi.","bulk":"Lisa massina gruppi","bulk_paste":"Kleebi kas","bulk_select":"(vali grupp)","automatic":"Automaatne","automatic_membership_email_domains":"Kasutajad, kes registreeruvad meiliaadressiga, mille domeen ühtib täpselt mõnega sellest loetelust, lisatakse siia gruppi automaatselt:","automatic_membership_retroactive":"Olemasolevate registreeritud kasutajate lisamiseks rakenda sama meiliaadressi domeeni reeglit","default_title":"Vaikimisi tiitel kõigile kasutajatele siin grupis","primary_group":"Muuda automaatselt peamiseks grupiks","group_owners":"Omanikud","add_owners":"Lisa omanikke","incoming_email":"Individuaalne sissetuleva meili aadress","incoming_email_placeholder":"sisesta meiliaadress"},"api":{"generate_master":"Genereeri API peavõti","none":"Hetkel aktiivsed API võtmed puuduvad.","user":"Kasutaja","title":"API","key":"API võti","generate":"Genereeri","regenerate":"Genereeri uus","revoke":"Tühista ","confirm_regen":"Oled kindel, et soovid selle API võtme asendada uuega?","confirm_revoke":"Oled kindel, et soovid selle võtme tühistada?","info_html":"See API võti lubab Sul teemasid luua ja uuendada JSON kutsete kaudu.","all_users":"Kõik kasutajad","note_html":"Hoia seda võtit \u003cstrong\u003esalajas\u003c/strong\u003e, iga kasutaja, kes seda omab, võib luua suvalisi postitusi suvalise kasutaja nime alt."},"plugins":{"title":"Plugin","installed":"Paigaldatud pluginad","name":"Nimi","none_installed":"Ühtegi pluginat ei ole paigaldatud.","version":"Versioon","enabled":"Sisse lülitatud?","is_enabled":"J","not_enabled":"E","change_settings":"Muuda sätteid","change_settings_short":"Sätted","howto":"Kuidas pluginaid paigaldada?"},"backups":{"title":"Varukoopiad","menu":{"backups":"Varukoopiad","logs":"Logid"},"none":"Ühtegi varukoopiat pole.","read_only":{"enable":{"title":"Lülita kirjutuskaitstud režiim sisse","label":"Luba kirjutuskaitstud režiim","confirm":"Oled kindel, et soovid kirjutuskaitstud režiimi aktiveerida?"},"disable":{"title":"Lülita kirjutuskaitstud režiim sisse","label":"Keela kirjutuskaitstud režiim"}},"logs":{"none":"Logisid pole veel..."},"columns":{"filename":"Faili nimi","size":"Suurus"},"upload":{"label":"Lae üles","title":"Lae varukoopia üles sellesse instantsi","uploading":"Laen üles...","success":"'{{filename}}' üleslaadimine õnnestus.","error":"Faili '{{filename}}' üleslaadimisel tekkis viga: {{message}}"},"operations":{"is_running":"Toiming on hetkel pooleli...","failed":"Toiming {{operation}} ebaõnnestus. Kontrolli logisid.","cancel":{"label":"Tühista","title":"Tühista antud tegevus","confirm":"Oled Sa kindel, et soovid tühistada antud tegevust?"},"backup":{"label":"Varukoopia","title":"Loo varukoopia","confirm":"Kas Sa soovid alustada uut varukoopiat?","without_uploads":"Jah (ära kaasa faile)"},"download":{"label":"Lae alla","title":"Lae varukoopia alla"},"destroy":{"title":"Eemalda varukoopia","confirm":"Oled kindel, et soovid selle varukoopia hävitada?"},"restore":{"is_disabled":"Taastamine on saidi sätetes välja lülitatud.","label":"Taasta","title":"Taasta varukoopia","confirm":"Oled Sa kindel, et soovid taastada seda varukoopiat?"},"rollback":{"label":"Pööra tagasi","title":"Pööra andmebaas tagasi viimati toiminud olekusse","confirm":"Oled kindel, et soovid andmebaasi tagasi viimati toiminud olekusse pöörata?"}}},"export_csv":{"user_archive_confirm":"Oled kindel, et soovid enda postitused alla laadida?","success":"Eksportimine käivitatud. Protsessi lõppemisel saadetakse Sulle teade.","failed":"Eksportimine ebaõnnestus. Kontrolli logisid.","rate_limit_error":"Postitusi saab alla laadida üks kord ööpäevas. Palun proovi homme uuesti.","button_text":"Ekspordi","button_title":{"user":"Ekspordi täielik kasutajate nimekiri CSV formaadis.","staff_action":"Ekspordi täielik meeskonna tegevuste logi CSV formaadis.","screened_email":"Ekspordi varjestatud meilide täielik loend CSV formaadis.","screened_ip":"Ekspordi varjestatud IP-aadresside täielik loend CSV formaadis.","screened_url":"Ekspordi varjestatud URL-de täielik loend CSV formaadis."}},"export_json":{"button_text":"Ekspordi"},"invite":{"button_text":"Saada kutsed","button_title":"Saada kutsed"},"customize":{"title":"Kohanda","long_title":"Saidi kohandused","css":"CSS","header":"Päis","top":"Ülemine","footer":"Jalus","embedded_css":"Sängitatud CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML, mida lisatakse enne \u003c/head\u003e silti"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML, mida lisatakse enne \u003c/body\u003e silti"},"override_default":"Ära standardset laadilehte kaasa","enabled":"Sisse lülitatud?","preview":"eelvaade","undo_preview":"eemalda eelvaade","rescue_preview":"vaikelaad","explain_preview":"Vaata saiti selle kohandatud laadilehega","explain_undo_preview":"Pöördu tagasi hetkel aktiivse kohandatud laadilehe juurde","explain_rescue_preview":"Vaata saiti vaikimisi laadilehega","save":"Salvesta","new":"Uus","new_style":"Uus stiil","import":"Impordi","import_title":"Vali fail või kleebi tekst","delete":"Kustuta","delete_confirm":"Kustutan selle kohanduse?","about":"Muuda saidi CSS laadilehed ja HTML päised. Alustamiseks lisa kohandus.","color":"Värv","opacity":"Läbipaistvus","copy":"Kopeeri","email_templates":{"title":"Meilimallid","subject":"Teema","multiple_subjects":"Sellel meilimallil on mitu pealkirja.","body":"Sisu","none_selected":"Redigeerimise alustamiseks vali meili mall.","revert":"Loobu muudatustest","revert_confirm":"Oled kindel, et soovid oma muudatustest loobuda?"},"css_html":{"title":"CSS/HTML","long_title":"CSS and HTML modifikatsioonid"},"colors":{"title":"Värvid","long_title":"Värvistikud","about":"Muuda saidil kasutatavaid värve ilma CSS-i kirjutamata. Alustamiseks lisa uus värvistik.","new_name":"Uus värvistik","copy_name_prefix":"Koopia sellest","delete_confirm":"Kustutan selle värvistiku?","undo":"ennista","undo_title":"Ennista selle värvistiku muudatused alates viimasest salvestamisest.","revert":"võta tagasi","revert_title":"Lähtesta see värvus Discourse'i vaikimisi värvistiku omale.","primary":{"name":"primaarne","description":"Enamik tekste, ikoone ja ääri."},"secondary":{"name":"teise astme","description":"Peamine taustavärv ja teksti värv mõnedel nuppudel."},"tertiary":{"name":"kolmanda astme","description":"Viited, mõned nupud, teavitused ja rõhuvärv."},"quaternary":{"name":"neljanda astme","description":"Navigatsiooniviited"},"header_background":{"name":"päise taust","description":"Saidi päise taustavärv."},"header_primary":{"name":"päise primaarne","description":"Tekst ja ikoonid saidi päises."},"highlight":{"name":"esiletõst","description":"Taustavärv esiletõstetud elementidel lehel, nagu postitused ja teemad."},"danger":{"name":"oht","description":"Esiletõstetud tegevuste värv nagu postituste ja teemade kustutamine."},"success":{"name":"edu","description":"Näitab, et tegevus oli edukas."},"love":{"name":"armastus","description":"Meeldimise nupu värvus."}}},"email":{"title":"Meilid","settings":"Sätted","templates":"Mallid","preview_digest":"Saadetise eelvaatlus","sending_test":"Saadan testmeili...","error":"\u003cb\u003eVIGA\u003c/b\u003e - %{server_error}","test_error":"Testmeili saatmisel tekkis viga. Palun kontrolli oma meilisätteid, veendu, et sinu teenusepakkuja ei blokeeri meiliühendusi ja proovi uuesti.","sent":"Saadetud","skipped":"Üle hüpatud","bounced":"Välja visatud","received":"Saadud","rejected":"Tagasi lükatud","sent_at":"Saadetud","time":"Aeg","user":"Kasutaja","email_type":"Meili liik","to_address":"Aadressile","test_email_address":"testitav meiliaadress","send_test":"Saada testmeil","sent_test":"saadetud!","delivery_method":"Kättetoimetamise viis","preview_digest_desc":"Passiivsetele kasutajatele meilitud saadetiste sisu eelvaatlus.","refresh":"Värskenda","format":"Formaat","html":"html","text":"tekst","last_seen_user":"Viimati nähtud kasutaja:","reply_key":"Vastuse võti","skipped_reason":"Ülehüppamise põhjus","incoming_emails":{"from_address":"Kellelt","to_addresses":"Kellele","cc_addresses":"Koopia","subject":"Teema","error":"Viga","none":"Sissetulevaid meile pole.","modal":{"title":"Sissetuleva meili üksikasjad","error":"Viga","headers":"Päised","subject":"Teema","body":"Sisu","rejection_message":"Meil äraütlemise kohta"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Teema...","error_placeholder":"Viga"}},"logs":{"none":"Logid puuduvad.","filters":{"title":"Filter","user_placeholder":"kasutajanimi","address_placeholder":"nimi@domeen.ee","type_placeholder":"ülevaade, registreerimine...","reply_key_placeholder":"vastuse võti","skipped_reason_placeholder":"põhjus"}}},"logs":{"title":"Logid","action":"Tegevus","created_at":"Loodud","last_match_at":"Viimati tabatud","match_count":"Tabamisi","ip_address":"IP","topic_id":"Teema ID","post_id":"Postituse ID","category_id":"Liigi ID","delete":"Kustuta","edit":"Muuda","save":"Salvesta","screened_actions":{"block":"blokeeri","do_nothing":"ära tee midagi"},"staff_actions":{"title":"Tiimi tegevused","instructions":"Kliki kasutajanimedele ja tegevustele nimekirja filtreerimiseks. Kliki profiilipiltidele, et minna kasutajalehtedele.","clear_filters":"Näita kõike","staff_user":"Meeskonnaliige","target_user":"Sihtkasutaja","subject":"Teema","when":"Millal","context":"Kontekst","details":"Detailid","previous_value":"Eelmine","new_value":"Uus","diff":"Erisused","show":"Näita","modal_title":"Detailid","no_previous":"Varasem väärtus puudub.","deleted":"Uus väärtus puudub. Kirje kustutati.","actions":{"delete_user":"kustuta kasutaja","change_trust_level":"muuda usaldustaset","change_username":"muuda kasutajanime","change_site_setting":"muuda saidi sätet","change_site_customization":"muuda saidi kohandusi","delete_site_customization":"kustuta saidi kohandused","change_site_text":"muuda saidi teksti","suspend_user":"peata kasutaja","unsuspend_user":"taasluba kasutaja","grant_badge":"anna märgis","revoke_badge":"eemalda märgis","check_email":"kontrolli postkasti","delete_topic":"kustuta teema","delete_post":"kustuta postitus","impersonate":"kehastu ümber","anonymize_user":"muuda kasutaja anonüümseks","roll_up":"Koonda IP-aadressi blokid kokku","change_category_settings":"muuda liigi sätteid","delete_category":"kustuta liik","create_category":"loo liik","block_user":"blokeeri kasutaja","unblock_user":"vabasta kasutaja blokeeringust","grant_admin":"anna admin-õigus","revoke_admin":"võta admin-õigus ära","grant_moderation":"anna modereerimisõigus","revoke_moderation":"võta modereerimisõigus ära","backup_operation":"varundustoiming","deleted_tag":"kustutatud silt","renamed_tag":"ümbernimetatud silt","revoke_email":"kutsu meil tagasi"}},"screened_emails":{"title":"Varjestatud meilid","description":"Kui keegi üritab uut kontot luua, siis kontrollitakse järgmisi meiliaadresse ja vastavuse korral registreerimine peatatakse või tehakse mõni muu toiming.","email":"Meiliaadress","actions":{"allow":"Luba"}},"screened_urls":{"title":"Varjestatud URL-d","description":"Siin loetletud URL-d esinesid spämmeriteks kuulutatud kasutajate postitustes.","url":"URL","domain":"Domeen"},"screened_ips":{"title":"Varjestatud IP-aadressid","description":"IP-aadressid, mis on vaatlemise all. IP-aadressi lubamiseks kasuta \"Luban\".","delete_confirm":"Oled kindel, et soovid aadressi %{ip_address} jaoks kehtestatud reegli eemaldada?","roll_up_confirm":"Oled kindel, et soovid tavaliselt varjestatud IP-aadressid alamvõrkudesse kokku koondada?","rolled_up_some_subnets":"Bännitud IP-aadrissid edukalt järgmistesse alamvõrkudesse kokku koondatud: %{subnets}.","rolled_up_no_subnet":"Ei ole midagi kokku koondada.","actions":{"block":"Blokeeri","do_nothing":"Luba","allow_admin":"Luba Admin"},"form":{"label":"Uus:","ip_address":"IP-aadress","add":"Lisa","filter":"Otsi"},"roll_up":{"text":"Koonda kokku","title":"Loob uue bännitud alamvõrgu koondsissekande kui on kogunenud vähemalt 'min_ban_entries_for_roll_up' aadressi."}},"logster":{"title":"Vealogid"}},"impersonate":{"title":"Kehasta","help":"Kasuta seda töövahendit kasutajakonto ülevõtmiseks silumise eesmärgil. Tühistamiseks pead välja logima.","not_found":"Seda kasutajat ei leitud.","invalid":"Vabanda, ent Sa ei saa selle kasutajana esineda."},"users":{"title":"Kasutajad","create":"Lisa admin-kasutaja","last_emailed":"Viimati meilitud","not_found":"Vabanda, sellist kasutajanime ei eksisteeri meie süsteemis.","id_not_found":"Vabanda, sellist kasutajatunnust ei eksisteeri meie süsteemis.","active":"Aktiivne","show_emails":"Näita meile","nav":{"new":"Uus","active":"Aktiivne","pending":"Ootel","staff":"Meeskond","suspended":"Peatatud","blocked":"Blokeeritud","suspect":"Kahtlane"},"approved":"Heakskiidetud?","approved_selected":{"one":"kiida heaks kasutaja","other":"kiida heaks ({{count}}) kasutajat"},"reject_selected":{"one":"lükka tagasi kasutaja","other":"lükka tagasi ({{count}}) kasutajat"},"titles":{"active":"Aktiivsed kasutajad","new":"Uued kasutajad","pending":"Kasutajad kontrolli ootel","newuser":"Kasutajad usaldustasemel 0 (Uued kasutajad)","basic":"Kasutajad usaldustasemel 1 (Kasutajad)","member":"Kasutajad usaldustasemel 2 (Liikmed)","regular":"Kasutajad usaldustasemel 3 (Püsiliikmed)","leader":"Kasutajad usaldustasemel 4 (Vedajad)","staff":"Meeskond","admins":"Admin-kasutajad","moderators":"Moderaatorid","blocked":"Blokeeritud kasutajad","suspended":"Peatatud kasutajad","suspect":"Kahtlased kasutajad"},"reject_successful":{"one":"Tagasi lükatud 1 kasutaja.","other":"Edukalt tagasi lükatud %{count} kasutajat."},"reject_failures":{"one":"Ei õnnestunud tagasi lükata 1 kasutaja.","other":"Ei õnnestunud tagasi lükata %{count} kasutajat."},"not_verified":"Ei ole kontrollitud","check_email":{"title":"Näita selle kasutaja meiliaadressi","text":"Näita"}},"user":{"suspend_failed":"Selle kasutaja peatamisel tekkis viga {{error}}","unsuspend_failed":"Selle kasutaja taaslubamisel tekkis viga {{error}}","suspend_duration":"Kauaks see kasutaja peatatakse?","suspend_duration_units":"(päeva)","suspend_reason_label":"Peatamise põhjus? See tekst \u003cb\u003eon nähtav kõigile\u003c/b\u003e selle kasutaja profiililehel, samuti kuvatakse kasutajale, kui ta üritab sisse logida. Tee lühidalt.","suspend_reason":"Põhjus","suspended_by":"Peatati kasutaja poolt","delete_all_posts":"Kustuta kõik postitused","suspend":"Peata","unsuspend":"Taasluba","suspended":"Peatatud?","moderator":"Moderaator?","admin":"Admin?","blocked":"Blokeeritud?","staged":"Ettevalmistamisel?","show_admin_profile":"Admin","edit_title":"Muuda tiitlit","save_title":"Salvesta tiitel","refresh_browsers":"Sunni brauserit värskendama","refresh_browsers_message":"Sõnum saadetud kõigile klientidele!","show_public_profile":"Näita avalikku profiili","impersonate":"Kehasta","ip_lookup":"IP otsimine","log_out":"Logi välja","logged_out":"Kasutaja logiti välja kõigil seadmetel","revoke_admin":"Eemalda admini õigused","grant_admin":"Anna admini õigused","revoke_moderation":"Eemalda modereerimise õigused","grant_moderation":"Anna modereerimise õigused","unblock":"Eemalda blokeering","block":"Blokeeri","reputation":"Maine","permissions":"Õigused","activity":"Tegevused","like_count":"Meeldimisi antud / saadud","last_100_days":"viimase 100 päeva jooksul","private_topics_count":"Privaatsed teemad","posts_read_count":"Positusi loetud","post_count":"Postitusi loodud","topics_entered":"Vaadatud teemasid","flags_given_count":"Omistatud tähised","flags_received_count":"Saadud tähised","warnings_received_count":"Hoiatust saadud","flags_given_received_count":"Antud / saadud tähised","approve":"Kinnita","approved_by":"kiitis heaks","approve_success":"Kasutaja heaks kiidetud ja meil saadetud aktiveerimisjuhistega.","approve_bulk_success":"Edu! Kõik kasutajad on heaks kiidetud ja teavitatud.","time_read":"Lugemise aeg","anonymize":"Anonümiseeri kasutaja","anonymize_confirm":"Oled sa KINDEL, et soovid seda kontot anonümiseerida? See võib muuta kasutajanime ja meiliaadressi ja teha puhtaks kogu kasutajaprofiili.","anonymize_yes":"Jah, anonümiseeri see konto","anonymize_failed":"Viga konto anonümiseerimisel.","delete":"Kustuta kasutaja","delete_forbidden_because_staff":"Admine ja moderaatoreid ei saa kustutada.","delete_posts_forbidden_because_staff":"Ei saa kustutada adminide ja moderaatorite kõiki postitusi.","delete_forbidden":{"one":"Kasutajaid ei saa kustutada, kui neil on postitusi. Kustuta kõik postitused enne kasutaja kustutamist. (Postitusi vanemaid, kui %{count} päev ei saa kustutada.)","other":"Kasutajaid ei saa kustutada, kui neil on postitusi. Kustuta kõik postitused enne kasutaja kustutamist. (Postitusi vanemaid, kui %{count} päeva ei saa kustutada.)"},"cant_delete_all_posts":{"one":"Ei saa kustutada kõiki postitusi. Osa postitusi on vanemad, kui  %{count} päev. (delete_user_max_post_age säte.) ","other":"Ei saa kustutada kõiki postitusi. Osa postitusi on vanemad, kui  %{count} päeva. (delete_user_max_post_age säte.) "},"cant_delete_all_too_many_posts":{"one":"Ei saa kustutada kõiki postitusi, sest kasutajal on rohkem, kui  1 postitus. (delete_all_posts_max)","other":"Ei saa kustutada kõiki postitusi, sest kasutajal on rohkem, kui  %{count} postitust. (delete_all_posts_max)"},"delete_confirm":"Oled Sa KINDEL, et soovid kustutada seda kasutajat? See kustutamine on lõplik!","delete_and_block":"Kustuta ja \u003cb\u003eblokeeri\u003c/b\u003e see meiliaadress ja  IP-aadress","delete_dont_block":"Kustuta vaid","deleted":"See kasutaja kustutati.","delete_failed":"Viga selle kasutaja kustutamisel. Veendu, et kõik postitused on kustutatud enne kasutaja kustutamist.","send_activation_email":"Saada aktiveerimismeil","activation_email_sent":"Aktiveerimismeil saadeti.","send_activation_email_failed":"Viga aktiveerimismeili saatmisel. %{error} ","activate":"Aktiveeri konto","activate_failed":"Viga kasutaja aktiveerimisel.","deactivate_account":"Deaktiveeri konto","deactivate_failed":"Viga kasutaja deaktiveerimisel.","unblock_failed":"Viga kasutaja blokeeringu eemaldamisel.","block_failed":"Viga kasutaja blokeerimisel.","block_confirm":"Oled Sa kindel, et soovid seda kasutajat blokeerida? Kasutaja ei saa peale seda luua ühtegi teemat ega postitust.","block_accept":"Jah, blokeeri see kasutaja","bounce_score":"Väljaviskamiste skoor","reset_bounce_score":{"label":"Lähtesta","title":"Lähtesta väljaviskamiste skoor tagasi 0"},"deactivate_explanation":"Deaktiveeritud kasutaja peab valideerima oma meiliaadressi.","suspended_explanation":"Peatatud kasutaja ei saa sisse logida.","block_explanation":"Blokeeritud kasutaja ei saa postitada ega alustada teemasid.","staged_explanation":"Ettevalmistamisel oleval kasutajal on lubatud postitada ettemääratud teemadesse vaid meili teel.","bounce_score_explanation":{"none":"Sellelt meiliaadressilt pole viimasel ajal tagasipõrgatusi saabunud.","some":"Sellelt meiliaadressilt on viimasel ajal mõned tagasipõrgatused saabunud.","threshold_reached":"Sellelt meiliaadressilt on saabunud liiga palju tagasipõrgatusi."},"trust_level_change_failed":"Viga kasutaja usaldustaseme muutmisel.","suspend_modal_title":"Peata kasutaja","trust_level_2_users":"Kasutajad usaldustasemel 2","trust_level_3_requirements":"Usaldustaseme 3 nõuded","trust_level_locked_tip":"usaldustase on lukustatud, süsteem ei eduta ega alanda kasutajat.","trust_level_unlocked_tip":"usaldustase on lukustamata, süsteem saab kasutajat edutada või alandada.","lock_trust_level":"Lukusta usaldustase","unlock_trust_level":"Eemalda usaldustaseme lukustus","tl3_requirements":{"title":"Usaldustaseme 3 nõuded","value_heading":"Väärtus","requirement_heading":"Nõue","visits":"Külastusi","days":"päeva","topics_replied_to":"Teemasid vastatud","topics_viewed":"Vaadatud teemasid","topics_viewed_all_time":"Teemasid vastatud (kogu aja jooksul)","posts_read":"Positusi loetud","posts_read_all_time":"Postitust loetud (kogu aja jooksul)","flagged_posts":"Tähistatud postitused","flagged_by_users":"Tähistanud kasutajad","likes_given":"Meeldimisi antud","likes_received":"Meeldimisi saadud","likes_received_days":"Meeldimisi saadud: unikaalseid päevi","likes_received_users":"Meeldimisi saadud: unikaalseid kasutajaid","qualifies":"Kvalifitseerub usaldustasemele 3.","does_not_qualify":"Ei kvalifitseeru usaldustasemele 3.","will_be_promoted":"Edutatakse varsti.","will_be_demoted":"Alandatakse varsti.","on_grace_period":"Hetkel edutamisel halastusperiood, madalamale ei viida.","locked_will_not_be_promoted":"Usaldustase lukustatud. Ei edutata kunagi.","locked_will_not_be_demoted":"Usaldustase lukustatud. Ei alandata kunagi."},"sso":{"title":"Single Sign On","external_id":"Väline ID","external_username":"Kasutajanimi","external_name":"Nimi","external_email":"Meiliaadress","external_avatar_url":"Profiili pildi URL"}},"user_fields":{"title":"Kasutajaväljad","help":"Lisa välju, mida kasutajad saavad täita.","create":"Loo kasutajaväli","untitled":"Tiitlita","name":"Välja nimi","type":"Välja tüüp","description":"Välja kirjeldus","save":"Salvesta","edit":"Muuda","delete":"Kustuta","cancel":"Tühista","delete_confirm":"Oled Sa kindel, et soovid kustutada selle kasutajavälja?","options":"Suvandid","required":{"title":"Nõutud registreerumisel?","enabled":"nõutud","disabled":"ei ole nõutud"},"editable":{"title":"Muudetav pärast registreerumist?","enabled":"muudetav","disabled":"ei ole muudetav"},"show_on_profile":{"title":"Näidata avalikul profiilil?","enabled":"näidatav profiilil","disabled":"ei ole näidatav profiilil"},"show_on_user_card":{"title":"Kuva kasutaja profiilil?","enabled":"kuvatud kasutaja profiilil","disabled":"ei kuvata kasutaja profiilil"},"field_types":{"text":"Tekstiväli","confirm":"Kinnitus","dropdown":"Rippmenüü"}},"site_text":{"description":"Võid oma foorumi kõiki tekste muuta. Alustamiseks otsi allolevast:","search":"Otsi teksi, mida soovid muuta","title":"Teksti sisu","edit":"muuda","revert":"Pööra tagasi muudatused","revert_confirm":"Oled Sa kindel, et soovid tagasi pöörata muudatusi?","go_back":"Tagasi otsingusse","recommended":"Soovitame järgnevat teksti oma vajadustele vastavalt kohandada:","show_overriden":"Näita vaid käsitsi muudetuid"},"site_settings":{"show_overriden":"Näita vaid käsitsi muudetuid","title":"Sätted","reset":"lähtesta","none":"mitte ükski","no_results":"Ei leidnud midagi.","clear_filter":"Puhasta","add_url":"lisa URL","add_host":"lisa teenusepakkuja","categories":{"all_results":"Kõik","required":"Nõutud","basic":"Baassätted","users":"Kasutajad","posting":"Postitan","email":"Meiliaadress","files":"Failid","trust":"Usaldustasemed","security":"Turve","onebox":"Onebox","seo":"SEO","spam":"Spämm","rate_limits":"Suhte piirang","developer":"Arendaja","embedding":"Manustamised","legal":"Õiguslik","uncategorized":"Muu","backups":"Varukoopiad","login":"Sisselogimine","plugins":"Pistikprogrammid","user_preferences":"Kasutaja seaded","tags":"Sildid"}},"badges":{"title":"Märgised","new_badge":"Uus märgis","new":"Uus","name":"Nimi","badge":"Märgis","display_name":"Kuvatav nimi","description":"Kirjeldus","long_description":"Pikk kirjeldus","badge_type":"Märgise tüüp","badge_grouping":"Grupp","badge_groupings":{"modal_title":"Märgiste grupeeringud"},"granted_by":"Märgistaja","granted_at":"Märgistuse aeg","reason_help":"(Viide postitusele või teemale)","save":"Salvesta","delete":"Kustuta","delete_confirm":"Oled kindel, et soovid selle märgist kustutada?","revoke":"Tühista ","reason":"Põhjus","expand":"Näita \u0026hellip;","revoke_confirm":"Oled kindel, et soovid seda märgist eemaldada?","edit_badges":"Muuda märgiseid","grant_badge":"Anna märgis","granted_badges":"Antud märgised","grant":"Määra","no_user_badges":"%{name} ei ole saanud veel ühtegi märgist.","no_badges":"Ei ole ühtegi märgist, mida saaks anda.","none_selected":"Vali märgis, et alustada","allow_title":"Luba märgise kasutamist tiitlina","multiple_grant":"Võib olla määratud mitmeid kordi","listable":"Näita märgist avalike märgiste lehel","enabled":"Luba märgis","icon":"Ikoon","image":"Pilt","icon_help":"Kasuta kas Font Awesome klassi või URL-viidet pildile","query":"Märgise päring (SQL)","target_posts":"Päri sihtmärkide postitusi","auto_revoke":"Jooksuta tühistamispäringut igapäevaselt","show_posts":"Näita märgistuste lehel postitust, millega anti märgistus","trigger":"Päästik","trigger_type":{"none":"Uuenda igapäevaselt","post_action":"Kui kasutaja reageerib postitusele","post_revision":"Kui kasutaja muudab postitust või loob postituse","trust_level_change":"Kui kasutaja muudab usaldustaset","user_change":"Kui kasutajat muudetakse või luuakse","post_processed":"Peale postituse toimetamist"},"preview":{"link_text":"Näita eelvaadet antud märgistest","plan_text":"Eelvaatle koos päringukavaga","modal_title":"Märgistuse päringu eelvaade","sql_error_header":"Viga päringuga.","error_help":"Vaata järgnevaid viiteid abiks märgiste päringute tegemisel.","bad_count_warning":{"header":"HOIATUS!","text":"Märgise andmise eksemplare on puudu. See juhtub, kui märgiste päring tagastab olematuid kasutaja või postisuse ID-sid. Sellega võivad hiljem kaasneda ettearvamatud tagajärjed - palun kontrolli oma päringut."},"no_grant_count":"Ei ole märgiseid, mida määrata.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e märgis, mida määrata.","other":"\u003cb\u003e%{count}\u003c/b\u003e märgist, mida määrata."},"sample":"Näidis:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e postitusele %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e postitusele %{link} ajal \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e ajal \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emotikon","help":"Lisa uued emotikonid kõigile kasutamiseks. (PRO-vihje: pukseeri korraga mitu faili)","add":"Lisa uus emotikon","name":"Nimi","image":"Pilt","delete_confirm":"Oled Sa kindel, et soovid kustutada :%{name}: emotikoni?"},"embedding":{"get_started":"Kui Sa soovid lisada Discourse teise veebisaidi sisse ehk sängitada, alusta lisades oma teenusepakkuja","confirm_delete":"Oled Sa kindel, et soovid kustutada selle teenusepakkuja?","sample":"Kasuta järgnevat HTML koodi oma saidil, et luua ja lisada/sängitada discourse teemad oma saidile. Asenda \u003cb\u003eREPLACE_ME\u003c/b\u003e kanoonilise lehe URL-viitega, kuhu Sa seda lisad.","title":"Sängitamine","host":"Lubatud hostid","edit":"muuda","category":"Postita liiki","add_host":"Lisa host","settings":"Sängitamise sätted","feed_settings":"Voo sätted","feed_description":"Oma saidi RSS/ATOM voo ühendamine võib parendada Discourse'i võimet Sinu saidi sisu importida.","crawling_settings":"Ämbliku sätted","crawling_description":"Kui Discourse loob Sinu postitustele teemasid ja RSS/ATOM voogu ei ole, üritab ta sisu Sinu HTML-st välja sõeluda. Mõnikord on sisu eraldamine raskendatud, mistõttu pakume sisu eraldamise hõlbustamiseks võimalust CSS-i reeglid ette anda.","embed_by_username":"Kasutajanimi teema loomiseks","embed_post_limit":"Maksimaalne postituste arv, mida sängitada","embed_username_key_from_feed":"Võti discourse kasutajanime eraldamiseks voost","embed_truncate":"Lühenda sängitatud postitused","embed_whitelist_selector":"CSS valik elementidele, mida lubada sängitamistes","embed_blacklist_selector":"CSS valik elementidele, mida eemaldada sängitamistes","embed_classname_whitelist":"CSS klasside lubatud nimed","feed_polling_enabled":"Impordi postitused RSS/ATOM'i kaudu","feed_polling_url":"URL või RSS/ATOM voog, mida kududa","save":"Salvesta sängitamise sätted"},"permalink":{"title":"Püsiviited","url":"URL","topic_id":"Teema ID","topic_title":"Teema","post_id":"Postituse ID","post_title":"Postitus","category_id":"Liigi ID","category_title":"Liik","external_url":"Väline URL","delete_confirm":"Oled Sa kindel, et soovid seda püsiviidet kustutada?","form":{"label":"Uus","add":"Lisa","filter":"Otsi (URL või väline URL)"}}}}},"en":{"js":{"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'et';
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
//! locale : estonian (et)
//! author : Henry Kehlmann : https://github.com/madhenry
//! improvements : Illimar Tambek : https://github.com/ragulka

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    function processRelativeTime(number, withoutSuffix, key, isFuture) {
        var format = {
            's' : ['mõne sekundi', 'mõni sekund', 'paar sekundit'],
            'm' : ['ühe minuti', 'üks minut'],
            'mm': [number + ' minuti', number + ' minutit'],
            'h' : ['ühe tunni', 'tund aega', 'üks tund'],
            'hh': [number + ' tunni', number + ' tundi'],
            'd' : ['ühe päeva', 'üks päev'],
            'M' : ['kuu aja', 'kuu aega', 'üks kuu'],
            'MM': [number + ' kuu', number + ' kuud'],
            'y' : ['ühe aasta', 'aasta', 'üks aasta'],
            'yy': [number + ' aasta', number + ' aastat']
        };
        if (withoutSuffix) {
            return format[key][2] ? format[key][2] : format[key][1];
        }
        return isFuture ? format[key][0] : format[key][1];
    }

    var et = moment.defineLocale('et', {
        months        : 'jaanuar_veebruar_märts_aprill_mai_juuni_juuli_august_september_oktoober_november_detsember'.split('_'),
        monthsShort   : 'jaan_veebr_märts_apr_mai_juuni_juuli_aug_sept_okt_nov_dets'.split('_'),
        weekdays      : 'pühapäev_esmaspäev_teisipäev_kolmapäev_neljapäev_reede_laupäev'.split('_'),
        weekdaysShort : 'P_E_T_K_N_R_L'.split('_'),
        weekdaysMin   : 'P_E_T_K_N_R_L'.split('_'),
        longDateFormat : {
            LT   : 'H:mm',
            LTS : 'H:mm:ss',
            L    : 'DD.MM.YYYY',
            LL   : 'D. MMMM YYYY',
            LLL  : 'D. MMMM YYYY H:mm',
            LLLL : 'dddd, D. MMMM YYYY H:mm'
        },
        calendar : {
            sameDay  : '[Täna,] LT',
            nextDay  : '[Homme,] LT',
            nextWeek : '[Järgmine] dddd LT',
            lastDay  : '[Eile,] LT',
            lastWeek : '[Eelmine] dddd LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s pärast',
            past   : '%s tagasi',
            s      : processRelativeTime,
            m      : processRelativeTime,
            mm     : processRelativeTime,
            h      : processRelativeTime,
            hh     : processRelativeTime,
            d      : processRelativeTime,
            dd     : '%d päeva',
            M      : processRelativeTime,
            MM     : processRelativeTime,
            y      : processRelativeTime,
            yy     : processRelativeTime
        },
        ordinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return et;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D. MMMM'); };
moment.fn.shortDate = function(){ return this.format('D. MMMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D. MMMM, YYYY hh:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
