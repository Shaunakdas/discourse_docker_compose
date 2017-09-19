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
r += "Este <a href='/unread'>o discuție necitită</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "Sunt <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " discuții necitite</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ro"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "și ";
return r;
},
"false" : function(d){
var r = "";
r += "este ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>o discuție nouă</a>";
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
r += "și ";
return r;
},
"false" : function(d){
var r = "";
r += "sunt ";
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
})() + " discuții noi</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ro"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "răsfoiește alte discuții în ";
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
}};

MessageFormat.locale.ro = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n === 0 || n != 1 && (n % 100) >= 1 &&
      (n % 100) <= 19 && n == Math.floor(n)) {
    return 'few';
  }
  return 'other';
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
I18n.translations = {"ro":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","few":"Bytes","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","long_no_year":"DD MMM HH:mm","long_no_year_no_time":"DD MMM","full_no_year_no_time":"Do MMMM ","long_with_year":"DD MMM YYYY HH:mm","long_with_year_no_time":"DD MMM YYYY","full_with_year_no_time":"Do MMMM YYYY","long_date_with_year":"DD MMM 'YY HH:mm","long_date_without_year":"DD MMM HH:mm","long_date_with_year_without_time":"DD MMM 'YY","long_date_without_year_with_linebreak":"DD MMM\u003cbr/\u003eHH:mm","long_date_with_year_with_linebreak":"DD MMM 'YY\u003cbr/\u003eHH:mm","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","few":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","few":"%{count}s","other":"%{count}s"},"x_minutes":{"one":"1m","few":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"1h","few":"%{count}h","other":"%{count}h"},"x_days":{"one":"1z","few":"%{count}z","other":"%{count}z"},"about_x_years":{"one":"1a","few":"%{count}a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","few":"\u003e %{count}a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","few":"%{count}a","other":"%{count}a"},"date_month":"DD MMMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","few":"%{count} min","other":"%{count} de min"},"x_hours":{"one":"1 oră","few":"%{count} ore","other":"%{count} de ore"},"x_days":{"one":"1 zi","few":"%{count} zile","other":"%{count} de zile"},"date_year":"D MM YYYY"},"medium_with_ago":{"x_minutes":{"one":"acum un min","few":"acum %{count} min","other":"acum %{count} de min"},"x_hours":{"one":"acum o oră","few":"acum %{count} ore","other":"acum %{count} de ore"},"x_days":{"one":"acum o zi","few":"acum %{count} zile","other":"acum %{count} de zile"}},"later":{"x_days":{"one":"După o zi","few":"După %{count} zile","other":"După %{count} de zile"},"x_months":{"one":"O lună mai târziu","few":"%{count} luni mai târziu","other":"%{count} de luni mai târziu"},"x_years":{"one":"După un an","few":"După %{count} ani","other":"După %{count} de ani"}},"previous_month":"Luna anterioară","next_month":"Luna următoare"},"share":{"topic":"distribuie această discuție","post":"distribuie postarea #%{postNumber}","close":"închide","twitter":"distribuie pe Twitter","facebook":"distribuie pe Facebook","google+":"distribuie pe Google+","email":"trimite această adresă pe email"},"action_codes":{"split_topic":"desparte această discuție %{when}","autoclosed":{"enabled":"închis %{when}","disabled":"deschis %{when}"},"closed":{"enabled":"închis %{when}","disabled":"deschis %{when}"},"archived":{"enabled":"arhivat %{when}","disabled":"dezarhivat %{when}"},"pinned":{"enabled":"promovat %{when}","disabled":"nepromovat %{when}"},"pinned_globally":{"enabled":"promovat global %{when}","disabled":"nepromovat %{when}"},"visible":{"enabled":"listat %{when}","disabled":"retras %{when}"}},"topic_admin_menu":"Opțiuni administrare discuție","emails_are_disabled":"Trimiterea de emailuri a fost dezactivată global de către un administrator. Nu vor fi trimise notificări email de nici un fel.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Irlanda)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)"}},"edit":"editează titlul și categoria acestui subiect","not_implemented":"Această funcționalitate nu a fost implementată încă.","no_value":"Nu","yes_value":"Da","generic_error":"A apărut o eroare.","generic_error_with_reason":"A apărut o eroare: %{error}","sign_up":"Înregistrare","log_in":"Autentificare","age":"Vârsta","joined":"Înregistrat","admin_title":"Admin","flags_title":"Semnalare","show_more":"Mai mult","show_help":"Opțiuni","links":"Adrese","links_lowercase":{"one":"adresă","few":"adrese","other":"adrese"},"faq":"Întrebări","guidelines":"Ajutor","privacy_policy":"Politică de confidențialitate","privacy":"Confidențialitate","terms_of_service":"Termenii serviciului","mobile_view":"Ecran pentru mobil","desktop_view":"Ecran pentru desktop","you":"Tu","or":"sau","now":"Adineauri","read_more":"citește mai mult","more":"Mai mult","less":"Mai puțin","never":"Niciodată","every_30_minutes":"La fiecare 30 de minute","every_hour":"La fiecare oră","daily":"Zilnic","weekly":"Săptămânal","every_two_weeks":"Odată la două săptamâni","every_three_days":"la fiecare trei zile","max_of_count":"max din {{count}}","alternation":"sau","character_count":{"one":"Un caracter","few":"{{count}} caractere","other":"{{count}} de caractere"},"suggested_topics":{"title":"Alte discuții","pm_title":"Mesaje sugerate"},"about":{"simple_title":"Despre","title":"Despre %{title}","stats":"Statisticile site-ului","our_admins":"Administratorii","our_moderators":"Moderatorii","stat":{"all_time":"Tot timpul","last_7_days":"Ultimele 7 zile","last_30_days":"Ultimele 30 de zile"},"like_count":"Aprecieri","topic_count":"Subiecte","post_count":"Postări","user_count":"Utilizatori noi","active_user_count":"Utilizatori activi","contact":"Contactează-ne","contact_info":"În cazul în care o problemă critică sau alt aspect urgent afectează site-ul, contactează-ne la %{contact_info}."},"bookmarked":{"title":"Semn de carte","clear_bookmarks":"Șterge semnele de carte","help":{"bookmark":"Click pentru plasare semn de carte pe prima postare a acestei discuții","unbookmark":"Click pentru ștergerea tuturor semnelor de carte din această discuție"}},"bookmarks":{"not_logged_in":"ne pare rău, trebuie să fii autentificat pentru a pune un semn de carte","created":"Ai pus semn de carte pe acest mesaj","not_bookmarked":"Ai citit deja aceast mesaj; fă clic să adaugi semn de carte","last_read":"Acesta este ultimul mesaj citit de tine; fă click să adaugi semn de carte","remove":"Semn de carte înlăturat","confirm_clear":"Ești sigur că dorești să ştergi toate bookmark-urile din acest subiect?"},"topic_count_latest":{"one":"{{count}} subiect nou sau actualizat.","few":"{{count}} subiecte noi sau actualizate.","other":"{{count}} subiecte noi sau actualizate."},"topic_count_unread":{"one":"Un subiect necitit.","few":"{{count}} subiecte necitite.","other":"{{count}} de subiecte necitite."},"topic_count_new":{"one":"Un subiect nou.","few":"{{count}} subiecte noi.","other":"{{count}} de subiecte noi."},"click_to_show":"Click pentru vizualizare.","preview":"vizualizează","cancel":"anulează","save":"Salvează Schimbările","saving":"Se Salvează...","saved":"Salvat!","upload":"Încarcă","uploading":"Încărcare...","uploading_filename":"Se încarcă {{filename}}...","uploaded":"Încărcat!","enable":"Activează","disable":"Dezactivează","undo":"Anulează acțiunea precedentă","revert":"Refacere","failed":"Eșuat","banner":{"close":"Ignoră acest banner.","edit":"Editează acest banner \u003e\u003e"},"choose_topic":{"none_found":"Nu au fost găsite discuții.","title":{"search":"Caută o discuție după nume, url sau id:","placeholder":"Scrie aici titlul discuției"}},"queue":{"topic":"Discuție:","approve":"Aprobare","reject":"Respinge","delete_user":"Şterge utilizatorul","title":"Necesită aprobare","none":"Nu sunt postări de revizuit.","edit":"Editează","cancel":"Anulează","view_pending":"vezi postările în aşteptare","has_pending_posts":{"one":"Această discuție are \u003cb\u003e1\u003c/b\u003e postare în așteptare","few":"Această discuţie are \u003cb\u003e{{count}}\u003c/b\u003e postări în aşteptare.","other":"Această discuţie are \u003cb\u003e{{count}}\u003c/b\u003e de postări în aşteptare."},"confirm":"Salvează Schimbările","delete_prompt":"Ești sigur că vrei să ștergi utilizatorul \u003cb\u003e%{username}\u003c/b\u003e? Vor fi șterse toate postările iar email-ul și IP-ul vor fi blocate.","approval":{"title":"Necesită aprobare","description":"Am primit nouă postare dar trebuie să fie aprobată de un moderator înainte că ea să apară pe site. Va rugăm să aveţi răbdare.","pending_posts":{"one":"Aveţi \u003cstrong\u003e1\u003c/strong\u003e postare în aşteptare.","few":"Aveţi \u003cstrong\u003e{{count}}\u003c/strong\u003e postări în aşteptare.","other":"Aveţi \u003cstrong\u003e{{count}}\u003c/strong\u003e de postări în aşteptare."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a postat \u003ca href='{{topicUrl}}'\u003ediscuția\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDvs.\u003c/a\u003e aţi postat \u003ca href='{{topicUrl}}'\u003ediscuția\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003ea răspuns la\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e a răspuns la \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a răspuns la \u003ca href='{{topicUrl}}'\u003ediscuție\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e a răspuns la \u003ca href='{{topicUrl}}'\u003ediscuție\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e a menționat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e a menționat \u003ca href='{{user2Url}}'\u003eyou\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eYou\u003c/a\u003e a menționat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postat de către \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postat de către \u003ca href='{{userUrl}}'\u003etine\u003c/a\u003e","sent_by_user":"Trimis de către \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Trimis de către \u003ca href='{{userUrl}}'\u003etine\u003c/a\u003e"},"directory":{"filter_name":"filtrează după utilizator","title":"Utilizatori","likes_given":"Oferite","likes_received":"Primite","topics_entered":"Văzute","topics_entered_long":"Subiecte văzute","time_read":"Timp citit","topic_count":"Subiecte","topic_count_long":"Subiecte create","post_count":"Răspunsuri","post_count_long":"Răspunsuri postate","no_results":"Fără rezultat.","days_visited":"Vizite","days_visited_long":"Zile de vizită","posts_read":"Citite","posts_read_long":"Posturi citite","total_rows":{"one":"1 utilizator","few":"%{count} utilizatori","other":"%{count} utilizatori"}},"groups":{"empty":{"mentions":"Nu sunt mențiuni ale acestui grup.","messages":"Nu este nici un mesaj pentru acest grup."},"add":"Adaugă","selector_placeholder":"Adaugă membri","owner":"proprietar","visible":"Grupul este vizibil tuturor utilizatorilor","title":{"one":"grup","few":"grupuri","other":"grupuri"},"members":"Membri","topics":"Discuții","posts":"Postări","mentions":"Mențiuni","messages":"Mesaje","alias_levels":{"nobody":"Nimeni","only_admins":"Doar Adminii","mods_and_admins":"Doar moderatorii și adminii","members_mods_and_admins":"Doar membri grupului, moderatorii și adminii","everyone":"Toată lumea"},"trust_levels":{"none":"Nimic"},"notifications":{"watching":{"title":"Urmărit"},"tracking":{"title":"Urmărit"},"regular":{"title":"Normal","description":"Vei fi notificat dacă cineva îți menționează @numele sau îți va scrie un reply."},"muted":{"title":"Mut"}}},"user_action_groups":{"1":"Aprecieri Date","2":"Aprecieri Primite","3":"Semne de carte","4":"Discuții","5":"Răspunsuri","6":"Răspunsuri","7":"Mențiuni","9":"Citate","11":"Editări","12":"Obiecte Trimise","13":"Primite","14":"În așteptare"},"categories":{"all":"toate categoriile","all_subcategories":"toate","no_subcategory":"niciuna","category":"Categorie","reorder":{"title":"Rearanjeaza Categoriile","title_long":"Rearanjeaza lista de categorii","fix_order":"Pozitii fixe","fix_order_tooltip":"Nu toate categoriile au un numar de pozitie unic, asta poate cauze rezultate neasteptate.","save":"Salveaza ordinea","apply_all":"Aplica","position":"Pozitie"},"posts":"Postări","topics":"Discuții","latest":"Ultimele","latest_by":"recente dupa","toggle_ordering":"Control comandă comutare","subcategories":"Subcategorie","topic_stat_sentence":{"one":"%{count} subiect în %{unit}.","few":"%{count} subiecte noi în %{unit}.","other":"%{count} subiecte noi în %{unit}."}},"ip_lookup":{"title":"Căutare adresă IP","hostname":"Nume gazdă","location":"Locație","location_not_found":"(necunoscut)","organisation":"Organizație","phone":"Telefon","other_accounts":"Alte conturi cu această adresă IP","delete_other_accounts":"Șterge %{count}","username":"nume de utilizator","trust_level":"TL","read_time":"Timp de citire","topics_entered":"Discuții la care particip","post_count":"# postari","confirm_delete_other_accounts":"Ești sigur că vrei să ștergi aceste conturi?"},"user_fields":{"none":"(selecteaza o optiune)"},"user":{"said":"{{username}} a spus:","profile":"Profil","mute":"Anulează","edit":"Editează Preferințe","download_archive":"descarcă arhiva postărilor mele","new_private_message":"Mesaj nou","private_message":"Mesaj","private_messages":"Mesaje","activity_stream":"Activitate","preferences":"Preferințe","expand_profile":"Extinde","bookmarks":"Semne de carte","bio":"Despre mine","invited_by":"Invitat de","trust_level":"Nivel de Încredere","notifications":"Notificări","statistics":"Statistici","desktop_notifications":{"label":"Notificari desktop","not_supported":"Notificarile nu sunt suportate in acest browser.","perm_default":"Activeaza notificarile","perm_denied_btn":"Nu se permite accesul","disable":"Dezactiveaza notificarile","enable":"Activeaza Notificarile","each_browser_note":"Notati: Setarile vor fi modificate pe orice alt browser."},"dismiss_notifications_tooltip":"Marchează cu citit toate notificările necitite","disable_jump_reply":"Nu sări la postarea mea după ce răspund","dynamic_favicon":"Arată subiectele noi/actualizate în iconiţă browserului.","external_links_in_new_tab":"Deschide toate adresele externe într-un tab nou","enable_quoting":"Activează răspunsuri-citat pentru textul selectat","change":"schimbă","moderator":"{{user}} este moderator","admin":"{{user}} este admin","moderator_tooltip":"Acest utilizator este moderator","admin_tooltip":"Acest utilizator este admin","blocked_tooltip":"Acest utilizator este blocat.","suspended_notice":"Acest user este suspendat păna la {{date}}.","suspended_reason":"Motiv: ","github_profile":"Github","email_activity_summary":"Sumarul activității","mailing_list_mode":{"label":" ","daily":"Trimite actualizări zilnice","individual":"Trimite un email pentru fiecare postare nouă"},"watched_categories":"Văzut","tracked_categories":"Tracked","muted_categories":"Muted","delete_account":"Șterge-mi contul","delete_account_confirm":"Ești sigur că vrei sa ștergi contul? Această acțiune nu este reversibilă!","deleted_yourself":"Contul tău a fost șters cu succes.","delete_yourself_not_allowed":"Nu iți poți sterge contul deocamdată. Contactează administratorul pentru ștergerea contului.","unread_message_count":"Mesaje","admin_delete":"Șterge","users":"Utilizatori","muted_users":"Silențios","muted_users_instructions":"Suprimă toate notificările de la aceşti utilizatori","muted_topics_link":"Arata topicurile dezactivate.","staff_counters":{"flags_given":"Semnale ajutătoare","flagged_posts":"postări semnalate","deleted_posts":"postări șterse","suspensions":"suspendări","warnings_received":"avertizări"},"messages":{"all":"Toate","inbox":"Inbox","sent":"Trimise","archive":"Arhivează","groups":"Grupurile Mele","bulk_select":"Selectează mesaje","move_to_inbox":"Mută în Inbox","move_to_archive":"Arhivează","select_all":"Selectează tot"},"change_password":{"success":"(email trimis)","in_progress":"(se trimite email)","error":"(eroare)","action":"Trimite email pentru resetare parolă","set_password":"Introduceți parolă"},"change_about":{"title":"Schimbă la Profil"},"change_username":{"title":"Schimbă numele utilizatorului","taken":"Acest nume de utilizator este deja folosit.","error":"S-a intâmpinat o eroare pe parcursul schimbării numelui de utilizator.","invalid":"Acest nume de utilizator este invalid. Trebuie să includă doar cifre și litere."},"change_email":{"title":"Schimbă Email","taken":"Acest email nu este disponibil.","error":"A apărut o eroare la schimbarea de email. Poate această adresă este deja in folosința?","success":"Am trimis un email către adresa respectivă. Urmează instrucțiunile de confirmare."},"change_avatar":{"title":"Schimbă poză profilului personal","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, bazat pe","gravatar_title":"Schimbă avatarul de pe site-ul Gravatar.","refresh_gravatar_title":"Reactualizează Gravatarul","letter_based":"Poză de profil atribuită de sistem.","uploaded_avatar":"Poză preferată","uploaded_avatar_empty":"Adaugă poza preferată","upload_title":"Încarcă poza personală","upload_picture":"Încarcă poza","image_is_not_a_square":"Atenţie: poză este decupată, dar înălţimea şi lăţimea nu sunt egale.","cache_notice":"Fotografia de profil a fost schimbata, dar poate dura ceva timp pana sa apara datorita caching-ului din browser."},"change_profile_background":{"title":"Datele Profilului","instructions":"Fundalul profilului va fi centrat şi va avea o dimensiune standard de 850px."},"change_card_background":{"title":"Fundal","instructions":"Fundalul va fi centrat şi va avea o dimensiune standard de 590px."},"email":{"title":"Email","instructions":"Emailul nu va fi făcut public.","ok":"Îți vom trimite un email pentru confirmare.","invalid":"introduceți o adresă validă pentru confirmare.","authenticated":"Emailul a fost autentificat de către {{provider}}."},"name":{"title":"Nume","instructions":"Versiunea lungă a numelui.","instructions_required":"Numele dvs. complet","too_short":"Numele este prea scurt.","ok":"Numele dvs arată bine."},"username":{"title":"Nume Utilizator","instructions":"Numele de utilizator trebuie sa fie unic, fără spații, scurt.","short_instructions":"Ceilalți te pot menționa ca @{{username}}.","available":"Numele de utilizator este valabil.","global_match":"Emailul se potrivește numelui de utilizator înregistrat.","global_mismatch":"Deja înregistrat. Încearcă:{{suggestion}}?","not_available":"Nu este valabil. Încearcă:{{suggestion}}?","too_short":"Numele de utilizator este prea scurt.","too_long":"Numele de utilizator este prea lung.","checking":"Verifică valabilitatea numelui de utilizator...","enter_email":"Nume de utilizator găsit. Introduceți emailul potrivit.","prefilled":"Emailul se potrivește cu numele de utilizator înregistrat."},"locale":{"title":"Limba interfeței","instructions":"Limba este folosită de interfața forumului. Schimbarea se va produce odată ce reîmprospatați pagina.","default":"(din oficiu)"},"password_confirmation":{"title":"Confirmă parola"},"last_posted":"Ultima postare","last_emailed":"Ultimul email dat","last_seen":"Văzut","created":"Participare","log_out":"Ieșire","location":"Locație","card_badge":{"title":"Insignă utilizator"},"website":"Website","email_settings":"Email","like_notification_frequency":{"always":"Întotdeauna","never":"Niciodată"},"email_previous_replies":{"always":"întotdeauna","never":"niciodată"},"email_digests":{"every_30_minutes":"La fiecare 30 de minute ","daily":"zilnic","every_three_days":"la fiecare trei zile","weekly":"săptămânal","every_two_weeks":"la fiecare două săptămâni"},"email_direct":"Trimite un email când cineva mă citează, îmi răspunde la un post, menţionează @username meu, sau mă invită la o discuţie.","email_private_messages":"Trimite-mi un emai când cineva îmi răspunde.","email_always":"Trimite-mi notificarile de email atunci cand sunt activ pe site.","other_settings":"Altele","categories_settings":"Categorii","new_topic_duration":{"label":"Consideră discuțiile ca fiind noi","not_viewed":"Nu le-am văzut încă ","last_here":"Create de la ultima vizită ","after_1_day":"creat azi","after_2_days":"creat in ultimele 2 zile","after_1_week":"creat in ultima saptamana","after_2_weeks":"creat in ultimele 2 saptamni"},"auto_track_topics":"Urmăreşte automat discuţiile pe care le vizitez ","auto_track_options":{"never":"niciodată","immediately":"imediat","after_30_seconds":"dupa 30 de secunde","after_1_minute":"dupa 1 minut","after_2_minutes":"dupa 2 minute","after_3_minutes":"dupa 3 minute","after_4_minutes":"dupa 4 minute","after_5_minutes":"dupa 5 minute","after_10_minutes":"dupa 10 minute"},"invited":{"search":"Scrie pentru a căuta invitații...","title":"Invitații","user":"Utilizatori invitați","sent":"Trimis","none":"Nu sunt invitații în așteptare.","truncated":{"one":"Se arată prima invitație.","few":"Se arată primele {{count}} invitații.","other":"Se arată primele {{count}} de invitații."},"redeemed":"Invitații rascumpărate","redeemed_at":"Răscumpărate","pending":"Invitații in așteptare","pending_tab":"In asteptare","pending_tab_with_count":"In asteptare ({{count}})","topics_entered":"Subiecte văzute","posts_read_count":"Posturi citite","expired":"Această invitație a expirat.","rescind":"Anulează","rescinded":"Invitație anulată","reinvite":"Retrimite Invitaţia","reinvited":"Invitaţia a fost retrimisă","time_read":"Timp de citit","days_visited":"Zile de vizită","account_age_days":"Vârsta contului în zile","create":"Trimite o invitație","bulk_invite":{"none":"Nu ai invitat încă pe nimeni. Poți trimite invitații individuale sau mai multor oameni deodată prin \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e incărcarea fișierului de invitație multiplă\u003c/a\u003e.","text":"Invitație multiplă din fișierul","uploading":"Incarcă","success":"Fişier încărcat cu succes, veţi fi înştiinţat printr-un mesaj când procesarea va fi completă.","error":"A apărut o eroare la încărcarea fișierului '{{filename}}': {{message}}"}},"password":{"title":"Parolă","too_short":"Parola este prea scurtă.","common":"Această parolă este prea comună.","same_as_username":"Parolă este identică cu numele de utilizator","same_as_email":"Parolă este identică cu adresa de email","ok":"Parola dumneavoastră arată bine.","instructions":"Trebuiesc minim %{count} de caractere."},"summary":{"title":"Sumar","stats":"Statistici","time_read":"timp de citit","topic_count":{"one":"subiect creat","few":"subiecte create","other":"de subiecte create"},"post_count":{"one":"postare creată","few":"postări create","other":"de postări create"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dat","few":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e date","other":"de \u003ci class='fa fa-heart'\u003e\u003c/i\u003e date"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e primit","few":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e primite","other":"de \u003ci class='fa fa-heart'\u003e\u003c/i\u003e primite"},"days_visited":{"one":"zi vizitată","few":"vizite zilnice","other":"de zile vizitate"},"posts_read":{"one":"postare citită","few":"postări citite","other":"de postări citite"},"bookmark_count":{"one":"semn de carte","few":"semne de carte","other":"de semne de carte"},"top_replies":"Top răspunsuri","no_replies":"Nici un răspuns încă.","more_replies":"Mai multe răspunsuri","top_topics":"Top discuții","no_topics":"Nici o discuție încă.","more_topics":"Mai multe discuții","top_badges":"Top insigne","no_badges":"Nici o insignă încă","more_badges":"Mai multe insigne","top_links":"Top link-uri","no_links":"Nici un link încă.","most_liked_by":"Cele mai apreciate de către","most_liked_users":"Cele mai apreciate","most_replied_to_users":"Cele mai răspune pentru"},"associated_accounts":"Conectări","ip_address":{"title":"Ultima adresă de IP"},"registration_ip_address":{"title":"Înregistrarea adresei de IP"},"avatar":{"title":"Poză de profil","header_title":"profil, mesaje, favorite si preferințe"},"title":{"title":"Titlu"},"filters":{"all":"Toate"},"stream":{"posted_by":"Postat de","sent_by":"Trimis de","private_message":"mesaj","the_topic":"Subiectul"}},"loading":"Încarcă...","errors":{"prev_page":"în timp ce încarcă","reasons":{"network":"Eroare de rețea","server":"Eroare de server: {{code}}","forbidden":"Acces nepermis","unknown":"Eroare","not_found":"Pagina nu a fost găsită"},"desc":{"network":"Te rugăm să verifici conexiunea.","network_fixed":"Se pare ca și-a revenit.","server":"Ceva nu a funcționat.","forbidden":"Nu ești autorizat să vezi această pagină.","not_found":"Oops, aplicația încearcă să încarce un URL care nu există.","unknown":"Ceva nu a funcționat."},"buttons":{"back":"Înapoi","again":"Încearcă din nou","fixed":"Încarcare pagină"}},"close":"Închide","assets_changed_confirm":"Acest site tocmai a fost actualizat. Reîmprospătați pentru cea mai nouă versiune?","logout":"Aţi fost deconectat.","refresh":"Reîmprospătează","read_only_mode":{"login_disabled":"Autentificarea este dezactivată când siteul este în modul doar pentru citit."},"learn_more":"află mai multe...","year":"an","year_desc":"discuții create în ultimile 365 de zile","month":"lună","month_desc":"discuții create în ultimile 30 de zile","week":"săptămană","week_desc":"discuții create în ultimile 7 zile","day":"zi","first_post":"Prima Postare","mute":"Anulare","unmute":"Activare","last_post":"Ultima Postare","last_reply_lowercase":"ultimul răspuns","replies_lowercase":{"one":"răspuns","few":"răspunsuri","other":"răspunsuri"},"signup_cta":{"sign_up":"Înregistrare","hide_session":"Aminteste-mi maine.","hide_forever":"Nu, Multumesc","hidden_for_session":"Ok, te vom intreba maine. Poti oricand folosi 'Autentificare' pentru a crea un cont.","value_prop":"Cand creati un cont nou, vom retine exact ce ati citit, astfel continuati intotdeauna de unde ati ramas. Deasemenea primiti notificari, aici sau prin email atunci se posteaza ceva nou. Puteti \"aprecia\" postari pentru a impartasi iubire :heartbeat:"},"summary":{"enabled_description":"Vizualizați sumarul discuției: cea mai interesantă postare, așa cum a fost determinată de comunitate. Pentru toate postările, faceți click dedesubt.","enable":"Fă sumarul discuției","disable":"Arată toate postările"},"deleted_filter":{"enabled_description":"Această discuție conține postări șterse, ce au fost ascunse. ","disabled_description":"Postările șterse din discuție sunt vizibile.","enable":"Ascunde postările șterse","disable":"Arată postările șterse"},"private_message_info":{"title":"Mesaj","invite":"Invită alte persoane...","remove_allowed_user":"Chiar doriți să îl eliminați pe {{name}} din acest mesaj privat?"},"email":"Email","username":"Nume utilizator","last_seen":"Văzut","created":"Creat","created_lowercase":"creat","trust_level":"Nivel de încredere","search_hint":"Numele de utilizator sau email","create_account":{"title":"Creează cont","failed":"Ceva a decurs greșit, poate că acest email e deja înregistrat, încearcă linkul parolă uitată "},"forgot_password":{"title":"Resetare parolă","action":"Mi-am uitat parola","invite":"Introduce-ți numele de utilizator sau adresa de email și vă vom trimite un email pentru resetarea parolei.","reset":"Resetare Parolă","complete_username":"Dacă contul se potrivește numelui de utilizator \u003cb\u003e%{username}\u003c/b\u003e, ar trebui să primiți în scurt timp un email cu instrucțiunile de resetare a parolei.","complete_email":"Dacă un cont se potrivește cu \u003cb\u003e%{email}\u003c/b\u003e, ar trebui să primiți un email în cel mai scurt timp cu instrucțiunile de resetare a parolei.","complete_username_found":"Am găsit un cont care se potriveşte cu utilizatorul \u003cb\u003e%{username}\u003c/b\u003e, veţi primi un email cu instrucţiunile cum să resetati parolă în cel mai scurt timp.","complete_email_found":"Am găsit un cont care se potriveşte cu adresa \u003cb\u003e%{email}\u003c/b\u003e, veţi primi un email cu instrucţiunile cum să resetati parolă în cel mai scurt timp.","complete_username_not_found":"Nici un cont nu se potriveşte cu utilizatorul \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nici un cont nu se potriveşte adresei  \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Autentificare","username":"Utilizator","password":"Parolă","email_placeholder":"email sau nume de utilizator","caps_lock_warning":"Caps Lock este apăsat","error":"Eroare necunoscută","rate_limit":"Te rog asteapta inainte de a te reconecta.","blank_username_or_password":"Introduceți emailul sau numele de utilizator și parola.","reset_password":"Resetare parolă","logging_in":"În curs de autentificare...","or":"sau","authenticating":"Se autentifică...","awaiting_confirmation":"Contul dumneavoastră așteaptă să fie activat .Folosiți linkul de reamintire a parolei, pentru a iniția un alt email de activare.","awaiting_approval":"Contul dumneavoastră nu a fost aprobat încă de un admin . Veți primi un email când se aprobă.","requires_invite":"Ne pare rău, accesul la forum se face pe bază de invitație.","not_activated":"Nu te poți loga încă. Am trimis anterior un email de activare pentru \u003cb\u003e{{sentTo}}\u003c/b\u003e. Urmăriți instrucțiunile din email pentru a vă activa contul.","not_allowed_from_ip_address":"Nu va puteţi conecta de la această adresa de IP.","admin_not_allowed_from_ip_address":"Nu va puteţi conecta ca administrator de la această adresa de IP.","resend_activation_email":"Click aici pentru a trimite emailul de activare încă odată.","sent_activation_email_again":"Am trimis un alt email de activare pentru dvs la \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Poate dura câteva minute până ajunge; Vizitați și secțiunea de spam a mailului.","to_continue":"Te rog sa te autentifici.","preferences":"Trebuie sa fi autentificat pentru a schimba preferintele.","forgot":"Nu imi amintesc detaliile contului meu.","google":{"title":"cu Google","message":"Autentificare cu Google (Asigurați-vă că barierele de pop up nu sunt active)"},"google_oauth2":{"title":"cu Google","message":"Autentificare cu Google (Asigurați-vă că barierele de pop up nu sunt active)"},"twitter":{"title":"cu Twitter","message":"Autentificare cu Twitter (Asigurați-vă că barierele de pop up nu sunt active)"},"facebook":{"title":"cu Facebook","message":"Autentificare cu Facebook (Asigurați-vă că barierele de pop up nu sunt active)"},"yahoo":{"title":"cu Yahoo","message":"Autentificare cu Yahoo (Asigurați-vă că barierele de pop up nu sunt active)"},"github":{"title":"cu GitHub","message":"Autentificare cu GitHub (Asigurați-vă că barierele de pop up nu sunt active)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"mai multe...","options":"Optiuni","whisper":"soapta","add_warning":"Această este o avertizare oficială.","posting_not_on_topic":"Cărei discuții vrei să-i răspunzi?","saving_draft_tip":"salvează...","saved_draft_tip":"salvat","saved_local_draft_tip":"salvat local","similar_topics":"discuția dvs e similară cu...","drafts_offline":"proiecte offline","error":{"title_missing":"Este nevoie de titlu","title_too_short":"Titlul trebuie sa aibă minim {{min}} de caractere","title_too_long":"Titlul nu poate avea {{max}} de caractere","post_missing":"Postarea nu poate fi gol","post_length":"Postarea trebuie sa aibă minim {{min}} de caractere","try_like":"Ai încercat butonul \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Trebuie să alegi o categorie"},"save_edit":"Salvează Editarea","reply_original":"Răspunde discuției originale","reply_here":"Răspunde aici","reply":"Răspunde","cancel":"Anulează","create_topic":"Creează o Discuţie","create_pm":"Mesaj","title":"Sau apasă Ctrl+Enter","users_placeholder":"Adaugă un utilizator","title_placeholder":"Care este tema discuției într-o singură propoziție?","edit_reason_placeholder":"de ce editați?","show_edit_reason":"(adaugă motivul editării)","reply_placeholder":"Scrie aici. Utilizeaza Markdown, BBCode or HTML la format. Trage sau lipeste imagini.","view_new_post":"Vizualizează noua postare.","saving":"Salvare","saved":"Salvat!","saved_draft":"Ai o postare în stadiul neterminat. Fă click oriunde pentru a continua editarea.","uploading":"Încarcă...","show_preview":"arată previzualizare \u0026raquo;","hide_preview":"\u0026laquo; ascunde previzualizare","quote_post_title":"Citează întreaga postare","bold_title":"Aldin","bold_text":"text aldin","italic_title":"Italic","italic_text":"text italic","link_title":"Adresă Hyper","link_description":"adaugă aici descrierea adresei hyper","link_dialog_title":"Introdu adresă hyper","link_optional_text":"titlu opțional","link_url_placeholder":"http://example.com","quote_title":"Citat-bloc","quote_text":"Citat-bloc","code_title":"Text preformatat","code_text":"indentează preformatarea textului cu 4 spații","upload_title":"Încarcă","upload_description":"Introduceți aici descrierea fișierelor încărcate","olist_title":"Listă numerică","ulist_title":"Listă punctată","list_item":"conținut de listă","heading_title":"Titlu","heading_text":"Titlu","hr_title":"Linie orizontală","help":"Ajutor de editare","toggler":"ascunde sau arată editorul","modal_ok":"Ok","modal_cancel":"Anuleaza","cant_send_pm":"Nu poți trimite mesaje către %{username}","admin_options_title":"Setări opționale ale discuției pentru moderatori","auto_close":{"label":"Închide automat discuţia după:","error":"Introduceţi o valoare valida.","based_on_last_post":"Nu închide discuţia până când ultimul răspuns nu are o vechime de cel puţin:","all":{"examples":"Introdu numărul de ore (24), timpul absolut (17:30) sau dată şi timpul cu secunde (2013-11-22 14:00)."},"limited":{"units":"(# de ore)","examples":"Introdu numărul de ore (24)."}}},"notifications":{"title":"notifică menționarea @numelui, răspunsuri la postările mele, discuții, mesaje private, etc","none":"Nu pot încarcă notificările în acest moment.","more":"vezi notificările mai vechi","total_flagged":"toate postările semnalate","mentioned":"\u003ci title='a menționat' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='a citat' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='a răspuns' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='a editat' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='a apreciat' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} și încă cineva\u003c/span\u003e {{description}}\u003c/p\u003e","few":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} și alți {{count}}\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} și alți {{count}}\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='Mesaj privat' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='Mesaj privat' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='a invitat la discuţie' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='a acceptat invitația ta' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e a acceptat invitația ta\u003c/p\u003e","moved_post":"\u003ci title='postare mutată' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e mutată {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='insignă acordată' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003e Ţi s-a acordat {{description}}\u003c/p\u003e","alt":{"mentioned":"Mentionat de","quoted":"Citat de","replied":"Raspuns","posted":"Postat de","private_message":"Mesaj privat de la","linked":"Link spre postarea ta"},"popup":{"mentioned":"{{username}} te-a menţionat în \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} te-a menţionat în \"{{topic}}\" - {{site_title}}","quoted":"{{username}} te-a citat în \"{{topic}}\" - {{site_title}}","replied":"{{username}} ți-a răspuns la \"{{topic}}\" - {{site_title}}","posted":"{{username}} a postal în \"{{topic}}\" - {{site_title}}","private_message":"{{username}} ți-a trimis un mesaj privat în \"{{topic}}\" - {{site_title}}","linked":"{{username}} a făcut o legătură la post-ul tău din \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Adaugă o imagine","title_with_attachments":"adaugă o imagine sau un fișier","from_my_computer":"din dispozitivul meu","from_the_web":"De pe web","remote_tip":"adresă către imagine http://example.com/image.jpg","local_tip":"selectează imagini de pe dispozitivul tău","local_tip_with_attachments":"selectează imagini sau fișiere de pe dispozitivul tău {{authorized_extensions}}","hint":"(puteți să trageți și să aruncați în editor pentru a le încărca)","uploading":"Încarcă","select_file":"Slectează fișier","image_link":"Adresa din imagine va duce la"},"search":{"sort_by":"Sortează după","relevance":"Relevanță","latest_post":"Ultimele postări","most_viewed":"Cele mai văzute","most_liked":"Cele mai apreciate","select_all":"Selectează tot","result_count":{"one":"Un rezultat pentru \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","few":"{{count}} rezultate pentru \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} de rezultate pentru \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"caută discuții, postări, utilizatori sau categorii","no_results":"Fără rezultat.","search_help":"Ajutor căutare","searching":"Caută...","post_format":"#{{post_number}} de {{username}}","context":{"user":"Caută postări după @{{username}}","topic":"Caută în această discuție","private_messages":"Caută mesaje"}},"new_item":"nou","go_back":"înapoi","not_logged_in_user":"pagina utilizatorului cu sumarul activităților și preferințelor","current_user":"mergi la pagina proprie de utilizator","topics":{"bulk":{"reset_read":"resetează citirea","delete":"Șterge subiectele","dismiss_new":"Anulează cele noi","toggle":"activează selecția în masă pentru discuții","actions":"Acțiuni în masă","change_category":"Schimbă categoria","close_topics":"Închide discuțiile","archive_topics":"Arhivează subiectele","notification_level":"Schimbă nivelul de notificări","choose_new_category":"Alege o nouă categorie pentru această discuţie","selected":{"one":"Ai selectat \u003cb\u003eun\u003c/b\u003e subiect.","few":"Ai selectat \u003cb\u003e{{count}}\u003c/b\u003e subiecte.","other":"Ai selectat \u003cb\u003e{{count}}\u003c/b\u003e de subiecte."}},"none":{"unread":"Nu sunt discuții necitite.","new":"Nu sunt discuții noi.","read":"Nu ai citit nicio discuție încă.","posted":"Nu ai postat în nicio discuție încă.","latest":"Nu există nicio discuție nouă.","hot":"Nu există nicio discuție importantă.","bookmarks":"Nu aveţi nici un semn de carte încă.","category":"Nu există nicio discuție din categoria {{category}}.","top":"Nu exită nicio discuție de top.","search":"Nu sunt rezulate la căutare."},"bottom":{"latest":"Nu există nicio ultimă discuție.","hot":"Nu mai există discuții importante.","posted":"Nu mai există discuții postate.","read":"Nu mai există discuții citite.","new":"Nu mai există discuții noi.","unread":"Nu mai există discuții necitite.","category":"Nu mai există discuții din categoria {{category}}.","top":"Nu mai există discuții de top.","bookmarks":"Nu mai sunt semne de carte.","search":"Nu mai sunt rezultate."}},"topic":{"unsubscribe":{"stop_notifications":"Vei primi mai puține notificări pentru \u003cstrong\u003e{{title}}\u003c/strong\u003e"},"create":"Discuție Nouă","create_long":"Creează discuție nouă","private_message":"Scrie un mesaj.","archive_message":{"help":"Mută mesajul în arhivă","title":"Arhivează"},"move_to_inbox":{"title":"Mută în Inbox","help":"Mută mesajul în Inbox"},"list":"Discuții","new":"discuție nouă","unread":"necitită","new_topics":{"one":"Un subiect nou","few":"{{count}} subiecte noi","other":"{{count}} de subiecte noi"},"unread_topics":{"one":"Un subiect necitit","few":"{{count}} subiecte necitite","other":"{{count}} de subiecte necitite"},"title":"Discuție","invalid_access":{"title":"Discuția este privată","description":"Ne pare rău nu ai acces la acea discuție!","login_required":"Trebuie să fii autentificat să poți vedea discuția."},"server_error":{"title":"Discuția nu s-a putut încărca","description":"Ne pare rău, nu am putut încărca discuția, posibil din cauza unei probleme de conexiune. Încercați din nou. Dacă problema persistă, anunță-ne."},"not_found":{"title":"Discuție negăsită","description":"Ne pare rău, Nu am putut găsii discuția. Poate a fost ștearsă de un moderator?"},"total_unread_posts":{"one":"ai un mesaj necitit în această discuţie.","few":"ai {{count}} mesaje necitite în această discuţie.","other":"ai {{count}} de mesaje necitite în această discuţie."},"unread_posts":{"one":"ai un mesaj vechi necitit în această discuţie.","few":"ai {{count}} mesaje vechi necitite în această discuţie.","other":"ai {{count}} de mesaje vechi necitite în această discuţie."},"new_posts":{"one":"este un mesaj nou în această discuţie de la ultima citire","few":"sunt {{count}} mesaje noi în această discuţie de la ultima citire","other":"sunt {{count}} de mesaje noi în această discuţie de la ultima citire"},"likes":{"one":"există o apreciere pentru această discuţie","few":"sunt {{count}} aprecieri pentru această discuţie","other":"sunt {{count}} de aprecieri pentru această discuţie"},"back_to_list":"Înapoi la lista de discuții","options":"Opțiunile discuției","show_links":"arată link-urile din această discuție","toggle_information":"activează detaliile discuției","read_more_in_category":"Vrei să citești mai mult? Răsfoiește alte discuții din {{catLink}} sau {{latestLink}}.","read_more":"Vrei să citești mai multe discuții? {{catLink}} sau {{latestLink}}.","browse_all_categories":"Priviți toate categoriile","view_latest_topics":"arată ultimele discuții","suggest_create_topic":"De ce să nu creați o discuție?","jump_reply_up":"sări la un răspuns mai vechi","jump_reply_down":"sări la un răspuns mai nou","deleted":"Discuția a fost ștearsă","auto_close_notice":"Această discuție va fi inchisă în %{timeLeft}.","auto_close_notice_based_on_last_post":"Această discuţie se va închide după %{duration} de la ultimul răspuns.","auto_close_title":"Setările de auto-închidere","auto_close_save":"Salvează","auto_close_remove":"nu închide automat această discuție","progress":{"title":"Progresul Discuției","go_top":"început","go_bottom":"sfârșit","go":"mergi","jump_bottom":"sări la ultimul mesaj","jump_bottom_with_number":"sări la mesajul %{post_number}","total":"toate postările","current":"Postarea curentă"},"notifications":{"reasons":{"3_6":"Vei primi notificări deoarece urmărești activ această categorie.","3_5":"Vei primi notificări deoarece ai început să urmărești activ această discuție automat.","3_2":"Vei primi notificări deoarece urmărești activ această discuție.","3_1":"Vei primi notificări deoarece ați creat această discuție.","3":"Vei primi notificări deoarece urmărești activ această discuție.","2_8":"Vei primi notificări deoarece urmărești această categorie.","2_4":"Vei primi notificări deoarece ai postat un răspuns în această discuție.","2_2":"Vei primi notificări fiindcă urmărești această discuție.","2":"Vei primi notificări fiindcă citești \u003ca href=\"/users/{{username}}/preferences\"\u003eaceastă discuție\u003c/a\u003e.","1_2":"Vei fi notificat dacă cineva îți menționează @numele sau îți scrie un răspuns.","1":"Vei fi notificat dacă cineva îți menționează @numele sau îți scrie un răspuns.","0_7":"Ignori toate notificările din această categorie.","0_2":"Ignori toate notificările din această discuție.","0":"Ignori toate notificările din această discuție."},"watching_pm":{"title":"Urmărit Activ","description":"Numărul postărilor noi va fi arătat pentru acest mesaj și vei fi notificat pentru orice răspuns scris."},"watching":{"title":"Urmărit Activ","description":"Numărul postărilor noi va fi arătat pentru această discuție și vei fi notificat pentru orice răspuns scris."},"tracking_pm":{"title":"Urmărit","description":"Numărul postărilor noi va fi arătat pentru acest mesaj. Vei fi notificat dacă cineva îți menționează @numele sau îți scrie un răspuns."},"tracking":{"title":"Urmărit","description":"Numărul postărilor noi va fi arătat pentru acest topic. Vei fi notificat dacă cineva îți menționează @numele sau îți scrie un răspuns."},"regular":{"title":"Normal","description":"Vei fi notificat dacă cineva îți menționează @numele sau îți scrie un răspuns."},"regular_pm":{"title":"Normal","description":"Vei fi notificat dacă cineva îți menționează @numele sau îți scrie un răspuns."},"muted_pm":{"title":"Silențios","description":"Nu vei fi niciodată notificat despre acest mesaj."},"muted":{"title":"Silențios","description":"Nu vei fi notificat de răspunsurile noi din această discuție și nu vor apărea în tabul necitite."}},"actions":{"recover":"Restaurează discuția","delete":"Șterge Discuție","open":"Redeschide discuția","close":"Închide discuția","multi_select":"Selectează discuţiile ...","auto_close":"Închide automat","pin":"Promovează discuţia pe pagină...","unpin":"Anulează promovarea discuției","unarchive":"Dezarhivează discuția","archive":"Arhivează discuția","invisible":"Fă invizibil","visible":"Fă vizibil","reset_read":"Resetează informația citită"},"feature":{"pin":"Promovează discuţia","unpin":"Anulează promovarea discuției","pin_globally":"Promovează discuţia global","make_banner":"Adaugă statutul de banner","remove_banner":"Șterge statutul de banner"},"reply":{"title":"Răspunde","help":"începe să compui un răspuns pentru această discuție"},"clear_pin":{"title":"Șterge promovarea","help":"Șterge promovarea acestei discuții pentru a nu mai apărea la începutul listei de discuții"},"share":{"title":"Distribuie","help":"distribuie o adresă spre această discuție"},"flag_topic":{"title":"Marcheză","help":"marchează privat această discuție pentru atenție sau trimite o notificare privată despre ea","success_message":"Ai marcat cu succes această discuție."},"feature_topic":{"title":"Promovează această discuţie","confirm_pin":"Ai deja {{count}} discuţii promovate. Prea multe discuţii promovate pot fi deveni o problemă pentru utilizatorii noi sau anonimi. Ești sigur că vrei să promovezi o altă discuţie în această categorie?","unpin":"Îndepărtează aceast mesaje din top-ul categoriei {{categoryLink}}","pin_note":"Utilizatorii pot anula promovarea unui subiect individual pentru ei înșiși.","pin_validation":"Este nevoie de o dată pentru a putea promova această discuție.","not_pinned":"Nu sunt discuții promovate în {{categoryLink}}.","confirm_pin_globally":"Sunt {{count}} discuţii promovate la nivel global. Prea multe discuţii promovate pot fi deveni o problemă pentru utilizatorii noi sau anonimi. Ești sigur că vrei să promovezi o altă discuţie la nivel global?","unpin_globally":"Eliminați acest subiect din partea de sus a tuturor listelor de discuţii.","global_pin_note":"Utilizatorii pot anula promovarea unui subiect individual pentru ei înșiși.","not_pinned_globally":"Nu există subiecte promovate global.","make_banner":"Transformă acest subiect într-un banner care apare în partea de sus a tuturor paginilor.","remove_banner":"Îndepărtaţi mesajul banner care apare în partea de sus a fiecărei pagini.","banner_note":"Utilizatorii pot îndepărta baner-ul închizându-l. Doar un singur mesaj poate fi folosit că baner într-un moment dat."},"inviting":"Invită...","invite_private":{"title":"Invită la mesaj privat","email_or_username":"adresa de Email sau numele de utilizator al invitatului","email_or_username_placeholder":"adresa de email sau numele utilizatorului","action":"Invită","success":"Am invitat acest utilizator să participe la acest mesaj.","error":"Ne pare rău, a apărut o eroare la trimiterea invitației către acel utilizator.","group_name":"numele grupului"},"invite_reply":{"title":"Invitație","username_placeholder":"nume utilizator","action":"Trimite o invitație","help":"invită alţi utilizatori la această discuţie via email sau notificare","to_forum":"Vom trimite un email scurt permițând prietenilor tăisă participe făcând click pe o adesă fără a necesita autentificare.","sso_enabled":"Introdu numele de utilizator al persoanei pe care dorești să o inviți la acesta discuţie.","to_topic_blank":"Introdu numele de utilizator sau adresa de email a persoanei pe care dorești să o inviți la acesta discuţie.","to_topic_email":"Ai introdus o adresa de e-mail. Vom trimite un email cu o invitaţie ce va permite prietenului tău să răspundă imediat la această discuţie.","email_placeholder":"exemplu@nume.com","success_email":"Am trimis o invitaţie către \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e.. Te vom anunţă când invitaţia este folosită. Verifică tab-ul invitaţii pe pagină ta de utilizator pentru a monitoriza invitaţiile. ","success_username":"Am invitat acest utilizator să participe la această discuţie.","error":"Ne pare rău, nu am putut invită persoană indicată. Poate că a fost deja invitată? (Invitaţiile sunt limitate)"},"login_reply":"Autentifică-te pentru a răspunde.","filters":{"n_posts":{"one":"O Postare","few":"{{count}} postări","other":"{{count}} de postări"},"cancel":"Arată din nou toate postările din această discuție."},"split_topic":{"title":"Mutare în discuție nouă ","action":"mută în discuție nouă","topic_name":"Numele noii discuții","error":"S-a semnalat o eroare la mutarea postărilor către discuția nouă.","instructions":{"one":"Vei crea o nouă discuţie care va fi populată cu postarea selectată.","few":"Vei crea o nouă discuţie care va fi populată cu cele \u003cb\u003e{{count}}\u003c/b\u003e postări selectate.","other":"Vei crea o nouă discuţie care va fi populată cu cele \u003cb\u003e{{count}}\u003c/b\u003e de postări selectate."}},"merge_topic":{"title":"Mută în discuție existentă","action":"mută în discuție existentă","error":"S-a semnalat o eroare la mutarea postărilor în acea discuție.","instructions":{"one":"Vă rugăm să alegeţi discuţia unde doriţi să mutaţi acest mesaj.","few":"Vă rugăm să alegeţi discuţia unde doriţi să mutaţi aceste \u003cb\u003e{{count}}\u003c/b\u003e mesaje.","other":"Vă rugăm să alegeţi discuţia unde doriţi să mutaţi aceste \u003cb\u003e{{count}}\u003c/b\u003e de mesaje."}},"change_owner":{"title":"Schimbă deținătorul postărilor","action":"Schimbă apartenența","error":"S-a semnalat o eroare la schimbarea apartenenței postărilor.","label":"Noul deținător al postărilor","placeholder":"numele de utilizator al deținătorului","instructions":{"one":"Va rugăm să alegeţi noul propietar pentru mesajul postat de \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Va rugăm să alegeţi noul propietar pentru cele {{count}} mesajele postate de \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Va rugăm să alegeţi noul propietar pentru cele {{count}} de mesajele postate de \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"NB: nicio notificare ce privește această postare nu va fi transferabilă retroactiv către noul utilizator.\u003cbr\u003eAvertisment: Acum, nicio informație ce depinde de postare nu va fi transferată noului utilizator. Folosește cu atenție."},"change_timestamp":{"title":"Schimbă data publicării","action":"schimbă data publicării"},"multi_select":{"select":"selectează","selected":"selectate ({{count}})","select_replies":"selectează +răspunsuri","delete":"șterge selecția","cancel":"anularea selecției","select_all":"selectează tot","deselect_all":"deselectează  tot","description":{"one":"Ai selectat \u003cb\u003eun\u003c/b\u003e mesaj.","few":"Ai selectat \u003cb\u003e{{count}}\u003c/b\u003e mesaje.","other":"Ai selectat \u003cb\u003e{{count}}\u003c/b\u003e de mesaje."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"răspunde prin citat","edit":"Editează {{link}} {{replyAvatar}} {{username}}","edit_reason":"Motivul: ","post_number":"postarea {{number}}","last_edited_on":"postare editată ultima oară la","reply_as_new_topic":"Răspunde cu o discuție nouă","continue_discussion":"În continuarea discuției {{postLink}}:","follow_quote":"mergi la postarea citată","show_full":"Arată postarea în întregime","show_hidden":"Arată conținut ascuns.","deleted_by_author":{"one":"(post retras de autor, va fi şters automat în %{count} ore, cu excepţia cazului în care mesajul este marcat)","few":"(postări retrase de autor, vor fi şterse automat în %{count} ore, cu excepţia cazului în care mesajele sunt marcate)","other":"(postări retrase de autor, vor fi şterse automat în %{count} ore, cu excepţia cazului în care mesajele sunt marcate)"},"expand_collapse":"expandează/restrânge","gap":{"one":"vezi un răspuns ascuns","few":"vezi {{count}} răspunsuri ascunse","other":"vezi {{count}} de răspunsuri ascunse"},"unread":"postarea nu a fost citită","has_replies":{"one":"Un răspuns","few":"{{count}} răspunsuri","other":"{{count}} de răspunsuri"},"has_likes":{"one":"O Apreciere","few":"{{count}} Aprecieri","other":"{{count}} de Aprecieri"},"has_likes_title":{"one":"O persoană a apreciat acest post.","few":"{{count}} persoane au apreciat acest post.","other":"{{count}} de persoane au apreciat acest post."},"has_likes_title_only_you":"Ai apreciat acest post","has_likes_title_you":{"one":"Ai apreciat acest post împreună cu un alt utilizator.","few":"Ai apreciat acest post împreună cu alți {{count}} utilizatori.","other":"Ai apreciat acest post împreună cu alți {{count}} de utilizatori."},"errors":{"create":"Ne pare rău, a apărut o eroare în creerea postării. Te rugăm să încerci iar.","edit":"Ne pare rău, a apărut o eroare în editarea postării. Te rugăm să încerci iar.","upload":"Ne pare rău, a apărut o eroare în încărcarea acelui fișier. Te rugăm să încerci iar.","too_many_uploads":"Ne pare rău, poți încarca doar câte un fișier.","upload_not_authorized":"Ne pare rău, fișierul pe care-l încarci nu este autorizat (extensia pentru autorizare: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Ne pare rău, un utilizator nou nu poate încarca imagini.","attachment_upload_not_allowed_for_new_user":"Ne pare rău, un utilizator nou nu poate încarca atașamnete.","attachment_download_requires_login":"Ne pare rău, dar trebuie să fii autentificat pentru a descarca ataşamente."},"abandon":{"confirm":"Ești sigur că dorești să abandonezi postarea?","no_value":"Nu, pastrează","yes_value":"Da, abandonează"},"via_email":"acest post a sosit via email","archetypes":{"save":"Opțiuni de salvare"},"controls":{"reply":"începe compunerea unui răspuns pentru această postare","like":"apreciează acestă postăre","has_liked":"ai apreciat acest răspuns","undo_like":"anuleazaă aprecierea","edit":"editează această postare","edit_anonymous":"Ne pare rău, dar trebuie să fii autentificat pentru a edita acest post.","flag":"marchează privat această postare pentru atenție sau trimite o notificare privată despre aceasta","delete":"șterge această postare","undelete":"rescrie această postare","share":"distribuie adresa către această postare","more":"Mai mult","delete_replies":{"confirm":{"one":"Dorești să ștergi răspunsul direct la acest mesaj?","few":"Dorești să ștergi cele {{count}} răspunsuri directe la acest mesaj?","other":"Dorești să ștergi cele {{count}} de răspunsuri directe la acest mesaj?"},"yes_value":"Da, șterge și răspunsurile","no_value":"Nu, doar postarea"},"admin":"acțiuni administrative de postare","wiki":"Fă postarea Wiki","unwiki":"Anulează stadiul de wiki al postării","convert_to_moderator":"Adaugă culoarea personalului","revert_to_regular":"Sterge culoarea personalului","rebake":"Reconstruieşte HTML","unhide":"Arată"},"actions":{"flag":"Semnal","defer_flags":{"one":"Amână marcarea","few":"Amână marcările","other":"Amână marcările"},"undo":{"off_topic":"Retrage semnalare","spam":"Retrage semnalare","inappropriate":"Retrage semnalare","bookmark":"Retrage marcare","like":"Retrage apreciere","vote":"Retrage vot"},"people":{"off_topic":"semnalat ca offtopic","spam":"somnalat ca spam","inappropriate":"semnalat ca nepotrivit"},"by_you":{"off_topic":"Ați marcat ca fiind în afara discuției","spam":"Ați marcat ca fiind spam","inappropriate":"Ați marcat ca nepotrivit","notify_moderators":"Ai marcat discuția pentru moderare","notify_user":"Aţi trimis un mesaj către acest utilizator","bookmark":"Ați marcat ca semn de carte această postare","like":"Ați apreciat","vote":"Ați votat aceasta postare"},"by_you_and_others":{"off_topic":{"one":"Dvs. şi încă o persoană aţi marcat acest mesaj ca fiind în afară discuţiei.","few":"Dvs. şi alte {{count}} persoane aţi marcat acest mesaj ca fiind în afară discuţiei.","other":"Dvs. şi alte {{count}} de persoane aţi marcat acest mesaj ca fiind în afară discuţiei."},"spam":{"one":"Dvs. şi încă o persoană aţi marcat acest mesaj ca spam. ","few":"Dvs. şi alte {{count}} persoane aţi marcat acest mesaj ca spam. ","other":"Dvs. şi alte {{count}} de persoane aţi marcat acest mesaj ca spam. "},"inappropriate":{"one":"Dvs. şi încă o persoană aţi marcat acest mesaj ca inadecvat. ","few":"Dvs. şi alte {{count}} persoane aţi marcat acest mesaj ca inadecvat. ","other":"Dvs. şi alte {{count}} de persoane aţi marcat acest mesaj ca inadecvat. "},"notify_moderators":{"one":"Dvs. şi încă o persoană aţi marcat acest mesaj pentru moderare.","few":"Dvs. şi alte {{count}} persoane aţi marcat acest mesaj pentru moderare.","other":"Dvs. şi alte {{count}} de persoane aţi marcat acest mesaj pentru moderare."},"notify_user":{"one":"Dvs. şi încă o persoană aţi trimis un mesaj către acest utilizator.","few":"Dvs. şi alte {{count}} persoane aţi trimis un mesaj către acest utilizator.","other":"Dvs. şi alte {{count}} de persoane aţi trimis un mesaj către acest utilizator."},"bookmark":{"one":"Dvs. şi încă o persoană aţi pus un semn de carte pentru această postare.","few":"Dvs. şi alte {{count}} persoane aţi pus un semn de carte pentru această postare.","other":"Dvs. şi alte {{count}} de persoane aţi pus un semn de carte pentru această postare."},"like":{"one":"Dvs. şi încă o persoană aţi apreciat aceasta.","few":"Dvs. şi alte {{count}} persoane aţi apreciat aceasta.","other":"Dvs. şi alte {{count}} de persoane aţi apreciat aceasta."},"vote":{"one":"Dvs. şi încă o persoană aţi votat pentru această postare.","few":"Dvs. şi alte {{count}} persoane aţi votat pentru această postare.","other":"Dvs. şi alte {{count}} de persoane aţi votat pentru această postare."}},"by_others":{"off_topic":{"one":"O persoană a marcat acesta ca fiind în afară discuţiei","few":"{{count}} persoane au marcat acesta ca fiind în afară discuţiei","other":"{{count}} de persoane au marcat acesta ca fiind în afară discuţiei"},"spam":{"one":"O persoană a marcat acesta ca spam","few":"{{count}} persoane au marcat acesta ca spam","other":"{{count}} de persoane au marcat acesta ca spam"},"inappropriate":{"one":"o persoană a marcat acesta ca inadecvat","few":"{{count}} persoane au marcat acesta ca inadecvat","other":"{{count}} de persoane au marcat acesta ca inadecvat"},"notify_moderators":{"one":"O persoană a marcat acest mesaj pentru moderare","few":"{{count}} persoane au marcat acest mesaj pentru moderare","other":"{{count}} persoane au marcat acest mesaj pentru moderare"},"notify_user":{"one":"o persoană a trimis un mesaj către acest utilizator","few":"{{count}} persoane au trimis un mesaj către acest utilizator","other":"{{count}} de persoane au trimis un mesaj către acest utilizator"},"bookmark":{"one":"O persoană a pus un semn de carte la acest mesaj","few":"{{count}} persoane au pus un semn de carte la acest mesaj","other":"{{count}} de persoane au pus un semn de carte la acest mesaj"},"like":{"one":"o persoană a apreciat aceasta","few":"{{count}} persoane au apreciat aceasta","other":"{{count}} de persoane au apreciat aceasta"},"vote":{"one":"O persoană a votat pentru acest mesaj","few":"{{count}} persoane au votat pentru acest mesaj","other":"{{count}} de persoane au votat pentru acest mesaj"}}},"delete":{"confirm":{"one":"Sunteți sigur că vreți să ștergeți acest mesaj?","few":"Sunteți sigur că vreți să ștergeți toate aceste mesaje?","other":"Sunteți sigur că vreți să ștergeți toate aceste mesaje?"}},"revisions":{"controls":{"first":"Prima revizie","previous":"Revizie precedentă","next":"Urmatoarea revizie","last":"Ultima revizie","hide":"Ascunde revizia","show":"Afișează revizia","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Arată rezultatul randării cu adăugări și proprietăți","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Arată proprietățile rezultatului randării una lângă alta","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Arată sursa de marcare a proprietăților una lângă alta","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}}}},"category":{"can":"can\u0026hellip; ","none":"(nicio categorie)","all":"Toate categoriile","choose":"Selectează o categorie\u0026hellip;","edit":"editează","edit_long":"Editează","view":"Arată discuțiile în categorie","general":"General","settings":"Setări","delete":"Șterge categorie","create":"Creează categorie","save":"Salvează categorie","slug":"Slug Categorie","slug_placeholder":"(Opțional) cuvinte-punctate pentru url","creation_error":"S-a semnalat o eroare în timpul creării categoriei.","save_error":"S-a semnalat o eroare in timpul salvării categoriei.","name":"Numele categoriei","description":"Descriere","topic":"Topicul categoriei","logo":"Imaginea Logo a categoriei","background_image":"Imaginea de fundal a categoriei","badge_colors":"Culorile insignei","background_color":"Culoarea de fundal","foreground_color":"Culoarea de prim-plan","name_placeholder":"Unul sau doua cuvinte maximum","color_placeholder":"Orice culoare","delete_confirm":"Sigur doriți să ștergeți această categorie?","delete_error":"S-a semnalat o eroare la ștergerea acestei categorii.","list":"Lista categorii","no_description":"Va rugăm adăugați o descriere acestei categorii.","change_in_category_topic":"Editează descrierea","already_used":"Această culoare este folosită la o altă categorie","security":"Securitate","images":"Imagini","auto_close_label":"Auto-inchide discuțiile după:","auto_close_units":"ore","email_in":"Adresa email de primire preferențială:","email_in_allow_strangers":"Acceptă emailuri de la utilizatori anonimi fară cont","email_in_disabled":"Postarea discuțiilor noi prin email este dezactivată din setările siteului. Pentru a activa postarea discuțiilor noi prin email,","email_in_disabled_click":"activarea setării \"primire email \".","allow_badges_label":"Permite acordarea de insigne în această categorie","edit_permissions":"Editează Permisiuni","add_permission":"Adaugă Permisiune","this_year":"anul acesta","position":"poziție","default_position":"Poziție inițială","position_disabled":"Categoriile vor fi afișate în ordinea activitații. Pentru a controla ordinea categoriilor în listă, ","position_disabled_click":"activeaza setarea \"poziția fixa a categoriei\".","parent":"Categoria parinte","notifications":{"watching":{"title":"Vizualizare"},"tracking":{"title":"Urmărire"},"regular":{"title":"Normal","description":"Veți fi notificat dacă cineva vă menționează @numele sau vă scrie un reply."},"muted":{"title":"Silențios"}}},"flagging":{"title":"Mulțumim că ne ajuți să păstrăm o comunitate civilizată!","action":"Marcare","take_action":"Actionează","notify_action":"Mesaj","official_warning":"Avertismen Oficial","delete_spammer":"Șterge spammer","yes_delete_spammer":"Da, Șterge spammer","ip_address_missing":"(N/A)","hidden_email_address":"(ascuns)","submit_tooltip":"Acceptă marcarea privată","take_action_tooltip":"Accesati permisiunea marcarii imediat, nu mai asteptati alte marcaje comune","cant":"Ne pare rău nu puteți marca această postare deocamdată.","notify_staff":"Notifică un moderator în privat","formatted_name":{"off_topic":"În afară discuției","inappropriate":"Inadecvat","spam":"Este Spam"},"custom_placeholder_notify_user":"De ce această postare necesită comunicarea cu utilizatorul directă sau privată? Fiți specific, constructiv și intotdeauna amabil.","custom_placeholder_notify_moderators":"De ce această postare necesită atenția moderatorului? Spuneți-ne exact ceea ce vă nelamurește, și oferiți adrese relevante de câte ori e posibil."},"flagging_topic":{"title":"De ce marcați privat această discuție?","action":"Marchează discuție","notify_action":"Mesaj"},"topic_map":{"title":"Sumarul discuției","participants_title":"Posteri Frecvenţi","links_title":"Legături Populare","clicks":{"one":"1 click","few":"%{count} click-uri","other":"%{count} click-uri"}},"topic_statuses":{"warning":{"help":"Aceasta este o avertizare oficială."},"bookmarked":{"help":"Aţi pus un semn de carte pentru această discuţie"},"locked":{"help":"Această discuție este închisă; nu mai acceptă răspunsuri noi"},"archived":{"help":"Această discuție a fost arhivată; Este închetată și nu poate fi editată"},"unpinned":{"title":"Desprinde","help":"Această discuţie va fi afişată în ordinea iniţială, nici un mesaj nu este promovat la inceputul listei."},"pinned_globally":{"title":"Promovat Global"},"pinned":{"title":"Promovat","help":"Aceast mesaj va fi promovat. Va fi afişat la începutul discuţiei."},"invisible":{"help":"Această discuție este invizibilă; nu va fi afișată în listele de discuții și va fi accesată numai prin adresa directă"}},"posts":"Postări","posts_long":"sunt {{number}} de postări în această discuție","original_post":"Postări originale","views":"Vizualizări","views_lowercase":{"one":"vizualizare","few":"vizualizări","other":"vizualizări"},"replies":"Răspunsuri","views_long":"această discuție a fost vizualizată de {{number}} de ori","activity":"Activitate","likes":"Aprecieri","likes_lowercase":{"one":"apreciere","few":"aprecieri","other":"aprecieri"},"likes_long":"sunt {{number}} aprecieri în această discuție","users":"Utilizatori","users_lowercase":{"one":"utilizator","few":"utilizatori","other":"utilizatori"},"category_title":"Categorie","history":"Istoric","changed_by":"de {{author}}","raw_email":{"title":"Email","not_available":"Indisponibil!"},"categories_list":"Listă categorii","filters":{"with_topics":"%{filter} Discuții","with_category":"%{filter} %{category} discuții","latest":{"title":"Ultimele","title_with_count":{"one":"Ultimele (1)","few":"Ultimele ({{count}})","other":"Ultimele ({{count}})"},"help":"Discuții cu postări recente"},"hot":{"title":"Interesant","help":"o selecție a discuțiilor interesante"},"read":{"title":"Citite","help":"Discuții citite, în ordinea cronologică a citirii"},"search":{"title":"Caută","help":"caută în toate discuțiile"},"categories":{"title":"Categorii","title_in":"Categoria - {{categoryName}}","help":"toate discuțiile grupate pe categorii"},"unread":{"title":"Necitite","title_with_count":{"one":"Necitit (1)","few":"Necitite ({{count}})","other":"Necitite ({{count}})"},"help":"discuțiile pe care le vizualizați sau urmariți momentan ce includ postări necitite"},"new":{"lower_title":"nou","title":"Noi","title_with_count":{"one":"Nou (1)","few":"Noi ({{count}})","other":"Noi ({{count}})"},"help":"discuții create în ultimele zile"},"posted":{"title":"Postările mele","help":"discuții în care ați postat"},"bookmarks":{"title":"Semne de carte","help":"discuții cu semne de carte"},"category":{"help":"discuțiile recente din categoria {{categoryName}}"},"top":{"title":"Top","help":"o selecție a celor mai bune discuții din ultimul an, lună sau zi","all":{"title":"Dintotdeauna"},"yearly":{"title":"Anual"},"quarterly":{"title":"Trimestrial"},"monthly":{"title":"Lunar"},"weekly":{"title":"Săptămânal"},"daily":{"title":"Zilnic"},"all_time":"Dintotdeauna","this_year":"An","this_quarter":"Trimestru","this_month":"Lună","this_week":"Săptămană","today":"Astăzi","other_periods":"vezi topul"}},"browser_update":"Din nefericire, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003e browserul dumneavoastră este prea vechi pentru a funcționa pe acest forum \u003c/a\u003e. Va rugăm \u003ca href=\"http://browsehappy.com\"\u003e reânoiți browserul\u003c/a\u003e.","permission_types":{"full":"Creează / Răspunde / Vizualizează","create_post":"Răspunde / Vizualizaează","readonly":"Vizualizaează"},"badges":{"more_badges":{"one":"Încă una","few":" Alte %{count}","other":" Alte %{count}"}},"poll":{"voters":{"one":"participant","few":"participanți","other":"participanți"},"total_votes":{"one":"un vot","few":"total voturi","other":"total voturi"},"average_rating":"Media: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Voturile sunt publice."},"cast-votes":{"title":"Exprimă-ți votul","label":"Votează acum!"},"show-results":{"title":"Afişează rezultatele sondajului","label":"Afișează rezultate"},"hide-results":{"title":"Înapoi la voturile tale","label":"Ascunde rezultate"},"open":{"title":"Deschide sondajul","label":"Deschide sondajul","confirm":"Ești sigur că vrei să deschizi acest sondaj?"},"close":{"title":"Închide sondajul","label":"Închide sondajul","confirm":"Sunteţi sigur că vreţi să închideţi acest sondaj?"}},"type_to_filter":"tastează pentru a filtra...","admin":{"title":"Discurs Admin","moderator":"Moderator","dashboard":{"title":"Spațiu de lucru","last_updated":"Actualizările spațiului de lucru:","version":"Versiune","up_to_date":"Sunteți la zi!","critical_available":"O actualizare importantă este valabilă.","updates_available":"Actualizări sunt disponibile.","please_upgrade":"Vă rugăm upgradați!","no_check_performed":"O căutare a actualizărilor nu a fost făcută. Asigurați-vă că sidekiq este pornit.","stale_data":"O căutare a actualizărilor nu a fost făcută în ultimul timp. Asigurați-vă că sidekiq este pornit.","version_check_pending":"Se pare că ați actualizat recent. Fantastic!","installed_version":"Instalat","latest_version":"Ultima","problems_found":"Ceva probleme s-au întâmpinat la instalarea discursului:","last_checked":"Ultima dată verificat","refresh_problems":"Reîmprospătează","no_problems":"Nicio problemă semnalată.","moderators":"Moderatori:","admins":"Admini:","blocked":"Blocați:","suspended":"Suspendați:","private_messages_short":"Msgs","private_messages_title":"Mesaje","mobile_title":"Mobil","space_free":"{{size}} liber","uploads":"încărcări","backups":"copii de siguranță","traffic_short":"trafic","traffic":"Cereri web","page_views":"Cereri API","page_views_short":"Cereri API","show_traffic_report":"Arată Raportul de Trafic detaliat","reports":{"today":"astăzi","yesterday":"Ieri","last_7_days":"din ultimele 7 zile","last_30_days":"din ultimele 30 de zile","all_time":"Din totdeauna","7_days_ago":"Acum 7 zile","30_days_ago":"Acum 30 de zile","all":"Toate","view_table":"Arată ca tabel","refresh_report":"Reactualizează Raportul","start_date":"Data de început ","end_date":"Data de sfârşit","groups":"Toate grupurile"}},"commits":{"latest_changes":"Ultimele schimbări: Vă rugăm reactualizați des!","by":"de către"},"flags":{"title":"Marcaje","old":"Vechi","active":"Active","agree":"De acord","agree_title":"Confirmă acest marcaj ca valid și corect","agree_flag_modal_title":"De acord și...","agree_flag_hide_post":"De acord (ascunde postarea + trimite MP)","agree_flag_hide_post_title":"Ascunde acest post şi trimite un mesaj urgent utilizatorului să îl editeze.","agree_flag_restore_post":"De acord (restaurare post)","agree_flag_restore_post_title":"Restaurează acest post","agree_flag":"De acord cu marcarea","agree_flag_title":"De acord cu marcarea și menține postarea neschimbată","defer_flag":"Amânare","defer_flag_title":"Scoate marcajul; Nu necesită o acțiune deocamdată.","delete":"Ștergere","delete_title":"Șterge postarea la care face referința marcajul.","delete_post_defer_flag":"Șterge postarea și renunță la marcaj","delete_post_defer_flag_title":"Șterge postarea; dacă este prima, șterge discuția","delete_post_agree_flag":"Șterge postarea și aprobă marcajul","delete_post_agree_flag_title":"Șterge postarea; dacă este prima, sterge discuția","delete_flag_modal_title":"Ștergere și...","delete_spammer":"Ștergere Spammer","delete_spammer_title":"Șterge utilizatorul , postările și discuțiile acestuia.","disagree_flag_unhide_post":"Nu sunt de acord (arată postarea)","disagree_flag_unhide_post_title":"Înlătură orice marcaj din postare și fă postarea din nou vizibilă","disagree_flag":"Nu sunt de acord","disagree_flag_title":"Refuză marcaj, acesta fiind invalid sau incorect","clear_topic_flags":"Terminat","clear_topic_flags_title":"Discuția a fost analizată iar problema rezolvată. Face-ți click pe Terminat pentru a înlătura marcajul.","more":"(detalii...)","dispositions":{"agreed":"de acord","disagreed":"Nu sunt de acord","deferred":"amânat"},"flagged_by":"Marcat de către","resolved_by":"Resolvat de către","took_action":"A luat măsuri","system":"Sistem","error":"Ceva a nu a funcționat","reply_message":"Răspunde","no_results":"Nu există marcaje.","topic_flagged":"Această \u003cstrong\u003ediscuție\u003c/strong\u003e a fost marcată.","visit_topic":"Vizualizați discuția pentru a acționa.","was_edited":"Mesajul a fost editat după primul semn","previous_flags_count":"Acest mesaj a fost deja marcat de {{count}} ori.","summary":{"action_type_3":{"one":"în afară discuţiei","few":"în afară discuţiei x{{count}}","other":"în afară discuţiei x{{count}}"},"action_type_4":{"one":"inadecvat","few":"inadecvat x{{count}}","other":"inadecvat x{{count}}"},"action_type_6":{"one":"personalizat","few":"personalizat x{{count}}","other":"personalizat x{{count}}"},"action_type_7":{"one":"personalizat","few":"personalizat x{{count}}","other":"personalizat x{{count}}"},"action_type_8":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"}}},"groups":{"primary":"Grup primar","no_primary":"(nu există grup primar)","title":"Grupuri","edit":"Editează  Grupuri","refresh":"Reîmprospătează","new":"Noi","selector_placeholder":"adaugă utilizatori","name_placeholder":"Numele grupului, fără spații, asemenea regulii de utilizator","about":"Editează aici apartentența la grupuri și numele","group_members":"Membrii grupului","delete":"Ștergere","delete_confirm":"Șterg acest grup?","delete_failed":"Imposibil de șters grupul. Dacă este unul automat, nu se poate șterge.","delete_member_confirm":"Şterge '%{username}' din grupul '%{group}'?","delete_owner_confirm":"Revocă dreptul de proprietar pentru '%{username}'?","name":"Nume","add":"Adaugă","add_members":"Adaugă membri","custom":"Personalizat","bulk_complete":"Utilizatorii au fost adăugați în grup.","bulk":"Adaugă în grup la grămadă","bulk_paste":"Lipiți o listă de utilizatori sau email-uri, unul pe linie:","bulk_select":"(selectați un grup)","automatic":"Automat","automatic_membership_email_domains":"Utilizatorii care se înregistrează cu un domeniu de email care se potriveşte cu unul din lista va fi adăugat automat în aces grup:","automatic_membership_retroactive":"Aplicaţi aceeaşi regulă pentru domeniul de email pentru a adaugă utilizatorii existenţi","default_title":"Titlu automat pentru toţi utilizatorii din acest grup","primary_group":"Setează automat că grup primar","group_owners":"Proprietari","add_owners":"Adaugă proprietari","incoming_email_placeholder":"introduceți adresa de email"},"api":{"generate_master":"Generează cheie API principală","none":"Nu sunt chei API principale active deocamdată.","user":"Utilizator","title":"API","key":"Cheie API","generate":"Generează","regenerate":"Regenerează","revoke":"Revocare","confirm_regen":"Sunteți sigur ca doriți să înlocuiți această cheie API cu una nouă?","confirm_revoke":"Sunteți sigur ca doriți să revocați acea cheie?","info_html":"Cheia dumneavoastră API vă permite să creați și să actualizați discuții folosind sintaxa JSON.","all_users":"Toți utilizatorii","note_html":"Păstrează această cheie \u003cstrong\u003esecretă\u003c/strong\u003e, toți utilizatorii ce o detin pot crea  postări arbitrare pe forum ca oricare alt utilizator."},"plugins":{"title":"Plugin-uri","installed":"Plugin-uri instalate","name":"Nume","none_installed":"Nu aveţi nici un plugin instalat.","version":"Versiune","enabled":"Activat?","is_enabled":"D","not_enabled":"N","change_settings":"Schimbă Setările","change_settings_short":"Setări","howto":"Cum instalez un plugin?"},"backups":{"title":"Copii de siguranță","menu":{"backups":"Copii de siguranță","logs":"Rapoarte"},"none":"Nici o copie de siguranță disponibilă.","logs":{"none":"Nu există rapoarte..."},"columns":{"filename":"Numele fișierului","size":"Mărime"},"upload":{"label":"Încarcă","title":"Încarcă o copie de siguranţă în această instanţa.","uploading":"ÎNCARCĂ","success":"fișierul '{{filename}}' a fost încărcat cu succes.","error":"S-a semnalat o eroare la încărcarea fișierului '{{filename}}': {{message}}"},"operations":{"is_running":"O altă operație este în desfășurare...","failed":"operația {{operation}} nu s-a finalizat. Vă rugăm verificați rapoartele.","cancel":{"label":"Anulează","title":"Anulează operația curentă","confirm":"Sunteți sigur că doriți să anulați operația curentă?"},"backup":{"label":"Salvare de siguranţă","title":"Creați o copie de siguranță","confirm":"Ești sigur că vrei să faci o nouă copie de siguranță?","without_uploads":"Da (nu include fişierele)"},"download":{"label":"Descarcă","title":"Downloadează copia de siguranță"},"destroy":{"title":"Sterge copie de siguranță","confirm":"Ești sigur ca vrei să ștergi această copie de siguranță?"},"restore":{"is_disabled":"Restabilirea este dezactivată din setările siteului.","label":"Restaurează","title":"Restaurează copia de siguranță"},"rollback":{"label":"Revenire la situaţia anterioară","title":"Restabilește baza de date în stadiul anterior"}}},"export_csv":{"user_archive_confirm":"Sunteţi sigur că doriţi să descărcaţi mesajele dvs.?","success":"Exportul a fost iniţiat. Veţi primi un mesaj de notificare când procesul se va termina.","failed":"Exportul a eşuat. Va rugăm verificaţi jurnalul.","rate_limit_error":"Postările pot fi descărcate doar o singură dată pe zi. Va rugăm încercaţi mâine.","button_text":"Exportă","button_title":{"user":"Exportă lista totală a utilizatorilor în formatul CSV.","staff_action":"Exportă jurnalul de acțiuni a conducerii în formatul CSV.","screened_email":"Exportă lista totală a adreselor de email verificate în format CSV.","screened_ip":"Exportă lista totală a adreselor de IP verificate în format CSV.","screened_url":"Exportă lista totală a adreselor URL verificate în format CSV."}},"export_json":{"button_text":"Exportă"},"invite":{"button_text":"Trimite o invitație","button_title":"Trimite o invitație"},"customize":{"title":"Personalizări","long_title":"Modificarea Site-ului","css":"Foaie de stil","header":"Titlu","top":"Top","footer":"Subsol","embedded_css":"Embedded CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML care va fi inserat înaintea de tag-ul \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML care va fi inserat înaintea de tag-ul \u003c/body\u003e"},"override_default":"Nu include foaia de stil standard","enabled":"Activat?","preview":"previzualizează","undo_preview":"șterge previzualizarea","rescue_preview":"stil predefinit","explain_preview":"Vizualizează site-ul cu foaia de stil predefinită","explain_undo_preview":"Înapoi la foaia de stil preferentială activată momentan","explain_rescue_preview":"Vizualizeaza site-ul cu foaia de stil predefinită","save":"Salvează","new":"Nou","new_style":"Stil nou","import":"Importă","import_title":"Selectați un fișier sau lipiți un text","delete":"Șterge","delete_confirm":"Șterge aceste preferințe?","about":"Modifică foaia de stil CSS și capetele HTML Modify CSS din site. Adaugă o preferința pentru a începe.","color":"Culoare","opacity":"Opacitate","copy":"Copiază","email_templates":{"title":"Sabloane","subject":"Subiect","multiple_subjects":"Acest șablon are mai multe subiecte","body":"Body","none_selected":"Selectați un șablon pentru a începe editarea","revert":"Revocați schimbările","revert_confirm":"Ești sigur că vreți să revocați schimbările?"},"css_html":{"title":"CSS/HTML","long_title":"Customizarile CSS and HTML"},"colors":{"title":"Culori","long_title":"Tabel culori","about":"Modifică culorile folosite în site fară a scrie CSS. Adaugă un nou aranjament pentru a începe.","new_name":"O un nou aranjament pentru culori","copy_name_prefix":"Copiază","delete_confirm":"Șterge acest aranjament de culori?","undo":"rescrie","undo_title":"Rescrie schimbările acestei culori de ultima oară când a fost salvată.","revert":"refacere","revert_title":"Resetează culoarea la stadiul aranjamentului predefinit .","primary":{"name":"primar","description":"Majoritatea textului, iconițe și margini."},"secondary":{"name":"secundar","description":"Culoarea principală de fundal și culoarea textului anumitor butoane."},"tertiary":{"name":"terțiar","description":"Adrese, cateva butoane, notificări, și culoarea de accent."},"quaternary":{"name":"quaternar","description":"Adrese de navigare."},"header_background":{"name":"fundalul Header-ului","description":"Culoarea de fundal a header-ului din site."},"header_primary":{"name":"header-ul primar","description":"Textul și inconițele din header-ul site-ului."},"highlight":{"name":"Iluminare","description":"Culoarea de fundal a elementelor iluminate din pagina, cum ar fi postări și discuții."},"danger":{"name":"Pericol","description":"Ilumineazș culoarea pentru acțiuni ca ștergerea postărilor și a discuțiilor."},"success":{"name":"succes","description":"Indică starea de succes a unei operațiuni."},"love":{"name":"Iubire","description":"Culoarea butonului de apreciere."}}},"email":{"title":"Emails","settings":"Opțiuni","templates":"Șabloane","preview_digest":"Previzualizează rezumat","sending_test":"Trimite email de test...","error":"\u003cb\u003eEROARE\u003c/b\u003e - %{server_error}","test_error":"S-a semnalat o problemă la trimtirerea email-ului. Vă rugăm verificați setările mailului, Verificați ca gazda sa nu bocheze conexiunile de email și reâncercați.","sent":"Trimise","skipped":"Omise","received":"Primite","rejected":"Respinse","sent_at":"Trimise la","time":"Timp","user":"Utilizator","email_type":"Tipul de Email","to_address":"La adresa","test_email_address":"Adresă email de test","send_test":"Trimite Email de test","sent_test":"trimis!","delivery_method":"Metoda de livrare","refresh":"Reîmprospătează","format":"Format","html":"html","text":"text","last_seen_user":"Ultimul utilizator văzut:","reply_key":"Cheie de răspuns","skipped_reason":"Motiv omiterii","incoming_emails":{"from_address":"De la","to_addresses":"Către","cc_addresses":"Cc","subject":"Subiect","error":"Eroare","filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Subiect...","error_placeholder":"Eroare"}},"logs":{"none":"Nu s-au găsit rapoarte.","filters":{"title":"Filtru","user_placeholder":"nume utilizator","address_placeholder":"nume@exemplu.com","type_placeholder":"rezumat, înregistrare...","reply_key_placeholder":"cheie de răspuns","skipped_reason_placeholder":"motivul"}}},"logs":{"title":"Rapoarte","action":"Acțiune","created_at":"Creat","last_match_at":"Ultima potrivire","match_count":"Potriviri","ip_address":"Adresa IP","topic_id":"ID Discuție","post_id":"ID Mesaj","category_id":"ID categorie","delete":"Șterge","edit":"Editează","save":"Salvează","screened_actions":{"block":"blochează","do_nothing":"nu acționa"},"staff_actions":{"title":"Acțiunile membrilor din staff","instructions":"Clic pe numele utilizatorului şi acţiuni pentru a filtra lista. Clic pe poză profilului pentru a vizita pagina utilizatorului.","clear_filters":"Arată tot","staff_user":"Utilizatorul din staff","target_user":"Utilizator țintă","subject":"Subiect","when":"Când","context":"Contextul","details":"Detalii","previous_value":"Precedent","new_value":"Nou","diff":"Diff","show":"Arată","modal_title":"Detalii","no_previous":"Nu există valoare precedentă.","deleted":"Nu există valoare nouă. Jurnalele au fost șterse.","actions":{"delete_user":"șterge utilizator","change_trust_level":"schimbă nivelul de încredere","change_username":"schimbă numele utilizatorului","change_site_setting":"schimbă setările site-ului","change_site_customization":"schimbă preferințele site-ului","delete_site_customization":"șterge preferințele site-ului","change_site_text":"schimbă textul site-ului","suspend_user":"suspendă utilizator","unsuspend_user":"reactivează utilizator","grant_badge":"acordă insignă","revoke_badge":"revocă insignă","check_email":"Verifică emailul","delete_topic":"şterge discuția","delete_post":"şterge mesajul","impersonate":"joacă rolul","anonymize_user":"fă userul anonim","change_category_settings":"schimbă setările categoriei","delete_category":"șterge categorie","create_category":"creează categorie","block_user":"blochează utilizator","unblock_user":"deblochează utilizator","grant_admin":"Acordă titlul de Admin","revoke_admin":"Revocă titlul de Admin","grant_moderation":"Acordă titlul de Moderator","revoke_moderation":"Revocă titlul de Moderator"}},"screened_emails":{"title":"Email-uri filtrate","description":"Când cineva încearcă să creeze un nou cont, următorul email va fi verificat iar înregistrarea va fi blocată, sau o altă acțiune va fi inițiată.","email":"Adresa email","actions":{"allow":"Permite"}},"screened_urls":{"title":"URL-uri filtrate","description":"URL-urile listate aici au fost folosite în postări de către utilizatorii ce sunt identificați ca spammeri.","url":"URL","domain":"Domeniu"},"screened_ips":{"title":"IP-uri filtrate","description":"adresele de IP sunt supravegheate. Folosește \"permite\" să golești lista de IP-uri.","delete_confirm":"Ești sigur că vrei să anulezi regula pentru %{ip_address}?","actions":{"block":"Blochează","do_nothing":"Permite","allow_admin":"Permite Admin"},"form":{"label":"Noi:","ip_address":"Adresă IP","add":"Adaugă","filter":"Caută"},"roll_up":{"text":"Roll up"}},"logster":{"title":"Jurnal de erori"}},"impersonate":{"title":"Imită Utilizator","help":"Folosește această unealtă pentru a imita un cont de utilizator în scopul de debugging.","not_found":"Utilizatorul nu poate fi găsit.","invalid":"Ne pare rău, dar nu puteţi prelua rolul acelui utilizator."},"users":{"title":"Utilizatori","create":"Adaugă Utilizator cu titlul de Admin","last_emailed":"Ultimul Email trimis","not_found":"Ne pare rău, acest nume de utilizator nu există în sistem.","id_not_found":"Ne pare rău, dar acest utilizator nu există în sistemul nostru.","active":"Activ","show_emails":"Arată Mail-urile","nav":{"new":"Nou","active":"Activ","pending":"În așteptare","staff":"Personalul","suspended":"Suspendate","blocked":"Blocate","suspect":"Suspect"},"approved":"Aprobate?","approved_selected":{"one":"aprobă utilizatorul","few":"aprobă utilizatorii ({{count}})","other":"aprobă utilizatorii ({{count}})"},"reject_selected":{"one":"refuză utilizatorul","few":"refuză utilizatorii ({{count}})","other":"refuză utilizatorii ({{count}})"},"titles":{"active":"Utilizatori activi","new":"Utilizatori noi","pending":"Utilizatori în așteptare de previzualizare","newuser":"Utilizatori la nielul de încredere 0 (utilizator nou)","basic":"Utilizatori la nivel de încredere 1 (utilizator de baza)","member":"Utilizatori la nivel de încredere 2 (Membri)","regular":"Utilizatori la nivel de încredere 3 (Utilizator activ)","leader":"Utilizatori la nivel de încredere 4 (Lider)","staff":"Personalul","admins":"Administratori","moderators":"Moderatori","blocked":"Utilizatori blocați","suspended":"Utilizatori suspendați","suspect":"Utilizatori Suspecţi"},"reject_successful":{"one":"1 utilizator a fost rejectat cu success.","few":"%{count} utilizatori au fost rejectaţi cu success.","other":"%{count} utilizatori au fost rejectaţi cu success."},"reject_failures":{"one":"Rejectarea a 1 utilizator a eşuat.","few":"Rejectarea a %{count} utilizatori a eşuat.","other":"Rejectarea a %{count} utilizatori a eşuat."},"not_verified":"Neverificat","check_email":{"title":"Arată adresa de email a acestui utilizator","text":"Arată"}},"user":{"suspend_failed":"Ceva nu a funcționat în suspendarea acestui utilizator {{error}}","unsuspend_failed":"Ceva nu a funcționat în activarea acestui utilizator {{error}}","suspend_duration":"Pentru cât timp va fi suspendat utilizatorul?","suspend_duration_units":"(zile)","suspend_reason_label":"De ce suspendați? Acest text \u003cb\u003eva fi vizibil oricui\u003c/b\u003e pe pagina de profil a utilizatorului, și va fi arătat utilizatorului când încearca autentificara. încercați să fiți succint.","suspend_reason":"Motiv","suspended_by":"Suspendat de","delete_all_posts":"Șterge toate postările","suspend":"Suspendat","unsuspend":"Activat","suspended":"Suspendat?","moderator":"Moderator?","admin":"Admin?","blocked":"Blocat?","show_admin_profile":"Admin","edit_title":"Editează Titlu","save_title":"Salvează Titlu","refresh_browsers":"Fortează reîmprospătarea browserului","refresh_browsers_message":"Mesajul a fost trimis către toţi clienţii. ","show_public_profile":"Arată profilul public","impersonate":"Imită","ip_lookup":"Cautare IP","log_out":"Ieșire","logged_out":"Acest utilizator a ieșit de pe toate dispozitivele","revoke_admin":"Revocă tirlu Admin","grant_admin":"Acordă titlu Admin","revoke_moderation":"Revocă titlu moderator","grant_moderation":"Acordă titlu moderator","unblock":"Deblochează","block":"Blochează","reputation":"Reputație","permissions":"Permisiuni","activity":"Activitate","like_count":"Aprecieri primite","last_100_days":"în ultimele 100 zile","private_topics_count":"Discuții private","posts_read_count":"Postări citite","post_count":"Postări Create","topics_entered":"Discuții Văzute","flags_given_count":"Marcaje acordate","flags_received_count":"Marcaje primite","warnings_received_count":"Avertizări Primite","flags_given_received_count":"Marcaje Acordate / Primite","approve":"Aprobare","approved_by":"aprobat de","approve_success":"Utilizator aprobat , email trimis cu instrucțiuni de activare.","approve_bulk_success":"Succes! Toți utilizatorii selectați au fost aprobați și notificați.","time_read":"Timp de citire","anonymize":"Fă userul anonim","anonymize_confirm":"Sunteţi SIGUR că vreţi să transformaţi acest cont într-un cont anonim? Operaţiunea va schimba numele utilizatorului şi adresa de email şi va reseta toate informaţiile din profil.","anonymize_yes":"Da, fă acest user anonim","anonymize_failed":"A apărut o problema în timpul transformării contului în cont anonim.","delete":"Ștergere Utilizator","delete_forbidden_because_staff":"Adminii și moderatorii nu pot fi sterși.","delete_posts_forbidden_because_staff":"Nu puteți șterge toate mesajele administratorilor și moderatorilor.","delete_forbidden":{"one":"Utilizatorii nu pot fi şterşi dacă au postări. Ştergeţi toate postările înainte de a încerca ştergerea unui utilizator. (Postările mai vechi de %{count} zile nu pot fi şterse)","few":"Utilizatorii nu pot fi şterşi dacă au postări. Ştergeţi toate postările înainte de a încerca ştergerea unui utilizator. (Postările mai vechi de %{count} zile nu pot fi şterse)","other":"Utilizatorii nu pot fi şterşi dacă au postări. Ştergeţi toate postările înainte de a încerca ştergerea unui utilizator. (Postările mai vechi de %{count} zile nu pot fi şterse)"},"cant_delete_all_posts":{"one":"Nu pot fi şterse toate postările. Unele postări sunt mai vechi de %{count} zile. (Setarea delete_user_max_post_age)","few":"Nu pot fi şterse toate postările. Unele postări sunt mai vechi de %{count} zile. (Setarea delete_user_max_post_age)","other":"Nu pot fi şterse toate postările. Unele postări sunt mai vechi de %{count} zile. (Setarea delete_user_max_post_age)"},"cant_delete_all_too_many_posts":{"one":"Nu pot fi şterse toate postările deoarece utilizatorul are mai mult de 1 postare. (Setarea delete_all_posts_max)","few":"Nu pot fi şterse toate postările deoarece utilizatorul are mai mult de %{count} postări. (Setarea delete_all_posts_max)","other":"Nu pot fi şterse toate postările deoarece utilizatorul are mai mult de %{count} postări. (Setarea delete_all_posts_max)"},"delete_confirm":"Sunteți sigur că doriți ștergerea acestui utilizator? Acțiunea este permanentă!","delete_and_block":"\u003cb\u003eDa\u003c/b\u003e, și \u003cb\u003eblock\u003c/b\u003e viitoarele autentificări pe acest email și adresă IP","delete_dont_block":"\u003cb\u003eDa\u003c/b\u003e, șterge decât utilizatorul","deleted":"Utilizatorul a fost șters.","delete_failed":"S-a semnalat o eroare la ștergerea utilizatorului. Asigurați-vă că toate postările sunt șterse înainte de a încerca ștergerea utilizatorului.","send_activation_email":"Trimite email de activare","activation_email_sent":"Um email de activare a fost trimis.","send_activation_email_failed":"S-a semnalat o eroare la trimiterea altui email de activare. %{error}","activate":"Activarea contului","activate_failed":"S-a semnalat o problemă la activarea utilizatorului.","deactivate_account":"Dezactivează cont","deactivate_failed":"S-a semnalat o problemă la dezactivarea utilizatoprului.","unblock_failed":"S-a semnalat o problemă la deblocarea utlizatorului.","block_failed":"S-a semnalat o problemă la blocarea utilizatorului.","block_accept":"Blochează utilizatorul","deactivate_explanation":"Un utilizator dezactivat va trebui să-și revalideze email-ul.","suspended_explanation":"Un utilizator suspendat nu se poate autentifica","block_explanation":"Un utilizator blocat nu poate posta sau porni o discuție.","trust_level_change_failed":"S-a semnalat o problemă la schimbarea nivelului de încredere al utilizatorului.","suspend_modal_title":"Suspendă utilizator","trust_level_2_users":"utilizatori de nivel de încredere 2 ","trust_level_3_requirements":"Cerințe pentru nivelul 3 de încredere","trust_level_locked_tip":"Nivelul de Încredere este blocat, sistemul nu va promova sau retrograda utilizatorii","trust_level_unlocked_tip":"Nivelul de Încredere este deblocat, sistemul poate promova sau retrograda utilizatorii","lock_trust_level":"Blochează Nivelul de Încredere","unlock_trust_level":"Deblochează Nivelul de Încredere","tl3_requirements":{"title":"Cerințe pentru nivelul 3 de încredere","value_heading":"Valoarea","requirement_heading":"Cerințe","visits":"Vizite","days":"zile","topics_replied_to":"Discuții la care s-a răspuns","topics_viewed":"Discuții văzute","topics_viewed_all_time":"Discuții văzute (din totdeauna)","posts_read":"Postări citite","posts_read_all_time":"Postări citite (din totdeauna)","flagged_posts":"Postări marcate","flagged_by_users":"Utilizatori ce au marcat","likes_given":"Aprecieri Oferite","likes_received":"Aprecieri Primite","likes_received_days":"Aprecieri Primite: zile unice","likes_received_users":"Aprecieri Primite: utilizatori unici","qualifies":"Calificări pentru nivelul 3 de încredere.","does_not_qualify":"Nu se califică pentru nivelul 3 de încredere.","will_be_promoted":"Vor fi promovați în 24 de ore.","will_be_demoted":"Va fi retrogradat în curând.","on_grace_period":"În prezent, în perioada de grație de promovare, nu va fi retrogradat.","locked_will_not_be_promoted":"Nivelul de Încredere blocat. Nu va fi niciodata promovat.","locked_will_not_be_demoted":"Nivelul de Încredere blocat. Nu va fi niciodata retrogradat."},"sso":{"title":"Single Sign On","external_id":"ID Extern","external_username":"Nume Utilizator","external_name":"Nume","external_email":"Email","external_avatar_url":"URL poză de profil"}},"user_fields":{"title":"Câmpuri utilizator","help":"Adăugaţi câmpuri pe care utilizatorii le pot completa.","create":"Creează un câmp utilizator","untitled":"Fără titlu","name":"Nume câmp","type":"Tip câmp","description":"Descriere câmp","save":"Salvează","edit":"Editează","delete":"Șterge","cancel":"Anulează","delete_confirm":"Sunteți sigur că stergeți acest câmp utilizator?","options":"Optiuni","required":{"title":"Necesar la înscriere?","enabled":"necesar","disabled":"opţional"},"editable":{"title":"Editabil după înregistrare?","enabled":"editabil","disabled":"nu este editabil"},"show_on_profile":{"title":"Arată în profilul public","enabled":"arată în profil","disabled":"nu arată în profil"},"field_types":{"text":"Câmp Text","confirm":"Confirmare","dropdown":"Select"}},"site_text":{"title":"Conținut","edit":"editează","revert":"Revocați schimbările","revert_confirm":"Ești sigur că vreți să revocați schimbările?","go_back":"Înapoi la căutare","show_overriden":"Arată doar rescrierile"},"site_settings":{"show_overriden":"Arată doar rescrierile","title":"Setări","reset":"resetează","none":"nimic","no_results":"Nu s-au găsit rezultate.","clear_filter":"Șterge","add_url":"adaugă URL","categories":{"all_results":"Toate","required":"Cerute","basic":"Setări de bază","users":"Utilizatori","posting":"Mesaje","email":"Email","files":"Fișiere","trust":"Niveluri de încredere","security":"Securitate","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limite","developer":"Developer","embedding":"Includere","legal":"Legal","uncategorized":"Altele","backups":"Copii de siguranță","login":"Autentificare","plugins":"Plugin-uri","user_preferences":"Preferințe"}},"badges":{"title":"Insigne","new_badge":"Insignă nouă","new":"Nou","name":"Nume","badge":"Insignă","display_name":"Afișeaza numele","description":"Descriere","badge_type":"Tipul insignei","badge_grouping":"Grup","badge_groupings":{"modal_title":"Insigne de grup"},"granted_by":"Acordat de","granted_at":"Acordat la","reason_help":"(O legătură către o postare sau o discuţie)","save":"Salvează","delete":"Șterge","delete_confirm":"Ești sigur că vrei să ștergi această insignă?","revoke":"Revocă","reason":"Motiv","expand":"Extinde \u0026hellip;","revoke_confirm":"Sunteți sigur ca  revocați insigna?","edit_badges":"Editează insigne","grant_badge":"Acordă insignă","granted_badges":"Insigne acordate","grant":"Acordă","no_user_badges":"%{name} nu i-a fost acordată nicio insignă.","no_badges":"Nu există nicio insignă ce poate fi acordată.","none_selected":"Selectaţi o insignă pentru a începe","allow_title":"Permite insigna sa fie folosită ca titlu","multiple_grant":"Poate sa fie acordată de mai multe ori","listable":"Arată insignă pe pagina publică a insignelor","enabled":"Activează insignă","icon":"Pictogramă","image":"Imagine","icon_help":"Folosiţi o clasă Font Awesome sau un URL pentru imagine","query":"Interogare insignă (SQL)","target_posts":"Interogarea mesajelor ţintă","auto_revoke":"Pornește verificarea de revocare î fiecare zi","show_posts":"Arata mesaje ce acordă insigne pe pagina de insigne","trigger":"Declanșator","trigger_type":{"none":"Actualizare zilnică","post_action":"Când un utilizator reacționează la un mesaj","post_revision":"Când un utlizator creează sau editează un mesaj","trust_level_change":"Când un utilizator schimbă nivelul de încredere","user_change":"Când un utilizator este editat sau creat"},"preview":{"link_text":"Previzualizare insigne acordate","plan_text":"Previzualizare cu interogare","modal_title":"Previzualizare Interogare Insignă","sql_error_header":"A apărut o eroare la executarea interogării.","error_help":"Vezi legăturile următoare pentru ajutor referitor la interogări pentru insigne.","bad_count_warning":{"header":"ATENȚIE!"},"sample":"Exemplu:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e pentru mesajul în %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e pentru mesajul în %{link} la \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e la \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Adaugă un nou \"emoji\" care va fi disponibil pentru toţi. (PROTIP: trage şi adaugă mai multe fişiere odată)","add":"Adaugă un emoji nou","name":"Nume","image":"Imagine","delete_confirm":"Ești sigur că vrei să ștergi emoji-ul :%{name}:?"},"embedding":{"confirm_delete":"Ești sigur că vrei să ștergi acest host?","sample":"Folosiți următorul cod HTML în site-ul dvs. pentru a crea și pentru a embed-ui topic-uri discourse. Înlocuiți \u003cb\u003eREPLACE_ME\u003c/b\u003e cu URL-ul canonic al paginii pe care doriți să o embed-uiți.","title":"Embedding","host":"Host-uri permise","edit":"editează","category":"Postează în categoria","add_host":"Adaugă host","settings":"Setări pentru embeding","feed_settings":"Setări Feed","embed_post_limit":"Numărul maxim de postări de încorporat.","save":"Salvați setările pentru embeding"},"permalink":{"title":"Adrese permanente","url":"URL","topic_id":"ID discuție","topic_title":"Discuție","post_id":"ID postare","post_title":"Postare","category_id":"ID categorie","category_title":"Categorie","external_url":"URL extern","delete_confirm":"Ești sigur că vrei să ștergi această adresă permanentă?","form":{"label":"Nou:","add":"Adaugă","filter":"Căutare (URL sau URL extern)"}}}}},"en":{"js":{"dates":{"timeline_date":"MMM YYYY","wrap_ago":"%{date} ago"},"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}","invited_user":"invited %{who} %{when}","invited_group":"invited %{who} %{when}","removed_user":"removed %{who} %{when}","removed_group":"removed %{who} %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"ap_south_1":"Asia Pacific (Mumbai)","cn_north_1":"China (Beijing)"}},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","groups":{"empty":{"posts":"There is no post by members of this group.","members":"There is no member in this group.","topics":"There is no topic by members of this group."},"index":"Groups","alias_levels":{"title":"Who can message and @mention this group?"},"trust_levels":{"title":"Trust level automatically granted to members when they're added:"},"notifications":{"watching":{"description":"You will be notified of every new post in every message, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."},"tracking":{"description":"You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"muted":{"description":"You will never be notified of anything about new topics in this group."}}},"categories":{"category_list":"Display category list","topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"perm_denied_expl":"You denied permission for notifications. Allow notifications via your browser settings.","currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","mailing_list_mode":{"enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","muted_categories_instructions":"You will not be notified of anything about new topics in these categories, and they will not appear in latest.","watched_topics_link":"Show watched topics","automatically_unpin_topics":"Automatically unpin topics when I reach the bottom.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","messages":{"failed_to_move":"Failed to move selected messages (perhaps your network is down)"},"change_about":{"error":"There was an error changing this value."},"change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email":{"frequency_immediately":"We'll email you immediately if you haven't read the thing we're emailing you about.","frequency":{"one":"We'll only email you if we haven't seen you in the last minute.","other":"We'll only email you if we haven't seen you in the last {{count}} minutes."}},"like_notification_frequency":{"title":"Notify when liked","first_time_and_daily":"First time a post is liked and daily","first_time":"First time a post is liked"},"email_previous_replies":{"title":"Include previous replies at the bottom of emails","unless_emailed":"unless previously sent"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies","every_hour":"hourly"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","invited":{"redeemed_tab":"Redeemed","redeemed_tab_with_count":"Redeemed ({{count}})","reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!","generate_link":"Copy Invite Link","generated_link_message":"\u003cp\u003eInvite link generated successfully!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eInvite link is only valid for this email address: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e"},"summary":{"no_likes":"No likes yet."}},"read_only_mode":{"enabled":"This site is in read only mode. Please continue to browse, but replying, likes, and other actions are disabled for now.","logout_disabled":"Logout is disabled while the site is in read only mode."},"too_few_topics_and_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","too_few_topics_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics. New visitors need some conversations to read and respond to.","too_few_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"signup_cta":{"intro":"Hey there! :heart_eyes: Looks like you're enjoying the discussion, but you're not signed up for an account."},"summary":{"description":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies.","description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"login":{"instagram":{"title":"with Instagram","message":"Authenticating with Instagram (make sure pop up blockers are not enabled)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_whisper":"Toggle Whisper","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"},"alt":{"edited":"Edit your post by","liked":"Liked your post","invited_to_private_message":"Invited to a private message from","invited_to_topic":"Invited to a topic from","invitee_accepted":"Invite accepted by","moved_post":"Your post was moved by","granted_badge":"Badge granted","group_message_summary":"Messages in group inbox"}},"upload_selector":{"remote_tip_with_attachments":"link to image or file {{authorized_extensions}}","hint_for_supported_browsers":"you can also drag and drop or paste images into the editor"},"search":{"clear_all":"Clear All","too_short":"Your search term is too short.","no_more_results":"No more results found.","context":{"category":"Search the #{{category}} category"}},"hamburger_menu":"go to another topic list or category","topics":{"bulk":{"unlist_topics":"Unlist Topics","dismiss":"Dismiss","dismiss_read":"Dismiss all unread","dismiss_button":"Dismiss…","dismiss_tooltip":"Dismiss just new posts or stop tracking topics","also_dismiss_topics":"Stop tracking these topics so they never show up as unread for me again","change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."},"none":{"educate":{"new":"\u003cp\u003eYour new topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered new and will show a \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e indicator if they were created in the last 2 days.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e","unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}}},"topic":{"unsubscribe":{"change_notification_state":"Your current notification state is "},"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"feature_topic":{"pin":"Make this topic appear at the top of the {{categoryLink}} category until","unpin_until":"Remove this topic from the top of the {{categoryLink}} category or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Make this topic appear at the top of all topic lists until","unpin_globally_until":"Remove this topic from the top of all topic lists or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"no_banner_exists":"There is no banner topic.","banner_exists":"There \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e currently a banner topic."},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"controls":"Topic Controls","invite_reply":{"to_topic_username":"You've entered a username. We'll send a notification with a link inviting them to this topic.","to_username":"Enter the username of the person you'd like to invite. We'll send a notification with a link inviting them to this topic."},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_timestamp":{"invalid_timestamp":"Timestamp cannot be in the future.","error":"There was an error changing the timestamp of the topic.","instructions":"Please select the new timestamp of the topic. Posts in the topic will be updated to have the same time difference."}},"post":{"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","whisper":"this post is a private whisper for moderators","wiki":{"about":"this post is a wiki"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","controls":{"change_owner":"Change Ownership"},"actions":{"people":{"notify_moderators":"notified moderators","notify_user":"sent a message","bookmark":"bookmarked this","like":"liked this","vote":"voted for this"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision"}}},"category":{"topic_template":"Topic Template","tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","create_long":"Create a new category","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","suppress_from_homepage":"Suppress this category from the homepage.","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"muted":{"description":"You will never be notified of anything about new topics in these categories, and they will not appear in latest."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"topic_statuses":{"locked_and_archived":{"help":"This topic is closed and archived; it no longer accepts new replies and cannot be changed"},"pinned_globally":{"help":"This topic is pinned globally; it will display at the top of latest and its category"}},"posts_likes_MF":"This topic has {count, plural, one {1 reply} other {# replies}} {ratio, select,\n  low {with a high like to post ratio}\n  med {with a very high like to post ratio}\n  high {with an extremely high like to post ratio}\n  other {}}\n","filters":{"unread":{"lower_title_with_count":{"one":"1 unread","other":"{{count}} unread"}},"new":{"lower_title_with_count":{"one":"1 new","other":"{{count}} new"}},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"}}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"groups":{"incoming_email":"Custom incoming email address","flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"operations":{"restore":{"confirm":"Are you sure you want to restore this backup?"},"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"email":{"bounced":"Bounced","preview_digest_desc":"Preview the content of the digest emails sent to inactive users.","incoming_emails":{"none":"No incoming emails found.","modal":{"title":"Incoming Email Details","error":"Error","headers":"Headers","subject":"Subject","body":"Body","rejection_message":"Rejection Mail"}}},"logs":{"staff_actions":{"actions":{"roll_up":"roll up IP blocks","backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}},"screened_ips":{"roll_up_confirm":"Are you sure you want to roll up commonly screened IP addresses into subnets?","rolled_up_some_subnets":"Successfully rolled up IP ban entries to these subnets: %{subnets}.","rolled_up_no_subnet":"There was nothing to roll up.","roll_up":{"title":"Creates new subnet ban entries if there are at least 'min_ban_entries_for_roll_up' entries."}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","block_confirm":"Are you sure you want to block this user? They will not be able to create any new topics or posts.","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"}},"site_text":{"description":"You can customize any of the text on your forum. Please start by searching below:","search":"Search for the text you'd like to edit","recommended":"We recommend customizing the following text to suit your needs:"},"site_settings":{"add_host":"add host","categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"long_description":"Long Description","trigger_type":{"post_processed":"After a post is processed"},"preview":{"bad_count_warning":{"text":"There are missing grant samples. This happens when the badge query returns user IDs or post IDs that do not exist. This may cause unexpected results later on - please double-check your query."},"no_grant_count":"No badges to be assigned.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned.","other":"\u003cb\u003e%{count}\u003c/b\u003e badges to be assigned."}}},"embedding":{"get_started":"If you'd like to embed Discourse on another website, begin by adding its host.","path_whitelist":"Path Whitelist","feed_description":"Providing an RSS/ATOM feed for your site can improve Discourse's ability to import your content.","crawling_settings":"Crawler Settings","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"Username for topic creation","embed_username_key_from_feed":"Key to pull discourse username from feed","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_truncate":"Truncate the embedded posts","embed_whitelist_selector":"CSS selector for elements that are allowed in embeds","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","embed_classname_whitelist":"Allowed CSS class names","feed_polling_enabled":"Import posts via RSS/ATOM","feed_polling_url":"URL of RSS/ATOM feed to crawl"}}}}};
I18n.locale = 'ro';
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
//! locale : romanian (ro)
//! author : Vlad Gurdiga : https://github.com/gurdiga
//! author : Valentin Agachi : https://github.com/avaly

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    function relativeTimeWithPlural(number, withoutSuffix, key) {
        var format = {
                'mm': 'minute',
                'hh': 'ore',
                'dd': 'zile',
                'MM': 'luni',
                'yy': 'ani'
            },
            separator = ' ';
        if (number % 100 >= 20 || (number >= 100 && number % 100 === 0)) {
            separator = ' de ';
        }
        return number + separator + format[key];
    }

    var ro = moment.defineLocale('ro', {
        months : 'ianuarie_februarie_martie_aprilie_mai_iunie_iulie_august_septembrie_octombrie_noiembrie_decembrie'.split('_'),
        monthsShort : 'ian._febr._mart._apr._mai_iun._iul._aug._sept._oct._nov._dec.'.split('_'),
        monthsParseExact: true,
        weekdays : 'duminică_luni_marți_miercuri_joi_vineri_sâmbătă'.split('_'),
        weekdaysShort : 'Dum_Lun_Mar_Mie_Joi_Vin_Sâm'.split('_'),
        weekdaysMin : 'Du_Lu_Ma_Mi_Jo_Vi_Sâ'.split('_'),
        longDateFormat : {
            LT : 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY H:mm',
            LLLL : 'dddd, D MMMM YYYY H:mm'
        },
        calendar : {
            sameDay: '[azi la] LT',
            nextDay: '[mâine la] LT',
            nextWeek: 'dddd [la] LT',
            lastDay: '[ieri la] LT',
            lastWeek: '[fosta] dddd [la] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'peste %s',
            past : '%s în urmă',
            s : 'câteva secunde',
            m : 'un minut',
            mm : relativeTimeWithPlural,
            h : 'o oră',
            hh : relativeTimeWithPlural,
            d : 'o zi',
            dd : relativeTimeWithPlural,
            M : 'o lună',
            MM : relativeTimeWithPlural,
            y : 'un an',
            yy : relativeTimeWithPlural
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 1st is the first week of the year.
        }
    });

    return ro;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['ro'] = function (n) {
  if (n == 1) return "one";
  if (n === 0 || n % 100 >= 1 && n % 100 <= 19) return "few";
  return "other";
};
