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
r += "Hai ";
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
r += "<a href='/unread'>1 sen ler</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " sen ler</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["gl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "e";
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
r += " <a href='/new'>1 novo</a> topic";
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
r += "e";
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
})() + " novos</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["gl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restantes, ou ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "explora outros temas en ";
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
}, "posts_likes_MF" : function(d){
var r = "";
r += "Este tema ten ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 resposta";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " respostas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["gl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "cun alto índice de gústames";
return r;
},
"med" : function(d){
var r = "";
r += "cun moi alto índice de gústames";
return r;
},
"high" : function(d){
var r = "";
r += "cun extremadamente alto índice de gústames";
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

MessageFormat.locale.gl = function ( n ) {
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
I18n.translations = {"gl":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","long_no_year":"D MMM h:mm a","long_no_year_no_time":"D MMM","full_no_year_no_time":"D MMMM","long_with_year":"D MMM, YYYY h:mm a","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"D MMMM, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1ano","other":"%{count}anos"},"over_x_years":{"one":"\u003e 1ano","other":"\u003e %{count}anos"},"almost_x_years":{"one":"1ano","other":"%{count}anos"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} mins"},"x_hours":{"one":"1 hora","other":"%{count} horas"},"x_days":{"one":"1 día","other":"%{count} días"},"date_year":"D MMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"Hai 1 min.","other":"Hai %{count} min."},"x_hours":{"one":"Hai 1 hora","other":"Hai %{count} horas"},"x_days":{"one":"Hai 1 día","other":"Hai %{count} días"}},"later":{"x_days":{"one":"1 día despois","other":"%{count} días despois"},"x_months":{"one":"1 mes despois","other":"%{count} meses despois"},"x_years":{"one":"1 anos despois","other":"%{count} anos despois"}},"previous_month":"Mes anterior","next_month":"Mes seguinte"},"share":{"topic":"compartir unha ligazón a este tema","post":"publicación %{postNumber}","close":"pechar","twitter":"compartir esta ligazón no Twitter","facebook":"compartir esta ligazón no Facebook","google+":"compartir esta ligazón no Google+","email":"enviar esta ligazón nun correo electrónico"},"action_codes":{"split_topic":"este tema dividiuse o %{when}","invited_user":"convidou a %{who} %{when}","removed_user":"eliminou a %{who} %{when}","autoclosed":{"enabled":"pechado o %{when}","disabled":"aberto o %{when}"},"closed":{"enabled":"pechado o %{when}","disabled":"aberto o %{when}"},"archived":{"enabled":"arquivado o %{when}","disabled":"desarquivado o %{when}"},"pinned":{"enabled":"pegado o %{when}","disabled":"despegado o %{when}"},"pinned_globally":{"enabled":"pegado globalmente o %{when}","disabled":"despegado o %{when}"},"visible":{"enabled":"listado o %{when}","disabled":"retirado da lista o %{when}"}},"topic_admin_menu":"accións do administrador de temas","emails_are_disabled":"Todos os correos electrónicos saíntes foron desactivados globalmente por un administrador. Non se enviará ningún tipo de notificación por correo electrónico.","s3":{"regions":{"us_east_1":"EE.UU. Leste (N. Virxinia)","us_west_1":"EE.UU. Oeste (N. California)","us_west_2":"EE.UU. Oeste (Oregón)","us_gov_west_1":"AWS GovCloud (EE.UU)","eu_west_1":"EU (Irlanda)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacífico (Singapur)","ap_southeast_2":"Asia Pacífico (Sidney)","ap_northeast_1":"Asia Pacífico (Tokio)","ap_northeast_2":"Asia Pacífico (Seúl)","sa_east_1":"América do Sur (São Paulo)"}},"edit":"editar o título e a categoría deste tema","not_implemented":"Sentímolo pero esta funcionalidade non se implementou aínda.","no_value":"Non","yes_value":"Si","generic_error":"Sentímolo pero produciuse un erro.","generic_error_with_reason":"Produciuse un erro: %{error}","sign_up":"Crear unha conta","log_in":"Iniciar sesión","age":"Idade","joined":"Inscrito","admin_title":"Admin","flags_title":"Denuncias","show_more":"amosar máis","show_help":"opcións","links":"Ligazóns","links_lowercase":{"one":"ligazón","other":"ligazóns"},"faq":"FAQ","guidelines":"Directrices","privacy_policy":"Normas de confidencialidade","privacy":"Confidencialidade","terms_of_service":"Termos do servizo","mobile_view":"Visualización móbil","desktop_view":"Visualización en escritorio","you":"Ti","or":"ou","now":"agora mesmiño","read_more":"ler máis","more":"Máis","less":"Menos","never":"nunca","every_30_minutes":"cada 30 minutos","every_hour":"cada hora","daily":"diariamente","weekly":"semanalmente","every_two_weeks":"cada dúas semanas","every_three_days":"cada tres días","max_of_count":"máx. de {{count}}","alternation":"ou","character_count":{"one":"{{count}} carácter","other":"{{count}} caracteres"},"suggested_topics":{"title":"Temas suxeridos","pm_title":"Mensaxes suxeridas"},"about":{"simple_title":"Verbo de","title":"Verbo de %{title}","stats":"Estatísticas do sitio","our_admins":"Administradores","our_moderators":"Os moderadores","stat":{"all_time":"Todos","last_7_days":"Últimos 7 días","last_30_days":"Últimos 30 días"},"like_count":"Gústames","topic_count":"Temas","post_count":"Publicacións","user_count":"Novos usuarios","active_user_count":"Usuarios activos","contact":"Contacta connosco","contact_info":"No caso dunha incidencia crítica ou asunto urxente que afecte este sitio, contacta connosco en %{contact_info}."},"bookmarked":{"title":"Marcador","clear_bookmarks":"Limpar marcadores","help":{"bookmark":"Preme para engadir aos marcadores a publicación inicial deste tema","unbookmark":"Preme para retirar todos os marcadores deste tema"}},"bookmarks":{"not_logged_in":"cómpre que teñas a sesión iniciada para engadir unha publicación aos marcadores","created":"engadiches aos marcadores esta publicación","not_bookmarked":"Acabas de ler esta publicación; preme para engadila aos  marcadores","last_read":"esta é a última publicación lida por ti; preme para engadila aos marcadores","remove":"Eliminar marcador","confirm_clear":"Confirmas o borrado de todos os marcadores deste tema?"},"topic_count_latest":{"one":"{{count}} tema novo ou actualizado.","other":"{{count}} temas novos ou actualizados."},"topic_count_unread":{"one":"{{count}} tópico sen ler.","other":"{{count}} temas sen ler."},"topic_count_new":{"one":"{{count}} tópico novo","other":"{{count}} temas novos"},"click_to_show":"Preme para amosar.","preview":"previsualizar","cancel":"cancelar","save":"Gardar cambios","saving":"Gardando....","saved":"Gardado!","upload":"Actualizar","uploading":"Actualizando...","uploading_filename":"Actualizando {{filename}}...","uploaded":"Actualizado!","enable":"Activar","disable":"Desactivar","undo":"Desfacer","revert":"Reverter","failed":"Fallou","banner":{"close":"Desbotar este báner.","edit":"Editar este báner »"},"choose_topic":{"none_found":"Non se atoparon temas.","title":{"search":"Buscar un tema polo nome, URL ou ID:","placeholder":"escribe o título do tema aquí"}},"queue":{"topic":"Tema:","approve":"Aprobar","reject":"Rexeitar","delete_user":"Eliminar usuario","title":"Cómpre aprobación","none":"Non hai publicacións para revisar.","edit":"Editar","cancel":"Cancelar","view_pending":"ver as publicacións pendentes","has_pending_posts":{"one":"Este tema ten \u003cb\u003e{{count}}\u003c/b\u003e publicación agardando aprobación","other":"Este tema ten \u003cb\u003e{{count}}\u003c/b\u003e publicacións agardando aprobación."},"confirm":"Gardar os cambios","delete_prompt":"Confirmas a eliminación de \u003cb\u003e%{username}\u003c/b\u003e? Eliminaranse todas as súas publicacións e bloquearase o seu correo electrónico e enderezo IP.","approval":{"title":"A publicación necesita aprobación","description":"Recibimos a túa nova publicación pero cómpre que sexa aprobada por un moderador antes de aparecer. Ten paciencia.","pending_posts":{"one":"Tes \u003cstrong\u003e{{count}}\u003c/strong\u003e publicación pendente.","other":"Tes \u003cstrong\u003e{{count}}\u003c/strong\u003e publicacións pendentes."},"ok":"De acordo"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e publicou \u003ca href='{{topicUrl}}'\u003eo tema\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eTi\u003c/a\u003e publicaches \u003ca href='{{topicUrl}}'\u003eo tema\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eTi\u003c/a\u003e respondiches a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu ao tema \u003ca href='{{topicUrl}}'\u003e\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eTi\u003c/a\u003e respondiches ao tema \u003ca href='{{topicUrl}}'\u003e\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e citou a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e citou a \u003ca href='{{user2Url}}'\u003e, vaia, a ti.\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTi\u003c/a\u003e citaches a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Publicado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Publicado por \u003ca href='{{userUrl}}'\u003eti\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003e, vaia, ti mesmo.\u003c/a\u003e"},"directory":{"filter_name":"filtrar por nome de usuario","title":"Usuarios","likes_given":"Dados","likes_received":"Recibidos","time_read":"Tempo de lectura","topic_count":"Temas","topic_count_long":"Temas creados","post_count":"Respostas","post_count_long":"Respostas publicadas","no_results":"Non se atoparon resultados.","days_visited":"Visitas","days_visited_long":"Días visitados","posts_read":"Lidas","posts_read_long":"Publicacións lidas","total_rows":{"one":"Un usuario","other":"%{count} usuarios"}},"groups":{"empty":{"posts":"Non hai publicacións de membros deste grupo.","members":"Non hai ningún membro neste grupo.","mentions":"Non hai ningunha mención deste grupo.","messages":"Non hai ningunha mensaxe para este grupo.","topics":"Non hai temas por membros deste grupo."},"add":"Engadir","selector_placeholder":"Engadir membros","owner":"propietario","visible":"O grupo é visíbel para todos os usuarios.","title":{"one":"grupo","other":"grupos"},"members":"Membros","topics":"Temas","posts":"Publicacións","mentions":"Mencións","messages":"Mensaxes","alias_levels":{"title":"Quen pode enviar mensaxes e @mención a este grupo?","nobody":"Ninguén","only_admins":"Só administradores","mods_and_admins":"Só moderadores e administradores","members_mods_and_admins":"Só membros do grupo, moderadores e administradores","everyone":"Todos"},"trust_levels":{"title":"Nivel de confianza automático concedido aos membros cando son engadidos:","none":"Ningún"},"notifications":{"watching":{"title":"Ver","description":"Notificaráseche cada publicación nova en cada mensaxe e amosarase o número de novas respostas."},"tracking":{"title":"Seguimento","description":"Notificaráseche se alguén menciona o teu @nome ou che responde e tamén  aparecerá o número de novas respostas."},"regular":{"title":"Normal","description":"Notificaráseche se alguén menciona o teu @nome ou che responde."},"muted":{"title":"Silenciado","description":"Non recibirás notificacións de nada relacionado con novos temas neste grupo."}}},"user_action_groups":{"1":"Gústames dados","2":"Gústames recibidos","3":"Marcadores","4":"Temas","5":"Respostas","6":"Respostas","7":"Mencións","9":"CItas","11":"Edicións","12":"Enviar elementos","13":"Caixa de entrada","14":"Pendente"},"categories":{"all":"todas as categorías","all_subcategories":"todo","no_subcategory":"ningunha","category":"Categoría","category_list":"Amosar a lista de categorías","reorder":{"title":"Reordenar as categorías","title_long":"Reorganizar a lista de categorías","fix_order":"Fixar as posicións","fix_order_tooltip":"Non todas as categorías teñen un número de posición único, e iso pode causar resultados inesperados.","save":"Gardar orde","apply_all":"Aplicar","position":"Posición"},"posts":"Publicacións","topics":"Temas","latest":"Últimos","latest_by":"últimos de","toggle_ordering":"trocar o control de ordenación","subcategories":"Subcategorías","topic_stat_sentence":{"one":"%{count} tema novo no último %{unit}.","other":"%{count} temas novos no último %{unit}."}},"ip_lookup":{"title":"Busca do enderezo IP","hostname":"Nome do servidor","location":"Localización","location_not_found":"(descoñecido)","organisation":"Organización","phone":"Teléfono","other_accounts":"Outras contas co mesmo enderezo IP:","delete_other_accounts":"Eliminar %{count}","username":"nome do usuario","trust_level":"NdeC","read_time":"tempo de lectura","topics_entered":"temas introducidos","post_count":"# publicacións","confirm_delete_other_accounts":"Confirma que quere eliminar estas contas?"},"user_fields":{"none":"(seleccione unha opción)"},"user":{"said":"{{username}}:","profile":"Perfil","mute":"Silenciar","edit":"Editar preferencias","download_archive":"Descargar as miñas publicacións","new_private_message":"Nova mensaxe","private_message":"Mensaxe","private_messages":"Mensaxes","activity_stream":"Actividade","preferences":"Preferencias","expand_profile":"Expandir","bookmarks":"Marcadores","bio":"Verbo de min","invited_by":"Convidado por","trust_level":"Nivel de confianza","notifications":"Notificacións","statistics":"Estatísticas","desktop_notifications":{"label":"Notificacións en escritorio","not_supported":"Este navegador non admite notificacións. Desculpe.","perm_default":"Acender notificacións","perm_denied_btn":"Permiso denegado","perm_denied_expl":"Denegaches o permiso para notificacións no teu navegador. Modifica os axustes para recibir notificacións no teu navegador.","disable":"Desactivar as notificacións","enable":"Activar as notificacións","each_browser_note":"Nota: Tes que cambiar este axuste en cadanseu navegador que utilices."},"dismiss_notifications_tooltip":"Marcar todas notificacións sen ler como lidas","disable_jump_reply":"Non saltar á miña publicación despois de que responda","dynamic_favicon":"Amosar o número de temas novos / actualizados na icona do navegador","external_links_in_new_tab":"Abrir todas as ligazóns externas nunha nova lapela","enable_quoting":"Activar as comiñas de resposta para o texto realzado","change":"cambiar","moderator":"{{user}} é moderador","admin":"{{user}} é administrador","moderator_tooltip":"Este usuario é  un moderador","admin_tooltip":"Este usuario é un administrador","blocked_tooltip":"Este usuario está bloqueado","suspended_notice":"Este usuario está suspendido até o {{date}}.","suspended_reason":"Razón:","github_profile":"Github","watched_categories":"Visto","tracked_categories":"Seguido","muted_categories":"Silenciado","muted_categories_instructions":"Non se che notificará nada sobre os temas novos nestas categorías e non aparecerán na lista de últimos.","delete_account":"Eliminar a miña conta","delete_account_confirm":"Confirmas que queres eliminar definitivamente a túa conta? Esta acción non se pode desfacer!","deleted_yourself":"A túa conta acaba de ser eliminada completamente.","delete_yourself_not_allowed":"Non podes eliminar a túa conta neste intre. Contacta cun administrador para que este a elimine por ti. ","unread_message_count":"Mensaxes","admin_delete":"Eliminar","users":"Usuarios","muted_users":"Silenciado","muted_users_instructions":"Suprimir todas as notificacións destes usuarios.","muted_topics_link":"Amosar os temas silenciados","automatically_unpin_topics":"Despegar os temas automaticamente cando alcance o fondo.","staff_counters":{"flags_given":"denuncias útiles","flagged_posts":"publicacións denunciadas","deleted_posts":"publicacións eliminadas","suspensions":"suspensións","warnings_received":"advertencias"},"messages":{"all":"Todo","inbox":"Caixa de entrada","sent":"Enviados","archive":"Arquivo","groups":"Os meus grupos","bulk_select":"Seleccionar mensaxes","move_to_inbox":"Mover á caixa de entrada","move_to_archive":"Arquivo","failed_to_move":"Produciuse un fallo ao mover as mensaxes seleccionadas (quizais a rede está caída)","select_all":"Seleccionar todo"},"change_password":{"success":"(correo enviado)","in_progress":"(enviando o correo)","error":"(erro)","action":"Enviar correo para restabelecer o contrasinal","set_password":"Estabelecer o contrasinal"},"change_about":{"title":"Cambiar «Verbo de min»"},"change_username":{"title":"Cambiar o nome do usuario","taken":"Sentímolo pero este nome xa está en uso.","error":"Produciuse un erro cambiando o teu nome de usuario.","invalid":"Este usuario é incorrecto. Só pode contar números e letras."},"change_email":{"title":"Cambiar o correo electrónico","taken":"Sentímolo pero este correo non está dispoñíbel.","error":"Produciuse un erro cambiando o correo electrónico. Quizais ese enderezo xa está en uso.","success":"Enviamos un correo electrónico a ese enderezo. Sigue as instrucións de confirmación."},"change_avatar":{"title":"Cambia a foto do perfil","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baseado en","gravatar_title":"Cambia o avatar no sitio web de Gravatar","refresh_gravatar_title":"Actualiza o teu Gravatar","letter_based":"Imaxe do perfil asignada polo sistema","uploaded_avatar":"Imaxe personalizada","uploaded_avatar_empty":"Engadir unha imaxe personalizada","upload_title":"Envía a túa imaxe","upload_picture":"Enviar imaxe","image_is_not_a_square":"Aviso: recortamos a túa imaxe; a largura e a altura eran distintas.","cache_notice":"Cambiaches correctamente a túa imaxe do perfil pero quizais tarde un chisco en aparecer debido á xestión da caché do navegador."},"change_profile_background":{"title":"Fondo do perfil","instructions":"Os fondos dos perfís centraranse e terán unha largura predeterminada de 850px."},"change_card_background":{"title":"Fondo das fichas dos usuarios","instructions":"As imaxes dos fondos centraranse e terán unha largura predeterminada de 590px."},"email":{"title":"Correo electrónico","instructions":"Non se verá nunca en público","ok":"Enviarémosche un correo electrónico para confirmar","invalid":"Introduce un enderezo de correo electrónico correcto","authenticated":"O teu enderezo de correo electrónico foi autenticado por {{provider}}","frequency_immediately":"Enviarémosche un correo-e axiña se non liches sobre o que che estamos a enviar.","frequency":{"one":"Só che eviaremos un correo-e se non te vimos no último minuto.","other":"Só che eviaremos un correo-e se non te vimos nos últimos {{count}} minutos."}},"name":{"title":"Nome","instructions":"Nome completo (opcional)","instructions_required":"Nome completo","too_short":"O nome é curto de mais","ok":"O nome parece correcto"},"username":{"title":"Nome do usuario","instructions":"Único, sen espazos, curto","short_instructions":"A xente pode mencionarte como @{{username}}","available":"O nome de usuario está dispoñíbel","global_match":"O correo electrónico correspóndese co nome do usuario rexistrado","global_mismatch":"Xa rexistrado. Tentar {{suggestion}}?","not_available":"Non dispoñíbel. Tentar {{suggestion}}?","too_short":"O nome do usuario é curto de máis","too_long":"O nome do usuario é longo de máis","checking":"Comprobando a dispoñibilidade do nome do usuario...","enter_email":"Atopouse o nome do usuario; introduce o correo electrónico","prefilled":"O correo electrónico coincide co nome do usuario rexistrado"},"locale":{"title":"Idioma da interface","instructions":"Idioma da interface do usuario. Cambiará cando actualices a páxina.","default":"(predeterminado)"},"password_confirmation":{"title":"O contrasinal outra vez"},"last_posted":"Última publicación","last_emailed":"Últimos envíos por correo-e","last_seen":"Visto","created":"Inscrito","log_out":"Saír da sesión","location":"Localización","card_badge":{"title":"Insignia na ficha do usuario"},"website":"Sitio web","email_settings":"Correo electrónico","like_notification_frequency":{"title":"Notificar cando reciba gústames","always":"Sempre","first_time_and_daily":"A primeira vez que unha publicación reciba un gústame e diariamente","first_time":"A primeira vez que unha publicación lle gusta a alguén","never":"Nunca"},"email_previous_replies":{"title":"Incluír as respostas previas no final dos correos electrónicos","unless_emailed":"excepto os enviados anteriormente","always":"sempre","never":"nunca"},"email_digests":{"every_30_minutes":"cada 30 minutos","every_hour":"cada hora","daily":"diariamente","every_three_days":"cada tres días","weekly":"semanalmente","every_two_weeks":"cada dúas semanas"},"email_in_reply_to":"Incluír nos correos un extracto das respostas á publicación","email_direct":"Enviar un correo electrónico cando alguén me cite, responda a unha das miñas publicacións, mencione o meu @nome_do_usuario ou me convide a un tema.","email_private_messages":"Enviar correo electrónico cando alguén me mande unha mensaxe","email_always":"Enviar notificación por correo-e incluso cando estea activo no sitio","other_settings":"Outro","categories_settings":"Categorías","new_topic_duration":{"label":"Considerar novos temas cando","not_viewed":"Aínda non os vin","last_here":"creados desde a última vez que estiven aquí","after_1_day":"creados no último día","after_2_days":"creados nos últimos 2 días","after_1_week":"creados na última semana","after_2_weeks":"creados nas última 2 semanas"},"auto_track_topics":"Facer seguimento automático dos temas nos que entro","auto_track_options":{"never":"nunca","immediately":"inmediatamente","after_30_seconds":"despois de 30 segundos ","after_1_minute":"despois de 1 minuto","after_2_minutes":"despois de 2 minutos","after_3_minutes":"despois de 3 minutos","after_4_minutes":"despois de 4  minutos","after_5_minutes":"despois de 5 minutos","after_10_minutes":"despois de 10 minutos"},"invited":{"search":"escribir para buscar convites...","title":"Convites","user":"Usuario convidado","sent":"Enviado","none":"Non hai convites pendentes de ver.","truncated":{"one":"Amosando o primeiro convite.","other":"Amosando os primeiros {{count}} convites."},"redeemed":"Convites utilizados","redeemed_tab":"Utilizados","redeemed_tab_with_count":"Utilizados ({{count}})","redeemed_at":"Utilizados","pending":"Convites pendentes","pending_tab":"Pendente","pending_tab_with_count":"Pendentes ({{count}})","topics_entered":"Temas vistos","posts_read_count":"Publicacións lidas","expired":"Este convite caducou.","rescind":"Eliminar","rescinded":"Convite eliminado","reinvite":"Reenviar convite","reinvited":"Convite reenviado","time_read":"Tempo de lectura","days_visited":"Días visitado","account_age_days":"Tempo da conta en días","create":"Enviar un convite","generate_link":"Copiar a ligazón do convite","generated_link_message":"\u003cp\u003eA ligazón do convite xerouse correctamente.\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eA ligazón do convite só é válida para este enderezo de correo-e: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Aínda non convidaches a ninguén. Podes enviar convites individuais ou en grupo se \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003esubes un ficheiro para convites múltiples\u003c/a\u003e.","text":"Convidar en grupo desde un ficheiro","uploading":"Enviando...","success":"O ficheiro enviouse correctamente, notificaráseche por mensaxe cando remate o proceso.","error":"Produciuse un erro ao subir «{{filename}}»: {{message}}"}},"password":{"title":"Contrasinal","too_short":"O teu contrasinal é demasiado curto.","common":"O contrasinal é demasiado habitual.","same_as_username":"O contrasinal é igual ao nome do usuario.","same_as_email":"O contrasinal é igual ao correo electrónico.","ok":"O contrasinal semella bo.","instructions":"Como mínimo %{count} caracteres."},"summary":{"title":"Resumo","stats":"Estatísticas","top_replies":"Respostas destacadas","more_replies":"Máis respostas","top_topics":"Temas destacados","more_topics":"Máis temas","top_badges":"Insignias principais","more_badges":"Máis insignias"},"associated_accounts":"Accesos","ip_address":{"title":"Último enderezo IP"},"registration_ip_address":{"title":"Rexistro de enderezos IP"},"avatar":{"title":"Imaxe do perfil","header_title":"perfil, mensaxes, marcadores e preferencias"},"title":{"title":"Título"},"filters":{"all":"Todo"},"stream":{"posted_by":"Publicado por","sent_by":"Enviado por","private_message":"mensaxe","the_topic":"o tema"}},"loading":"Cargando...","errors":{"prev_page":"ao tentar cargar","reasons":{"network":"Erro de rede","server":"Erro do servidor","forbidden":"Acceso denegado","unknown":"Erro","not_found":"Páxina non atopada"},"desc":{"network":"Por favor, comproba a conexión.","network_fixed":"Parece que xa estamos de volta.","server":"Código do erro: {{status}}","forbidden":"Non tes permiso para ver isto","not_found":"Vaites, o aplicativo tentou cargar unha URL inexistente.","unknown":"Algo foi mal."},"buttons":{"back":"Volver","again":"Tentar de novo","fixed":"Cargar páxina"}},"close":"Pechar","assets_changed_confirm":"Este sitio acaba de actualizarse. Queres recargar a páxina para ter a última versión?","logout":"Fuches desconectado.","refresh":"Actualizar","read_only_mode":{"enabled":"Este sitio está en modo só-lectura. Continúe navegando pero responder, gustar e outras accións estarán desactivadas polo de agora.","login_disabled":"Cando o sitio está no modo de só-lectura, desactívase o inicio de sesión.","logout_disabled":"O peche de sesión desactívase mentres o sitio está en modo de só lectura."},"too_few_topics_and_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eComecemos a discusión!\u003c/a\u003e Hai actualmente \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e temas e \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e publicacións. Os novos visitantes precisan algunhas conversas par ler e participar.","too_few_topics_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eComecemos a discusión!\u003c/a\u003e Hai actualmente \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e temas. Os novos visitantes precisan algunhas conversas par ler e participar.","too_few_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eComecemos a discusión!\u003c/a\u003e Hai actualmente \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e publicacións. Os novos visitantes precisan algunhas conversas par ler e participar.","learn_more":"saber máis...","year":"ano","year_desc":"temas creados nos últimos 365 días","month":"mes","month_desc":"temas creados nos últimos 30 días","week":"semana","week_desc":"temas creados nos últimos 7 días","day":"día","first_post":"Publicación inicial","mute":"Silenciar","unmute":"Non silenciar","last_post":"Última publicación","last_reply_lowercase":"última resposta","replies_lowercase":{"one":"resposta","other":"respostas"},"signup_cta":{"sign_up":"Rexistrarse","hide_session":"Lembrarmo mañá","hide_forever":"non grazas","hidden_for_session":"De acordo, preguntareicho mañá. Tamén podes usar «Iniciar sesión» para crear unha conta.","intro":"Ei! :heart_eyes: Semella que gozas coa discusión pero non abriches ningunha conta.","value_prop":"Cando creas unha conta, lembramos exactamente o que liches. Deste xeito sempre volves exactamente onde o deixaches. Podes recibir notificación aquí e vía correo electrónico sempre que se fagan publicacións. E podes darlle a Gústame nas publicacións para compartir o cariño. :heartbeat: "},"summary":{"enabled_description":"Estás vendo un resumo deste tema: as publicacións máis interesantes determinadas pola comunidade","description":"Hai \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas.","description_time":"Hai \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas cun tempo estimado de lectura de \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Resumir este tema","disable":"Amosar todas as publicacións"},"deleted_filter":{"enabled_description":"Este tema contén publicacións eliminadas, que se ocultaron.","disabled_description":"Móstranse as publicacións eliminadas do tema.","enable":"Ocultar publicacións eliminadas","disable":"Amosar as publicacións eliminadas"},"private_message_info":{"title":"Mensaxe","invite":"Convidar a outros...","remove_allowed_user":"Confirmas a eliminación de {{name}} desta mensaxe?"},"email":"Correo electrónico","username":"Nome do usuario","last_seen":"Visto","created":"Creado","created_lowercase":"creado","trust_level":"Nivel de confianza","search_hint":"nome do usuario, correo-e ou enderezo IP","create_account":{"title":"Crear unha conta nova","failed":"Algo foi mal, quizais este correo electrónico xa está rexistrado, tenta coa ligazón de «Esquecín o contrasinal»."},"forgot_password":{"title":"Contrasinal restabelecido","action":"Esquecín o contrasinal","invite":"Introduce o nome do usuario ou correo electrónico, e enviaráseche un correo para restabelecer o contrasinal","reset":"Restabelecer contrasinal","complete_username":"Se unha conta corresponde ao nome de usuario \u003cb\u003e%{username}\u003c/b\u003e, deberas recibir en breve un correo-e coas instrucións sobre como restabelecer o teu contrasinal.","complete_email":"Se unha conta coincide con \u003cb\u003e%{email}\u003c/b\u003e, deberías recibir en breve un correo-e con instrucións sobre como restabelecer o teu contrasinal.","complete_username_found":"Atopamos unha conta co mesmo nome de usuario \u003cb\u003e%{username}\u003c/b\u003e, deberas recibir en breve un correo-e coas instrucións sobre como restabelecer o teu contrasinal.","complete_email_found":"Atopamos unha conta que coincide con \u003cb\u003e%{email}\u003c/b\u003e, deberas recibir en breve unha mensaxe coas instrucións sobre como restabelecer o contrasinal.","complete_username_not_found":"Ningunha conta coincide co nome do usuario \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Ningunha conta coincide co \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Iniciar sesión","username":"Usuario","password":"Contrasinal","email_placeholder":"correo electrónico ou nome de usuario","caps_lock_warning":" Bloqueo de maiúsculas activado","error":"Erro descoñecido","rate_limit":"Por favor, agarda antes de tentalo outra vez.","blank_username_or_password":"Introduce o teu correo electrónico ou nome de usuario e o contrasinal.","reset_password":"Restabelecer contrasinal","logging_in":"Iniciando sesión...","or":"ou","authenticating":"Autenticando...","awaiting_confirmation":"A túa conta está pendente de se activar, emprega a ligazón de contrasinal esquecido para emitir outro correo de activación.","awaiting_approval":"A túa conta non foi aínda aprobada polos membros do equipo. Enviaráseche unha mensaxe cando así for.","requires_invite":"Sentímolo pero o acceso a este foro é unicamente por convite.","not_activated":"Non podes acceder aínda. Antes debemos enviarche unha mensaxe a \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor, sigue as instrucións desta mensaxe para activar a túa conta.","not_allowed_from_ip_address":"Non podes acceder desde este enderezo IP.","admin_not_allowed_from_ip_address":"Non podes acceder como administrador desde este enderezo IP.","resend_activation_email":"Preme aquí para enviar outro correo de activación.","sent_activation_email_again":"Enviamos outro correo-e de activación a \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Pode tardar uns minutos en chegar; asegúrate de revisar o cartafol do spam.","to_continue":"Por favor, inicia sesión","preferences":"Precisas iniciar sesión para cambiar as túas preferencias de usuario.","forgot":"Non lembro os detalles da miña conta","google":{"title":"co Google","message":"Autenticación mediante Google (asegúrate de ter desactivado o bloqueador de xanelas emerxentes)"},"google_oauth2":{"title":"co Google","message":"Autenticación mediante Google (asegúrate de ter desactivado o bloqueador de xanelas emerxentes)"},"twitter":{"title":"co Twitter","message":"Autenticación mediante Twitter (asegúrate de ter desactivado o bloqueador de xanelas emerxentes)"},"instagram":{"title":"con Instagram","message":"Autenticación con Instagram (asegúrate que os bloqueadores de publicidade estean desactivados)"},"facebook":{"title":"co Facebook","message":"Autenticación mediante Facebook (asegúrate de ter desactivado o bloqueador de xanelas emerxentes)"},"yahoo":{"title":"co Yahoo","message":"Autenticación mediante Yahoo (asegúrate de ter desactivado o bloqueador de xanelas emerxentes)"},"github":{"title":"co GitHub","message":"Autenticación mediante Github (asegúrate de ter desactivado o bloqueador de xanelas emerxentes)"}},"shortcut_modifier_key":{"shift":"Maiús.","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"máis...","options":"Opcións","whisper":"bisbar","add_warning":"Este é un aviso oficial.","toggle_whisper":"Cambiar Bisbar","posting_not_on_topic":"A que tema queres responder?","saving_draft_tip":"gardando...","saved_draft_tip":"gardado","saved_local_draft_tip":"gardado localmente","similar_topics":"O teu tema é semellante a...","drafts_offline":"borradores sen conexión","error":{"title_missing":"O título é obrigatorio","title_too_short":"O título debe ter alomenos {{min}} caracteres","title_too_long":"O título non debe ter máis de {{max}} caracteres","post_missing":"A publicación non pode estar baleira","post_length":"A publicación debe ter alomenos {{min}} caracteres","try_like":"Probaches o botón \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Debes seleccionar unha categoría"},"save_edit":"Gardar a edición","reply_original":"Responder no tema orixinal","reply_here":"Responder aquí","reply":"Responder","cancel":"Cancelar","create_topic":"Crear tema","create_pm":"Mensaxe","title":"Ou preme Ctrl+Intro","users_placeholder":"Engadir un usuario","title_placeholder":"Sobre que trata a discusión nunha soa frase?","edit_reason_placeholder":"por que estás editando?","show_edit_reason":"(engadir unha razón para editar)","reply_placeholder":"Escribe aquí. Usa Markdown, BBCode ou HTML para formatar. Arrastra ou pega imaxes.","view_new_post":"Ver a nova publicación.","saving":"Gardando","saved":"Gardado!","saved_draft":"A publicación do borrador está en proceso. Selecciona continuar.","uploading":"Enviando...","show_preview":"amosar visualización \u0026raquo;","hide_preview":"\u0026laquo; ocultar previsualización","quote_post_title":"Citar a publicación enteira","bold_title":"Grosa","bold_text":"Texto groso","italic_title":"Resalte","italic_text":"texto resaltado","link_title":"Hiperligazón","link_description":"introducir a descrición da ligazón aquí","link_dialog_title":"Inserir hiperligazón","link_optional_text":"título opcional","quote_title":"Citación","quote_text":"Citación","code_title":"Texto preformatado","code_text":"Texto preformatado cun sangrado de 4 espazos","upload_title":"Enviar","upload_description":"introducir a descrición do envío aquí","olist_title":"Lista numerada","ulist_title":"Lista con símbolos","list_item":"Elemento da lista","heading_title":"Cabeceira","heading_text":"Cabeceira","hr_title":"Regra horizontal","help":"Axuda para edición con Markdown","toggler":"agochar ou amosar o panel de composición","modal_ok":"De acordo","modal_cancel":"Cancelar","cant_send_pm":"Sentímolo pero non podes enviar unha mensaxe a %{username}.","admin_options_title":"Axustes do equipo para este tema","auto_close":{"label":"Tempo para o peche automático deste tema:","error":"Introduce un valor correcto.","based_on_last_post":"Non pechar até que a última publicación do tema teña alomenos este tempo.","all":{"examples":"Introducir o número de horas (24), hora absoluta (17:30) ou a marca data/hora (2013-11-22 14:00)."},"limited":{"units":"(# de horas)","examples":"Introducir o número de horas (24)."}}},"notifications":{"title":"notificacións das mencións ao teu @nome, respostas ás túas publicacións e temas, mensaxes, etc","none":"Non é posíbel cargar as notificacións neste intre","more":"ver notificacións anteriores","total_flagged":"total de publicacións denunciadas","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 máis\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} e {{count}} máis\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e aceptou o teu convite\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moveu {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eObtiveches «{{description}}»\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensaxe na caixa do correo de {{group_name}} \u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensaxes na caixa do correo de {{group_name}} \u003c/p\u003e"},"alt":{"mentioned":"Mencionado por","quoted":"Citado por","replied":"Respondido","posted":"Publicado por","edited":"A túa publicación ediotuna","liked":"Gustoulles a túa publicación","private_message":"Mensaxe privada de","invited_to_private_message":"Convidado a unha mensaxe privada de","invited_to_topic":"Convidado a un tema de","invitee_accepted":"Convite aceptado por","moved_post":"A túa publicación foi movida por","linked":"Ligazón á túa publicación","granted_badge":"Insignias concedidas","group_message_summary":"Mensaxes na caixa do grupo"},"popup":{"mentioned":"{{username}} mencionoute en \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mencionoute en \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citoute en \"{{topic}}\" - {{site_title}}","replied":"{{username}} respondeute en \"{{topic}}\" - {{site_title}}","posted":"{{username}} publicou en \"{{topic}}\" - {{site_title}}","private_message":"{{username}} enviouche unha mensaxe privada en \"{{topic}}\" - {{site_title}}","linked":"{{username}} ligou a túa publicación desde \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Engadir unha imaxe","title_with_attachments":"Engadir imaxe ou ficheiro","from_my_computer":"Desde o meu dispositivo","from_the_web":"Desde a web","remote_tip":"ligazón á imaxe","remote_tip_with_attachments":"ligazón á imaxe ou ficheiro {{authorized_extensions}}","local_tip":"seleccionar imaxes do teu dispositivo","local_tip_with_attachments":"selecciona imaxes ou ficheiros do teu dispositivo {{authorized_extensions}}","hint":"(tamén podes arrastrar e soltar no editor para envialos)","hint_for_supported_browsers":"tamén podes arrastrar e soltar ou pegar imaxes no editor","uploading":"Enviando","select_file":"Seleccionar ficheiro","image_link":"ligazón onde levará a túa imaxe"},"search":{"sort_by":"Ordenar por","relevance":"Relevancia","latest_post":"Últimas publicacións","most_viewed":"Máis vistos","most_liked":"Con máis Gústames","select_all":"Seleccionar todo","clear_all":"Borrar todo","result_count":{"one":"Un resultado para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} resultados para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"buscar temas, publicacións, usuarios ou categorías","no_results":"Non se atoparon resultados.","no_more_results":"Non se atoparon máis resultados.","search_help":"Buscar axuda","searching":"Buscando...","post_format":"#{{post_number}} de {{username}}","context":{"user":"Buscar publicacións de @{{username}}","topic":"Buscar neste tema","private_messages":"Buscar mensaxes"}},"hamburger_menu":"ir a outra lista de temas ou categoría","new_item":"novo","go_back":"volver","not_logged_in_user":"páxina do usuario cun resumo das actividades e preferencias actuais","current_user":"ir á túa páxina do usuario","topics":{"bulk":{"unlist_topics":"Retirar temas da lista","reset_read":"Restabelecer Lidos","delete":"Eliminar temas","dismiss":"Desbotar","dismiss_read":"Desbotar os non lidos","dismiss_button":"Desbotar...","dismiss_tooltip":"Desbotar só as publicacións novas ou deixar de seguir temas","also_dismiss_topics":"Deter o seguimento destes temas para que non se me amosen como non lidos","dismiss_new":"Desbotar novas","toggle":"cambiar a selección en bloque dos temas","actions":"Accións en bloque","change_category":"Cambiar categoría","close_topics":"Pechar temas","archive_topics":"Arquivar temas","notification_level":"Cambiar o nivel de notificación","choose_new_category":"Seleccionar a nova categoría dos temas:","selected":{"one":"Seleccionaches \u003cb\u003eun\u003c/b\u003e tema.","other":"Seleccionaches \u003cb\u003e{{count}}\u003c/b\u003e temas."}},"none":{"unread":"Non tes temas sen ler.","new":"Non tes novos temas.","read":"Aínda non liches ningún tema.","posted":"Aínda non publicaches en ningún tema.","latest":"Non hai últimos temas. Triste.","hot":"Non hai temas quentes.","bookmarks":"Aínda non marcaches este tema.","category":"Non hai temas en {{category}}.","top":"Non hai temas destacados.","search":"Non hai resultados da busca.","educate":{"new":"\u003cp\u003eAquí aparecen os teus temas novos.\u003c/p\u003e\u003cp\u003eDe xeito predeterminado, os temas considéranse novos e amosan un indicador \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enovo\u003c/span\u003e se se crearon nos últimos dous días.\u003c/p\u003e\u003cp\u003ePodes ir ás \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e para cambiar este axuste.\u003c/p\u003e","unread":"\u003cp\u003eOs teus temas sen ler aparecen aquí.\u003c/p\u003e\u003cp\u003eDe xeito predeterminado, os temas considéranse sen ler e amosarase o número dos non lidos. \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e se ti:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreaches o tema\u003c/li\u003e\u003cli\u003eRespondiches o tema\u003c/li\u003e\u003cli\u003eLiches o tema durante máis de catro minutos\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOu estabeleciches o tema para ser Seguido ou Visto no control de notificacións na banda inferior de cada tema.\u003c/p\u003e\u003cp\u003eVai ás túas \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e se queres cambiar isto.\u003c/p\u003e"}},"bottom":{"latest":"Non hai máis últimos temas.","hot":"Non hai máis temas  quentes.","posted":"Non hai máis temas publicados.","read":"Non hai máis temas lidos.","new":"Non hai máis temas novos.","unread":"Non hai máis temas sen ler.","category":"Non hai máis temas en {{category}}.","top":"Non hai máis temas destacados.","bookmarks":"Non hai máis temas marcados.","search":"Non hai máis resultados da busca."}},"topic":{"unsubscribe":{"stop_notifications":"Agora recibirás menos notificacións sobre \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"O estado actual das túas notificacións é"},"create":"Novo tema","create_long":"Crear un novo tema","private_message":"Iniciar unha mensaxe","archive_message":{"help":"Mover mensaxes ao arquivo","title":"Arquivo"},"move_to_inbox":{"title":"Mover á caixa de entrada","help":"Mover mensaxes á caixa de entrada"},"list":"Temas","new":"novo tema","unread":"sen ler","new_topics":{"one":"Un tema novo","other":"{{count}} temas novos"},"unread_topics":{"one":"Un tema sen ler","other":"{{count}} temas sen ler"},"title":"Tema","invalid_access":{"title":"O tema é privado","description":"Sentímolo pero non tes acceso a este tema.","login_required":"Debes iniciar sesión para ver este tema."},"server_error":{"title":"A carga do tema fallou","description":"Sentímolo pero non podemos cargar este tema, posibelmente debido a problemas de conexión. Ténato de novo e se o problema continúa fáinolo saber."},"not_found":{"title":"Non foi posíbel atopar o tema","description":"Sentímolo pero non foi posíbel atopar este tema. Quizais foi eliminado por un moderador."},"total_unread_posts":{"one":"Tes unha publicación sen ler neste tema","other":"Tes {{count}} publicacións sen ler neste tema"},"unread_posts":{"one":"Tes unha publicación antiga sen ler neste tema","other":"Tes {{count}} publicacións antigas sen ler neste tema"},"new_posts":{"one":"hai unha nova publicación neste tema desde a túa última lectura","other":"hai {{count}} novas publicacións neste tema desde a túa última lectura"},"likes":{"one":"hai un gústame neste tema","other":"hai {{count}} gústames neste tema"},"back_to_list":"Volver á lista de temas","options":"Opcións de temas","show_links":"amosar as ligazóns cara este tema","toggle_information":"cambiar detalles do tema","read_more_in_category":"Queres ler máis? explora outros temas en {{catLink}} ou {{latestLink}}.","read_more":"Queres ler máis? {{catLink}} ou {{latestLink}}.","browse_all_categories":"Explorar todas as categorías","view_latest_topics":"ver últimos temas","suggest_create_topic":"Porque non crear un tema?","jump_reply_up":"ir a unha resposta anterior","jump_reply_down":"ir a unha resposta posterior","deleted":"Eliminouse o tema","auto_close_notice":"Este tema pechará automaticamente en %{timeLeft}.","auto_close_notice_based_on_last_post":"Este tema pechará %{duration} despois da última resposta.","auto_close_title":"Axustes do peche automático","auto_close_save":"Gardar","auto_close_remove":"arriba","progress":{"title":"progreso do tema","go_top":"principio","go_bottom":"final","go":"ir","jump_bottom":"ir á última publicación","jump_bottom_with_number":"ir á publicación %{post_number}","total":"publicacións totais","current":"publicación actual"},"notifications":{"reasons":{"3_6":"Recibirás notificacións porque estás vendo esta categoría.","3_5":"Recibirás notificacións porque comezaches a ver este tema automaticamente.","3_2":"Recibirás notificacións porque estás vendo este tema.","3_1":"Recibirás notificacións por ser o creador deste tema.","3":"Recibirás notificacións porque estás vendo este tema.","2_8":"Recibirás notificacións porque segues esta categoría.","2_4":"Recibirás notificacións porque publicaches unha resposta neste tema.","2_2":"Recibirás notificacións porque segues este tema.","2":"Recibirás notificacións porque \u003ca href=\"/users/{{username}}/preferences\"\u003eliches este tema\u003c/a\u003e.","1_2":"Notificarémosche se alguén menciona o teu @nome ou che responde.","1":"Notificarémosche se alguén menciona o teu @nome ou che responde.","0_7":"Estás ignorando todas as notificacións desta categoría.","0_2":"Estás ignorando todas as notificacións deste tema.","0":"Estás ignorando todas as notificacións deste tema."},"watching_pm":{"title":"Ver","description":"Recibirás notificacións de cada resposta a esta mensaxe e aparecerá o número de novas respostas."},"watching":{"title":"Ver","description":"Notificaránseche as respostas recibidas neste tema e amosarase o número de novas respostas."},"tracking_pm":{"title":"Seguimento","description":"Amosarase o número de novas respostas desta mensaxe. Notificaránseche as mencións ao teu @name ou cando alguén che responda."},"tracking":{"title":"Seguimento","description":"Amosarase o número de novas respostas para este tema. Notificaránseche as mencións ao teu @name ou cando alguén che responda."},"regular":{"title":"Normal","description":"Notificarémosche se alguén menciona o teu @nome ou che responde."},"regular_pm":{"title":"Normal","description":"Notificarémosche se alguén menciona o teu @nome ou che responde."},"muted_pm":{"title":"Silenciado","description":"Non recibirás ningunha notificación sobre esta mensaxe."},"muted":{"title":"Silenciado","description":"Non se che notificará nada sobre este tema e non aparecerá no listado de últimos."}},"actions":{"recover":"Recuperar tema","delete":"Eliminar tema","open":"Abrir tema","close":"Pechar tema","multi_select":"Seleccionar publicacións...","auto_close":"Pechar automaticamente...","pin":"Pegar tema...","unpin":"Despegar tema...","unarchive":"Desarquivar tema","archive":"Arquivar tema","invisible":"Retirar da lista","visible":"Engadir á lista","reset_read":"Restabelecer datos de lecturas"},"feature":{"pin":"Pegar tema","unpin":"Despegar tema","pin_globally":"Pegar tema globalmente","make_banner":"Tema do báner","remove_banner":"Eliminar o tema do báner"},"reply":{"title":"Responder","help":"responder a este tema"},"clear_pin":{"title":"Borrar o estado Pegar","help":"Borra o estado Pegado deste tema para que non apareza na banda superior da lista de temas."},"share":{"title":"Compartir","help":"compartir unha ligazón a este tema"},"flag_topic":{"title":"Denunciar","help":"denunciar privadamente este tema para revisalo ou enviar unha notificación privada sobre el","success_message":"Denunciaches o tema correctamente."},"feature_topic":{"title":"Destacar este tema","pin":"Facer que este tema apareza no alto da categoría {{categoryLink}} até","confirm_pin":"Xa tes {{count}} temas pegados. Demasiados temas pegados pode resultar pesado para usuarios novos e anónimos. Confirmas que queres pegar outro tema nesta categoría?","unpin":"Eliminar este tema da banda superior da categoría {{categoryLink}}.","unpin_until":"Retirar este tema do alto da {{categoryLink}} ou agardar até \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Os usuarios poden despegar o tema por si mesmos.","pin_validation":"Requírese unha data para pegar este tema.","not_pinned":"Non hai temas pegados en {{categoryLink}}.","already_pinned":{"one":"Temas pegados actualmente en {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Temas pegados actualmente en {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Facer que este tema apareza no alto de todas as listas de temas até","confirm_pin_globally":"Xa tes {{count}} temas pegados globalmente. Demasiados temas pegados pode resultar pesado para usuarios novos e anónimos. Confirmas que queres pegar outro tema globalmente?","unpin_globally":"Eliminar este tema da banda superior de todas as listas de temas.","unpin_globally_until":"Eliminar este tema do alto de todas as listas de temas ou agardar até \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Os usuarios poden despegar o tema por si mesmos.","not_pinned_globally":"Non hai temas pegados globalmente.","already_pinned_globally":{"one":"Temas pegados globalmente neste intre: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Temas pegados globalmente neste intre: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Facer deste tema un báner que apareza na banda superior de todas as páxinas.","remove_banner":"Eliminar o báner que aparece na banda superior de todas as páxinas.","banner_note":"Os usuarios poden desbotar un báner se o pechan. Unicamente pode haber un tema que sexa un báner ao mesmo tempo.","no_banner_exists":"Non hai tema para o báner.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eHai\u003c/strong\u003e actualmente un tema para o báner."},"inviting":"Convidando...","invite_private":{"title":"Convidar á mensaxe","email_or_username":"Nome do usuario ou correo-e do convidado","email_or_username_placeholder":"correo electrónico e nome do usuario","action":"Convidar","success":"Convidamos este usuario a participar nesta mensaxe.","error":"Sentímolo pero houbo un erro convidando este usuario.","group_name":"nome do grupo"},"controls":"Controis do tema","invite_reply":{"title":"Convidar","username_placeholder":"nome do usuario","action":"Enviar convite","help":"convidar a outros a este tema por correo electrónico ou notificacións","to_forum":"Enviaremos un correo electrónico permitindo ao teu amigo que se una inmediatamente ao premer nunha ligazón. Non require iniciar sesión.","sso_enabled":"Introduce o nome do usuario da persoa que desexas convidar a este tema.","to_topic_blank":"Introduce o nome do usuario ou o correo electrónico da persoa que desexas convidar a este tema.","to_topic_email":"Introduciches un enderezo de correo-e. Enviarémosche un convite que permitirá os teus amigos responder inmediatamente a este tema.","to_topic_username":"Introduciches un nome de usuario. Enviarémoslle unha notificación cunha ligazón convidándoo a este tema.","to_username":"Introduce o nome do usuario da persoa que desexas convidar. Enviarémoslle unha notificación cunha ligazón convidándoa a este tema.","email_placeholder":"name@example.com","success_email":"Enviamos un convite a \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Notificarémosche cando utilice a invitación. Mira a lapela de convites na túa páxina de usuario para facer un seguimento das túas invitacións.","success_username":"Convidamos este usuario a participar neste tema.","error":"Sentímolo, non foi posíbel convidar esta persoa. Quizais xa foi convidada? (os convites teñen un límite)"},"login_reply":"Inicia sesión para responder","filters":{"n_posts":{"one":"Unha publicación","other":"{{count}} publicacións"},"cancel":"Eliminar filtro"},"split_topic":{"title":"Mover ao tema novo","action":"mover ao tema novo","topic_name":"Nome do tema novo","error":"Produciuse un erro movendo as publicacións ao novo tema.","instructions":{"one":"Vas crear un novo tema e enchelo coa publicación que seleccionaches.","other":"Vas crear un novo tema e enchelo coas \u003cb\u003e{{count}}\u003c/b\u003e publicacións que seleccionaches."}},"merge_topic":{"title":"Mover a un tema existente","action":"mover a un tema existente","error":"Produciuse un erro movendo publicacións nese tema.","instructions":{"one":"Selecciona o tema ao que queres mover esta publicación.","other":"Selecciona o tema ao que queres mover estas \u003cb\u003e{{count}}\u003c/b\u003e publicacións."}},"change_owner":{"title":"Cambiar propietario das publicacións","action":"cambiar propiedade","error":"Produciuse un erro cambiando a propiedade das publicacións.","label":"Novo propietario das publicacións","placeholder":"nome do usuario do novo propietario","instructions":{"one":"Selecciona o novo propietario da publicación de \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Selecciona o novo propietario das {{count}} publicacións de \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Decátate que ningunha notificación sobre esta publicación se transferirá retroactivamente ao novo usuario.\u003cbr\u003eAviso: actualmente, non se transfire ao novo usuario ningún dato relacionado cunha publicación. Usa isto con tino."},"change_timestamp":{"title":"Cambiar a marca data/hora","action":"cambiar a marca data/hora","invalid_timestamp":"A marca data/hora non pode ser no futuro.","error":"Produciuse un erro cambiando a marca data/hora do tema.","instructions":"Selecciona a marca data/hora para o tema. As publicacións do tema actualizaranse para ter a mesma diferenza de tempo."},"multi_select":{"select":"seleccionar","selected":"seleccionados ({{count}})","select_replies":"seleccionar +respostas","delete":"eliminar seleccionados","cancel":"cancelar selección ","select_all":"seleccionar todo","deselect_all":"deseleccionar todo","description":{"one":"Seleccionaches \u003cb\u003eunha\u003c/b\u003e publicación.","other":"Seleccionaches \u003cb\u003e{{count}}\u003c/b\u003e publicacións."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citar resposta","edit":"Editando {{link}} {{replyAvatar}} {{username}}","edit_reason":"Razón:","post_number":"publicación {{number}}","last_edited_on":"última edición da publicación","reply_as_new_topic":"Responder como tema ligado","continue_discussion":"Continuar a discusión de {{postLink}}:","follow_quote":"ir á publicación citada","show_full":"Amosar a publicación completa","show_hidden":"Ver o contido oculto.","deleted_by_author":{"one":"(as publicacións retiradas polo autor serán automaticamente eliminadas en %{count} hora, excepto que fosen denunciadas)","other":"(as publicacións retiradas polo autor serán automaticamente eliminadas en %{count} horas, excepto que fosen denunciadas)"},"expand_collapse":"ampliar/reducir","gap":{"one":"ver unha resposta oculta","other":"ver {{count}} respostas ocultas"},"unread":"Publicación sen ler","has_replies":{"one":"{{count}} resposta","other":"{{count}} respostas"},"has_likes":{"one":"{{count}} gústame","other":"{{count}} gústames"},"has_likes_title":{"one":"A unha persoa gustoulle esta publicación","other":"A {{count}} persoas gustoulles esta publicación"},"has_likes_title_only_you":"gustouche esta publicación","has_likes_title_you":{"one":"A ti e a outro máis gustouvos esta publicación","other":"A ti e a {{count}} persoas máis gustouvos esta publicación"},"errors":{"create":"Sentímolo pero produciuse un erro creando a publicación. Téntao de novo.","edit":"Sentímolo pero produciuse un erro editando a publicación. Téntao de novo.","upload":"Sentímolo pero produciuse un erro enviando a publicación. Téntao de novo.","too_many_uploads":"Sentímolo pero só podes enviar un ficheiro de cada vez.","upload_not_authorized":"Sentímolo pero o ficheiro que tentas enviar non está autorizado (extensións autorizadas: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Sentímolo pero os novos usuarios non poden subir imaxes.","attachment_upload_not_allowed_for_new_user":"Sentímolo pero os novos usuarios non poden subir anexos.","attachment_download_requires_login":"Sentímolo pero debes iniciar sesión para descargar anexos."},"abandon":{"confirm":"Confirmas o abandono da túa publicación?","no_value":"Non, seguir","yes_value":"Si, abandonar"},"via_email":"esta publicación chegou por correo-e","whisper":"este é un bisbar privado para moderadores","wiki":{"about":"esta publicación é unha wiki"},"archetypes":{"save":"Gardar opcións"},"controls":{"reply":"escribir unha resposta a esta publicación","like":"gústame esta publicación","has_liked":"gustouche esta publicación","undo_like":"desfacer o gústame","edit":"editar publicación","edit_anonymous":"Sentímolo pero debes iniciar sesión para editar esta publicación.","flag":"denunciar privadamente esta publicación ou enviar unha notificación privada sobre ela","delete":"eliminar publicación","undelete":"recuperar publicación","share":"compartir ligazón á publicación","more":"Máis","delete_replies":{"confirm":{"one":"Tamén desexas eliminar a resposta directa desta publicación?","other":"Tamén desexas eliminar as {{count}} respostas directas desta publicación?"},"yes_value":"Si, eliminar tamén as respostas","no_value":"Non, só esta publicación"},"admin":"accións admin. nas publicacións","wiki":"Crear wiki","unwiki":"Eliminar wiki","convert_to_moderator":"Engadir cor do Equipo","revert_to_regular":"Eliminar cor do Equipo","rebake":"Reconstruír HTML","unhide":"Non ocultar","change_owner":"Cambiar propietario"},"actions":{"flag":"Denunciar","defer_flags":{"one":"Pospor denuncia","other":"Pospor denuncias"},"undo":{"off_topic":"Desfacer denuncia","spam":"Desfacer denuncia","inappropriate":"Desfacer denuncia","bookmark":"Desfacer marcador","like":"Desfacer o gústame","vote":"Desfacer voto"},"people":{"off_topic":"notificado como sen relación co tema","spam":"denunciou isto como spam","inappropriate":"denunciou isto como inapropiado","notify_moderators":"moderadores notificados","notify_user":"enviou unha mensaxe","bookmark":"marcou isto","like":"gustou disto","vote":"votou por isto"},"by_you":{"off_topic":"Informaches disto como non relacionado","spam":"Denunciaches isto como spam","inappropriate":"Denunciaches isto como inapropiado","notify_moderators":"Denunciaches isto para moderación","notify_user":"Enviaches unha mensaxe a este usuario","bookmark":"Marcaches esta publicación","like":"Gustouche isto","vote":"Votaches esta publicación"},"by_you_and_others":{"off_topic":{"one":"Ti e outro máis informastes disto como non relacionado","other":"Ti e {{count}} máis informastes disto como non relacionado"},"spam":{"one":"Ti e outro máis denunciastes isto como spam","other":"Ti e {{count}} máis denunciastes isto com spam"},"inappropriate":{"one":"Ti e outro máis denunciastes isto como inapropiado","other":"Ti e {{count}} máis denunciastes isto como inapropiado"},"notify_moderators":{"one":"Ti e outro máis denunciastes isto para moderación","other":"Ti e {{count}} máis denunciastes isto para moderación"},"notify_user":{"one":"Ti e unha persoa máis enviastes unha mensaxe a este usuario","other":"Ti e {{count}} persoas máis enviastes unha mensaxe a este usuario"},"bookmark":{"one":"Ti e outra persoa marcastes esta publicación","other":"Ti e {{count}} persoas máis marcastes esta publicación"},"like":{"one":"A ti e a un máis gustouvos isto","other":"A ti e a {{count}} máis gustouvos isto"},"vote":{"one":"Ti e outra persoa votastes esta publicación","other":"Ti e {{count}} persoas máis votastes esta publicación"}},"by_others":{"off_topic":{"one":"Unha persoa marcou isto como non relacionado","other":"{{count}} persoas informaron disto como non relacionado"},"spam":{"one":"Unha persoa marcou isto como spam","other":"{{count}} persoas denunciaron isto como spam"},"inappropriate":{"one":"Unha persoa denunciou isto como inapropiado","other":"{{count}} persoas denunciaron isto como inapropiado"},"notify_moderators":{"one":"Unha persoa denunciou isto para moderación","other":"{{count}} persoas denunciaron isto para moderación"},"notify_user":{"one":"Unha persoa enviou unha mensaxe a este usuario","other":"{{count}} persoas enviaron unha mensaxe a este usuario"},"bookmark":{"one":"Unha persoa marcou esta publicación","other":"{{count}} persoas marcaron esta publicación"},"like":{"one":"A unha persoa gustoulle isto","other":"A {{count}} persoas gustoulles isto"},"vote":{"one":"Unha persoa votou por esta publicación","other":"{{count}} persoas votaron por esta publicación"}}},"delete":{"confirm":{"one":"Confirmas a eliminación desta publicación?","other":"Confirmas a eliminación de todas estas publicacións?"}},"revisions":{"controls":{"first":"Primeira revisión","previous":"Revisión anterior","next":"Revisión seguinte","last":"Última revisión","hide":"Ocultar revisión","show":"Amosar revisión","revert":"Reverter a esta revisión","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Amosar o resultado coas adicións e eliminacións inseridas","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Amosar o resultado coas diferenzas comparadas","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Amosar a fonte crúa coas diferenzas comparadas","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Crúa"}}}},"category":{"can":"podes\u0026hellip; ","none":"(sen categoría)","all":"Todas as categorías","choose":"Seleccionar unha categoría\u0026hellip;","edit":"editar","edit_long":"Editar","view":"Ver os Temas na Categoría","general":"Xeral","settings":"Axustes","topic_template":"Modelo para o tema","delete":"Eliminar categoría","create":"Nova categoría","create_long":"Crear unha nova categoría","save":"Gardar categoría","slug":"«Slug» da Categoría","slug_placeholder":"Inserir guións entre palabras para url (opcional) ","creation_error":"Produciuse un erro durante a creación desta categoría.","save_error":"Produciuse un erro gardando a categoría.","name":"Nome da categoría","description":"Descrición","topic":"tema da categoría","logo":"Logotipo da categoría","background_image":"Imaxe do fondo da categoría","badge_colors":"Cores das insignias","background_color":"Cor do fondo","foreground_color":"Cor do primeiro plano","name_placeholder":"Dúas palabras como máximo","color_placeholder":"Calquera cor web","delete_confirm":"Confirmas a eliminación desta categoría?","delete_error":"Produciuse un erro elimando esta categoría.","list":"Listar categorías","no_description":"Engade unha descrición a esta categoría.","change_in_category_topic":"Editar a descrición","already_used":"Esta cor usouna outra categoría","security":"Seguranza","special_warning":"Aviso: esta categoría ten axustes predeterminados e as opcións de seguranza non se poden modificar. Se non queres usala, elimínaa no canto de reciclala.","images":"Imaxes","auto_close_label":"Pechar automaticamente os temas despois de:","auto_close_units":"horas","email_in":"Personalizar enderezos de correos-e entrantes:","email_in_allow_strangers":"Aceptar correos-e de usuarios anónimos sen contas","email_in_disabled":"A publicación de novos temas vía correo-e está desactivada nos axustes do sitio. Para activala,","email_in_disabled_click":"activar o axuste «email in».","suppress_from_homepage":"Retirar esta categoría da páxina de inicio.","allow_badges_label":"Permitir adxudicar insignias nesta categoría","edit_permissions":"Editar permisos","add_permission":"Engadir permisos","this_year":"este ano","position":"posición","default_position":"Posición predeterminada","position_disabled":"As categorías amosaranse en orde de actividade. Para controlar a orde das categorías nas listas.","position_disabled_click":"activar o axuste «fixed category positions».","parent":"Categoría pai","notifications":{"watching":{"title":"Ver"},"tracking":{"title":"Seguimento"},"regular":{"title":"Normal","description":"Notificarémosche se alguén menciona o teu @nome ou che responde."},"muted":{"title":"Silenciado","description":"Non se che notificarán novos temas nestas categorías e non aparecerán nos Últimos."}}},"flagging":{"title":"Grazas por axudar a manter a nosa comunidade.","action":"Denunciar publicación","take_action":"Tomar medidas","notify_action":"Mensaxe","delete_spammer":"Eliminar spammer","yes_delete_spammer":"Si, eliminar o spammer","ip_address_missing":"(N/D)","hidden_email_address":"(oculto)","submit_tooltip":"Enviar a denuncia privada","take_action_tooltip":"Alcanzar o limiar de denuncias inmediatamente no canto de agardar por máis denuncias da comunidade","cant":"Sentímolo pero non podes denunciar esta publicación neste intre.","notify_staff":"Notificar ao equipo privadamente","formatted_name":{"off_topic":"Non está relacionado","inappropriate":"É inapropiado","spam":"É spam"},"custom_placeholder_notify_user":"Se específico, construtivo e sempre amábel.","custom_placeholder_notify_moderators":"Especifícanos sobre o que estás preocupado e proporciónanos ligazóns relevantes e exemplos cando sexa posíbel."},"flagging_topic":{"title":"Grazas por axudar a manter a nosa comunidade.","action":"Denunciar tema","notify_action":"Mensaxe"},"topic_map":{"title":"Resumo do tema","participants_title":"Publicadores frecuentes","links_title":"Ligazóns populares","clicks":{"one":"Un clic","other":"%{count} clics"}},"topic_statuses":{"warning":{"help":"Este é un aviso oficial."},"bookmarked":{"help":"Marcaches este tema"},"locked":{"help":"Este tema está pechado, xa non acepta respostas"},"archived":{"help":"Este tema está arquivado; está conxelado e non se pode cambiar"},"locked_and_archived":{"help":"Este tema está pechado e arquivado; xa non acepta novas respostas e non se pode cambiar"},"unpinned":{"title":"Despegado","help":"Este tema está despegado para vostede; presentarase na orde normal"},"pinned_globally":{"title":"Pegado globalmente","help":"Este tema pegouse globalmente; presentarase na banda superior dos máis recentes e na súa categoría"},"pinned":{"title":"Pegado","help":"Este tema pegouse globalmente; presentarase na banda superior da súa categoría"},"invisible":{"help":"Este tema non está listado. Non se presentará nas listas de temas e só estará accesíbel vía ligazón directa"}},"posts":"Publicacións","posts_long":"hai {{number}} publicacións neste tema","original_post":"Publicación orixinal","views":"Vistas","views_lowercase":{"one":"vista","other":"vistas"},"replies":"Respostas","views_long":"este tema visitouse {{number}} veces","activity":"Actividade","likes":"Gústames","likes_lowercase":{"one":"gústame","other":"gústames"},"likes_long":"hai {{number}} gústames neste tema","users":"Usuarios","users_lowercase":{"one":"usuario","other":"usuarios"},"category_title":"Categoría","history":"Historial","changed_by":"por {{author}}","raw_email":{"title":"Fonte do correo","not_available":"Non dispoñíbel."},"categories_list":"Lista de categorías","filters":{"with_topics":"%{filter} temas","with_category":"Temas de %{filter} %{category}","latest":{"title":"Últimos","title_with_count":{"one":"Último (1)","other":"({{count}}) últimos"},"help":"temas con publicacións recentes"},"hot":{"title":"Quentes","help":"unha selección dos temas máis quentes"},"read":{"title":"Lidos","help":"temas que liches, partindo da última lectura"},"search":{"title":"Buscar","help":"buscar todos os temas"},"categories":{"title":"Categorías","title_in":"Categoría - {{categoryName}}","help":"todos os temas agrupados por categoría"},"unread":{"title":"Sen ler","title_with_count":{"one":"Un sen ler","other":"({{count}}) sen ler"},"help":"temas con publicacións sen ler que estás vendo ou seguindo","lower_title_with_count":{"one":"Unha sen ler","other":"{{count}} sen ler"}},"new":{"lower_title_with_count":{"one":"Un novo","other":"{{count}} novos"},"lower_title":"novo","title":"Novo","title_with_count":{"one":"Un novo","other":"({{count}}) novos"},"help":"temas creados nos últimos días"},"posted":{"title":"As miñas publicacións","help":"temas nos que publicaches"},"bookmarks":{"title":"Marcadores","help":"temas que marcaches"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"últimos temas na categoría {{categoryName}}"},"top":{"title":"Destacados","help":"os temas máis activos no último ano, mes, semana ou día","all":{"title":"Todos"},"yearly":{"title":"Anual"},"quarterly":{"title":"Trimestral"},"monthly":{"title":"Mensual"},"weekly":{"title":"Semanal"},"daily":{"title":"Diario"},"all_time":"Todos","this_year":"Ano","this_quarter":"Trimestre","this_month":"Mes","this_week":"Semana","today":"Hoxe","other_periods":"ver destacados"}},"browser_update":"Desgraciadamente, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eo navegador é demasiado vello para funcionar nesta web\u003c/a\u003e. \u003ca href=\"http://browsehappy.com\"\u003eAnóvao\u003c/a\u003e.","permission_types":{"full":"Crear / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"poll":{"voters":{"one":"votante","other":"votantes"},"total_votes":{"one":"votos totais","other":"votos totais"},"average_rating":"Valoración media: \u003cstrong\u003e%{average}\u003c/strong\u003e.","cast-votes":{"title":"Vota","label":"Vota agora!"},"show-results":{"title":"Mostrar os resultados da votación","label":"Mostrar os resultados"},"hide-results":{"title":"Volver aos teus votos","label":"Ocultar os resultados"},"open":{"title":"Abrir a enquisa","label":"Abrir","confirm":"Confirmas a apertura da enquisa?"},"close":{"title":"Pechar a enquisa","label":"Pechar","confirm":"Confirmas o peche desta enquisa?"}},"type_to_filter":"escribe para filtrar...","admin":{"title":"Administrador de Discourse","moderator":"Moderador","dashboard":{"title":"Panel","last_updated":"Última actualización de Panel:","version":"Versión","up_to_date":"Estás actualizado.","critical_available":"Está dispoñíbel unha actualización crítica.","updates_available":"Hai actualizacións dispoñíbeis.","please_upgrade":"Por favor actualiza.","no_check_performed":"Non se efectuou unha busca de actualizacións. Asegúrate de que sidekiq está executándose.","stale_data":"Non se efectuou unha busca de actualizacións ultimamente. Asegúrate de que sidekiq está executándose.","version_check_pending":"Parece que actualizaches recentemente. Caralludo!","installed_version":"Instalado","latest_version":"Últimos","problems_found":"Atopáronse algúns problemas coa instalación do Discourse.","last_checked":"Última comprobación","refresh_problems":"Actualizar","no_problems":"Non se atoparon problemas.","moderators":"Moderadores:","admins":"Administradores:","blocked":"Bloqueados:","suspended":"Suspendidos:","private_messages_short":"Mensaxes","private_messages_title":"Mensaxes","mobile_title":"Móbil","space_free":"{{size}} libres","uploads":"subidas","backups":"copias de seguranza","traffic_short":"Tráfico","traffic":"Peticións web de aplicativos","page_views":"Peticións API","page_views_short":"Peticións API","show_traffic_report":"Amosar o informe detallado do tráfico","reports":{"today":"Hoxe","yesterday":"Onte","last_7_days":"Últimos 7 días","last_30_days":"Últimos 30 días","all_time":"Todos","7_days_ago":"Hai 7 días","30_days_ago":"Hai 30 días","all":"Todo","view_table":"táboa","refresh_report":"Actualiza informe","start_date":"Data de inicio","end_date":"Data de remate","groups":"Todos os grupos"}},"commits":{"latest_changes":"Últimos cambios: por favor, actualiza a miúdo.","by":"por"},"flags":{"title":"Denuncias","old":"Antigo","active":"Activo","agree":"Aceptar","agree_title":"Confirmar esta denuncia como válida","agree_flag_modal_title":"Aceptar e...","agree_flag_hide_post":"Aceptar (ocultar publicación + enviar msx. privada)","agree_flag_hide_post_title":"Ocultar esta publicación e enviar automaticamente unha mensaxe ao usuario para que a edite axiña","agree_flag_restore_post":"Aceptar (restabelecer publicación)","agree_flag_restore_post_title":"Restabelecer esta publicación","agree_flag":"Aceptar denuncia","agree_flag_title":"Aceptar a denuncia e manter a publicación sen cambios","defer_flag":"Pospor","defer_flag_title":"Eliminar esta denuncia; non precisa medidas neste momento.","delete":"Eliminar","delete_title":"Eliminar a publicación á que se refire esta denuncia.","delete_post_defer_flag":"Eliminar publicación e pospor a denuncia","delete_post_defer_flag_title":"Eliminar publicación. Se é a inicial, eliminar tamén o tema","delete_post_agree_flag":"Eliminar a publicación e aceptar a denuncia","delete_post_agree_flag_title":"Eliminar publicación. Se é a inicial, eliminar tamén o tema.","delete_flag_modal_title":"Eliminar e...","delete_spammer":"Eliminar spammer","delete_spammer_title":"Eliminar o usuario e todas as súas publicacións e temas.","disagree_flag_unhide_post":"En desacordo (amosar publicación)","disagree_flag_unhide_post_title":"Eliminar as denuncias desta publicación e facela visíbel de novo","disagree_flag":"Non aceptar","disagree_flag_title":"Denegar esta denuncia por incorrecta","clear_topic_flags":"Feito","clear_topic_flags_title":"Este tema investigouse e as incidencias arranxáronse. Preme Feito para eliminar as denuncias.","more":"(máis respostas...)","dispositions":{"agreed":"aceptar","disagreed":"non aceptar","deferred":"posposta"},"flagged_by":"Denunciado por","resolved_by":"Arranxado por","took_action":"Tomadas medidas","system":"Sistema","error":"Algo foi mal","reply_message":"Responder","no_results":"Non hai denuncias","topic_flagged":"Este \u003cstrong\u003etema\u003c/strong\u003e foi denunciado.","visit_topic":"Visite o tema para actuar","was_edited":"A publicación editouse despois da primeira denuncia","previous_flags_count":"Esta publicación xa se denunciou {{count}} veces.","summary":{"action_type_3":{"one":"sen relación","other":"sen relación x{{count}}"},"action_type_4":{"one":"inapropiado","other":"inapropiados x{{count}}"},"action_type_6":{"one":"personalizar","other":"personalizar x{{count}}"},"action_type_7":{"one":"personalizar","other":"personalizar x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Grupo primario","no_primary":"(non hai un grupo primario)","title":"Grupos","edit":"Editar grupos","refresh":"Actualizar","new":"Novo","selector_placeholder":"escribe o nome do usuario","name_placeholder":"Nome do grupo sen espazos, como na regra do nome do usuario","about":"Edita aquí a túa pertenza a un grupo e nomes","group_members":"Membros do grupo","delete":"Eliminar","delete_confirm":"Eliminar este grupo?","delete_failed":"Non é posíbel eliminar o grupo. Se este é un grupo automático, non se pode destruír.","delete_member_confirm":"Queres eliminar a «%{username}» do grupo «%{group}»?","delete_owner_confirm":"Eliminar os privilexios de usuario de «%{username}»?","name":"Nome","add":"Engadir","add_members":"Engadir membros","custom":"Personalizar","bulk_complete":"Engadíronse os usuarios ao grupo.","bulk":"Engadir ao grupo en bloque","bulk_paste":"Pegar unha lista de nomes de usuario ou correos-e, un por liña:","bulk_select":"(seleccionar un grupo)","automatic":"Automático","automatic_membership_email_domains":"Os usuarios que se rexistraron cun dominio de correo electrónico que coincida exactamente con algún da lista engadiranse automaticamente a este grupo:","automatic_membership_retroactive":"Aplicar a regra do mesmo dominio de correo electrónico para engadir os usuarios rexistrados.","default_title":"Título predeterminado para os usuarios deste grupo","primary_group":"Estabelecer automaticamente como grupo primario","group_owners":"Propietarios","add_owners":"Engadir propietarios","incoming_email":"Personalizar enderezos de correo-e entrantes","incoming_email_placeholder":"introducir enderezos de correo-e"},"api":{"generate_master":"Xerar unha chave maestra da API","none":"Non hai chaves activas da API agora mesmo.","user":"Usuario","title":"API","key":"Chave da API","generate":"Xerar","regenerate":"Rexenerar","revoke":"Revogar","confirm_regen":"Confirmas a substitución da chave da API por unha nova?","confirm_revoke":"Confirmas a revogación desta chave?","info_html":"A chave da API permitirache crear e actualizar temas usando chamadas JSON.","all_users":"Todos os usuarios","note_html":"Manter esta chave en \u003cstrong\u003esecreto\u003c/strong\u003e, todos os usuarios que a teñan poderían crear e publicar co nome da calquera usuario."},"plugins":{"title":"Plugins","installed":"Plugins instalados","name":"Nome","none_installed":"Non tes ningún plugin instalado.","version":"Versión","enabled":"Activado?","is_enabled":"S","not_enabled":"N","change_settings":"Cambiar axustes","change_settings_short":"Axustes","howto":"Como podo instalar un plugin?"},"backups":{"title":"Copias de seguranza","menu":{"backups":"Copias de seguranza","logs":"Rexistros"},"none":"Non hai copia de seguranza dispoñíbel","logs":{"none":"Aínda non hai rexistros..."},"columns":{"filename":"Nome do ficheiro","size":"Tamaño"},"upload":{"label":"Enviar","title":"Subir unha copia de seguranza a esta instancia","uploading":"Enviando...","success":"«{{filename}}» subiuse correctamente.","error":"Produciuse un erro durante o envío de «{{filename}}»: {{message}}"},"operations":{"is_running":"Estase executando unha operación...","failed":"Produciuse un fallo {{operation}} . Revisa os rexistros.","cancel":{"label":"Cancelar","title":"Cancelar a operación actual","confirm":"Confirmas a cancelación da operación actual?"},"backup":{"label":"Copia de seguranza","title":"Crear unha copia de seguranza","confirm":"Confirmas a execución dunha nova copia de seguranza?","without_uploads":"Si (non incluír ficheiros)"},"download":{"label":"Descargar","title":"Descargar a copia de seguranza"},"destroy":{"title":"Eliminar a copia de seguranza","confirm":"Confirmas a destrución desta copia de seguranza?"},"restore":{"is_disabled":"«Restabelecer» está desactivado nos axustes do sitio.","label":"Restabelecer","title":"Restabelecer a copia de seguranza","confirm":"Confirmas a restauración desta copia de seguranza?"},"rollback":{"label":"Reverter","title":"Reverter a base de datos ao estado de funcionamento anterior","confirm":"Confirmas a reversión da base de datos ao estado de funcionamento anterior?"}}},"export_csv":{"user_archive_confirm":"Confirmas a descarga das túas publicacións?","success":"Iniciouse a exportación, notificarémosche cunha mensaxe o remate do proceso.","failed":"Produciuse un fallo na exportación. Comproba os rexistros.","rate_limit_error":"Só se poden descargar as publicacións unha vez por día. Téntao de novo mañá.","button_text":"Exportar","button_title":{"user":"Exportar a lista completa de usuarios en formato CSV.","staff_action":"Exportar o rexistro con todas as accións do equipo en formato CSV.","screened_email":"Exportar a lista de correos-e controlados en formato CSV.","screened_ip":"Exportar a lista de IP controladas en formato CSV.","screened_url":"Exportar a lista de URL controladas en formato CSV."}},"export_json":{"button_text":"Exportar"},"invite":{"button_text":"Enviar convites","button_title":"Enviar convites"},"customize":{"title":"Personalizar","long_title":"Personalización do sitio","css":"CSS","header":"Cabeceira","top":"Destacados","footer":"Pé de páxina","embedded_css":"CSS encaixado","head_tag":{"text":"\u003c/head\u003e","title":"HTML que se inserirá antes da etiqueta \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML que se inserirá antes da etiqueta \u003c/body\u003e"},"override_default":"Non incluír folla de estilo estándar","enabled":"Activado?","preview":"previsualizar","undo_preview":"eliminar previsualización","rescue_preview":"estilo predeterminado","explain_preview":"Ver o sitio con esta folla de estilo personalizada","explain_undo_preview":"Volver á folla de estilo personalizada activada actualmente","explain_rescue_preview":"Ver o sitio coa folla de estilo predeterminada","save":"Gardar","new":"Novo","new_style":"Novo estilo","import":"Importar","import_title":"Seleccionar un ficheiro ou pegar un texto","delete":"Eliminar","delete_confirm":"Queres eliminar esta personalización?","about":"Modificar as follas de estilo CSS e as cabeceiras HTML do sitio. Engadir unha personalización para comezar.","color":"Cor","opacity":"Opacidade","copy":"Copiar","email_templates":{"title":"Modelos de correo-e","subject":"Asunto","multiple_subjects":"Este modelo de correo-e ten varios asuntos.","body":"Corpo","none_selected":"Selecciona un modelo de correo-e para comezar a edición.","revert":"Reverter os cambios","revert_confirm":"Confirmas a reversión dos cambios?"},"css_html":{"title":"CSS/HTML","long_title":"Personalizacións do CSS e do HTML"},"colors":{"title":"Cores","long_title":"Esquemas de cor","about":"Modifica as cores usadas no sitio sen ter que escribir en CSS. Engade un esquema para comezar.","new_name":"Novo esquema de cores","copy_name_prefix":"Copiar de","delete_confirm":"Queres eliminar este esquema de cor?","undo":"desfacer","undo_title":"Desfai os teus cambio nesta cor desde a última vez que a gardaches.","revert":"reverter","revert_title":"Restabelecer o esquema de cor ao predeterminado de Discourse.","primary":{"name":"primario","description":"Principalmente texto, iconas e bordos."},"secondary":{"name":"secundario","description":"Cor principal do fondo e cor do texto dalgúns botóns."},"tertiary":{"name":"terciario","description":"Ligazóns, algúns botóns, notificacións e cor de resalte."},"quaternary":{"name":"cuaternario","description":"Ligazóns de navegación"},"header_background":{"name":"Fondo da cabeceira","description":"Cor do fondo na cabeceira do sitio."},"header_primary":{"name":"cabeceira primaria","description":"Texto e iconas na cabeceira do sitio."},"highlight":{"name":"resaltes","description":"Cor do fondo dos elementos resaltados da páxina, como publicacións e temas."},"danger":{"name":"perigo","description":"Cor de resalte para accións como eliminar publicacións e temas."},"success":{"name":"correcto","description":"Usado para indicar que unha acción se realizou correctamente."},"love":{"name":"gústame","description":"Cor do botón Gústame."}}},"email":{"title":"Correos electrónicos","settings":"Axustes","templates":"Modelos","preview_digest":"Previsualización do compendio","sending_test":"Enviando correo-e de proba...","error":"\u003cb\u003eERRO\u003c/b\u003e - %{server_error}","test_error":"Produciuse un problema enviando o correo-e de proba. Revisa os teus axustes de correo electrónico, comproba que o teu host non está bloqueando as conexións de correo e téntao de novo.","sent":"Enviado","skipped":"Saltado","received":"Recibidos","rejected":"Rexeitado","sent_at":"Enviado ás","time":"Hora","user":"Usuario","email_type":"Tipo de correo-e","to_address":"Ao enderezo","test_email_address":"enderezo de correo-e de proba","send_test":"Enviar correo-e de proba","sent_test":"enviado!","delivery_method":"Metodo de entrega","preview_digest_desc":"Previsualiza o contido dos correos-e compendio enviados a usuarios inactivos.","refresh":"Actualizar","format":"Formato","html":"html","text":"texto","last_seen_user":"Último usuario visto:","reply_key":"Tecla para responder","skipped_reason":"Saltar razón","incoming_emails":{"from_address":"De","to_addresses":"A","cc_addresses":"Cc","subject":"Asunto","error":"Erro","none":"Non se atoparon correos entrantes.","modal":{"title":"Detalles dos correos-e entrantes","error":"Erro","subject":"Asunto","body":"Corpo","rejection_message":"Correo-e de rexeitamento"},"filters":{"from_placeholder":"de@exemplo.com","to_placeholder":"a@exemplo.com","cc_placeholder":"cc@exemplo.com","subject_placeholder":"Asunto...","error_placeholder":"Erro"}},"logs":{"none":"Non se atoparon rexistros.","filters":{"title":"Filtro","user_placeholder":"nome de usuario","address_placeholder":"nome@exemplo.com","type_placeholder":"compendio, rexistro...","reply_key_placeholder":"tecla para responder","skipped_reason_placeholder":"razón"}}},"logs":{"title":"Rexistros","action":"Acción","created_at":"Creado","last_match_at":"Último resultado","match_count":"Resultados","ip_address":"IP","topic_id":"ID do tema","post_id":"ID da publicación","category_id":"ID da categoría","delete":"Eliminar","edit":"Editar","save":"Gardar","screened_actions":{"block":"bloquear","do_nothing":"non facer nada"},"staff_actions":{"title":"Accións do equipo","instructions":"Premer nos nomes dos usuarios e nas accións para filtrar a lista. Premer nas imaxes dos perfís para ir ás páxinas dos usuarios.","clear_filters":"Amosar todo","staff_user":"Usuario do equipo","target_user":"Usuario obxectivo","subject":"Asunto","when":"Cando","context":"Contexto","details":"Detalles","previous_value":"Anterior","new_value":"Novo","diff":"Diferenzas","show":"Amosar","modal_title":"Detalles","no_previous":"Non hai ningún valor previo.","deleted":"Non hai ningún valor. O rexistro foi eliminado.","actions":{"delete_user":"eliminar usuario","change_trust_level":"cambiar nivel de confianza","change_username":"cambiar nome do usuario","change_site_setting":"cambiar axuste do sitio","change_site_customization":"cambiar a personalización do sitio","delete_site_customization":"eliminar a personalización do sitio","change_site_text":"cambiar o texto do sitio","suspend_user":"suspender usuario","unsuspend_user":"non suspender usuario","grant_badge":"conceder insignia","revoke_badge":"revogar insignia","check_email":"comprobar correo-e","delete_topic":"eliminar tema","delete_post":"eliminar publicación","impersonate":"suplantar","anonymize_user":"facer o usuario anónimo","roll_up":"encartar os bloques de IP","change_category_settings":"cambiar axustes da categoría","delete_category":"eliminar categoría","create_category":"crear categoría","block_user":"bloquear usuario","unblock_user":"desbloquear usuario","grant_admin":"conceder administración","revoke_admin":"revogar administración","grant_moderation":"conceder moderación","revoke_moderation":"revogar moderación","backup_operation":"operación de copia de seguranza"}},"screened_emails":{"title":"Correos-e controlados","description":"Cando alguén tente crear unha nova conta, comprobaranse os seguintes enderezos de correo electrónico e bloquearase o rexistro ou se tomará outra medida.","email":"Enderezo de correo-e","actions":{"allow":"Permitir"}},"screened_urls":{"title":"URL controladas","description":"As URL listadas aquí usáronse en publicacións de usuarios que foron identificados como spammers.","url":"URL","domain":"Dominio"},"screened_ips":{"title":"IP controladas","description":"Enderezos IP observados. Usa «Permitir» para engadilos á lista branca.","delete_confirm":"Confirmas a eliminación da regra para %{ip_address}?","roll_up_confirm":"Confirmas que queres agrupar en subredes os enderezos IP controlados comunmente?","rolled_up_some_subnets":"Agrupáronse correctamente en subredes as entradas de IP para bloquear: %{subnets}.","rolled_up_no_subnet":"Non hai nada que agrupar.","actions":{"block":"Bloquear","do_nothing":"Permitir","allow_admin":"Permitir administrador"},"form":{"label":"Novo:","ip_address":"Enderezo IP","add":"Engadir","filter":"Buscar"},"roll_up":{"text":"Agrupar","title":"Crea unha nova subrede de entradas para bloquear se hai cando menos «min_ban_entries_for_roll_up» entradas."}},"logster":{"title":"Rexistros de erros"}},"impersonate":{"title":"Suplantar","help":"Usar esta ferramenta para suplantar unha conta de usuario co obxecto de detectar e corrixir erros. Deberás saír da sesión ao rematar.","not_found":"Non é posíbel atopar o usuario.","invalid":"Sentímolo pero non podes suplantar este usuario."},"users":{"title":"Usuarios","create":"Engadir usuario administrador","last_emailed":"Últimos envíos por correo-e","not_found":"Sentímolo pero o nome do usuario non existe no sistema.","id_not_found":"Sentímolo pero o usuario non existe no sistema.","active":"Activo","show_emails":"Amosar correos-e","nav":{"new":"Novo","active":"Activo","pending":"Pendente","staff":"Equipo","suspended":"Suspendido","blocked":"Bloqueado","suspect":"Sospeitoso"},"approved":"Aprobado?","approved_selected":{"one":"aprobar usuario","other":"aprobar os ({{count}}) usuarios"},"reject_selected":{"one":"rexeitar usuario","other":"rexeitar os ({{count}}) usuarios"},"titles":{"active":"Usuarios activos","new":"Novos usuarios","pending":"Usuarios pendentes de revisión","newuser":"Usuarios cun nivel de confianza 0 (novo usuario)","basic":"Usuarios cun nivel de confianza 1 (usuario básico)","member":"Usuarios cun nivel de confianza 2 (membro)","regular":"Usuarios cun nivel de confianza 3 (normal)","leader":"Usuarios cun nivel de confianza 4 (líder)","staff":"Equipo","admins":"Usuarios administradores","moderators":"Moderadores","blocked":"Usuarios bloqueados","suspended":"Usuarios suspendidos","suspect":"Usuarios sospeitosos"},"reject_successful":{"one":"Rexeitouse un usuario correctamente.","other":"Rexeitáronse %{count} usuarios correctamente."},"reject_failures":{"one":"Produciuse un fallo rexeitando o usuario.","other":"Produciuse un fallo rexeitando os %{count} usuarios."},"not_verified":"Sen verificar","check_email":{"title":"Amosar o enderezo de correo-e deste usuario","text":"Amosar"}},"user":{"suspend_failed":"Algo fallou rexeitando este usuario {{error}}","unsuspend_failed":"Algo foi mal levantando a suspensión deste usuario {{error}}","suspend_duration":"Canto tempo estará suspendido o usuario?","suspend_duration_units":"(días)","suspend_reason_label":"Cal é o motivo da suspensión? Este texto \u003cb\u003eserá visíbel para todo o mundo\u003c/b\u003e na páxina do perfil deste usuario e amosaráselle ao usuario cando tente iniciar sesión. Procura ser breve.","suspend_reason":"Razón","suspended_by":"Suspendido por","delete_all_posts":"Eliminar todas as publicacións","suspend":"Suspender","unsuspend":"Non suspender","suspended":"Suspendido?","moderator":"Moderador?","admin":"Administrador?","blocked":"Bloqueado?","staged":"Transitorio?","show_admin_profile":"Administración","edit_title":"Editar título","save_title":"Gardar título","refresh_browsers":"Forzar a actualización do navegador","refresh_browsers_message":"Mensaxe enviada a todos os clientes.","show_public_profile":"Amosar o perfil público","impersonate":"Suplantar","ip_lookup":"Busca de IP","log_out":"Saír da sesión","logged_out":"O usuario foi desconectado en todos os dispositivos","revoke_admin":"Revogar administrador","grant_admin":"Facer administrador","revoke_moderation":"Revogar moderación","grant_moderation":"Conceder moderación","unblock":"Desbloquear","block":"Bloquear","reputation":"Reputación","permissions":"Permisos","activity":"Actividade","like_count":"Gústames dados / Recibidos","last_100_days":"nos últimos 100 días","private_topics_count":"Temas privados","posts_read_count":"Publicacións lidas","post_count":"Publicacións creadas","topics_entered":"Temas vistos","flags_given_count":"Denuncias dadas","flags_received_count":"Denuncias recibidas","warnings_received_count":"Avisos recibidos","flags_given_received_count":"Denuncias dadas / Recibidas","approve":"Aprobar","approved_by":"aprobado por","approve_success":"Usuario aprobado, enviouse un correo-e coas instrucións de activación.","approve_bulk_success":"Todos os usuarios seleccionados foron aprobados e notificados.","time_read":"Tempo de lectura","anonymize":"Facer o usuario anónimo","anonymize_confirm":"Confirmas que desexas converter esta conta en anónima? Cambiaranse o nome do usuario e o correo electrónico e restabelecerase toda a información do perfil.","anonymize_yes":"Si, converter a conta en anónima","anonymize_failed":"Produciuse un problema convertendo a conta en anónima.","delete":"Eliminar usuario","delete_forbidden_because_staff":"Non é posíbel eliminiar os administradores e moderadores.","delete_posts_forbidden_because_staff":"Non é posíbel eliminar todas as publicacións dos administradores ou moderadores.","delete_forbidden":{"one":"Non é posíbel eliminar usuarios se teñen publicacións. Elimina as publicacións antes de eliminar o usuario (non é posíbel eliminar publicacións de máis de  %{count} día)","other":"Non é posíbel eliminar usuarios se teñen publicacións. Elimina as publicacións antes de eliminar o usuario (non é posíbel eliminar publicacións de máis de  %{count} días)"},"cant_delete_all_posts":{"one":"Non é posíbel eliminar todas as publicacións. Algunhas teñen máis de %{count} día. (o axuste delete_user_max_post_age.)","other":"Non é posíbel eliminar todas as publicacións. Algunhas teñen máis de %{count} días. (o axuste delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Non é posíbel eliminar todas as publicacións porque o usuario ten máis dunha publicación.  (delete_all_posts_max)","other":"Non é posíbel eliminar todas as publicacións porque o usuario ten máis de %{count} publicacións.  (delete_all_posts_max)"},"delete_confirm":"CONFIRMAS a eliminación deste usuario? Non se poderá desfacer!","delete_and_block":"Eliminar e \u003cb\u003ebloquear\u003c/b\u003e este correo-e e enderezo IP","delete_dont_block":"Só eliminar","deleted":"Eliminouse o usuario.","delete_failed":"Produciuse un erro eliminando este usuario. Asegúrate que se eliminan todas as publicacións antes de tentar eliminar o usuario.","send_activation_email":"Enviar correo-e de activación","activation_email_sent":"Enviouse un correo electrónico de activación.","send_activation_email_failed":"Produciuse un problema enviando outro correo-e de activación. %{error}","activate":"Activar conta","activate_failed":"Produciuse un problema activando o usuario.","deactivate_account":"Desactivar a conta","deactivate_failed":"Produciuse un problema desactivando o usuario.","unblock_failed":"Produciuse un problema desbloqueando o usuario.","block_failed":"Produciuse un problema bloqueando o usuario.","block_confirm":"Confirmas o bloqueo deste usuario? Non poderá crear máis temas nin publicacións.","block_accept":"Si, bloquealo","deactivate_explanation":"Un usuario desactivado debe revalidar o seu correo-e.","suspended_explanation":"Un usuario suspendido non pode iniciar sesión.","block_explanation":"Un usuario bloquedo non pode publicar nin iniciar temas.","trust_level_change_failed":"Produciuse un problema cambiando o nivel de confianza do usuario.","suspend_modal_title":"Suspender usuario","trust_level_2_users":"Usuarios con nivel 2 de confianza","trust_level_3_requirements":"Requirimentos para o nivel de confianza 3","trust_level_locked_tip":"o nivel de confianza está bloqueado, o sistema non promocionará nin rebaixará o usuario","trust_level_unlocked_tip":"o nivel de confianza está desbloqueado, o sistema pode promocionar ou rebaixar o usuario","lock_trust_level":"Bloquear o nivel de confianza","unlock_trust_level":"Desbloquear o nivel de confianza","tl3_requirements":{"title":"Requerimentos para o nivel 3 de confianza","value_heading":"Valor","requirement_heading":"Requirimento","visits":"Visitas","days":"días","topics_replied_to":"Temas os que respondeu","topics_viewed":"Temas vistos","topics_viewed_all_time":"Temas vistos (todo o tempo)","posts_read":"Publicacións lidas","posts_read_all_time":"Publicacións lidas (todo o tempo)","flagged_posts":"Publicacións denunciadas","flagged_by_users":"Usuarios que denunciaron","likes_given":"Gústames dados","likes_received":"Gústames recibidos","likes_received_days":"Gústames recibidos: por días","likes_received_users":"Gústames recibidos: usuarios","qualifies":"Cumpre os requisitos para o nivel de confianza 3.","does_not_qualify":"Non cumpre os requisitos para o nivel de confianza 3.","will_be_promoted":"Será promocionado pronto.","will_be_demoted":"Será rebaixado pronto.","on_grace_period":"Actualmente ne periodo de graza da promoción, non será rebaixado","locked_will_not_be_promoted":"Nivel de confianza bloqueado. Non se promocionará nunca.","locked_will_not_be_demoted":"Nivel de confianza bloqueado. Non será rebaixado nunca."},"sso":{"title":"Inicio de sesión simple","external_id":"ID externo","external_username":"Nome do usuario","external_name":"Nome","external_email":"Correo electrónico","external_avatar_url":"URL da imaxe do perfil"}},"user_fields":{"title":"Campos do usuario","help":"Engade campos que os usuarios poidan encher.","create":"Crear un campo de usuario","untitled":"Sen título","name":"Nome do campo","type":"TIpo de campo","description":"Descrición do campo","save":"Gardar","edit":"Editar","delete":"Eliminar","cancel":"Cancelar","delete_confirm":"Confirmas a eliminación deste campo do usuario?","options":"Opcións","required":{"title":"Requirido para rexistrarse?","enabled":"obrigatorio","disabled":"non obrigatorio"},"editable":{"title":"Editábel despois do rexistro?","enabled":"editábel","disabled":"non editábel"},"show_on_profile":{"title":"Amosar no perfil público?","enabled":"amosado no perfil","disabled":"non amosado no perfil"},"field_types":{"text":"Campo de texto","confirm":"Confirmación","dropdown":"Despregábel"}},"site_text":{"description":"Podes personalizar calquera texto do teu foro. Comeza por buscar debaixo:","search":"Busca o texto que queres editar","title":"Contido do texto","edit":"editar","revert":"Reverter os cambios","revert_confirm":"Confirmas a reversión dos cambios?","go_back":"Volver á busca","recommended":"Recomendamos personalizar o seguinte texto para axeitalo ás túas necesidades:","show_overriden":"Amosar só os cambios"},"site_settings":{"show_overriden":"Amosar só os cambios","title":"Axustes","reset":"restabelecer","none":"ningunha","no_results":"Non se atoparon resultados.","clear_filter":"Borrar","add_url":"engadir URL","add_host":"engadir host","categories":{"all_results":"Todo","required":"Obrigatorio","basic":"Configuración básica","users":"Usuarios","posting":"Publicación","email":"Correo electrónico","files":"Ficheiros","trust":"Niveis de confianza","security":"Seguranza","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Límites de frecuencia","developer":"Desenvolvedor","embedding":"Encaixado","legal":"Legal","uncategorized":"Outro","backups":"Copias de seguranza","login":"Iniciar sesión","plugins":"Plugins","user_preferences":"Preferencias do usuario"}},"badges":{"title":"Insignias","new_badge":"Nova insignia","new":"Novo","name":"Nome","badge":"Insignia","display_name":"Nome público","description":"Descrición","badge_type":"Tipo de insignia","badge_grouping":"Grupo","badge_groupings":{"modal_title":"Grupos de insignias"},"granted_by":"Concedido por","granted_at":"Concedido","reason_help":"(Ligazón a unha publicación ou tema)","save":"Gardar","delete":"Eliminar","delete_confirm":"Confirmas a eliminación desta insignia?","revoke":"Revogar","reason":"Razón","expand":"Expandir \u0026hellip;","revoke_confirm":"Confirmas a revogación desta insignia?","edit_badges":"Editar insignias","grant_badge":"Conceder insignia","granted_badges":"Insignias concedidas","grant":"Conceder","no_user_badges":"A %{name} non se lle concedeu ningunha insignia.","no_badges":"Non hai insignias para conceder.","none_selected":"Selecciona unha insignia para comezar","allow_title":"Permitir que se use a insignia como un título","multiple_grant":"Pode concederse múltiples veces","listable":"Amosar a insignia na páxina de insignias públicas","enabled":"Activar insignia","icon":"Icona","image":"Imaxe","icon_help":"Usar a clase Font Awesome ou unha URL a unha imaxe","query":"Consulta sobre insignia (SQL)","target_posts":"Consulta dirixida a mensaxes","auto_revoke":"Executar a consulta de revogación diariamente","show_posts":"Amosar a publicación concedendo a insignia na páxina das insignias","trigger":"Activador","trigger_type":{"none":"Actualizar diariamente","post_action":"Cando un usuario actúa sobre unha publicación","post_revision":"Cando un usuario edita ou crea unha publicación","trust_level_change":"Cando un usuario cambia o nivel de confianza","user_change":"Cando se crea ou edita un usuario"},"preview":{"link_text":"Previsualizar as insignias concedidas","plan_text":"Vista previa do plan da consulta","modal_title":"Previsualizar a consulta de insignias","sql_error_header":"Produciuse un erro coa consulta.","error_help":"Busca axuda nas seguintes ligazóns sobre consultas de insignias.","bad_count_warning":{"header":"AVISO","text":"Faltan algunhas mostras para a concesión da insignia. Isto acontece cando a consulta sobre insignias devolve unha ID do usuario, ou de publicacións que non existen. Pode causar resultados inesperados posteriormente. Revisa outra vez a solicitude."},"no_grant_count":"Non hai insignias para asignar.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e insignia para asignar.","other":"\u003cb\u003e%{count}\u003c/b\u003e insignias para asignar."},"sample":"Mostra:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e para publicación en %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e para publicación en %{link} o \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e o \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Engade novo emoji que estará dispoñíbel para todos. (Suxestión: arrastra e solta múltiples ficheiros dunha vez)","add":"Engadir novo Emoji","name":"Nome","image":"Imaxe","delete_confirm":"Confirmas a eliminación do emoji :%{name}:?"},"embedding":{"get_started":"Se queres encaixar o Discourse noutro sitio web, comeza engadindo o seu host.","confirm_delete":"Confirmas a eliminación deste host?","sample":"Usa o seguinte código HTML no teu sitio para crear e encaixar temas do Discourse. Substitúe \u003cb\u003eREPLACE_ME\u003c/b\u003e pola URL canónica da páxina que recibe o encaixado. ","title":"Encaixado","host":"Hosts permitidos","edit":"editar","category":"Publicación a categoría","add_host":"Engadir host","settings":"Axustes para o encaixado","feed_settings":"Axustes das fontes","feed_description":"Dotar dunha fonte RSS/ATOM o teu sitio pode mellorar a capacidade de Discourse para importar o teu contido.","crawling_settings":"Axustes do extractor","crawling_description":"Cando o Discourse crea temas para as túas publicacións, se non existe unha fonte RSS/ATOM, tentará analizar o contido do teu HTML. Ás veces pode ser difícil extraer o contido, por iso damos a posibilidade de especificar as regras do CSS para facilitar a extracción.","embed_by_username":"Nome do usuario para crear o tema","embed_post_limit":"Número máximo de publicacións a encaixar","embed_username_key_from_feed":"Clave para extraer da fonte o nome do usuario do discourse","embed_truncate":"Truncar as publicacións encaixadas","embed_whitelist_selector":"Selector CSS de elementos permitidos nos encaixados","embed_blacklist_selector":"Selector CSS para elementos retirados nos encaixados","feed_polling_enabled":"Importar publicacións vía RSS/ATOM","feed_polling_url":"URL da fonte RSS/ATOM para facer a extracción","save":"Gardar axustes de encaixado"},"permalink":{"title":"Ligazóns permanentes","url":"URL","topic_id":"ID do tema","topic_title":"Tema","post_id":"ID da publicación","post_title":"Publicación","category_id":"ID da categoría","category_title":"Categoría","external_url":"URL externa","delete_confirm":"Confirmas a eliminación desta ligazón permanente?","form":{"label":"Novo:","add":"Engadir","filter":"Buscar (URLou URL externa)"}}}}},"en":{"js":{"dates":{"timeline_date":"MMM YYYY","wrap_ago":"%{date} ago"},"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}","invited_group":"invited %{who} %{when}","removed_group":"removed %{who} %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"ap_south_1":"Asia Pacific (Mumbai)","cn_north_1":"China (Beijing)"}},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","directory":{"topics_entered":"Viewed","topics_entered_long":"Topics Viewed"},"groups":{"index":"Groups","notifications":{"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."}}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","email_activity_summary":"Activity Summary","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","watched_topics_link":"Show watched topics","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_about":{"error":"There was an error changing this value."},"change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","invited":{"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"time_read":"read time","topic_count":{"one":"topic created","other":"topics created"},"post_count":{"one":"post created","other":"posts created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"no_replies":"No replies yet.","no_topics":"No topics yet.","no_badges":"No badges yet.","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","link_url_placeholder":"http://example.com","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e"},"search":{"too_short":"Your search term is too short.","context":{"category":"Search the #{{category}} category"}},"topics":{"bulk":{"change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."}},"post":{"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"public":{"title":"Votes are public."},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}}},"email":{"bounced":"Bounced","incoming_emails":{"modal":{"headers":"Headers"}}},"logs":{"staff_actions":{"actions":{"deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"}},"site_settings":{"categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"long_description":"Long Description","trigger_type":{"post_processed":"After a post is processed"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'gl';
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
//! locale : galician (gl)
//! author : Juan G. Hurtado : https://github.com/juanghurtado

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var gl = moment.defineLocale('gl', {
        months : 'Xaneiro_Febreiro_Marzo_Abril_Maio_Xuño_Xullo_Agosto_Setembro_Outubro_Novembro_Decembro'.split('_'),
        monthsShort : 'Xan._Feb._Mar._Abr._Mai._Xuñ._Xul._Ago._Set._Out._Nov._Dec.'.split('_'),
        monthsParseExact: true,
        weekdays : 'Domingo_Luns_Martes_Mércores_Xoves_Venres_Sábado'.split('_'),
        weekdaysShort : 'Dom._Lun._Mar._Mér._Xov._Ven._Sáb.'.split('_'),
        weekdaysMin : 'Do_Lu_Ma_Mé_Xo_Ve_Sá'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY H:mm',
            LLLL : 'dddd D MMMM YYYY H:mm'
        },
        calendar : {
            sameDay : function () {
                return '[hoxe ' + ((this.hours() !== 1) ? 'ás' : 'á') + '] LT';
            },
            nextDay : function () {
                return '[mañá ' + ((this.hours() !== 1) ? 'ás' : 'á') + '] LT';
            },
            nextWeek : function () {
                return 'dddd [' + ((this.hours() !== 1) ? 'ás' : 'a') + '] LT';
            },
            lastDay : function () {
                return '[onte ' + ((this.hours() !== 1) ? 'á' : 'a') + '] LT';
            },
            lastWeek : function () {
                return '[o] dddd [pasado ' + ((this.hours() !== 1) ? 'ás' : 'a') + '] LT';
            },
            sameElse : 'L'
        },
        relativeTime : {
            future : function (str) {
                if (str === 'uns segundos') {
                    return 'nuns segundos';
                }
                return 'en ' + str;
            },
            past : 'hai %s',
            s : 'uns segundos',
            m : 'un minuto',
            mm : '%d minutos',
            h : 'unha hora',
            hh : '%d horas',
            d : 'un día',
            dd : '%d días',
            M : 'un mes',
            MM : '%d meses',
            y : 'un ano',
            yy : '%d anos'
        },
        ordinalParse : /\d{1,2}º/,
        ordinal : '%dº',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 1st is the first week of the year.
        }
    });

    return gl;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM, YYYY h:mm a'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
