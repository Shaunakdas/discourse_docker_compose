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
r += "Hay ";
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
r += "<a href='/unread'>1 no leído</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " no leídos</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "y ";
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
r += " <a href='/new'>1 nuevo</a> tema";
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
r += "y ";
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
})() + " nuevos</a> temas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restantes, o ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "explora otros temas en ";
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
r += "Este tema tiene ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 respuesta";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " respuestas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "con una ratio de me gusta por post elevada";
return r;
},
"med" : function(d){
var r = "";
r += "con una ratio de me gusta por post bastante elevada";
return r;
},
"high" : function(d){
var r = "";
r += "con una ratio de me gusta por post elevadísima";
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

MessageFormat.locale.es = function ( n ) {
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
I18n.translations = {"es":{"js":{"number":{"format":{"separator":",","delimiter":"."},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"hace %{date}","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuto","other":"%{count} mins"},"x_hours":{"one":"1 hora","other":"%{count} horas"},"x_days":{"one":"1 día","other":"%{count} días"},"date_year":"D MMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"hace 1 minuto","other":"hace %{count} minutos"},"x_hours":{"one":"hace 1 hora","other":"hace %{count} horas"},"x_days":{"one":"hace 1 día","other":"hace %{count} días"}},"later":{"x_days":{"one":"1 día después","other":"%{count} días después"},"x_months":{"one":"%{count} mes después","other":"%{count} meses después"},"x_years":{"one":"%{count} año después","other":"%{count} años después"}},"previous_month":"Anterior mes","next_month":"Próximo mes"},"share":{"topic":"comparte un enlace a este tema","post":"post #%{postNumber}","close":"cerrar","twitter":"comparte este enlace en Twitter","facebook":"comparte este enlace en Facebook","google+":"comparte este enlace en Google+","email":"comparte este enlace por email"},"action_codes":{"public_topic":"hizo este tema público %{when}","private_topic":"hizo este tema privado %{when}","split_topic":"separó este tema %{when}","invited_user":"invitó a %{who} %{when}","invited_group":"invitó a %{who} %{when}","removed_user":"eliminó a %{who} %{when}","removed_group":"eliminó a %{who} %{when}","autoclosed":{"enabled":"cerrado %{when}","disabled":"abierto %{when}"},"closed":{"enabled":"cerrado %{when}","disabled":"abierto %{when}"},"archived":{"enabled":"archivado %{when}","disabled":"desarchivado %{when}"},"pinned":{"enabled":"destacado %{when}","disabled":"sin destacar %{when}"},"pinned_globally":{"enabled":"destacado globalmente %{when}","disabled":"sin destacar %{when}"},"visible":{"enabled":"listado %{when}","disabled":"quitado de la lista, invisible %{when}"}},"topic_admin_menu":"acciones de administrador para el tema","emails_are_disabled":"Todos los emails salientes han sido desactivados por un administrador. No se enviará ninguna notificación por email.","bootstrap_mode_enabled":"Para lanzar tu nuevo sitio más fácilmente, estás en modo de arranque. A todos los nuevos usuarios se les concederá el nivel 1 de confianza y recibirán resúmenes diarios por email. Esto se desactivará automáticamente cuando el número total de usuarios exceda los %{min_users}.","bootstrap_mode_disabled":"El modo de arranque se desactivará en las próximas 24 horas.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"UE (Irlanda)","eu_central_1":"UE (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapur)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Bombay)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seúl)","sa_east_1":"Sudamérica (São Paulo)","cn_north_1":"China (Pekín)"}},"edit":"editar el título y la categoría de este tema","not_implemented":"Esta característica no ha sido implementada aún, ¡lo sentimos!","no_value":"No","yes_value":"Sí","generic_error":"Lo sentimos, ha ocurrido un error.","generic_error_with_reason":"Ha ocurrido un error: %{error}","sign_up":"Registrarse","log_in":"Iniciar sesión","age":"Edad","joined":"Registrado","admin_title":"Admin","flags_title":"Reportes","show_more":"ver más","show_help":"opciones","links":"Enlaces","links_lowercase":{"one":"enlace","other":"enlaces"},"faq":"FAQ","guidelines":"Directrices","privacy_policy":"Política de Privacidad","privacy":"Privacidad","terms_of_service":"Condiciones de uso","mobile_view":"Versión móvil","desktop_view":"Versión de escritorio","you":"Tú","or":"o","now":"ahora mismo","read_more":"leer más","more":"Más","less":"Menos","never":"nunca","every_30_minutes":"cada 30 minutos","every_hour":"cada hora","daily":"cada día","weekly":"cada semana","every_two_weeks":"cada dos semanas","every_three_days":"cada tres días","max_of_count":"máximo de {{count}}","alternation":"o","character_count":{"one":"{{count}} carácter","other":"{{count}} caracteres"},"suggested_topics":{"title":"Temas Sugeridos","pm_title":"Mensajes sugeridos"},"about":{"simple_title":"Acerca de","title":"Sobre %{title}","stats":"Estadísticas del sitio","our_admins":"Nuestros Administradores","our_moderators":"Nuestros Moderadores","stat":{"all_time":"Todo el tiempo","last_7_days":"Últimos 7 días","last_30_days":"Últimos 30 días"},"like_count":"Me Gusta","topic_count":"Temas","post_count":"Posts","user_count":"Nuevos usuarios","active_user_count":"Usuarios activos","contact":"Contáctanos","contact_info":"En caso de un error crítico o un asunto urgente referente a este sitio, por favor, contáctanos en %{contact_info}."},"bookmarked":{"title":"Marcador","clear_bookmarks":"Quitar Marcadores","help":{"bookmark":"Clic para guardar en marcadores el primer post de este tema","unbookmark":"Clic para quitar todos los marcadores de este tema"}},"bookmarks":{"not_logged_in":"Lo sentimos, debes iniciar sesión para guardar posts en marcadores.","created":"has guardado este post en marcadores","not_bookmarked":"has leído este post, haz clic para guardarlo en marcadores","last_read":"este es el último post que has leído; haz clic para guardarlo en marcadores","remove":"Eliminar marcador","confirm_clear":"¿Seguro que deseas borrar todos los marcadores de este tema?"},"topic_count_latest":{"one":"Un tema nuevo o actualizado.","other":"{{count}} temas nuevos o actualizados."},"topic_count_unread":{"one":"Un tema sin leer.","other":"{{count}} temas sin leer."},"topic_count_new":{"one":"Un nuevo tema.","other":"{{count}} nuevos temas."},"click_to_show":"Clic para mostrar.","preview":"vista previa","cancel":"cancelar","save":"Guardar cambios","saving":"Guardando...","saved":"¡Guardado!","upload":"Subir","uploading":"Subiendo...","uploading_filename":"Subiendo {{filename}}...","uploaded":"¡Subido!","enable":"Activar","disable":"Desactivar","undo":"Deshacer","revert":"Revertir","failed":"Falló","switch_to_anon":"Entrar al Modo Anónimo","switch_from_anon":"Salir del Modo Anónimo","banner":{"close":"Descartar este banner.","edit":"Editar este banner \u003e\u003e"},"choose_topic":{"none_found":"Ningún tema encontrado.","title":{"search":"Buscar un Tema por nombre, url o id:","placeholder":"escribe el título de tema aquí"}},"queue":{"topic":"Tema:","approve":"Aprobar","reject":"Rechazar","delete_user":"Eliminar usuario","title":"Necesita Aprobación","none":"No hay posts para revisar","edit":"Editar","cancel":"Cancelar","view_pending":"ver posts pendientes","has_pending_posts":{"one":"Este tema tiene \u003cb\u003e1\u003c/b\u003e post esperando aprobación","other":"Este tema tiene \u003cb\u003e{{count}}\u003c/b\u003e posts esperando aprobación"},"confirm":"Guardar Cambios","delete_prompt":"¿Seguro que quieres eliminar a \u003cb\u003e%{username}\u003c/b\u003e? Se eliminarán todos sus posts y se bloqueará su email y dirección IP.","approval":{"title":"El Post Necesita Aprobación","description":"Hemos recibido tu nuevo post pero necesita ser aprobado por un moderador antes de aparecer. Por favor, ten paciencia.","pending_posts":{"one":"Tienes \u003cstrong\u003e1\u003c/strong\u003e post pendiente.","other":"Tienes \u003cstrong\u003e{{count}}\u003c/strong\u003e posts pendientes."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e publicó \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e publicaste \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e contestó a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e contestaste a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e contestó a \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e contestaste a \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionó a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003ete\u003c/a\u003e mencionó","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTú\u003c/a\u003e mencionaste a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Publicado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Publicado por \u003ca href='{{userUrl}}'\u003eti\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003eti\u003c/a\u003e"},"directory":{"filter_name":"filtrar por usuario","title":"Usuarios","likes_given":"Dados","likes_received":"Recibidos","topics_entered":"Vistos","topics_entered_long":"Temas vistos","time_read":"Tiempo de Lectura","topic_count":"Temas","topic_count_long":"Temas creados","post_count":"Respuestas","post_count_long":"Posts escritos","no_results":"No se encontraron resultados.","days_visited":"Visitas","days_visited_long":"Días visitados","posts_read":"Leídos","posts_read_long":"Posts leídos","total_rows":{"one":"1 usuario","other":"%{count} usuarios"}},"groups":{"empty":{"posts":"No hay mensajes publicados por los miembros de este grupo.","members":"Este grupo no tiene miembros.","mentions":"No hay menciones de este grupo.","messages":"No hay mensajes para este grupo.","topics":"No hay temas de miembros de este grupo."},"add":"Añadir","selector_placeholder":"Añadir miembros","owner":"propietario","visible":"El grupo es visible para todos los usuarios","index":"Grupos","title":{"one":"grupo","other":"grupos"},"members":"Miembros","topics":"Temas","posts":"Posts","mentions":"Menciones","messages":"Mensajes","alias_levels":{"title":"¿Quién puede emviar mensajes y @mencionar a este grupo?","nobody":"Nadie","only_admins":"Solo administradores","mods_and_admins":"Solo moderadores y administradores","members_mods_and_admins":"Solo miembros del grupo, moderadores y administradores","everyone":"Todos"},"trust_levels":{"title":"Nivel de confianza entregado automáticamente a miembros cuando son añadidos:","none":"Ninguno"},"notifications":{"watching":{"title":"Vigilando","description":"e te notificará de cada nuevo post en este mensaje y se mostrará un contador de nuevos posts."},"watching_first_post":{"title":"Vigilar Primer Post","description":"Sólo se te notificará del primer post en cada nuevo tema en este grupo."},"tracking":{"title":"Siguiendo","description":"Se te notificará si alguien menciona tu @nombre o te responde, y un contador de nuevos mensajes será mostrado."},"regular":{"title":"Normal","description":"Se te notificará si alguien menciona tu @nombre o te responde."},"muted":{"title":"Silenciado","description":"Nunca se te notificará de nada sobre temas en este grupo."}}},"user_action_groups":{"1":"'Me gusta' Dados","2":"'Me gusta' Recibidos","3":"Marcadores","4":"Temas","5":"Posts","6":"Respuestas","7":"Menciones","9":"Citas","11":"Ediciones","12":"Elementos Enviados","13":"Bandeja de entrada","14":"Pendiente"},"categories":{"all":"Categorías","all_subcategories":"todas","no_subcategory":"ninguna","category":"Categoría","category_list":"Mostrar lista de categorías","reorder":{"title":"Reorganizar Categorías","title_long":"Reorganizar la lista de categorías","fix_order":"Ordenar posiciones","fix_order_tooltip":"No todas las categorías tienen un número de posición único, lo que puede causar resultados inesperados.","save":"Guardar orden","apply_all":"Aplicar","position":"Posición"},"posts":"Posts","topics":"Temas","latest":"Recientes","latest_by":"recientes por","toggle_ordering":"activar orden","subcategories":"Subcategorías","topic_sentence":{"one":"1 tema","other":"%{count} temas"},"topic_stat_sentence":{"one":"%{count} tema nuevo en los últimos %{unit}.","other":"%{count} temas nuevos en los últimos %{unit}."}},"ip_lookup":{"title":"Búsqueda de Direcciones IP","hostname":"Nombre del host","location":"Ubicación","location_not_found":"(desconocido)","organisation":"Organización","phone":"Teléfono","other_accounts":"Otras cuentas con esta dirección IP:","delete_other_accounts":"Eliminar %{count}","username":"usuario","trust_level":"NC","read_time":"tiempo de lectura","topics_entered":"temas vistos","post_count":"# posts","confirm_delete_other_accounts":"¿Seguro que quieres eliminar estas cuentas?"},"user_fields":{"none":"(selecciona una opción)"},"user":{"said":"{{username}}:","profile":"Perfil","mute":"Silenciar","edit":"Editar Preferencias","download_archive":"Descargar mis posts","new_private_message":"Nuevo mensaje","private_message":"Mensaje","private_messages":"Mensajes","activity_stream":"Actividad","preferences":"Preferencias","expand_profile":"Expandir","bookmarks":"Marcadores","bio":"Acerca de mí","invited_by":"Invitado Por","trust_level":"Nivel de Confianza","notifications":"Notificaciones","statistics":"Estadísticas","desktop_notifications":{"label":"Notificaciones de escritorio","not_supported":"Las notificaciones no están disponibles en este navegador. Lo sentimos.","perm_default":"Activar notificaciones","perm_denied_btn":"Permiso denegado","perm_denied_expl":"Has denegado los permisos para las notificaciones en tu navegador web. Configura tu navegador para permitir notificaciones. ","disable":"Desactivar notificaciones","enable":"Activar notificaciones","each_browser_note":"Nota: Tendrás que cambiar esta opción para cada navegador que uses."},"dismiss_notifications":"Descartar todos","dismiss_notifications_tooltip":"Marcar todas las notificaciones no leídas como leídas","disable_jump_reply":"No dirigirme a mi post cuando responda","dynamic_favicon":"Mostrar contador de temas nuevos/actualizados en el favicon","external_links_in_new_tab":"Abrir todos los enlaces externos en una nueva pestaña","enable_quoting":"Activar respuesta citando el texto resaltado","change":"cambio","moderator":"{{user}} es un moderador","admin":"{{user}} es un administrador","moderator_tooltip":"Este usuario es un moderador","admin_tooltip":"Este usuario es un administrador","blocked_tooltip":"El usuario está bloqueado","suspended_notice":"Este usuario ha sido suspendido hasta {{date}}.","suspended_reason":"Causa: ","github_profile":"Github","email_activity_summary":"Resumen de actividad","mailing_list_mode":{"label":"Modo lista de correo","enabled":"Activar modo lista de correo","instructions":"Esta opción sobreescribe el resumen de actividad.\u003cbr /\u003e\nLos temas y categorías silenciadas no se incluyen en estos emails.\n","daily":"Enviar actualizaciones diariamente","individual":"Enviar un email por cada nuevo post","many_per_day":"Enviarme un email por cada nuevo post (unos {{dailyEmailEstimate}} por día)","few_per_day":"Enviarme un email por cada nuevo post (unos 2 por día)"},"tag_settings":"Etiquetas","watched_tags":"Vigiladas","watched_tags_instructions":"Vigilarás automáticamente todos los temas con estas etiquetas. Se te notificará de todos los nuevos posts y temas y aparecerá un contador de nuevos posts al lado del tema.","tracked_tags":"Siguiendo","tracked_tags_instructions":"Seguirás automáticamente todos los temas con estas etiquetas. Aparecerá un contador de nuevos posts al lado del tema.","muted_tags":"Silenciadas","muted_tags_instructions":"No serás notificado de ningún tema con estas etiquetas y no aparecerán en la pestaña Recientes.","watched_categories":"Vigiladas","watched_categories_instructions":"Vigilarás automáticamente todos los temas en estas categorías. Se te notificará de todos los nuevos posts y temas, y aparecerá un contador de nuevos posts al lado del tema.","tracked_categories":"Siguiendo","tracked_categories_instructions":"Seguirás automáticamente todos los temas en estas categorías. Aparecerá un contador de nuevos posts al lado del tema.","watched_first_post_categories":"Vigilar Primer Post","watched_first_post_categories_instructions":"Se te notificará del primer post de cada nuevo tema en estas categorías.","watched_first_post_tags":"Vigilando Primer Post","watched_first_post_tags_instructions":"Se te notificará del primer post en cada nuevo tema con estas etiquetas.","muted_categories":"Silenciado","muted_categories_instructions":"No serás notificado de ningún tema en estas categorías, y no aparecerán en la página de mensajes recientes.","delete_account":"Borrar Mi Cuenta","delete_account_confirm":"¿Estás seguro que quieres borrar permanentemente tu cuenta? ¡Esta acción no puede ser revertida!","deleted_yourself":"Tu cuenta ha sido borrada exitosamente.","delete_yourself_not_allowed":"No puedes borrar tu cuenta en este momento. Contacta a un administrador para borrar tu cuenta en tu nombre.","unread_message_count":"Mensajes","admin_delete":"Eliminar","users":"Usuarios","muted_users":"Silenciados","muted_users_instructions":"Omite todas las notificaciones de estos usuarios.","muted_topics_link":"Mostrar temas silenciados","watched_topics_link":"Mostrar temas vigilados","automatically_unpin_topics":"Dejar de destacar temas automáticamente cuando los leo por completo.","apps":"Apps","revoke_access":"Revocar acceso","undo_revoke_access":"Deshacer revocación de acceso","api_permissions":"Permisos:","api_approved":"Aprobado:","api_read":"leer","api_read_write":"leer y escribir","staff_counters":{"flags_given":"reportes útiles","flagged_posts":"posts reportados","deleted_posts":"posts eliminados","suspensions":"suspensiones","warnings_received":"avisos"},"messages":{"all":"Todos","inbox":"Bandeja de entrada","sent":"Enviados","archive":"Archivo","groups":"Mis grupos","bulk_select":"Mensajes seleccionados","move_to_inbox":"Mover a la bandeja de entrada","move_to_archive":"Archivar","failed_to_move":"No se han podido mover los mensajes seleccionados (puede haber problemas de conexión)","select_all":"Seleccionar todo"},"change_password":{"success":"(e-mail enviado)","in_progress":"(enviando e-mail)","error":"(error)","action":"Enviar email para restablecer la contraseña","set_password":"Establecer contraseña"},"change_about":{"title":"Cambiar 'Acerca de mí'","error":"Hubo un error al cambiar este valor."},"change_username":{"title":"Cambiar Nombre de Usuario","confirm":"Si cambias tu nombre de usuario, todas las citas anteriores a tus posts y menciones a tu @nombre se romperán. ¿Seguro que quieres hacerlo?","taken":"Lo sentimos, ese nombre de usuario ya está siendo usado.","error":"Ha ocurrido un error al cambiar tu nombre de usuario.","invalid":"Este nombre de usuario no es válido. Debe incluir sólo números y letras"},"change_email":{"title":"Cambiar E-mail","taken":"Lo sentimos, pero ese e-mail no está disponible.","error":"Ha ocurrido un error al cambiar tu email. ¿Tal vez esa dirección ya está en uso?","success":"Te hemos enviado un e-mail a esa dirección. Por favor sigue las instrucciones de confirmación."},"change_avatar":{"title":"Cambiar tu imagen de perfil","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basado en","gravatar_title":"Cambia tu avatar en la web de Gravatar","refresh_gravatar_title":"Actualizar tu Gravatar","letter_based":"Imagen de perfil asignada por el sistema","uploaded_avatar":"Foto personalizada","uploaded_avatar_empty":"Añade una foto personalizada","upload_title":"Sube tu foto","upload_picture":"Subir Imagen","image_is_not_a_square":"Advertencia: hemos recortado su imagen; la anchura y la altura no eran iguales.","cache_notice":"Has cambiado correctamente tu imagen de perfil pero podría tardar un poco en aparecer debido al caching del navegador."},"change_profile_background":{"title":"Fondo de perfil","instructions":"Fondos de perfil serán centrados y tendrán un ancho por default de 850px."},"change_card_background":{"title":"Fondo de Tarjeta de Usuario","instructions":"Imágenes de fondo serán centrados y tendrán un ancho por default de 590px."},"email":{"title":"E-mail","instructions":"Nunca se mostrará públicamente","ok":"Te enviaremos un email para confirmar","invalid":"Por favor, introduce una dirección de correo válida","authenticated":"Tu dirección de correo ha sido autenticada por {{provider}}","frequency_immediately":"Te enviaremos un email inmediatamente si no has leído aquello que vamos a enviarte.","frequency":{"one":"Sólo te enviaremos emails si no te hemos visto en el último minuto.","other":"Sólo te enviaremos si no te hemos visto en los últimos {{count}} minutos."}},"name":{"title":"Nombre","instructions":"Tu nombre completo (opcional)","instructions_required":"Tu nombre completo","too_short":"Tu nombre es demasiado corto","ok":"Tu nombre es válido"},"username":{"title":"Nombre de usuario","instructions":"Debe ser único, sin espacios y conciso","short_instructions":"Los demás usuarios pueden mencionarte como @{{username}}","available":"Tu nombre de usuario está disponible","global_match":"La dirección coincide con la del nombre de usuario registrado","global_mismatch":"Ya está registrado. ¿Prueba {{suggestion}}?","not_available":"No disponible. ¿Prueba {{suggestion}}?","too_short":"Tu nombre de usuario es demasiado corto","too_long":"Tu nombre de usuario es demasiado largo","checking":"Comprobando la disponibilidad del nombre de usuario...","enter_email":"Nombre de usuario encontrado; introduce la dirección de correo correspondiente","prefilled":"El email coincide con el nombre de usuario registrado"},"locale":{"title":"Idioma de la interfaz","instructions":"El idioma de la interfaz. Cambiará cuando recargues la página.","default":"(por defecto)"},"password_confirmation":{"title":"Introduce de nuevo la contraseña"},"last_posted":"Último post","last_emailed":"Último Enviado por email","last_seen":"Visto por última vez","created":"Creado el","log_out":"Cerrar sesión","location":"Ubicación","card_badge":{"title":"Distintivo de Tarjeta de Usuario"},"website":"Sitio Web","email_settings":"E-mail","like_notification_frequency":{"title":"Notificar cuando me dan Me gusta","always":"Con cada Me gusta que reciban mis posts","first_time_and_daily":"Al primer Me gusta que reciben mis posts y luego diariamente si reciben más","first_time":"Al primer Me gusta que reciben mi posts","never":"Nunca"},"email_previous_replies":{"title":"Incluir respuestas previas al pie de los emails","unless_emailed":"a menos que se hayan enviado previamente","always":"siempre","never":"nunca"},"email_digests":{"title":"Cuando no visite el sitio, envíame un email con un resumen de los temas y respuestas populares","every_30_minutes":"cada 30 minutos","every_hour":"cada hora","daily":"diariamente","every_three_days":"cada tres días","weekly":"semanalmente","every_two_weeks":"cada dos semanas"},"include_tl0_in_digests":"Incluir contenido de nuevos usuarios en los emails de resumen","email_in_reply_to":"Incluir un extracto del post al que se responde en los emails","email_direct":"Envíame un email cuando alguien me cite, responda a mis posts, mencione mi @usuario o me invite a un tema","email_private_messages":"Notifícame por email cuando alguien me envíe un mensaje","email_always":"Quiero recibir notificaciones por email incluso cuando esté de forma activa por el sitio","other_settings":"Otros","categories_settings":"Categorías","new_topic_duration":{"label":"Considerar que los temas son nuevos cuando","not_viewed":"No los he visto todavía","last_here":"creados desde mi última visita","after_1_day":"creados durante el último día ","after_2_days":"creados durante los últimos 2 días","after_1_week":"creados durante la última semana","after_2_weeks":"creados durante las últimas 2 semanas"},"auto_track_topics":"Seguir automáticamente temas en los que entre","auto_track_options":{"never":"nunca","immediately":"inmediatamente","after_30_seconds":"después de 30 segundos","after_1_minute":"después de 1 minuto","after_2_minutes":"después de 2 minutos","after_3_minutes":"después de 3 minutos","after_4_minutes":"después de 4 minutos","after_5_minutes":"después de 5 minutos","after_10_minutes":"después de 10 minutos"},"invited":{"search":"escribe para buscar invitaciones...","title":"Invitaciones","user":"Invitar Usuario","sent":"Enviadas","none":"No hay ninguna invitación pendiente que mostrar.","truncated":{"one":"Mostrando la primera invitación.","other":"Mostrando las primeras {{count}} invitaciones."},"redeemed":"Invitaciones aceptadas","redeemed_tab":"Usado","redeemed_tab_with_count":"Aceptadas ({{count}})","redeemed_at":"Aceptada","pending":"Invitaciones Pendientes","pending_tab":"Pendiente","pending_tab_with_count":"Pendientes ({{count}})","topics_entered":"Temas Vistos","posts_read_count":"Posts leídos","expired":"Esta invitación ha caducado.","rescind":"Remover","rescinded":"Invitación eliminada","reinvite":"Reenviar Invitación","reinvite_all":"Reenviar todas las invitaciones","reinvited":"Invitación reenviada","reinvited_all":"¡Todas las invitaciones han sido reenviadas!","time_read":"Tiempo de Lectura","days_visited":"Días Visitados","account_age_days":"Antigüedad de la cuenta en días","create":"Enviar una Invitación","generate_link":"Copiar Enlace de Invitación","generated_link_message":"\u003cp\u003e¡Enlace de Invitación generado con éxito!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eEste enlace de Invitación es sólo válido para la siguiente dirección de email: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"No has invitado a nadie todavía. Puedes enviar invitaciones individuales o invitar a un grupo de personas a la vez \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003esubiendo un archivo para invitaciones en masa\u003c/a\u003e.","text":"Archivo de Invitación en Masa","uploading":"Subiendo...","success":"Archivo subido correctamente, se te notificará con un mensaje cuando se complete el proceso.","error":"Hubo un error al subir '{{filename}}': {{message}}"}},"password":{"title":"Contraseña","too_short":"Tu contraseña es demasiada corta.","common":"Esa contraseña es demasiado común.","same_as_username":"Tu contraseña es la misma que tu nombre de usuario.","same_as_email":"Tu contraseña es la misma que tu dirección de correo electrónico.","ok":"Tu contraseña es válida.","instructions":"Debe contener al menos %{count} caracteres."},"summary":{"title":"Resumen","stats":"Estadísticas","time_read":"tiempo de lectura","topic_count":{"one":"tema creado","other":"temas creados"},"post_count":{"one":"post publicado","other":"posts publicados"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dado","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dados"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e recibido","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e recibidos"},"days_visited":{"one":"día visitado","other":"días visitados"},"posts_read":{"one":"post leído","other":"posts leídos"},"bookmark_count":{"one":"marcador","other":"marcadores"},"top_replies":"Respuestas top","no_replies":"No hay respuestas aún.","more_replies":"Más respuestas","top_topics":"Temas top","no_topics":"No hay temas aún.","more_topics":"Más temas","top_badges":"Distintivos top","no_badges":"No hay distintivos aún.","more_badges":"Más distintivos","top_links":"Top enlaces","no_links":"No hay enlaces aún.","most_liked_by":"Los que dieron más me gusta","most_liked_users":"De quien recibió más Me gusta","most_replied_to_users":"A quienes más respondió","no_likes":"No hay me gusta aún."},"associated_accounts":"Inicios de sesión","ip_address":{"title":"Última dirección IP"},"registration_ip_address":{"title":"Dirección IP de Registro"},"avatar":{"title":"Imagen de perfil","header_title":"perfil, mensajes, marcadores y preferencias"},"title":{"title":"Título"},"filters":{"all":"Todos"},"stream":{"posted_by":"Publicado por","sent_by":"Enviado por","private_message":"mensaje","the_topic":"el tema"}},"loading":"Cargando...","errors":{"prev_page":"mientras se intentaba cargar","reasons":{"network":"Error de Red","server":"Error del Servidor","forbidden":"Acceso Denegado","unknown":"Error","not_found":"Página no encontrada"},"desc":{"network":"Por favor revisa tu conexión.","network_fixed":"Parece que ha vuelto.","server":"Código de error: {{status}}","forbidden":"No estás permitido para ver eso.","not_found":"¡Ups! la aplicación intentó cargar una URL inexistente.","unknown":"Algo salió mal."},"buttons":{"back":"Volver Atrás","again":"Intentar de Nuevo","fixed":"Cargar Página"}},"close":"Cerrar","assets_changed_confirm":"Este sitio acaba de ser actualizado justo ahora. ¿Quieres recargar la página para ver la última versión?","logout":"Has cerrado sesión.","refresh":"Actualizar","read_only_mode":{"enabled":"Este sitio está en modo solo-lectura. Puedes continuar navegando pero algunas acciones como responder o dar \"me gusta\" no están disponibles por ahora.","login_disabled":"Iniciar sesión está desactivado mientras el foro esté en modo solo lectura.","logout_disabled":"Cerrar sesión está desactivado mientras el sitio se encuentre en modo de sólo lectura."},"too_few_topics_and_posts_notice":"¡Vamos a \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003edar por comenzada la comunidad!\u003c/a\u003e Hay \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e temas y \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e mensajes. Los nuevos visitantes necesitan algo que leer y a lo que responder.","too_few_topics_notice":"¡Vamos a \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003edar por comenzada la comunidad!\u003c/a\u003e Hay \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e temas. Los nuevos visitantes necesitan algo que leer y a lo que responder.","too_few_posts_notice":"¡Vamos a \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003edar por empezada la comunidad!\u003c/a\u003e Hay \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e mensajes. Los nuevos visitantes necesitan algo que leer y a lo que responder.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e alcanzó el límite establecido en las opciones del sitio del %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e excedió el límite establecido en las opciones del sitio del %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errores/%{duration}"}},"learn_more":"saber más...","year":"año","year_desc":"temas creados en los últimos 365 días","month":"mes","month_desc":"temas creados en los últimos 30 días","week":"semana","week_desc":"temas creados en los últimos 7 días","day":"día","first_post":"Primer post","mute":"Silenciar","unmute":"No silenciar","last_post":"Último post","last_reply_lowercase":"última respuesta","replies_lowercase":{"one":"respuesta","other":"respuestas"},"signup_cta":{"sign_up":"Registrarse","hide_session":"Recordar mañana","hide_forever":"no, gracias","hidden_for_session":"Vale, te preguntaremos mañana. Recuerda que también puedes usar el botón 'Iniciar sesión' para crear una cuenta en cualquier momento.","intro":"¡Hola! :heart_eyes: Parece que estás interesado en las cosas que nuestros usuarios publican, pero no tienes una cuenta registrada.","value_prop":"Cuando te registras, recordamos lo que has leído, para que puedas volver justo donde estabas leyendo. También recibes notificaciones, por aquí y por email, cuando se publican nuevos mensajes. ¡También puedes darle a Me gusta a los mensajes! :heartbeat:"},"summary":{"enabled_description":"Estás viendo un resumen de este tema: los posts más interesantes determinados por la comunidad.","description":"Hay \u003cb\u003e{{replyCount}}\u003c/b\u003e respuestas.","description_time":"Hay \u003cb\u003e{{replyCount}}\u003c/b\u003e respuestas con un tiempo de lectura estimado de \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Resumir este Tema","disable":"Ver Todos los Posts"},"deleted_filter":{"enabled_description":"Este tema contiene posts eliminados, los cuales han sido ocultados.","disabled_description":"Se están mostrando los posts eliminados de este tema. ","enable":"Ocultar Posts Eliminados","disable":"Mostrar Posts Eliminados"},"private_message_info":{"title":"Mensaje","invite":"Invitar a Otros...","remove_allowed_user":"¿Seguro que quieres eliminar a {{name}} de este mensaje?","remove_allowed_group":"¿Seguro que quieres eliminar a {{name}} de este mensaje?"},"email":"E-mail","username":"Nombre de usuario","last_seen":"Visto por última vez","created":"Creado","created_lowercase":"creado","trust_level":"Nivel de Confianza","search_hint":"usuario, email o dirección IP","create_account":{"title":"Crear nueva cuenta","failed":"Algo ha salido mal, tal vez este e-mail ya fue registrado, intenta con el enlace 'olvidé la contraseña'"},"forgot_password":{"title":"Restablecer contraseña","action":"Olvidé mi contraseña","invite":"Introduce tu nombre de usuario o tu dirección de e-mail, y te enviaremos un correo electrónico para cambiar tu contraseña.","reset":"Restablecer Contraseña","complete_username":"Si una cuenta coincide con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e, dentro de poco deberías recibir un e-mail con las instrucciones para cambiar tu contraseña.","complete_email":"Si una cuenta coincide con \u003cb\u003e%{email}\u003c/b\u003e, dentro de poco deberías recibir un e-mail con las instrucciones para cambiar tu contraseña.","complete_username_found":"Encontramos una cuenta que coincide con el usuario \u003cb\u003e%{username}\u003c/b\u003e, deberías recibir en breve un e-mail con instrucciones para restablecer tu contraseña.","complete_email_found":"Encontramos una cuenta que coincide con el e-mail \u003cb\u003e%{email}\u003c/b\u003e, deberías recibir en breve un e-mail con instrucciones para restablecer tu contraseña.","complete_username_not_found":"Ninguna cuenta concuerda con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Ninguna cuenta concuerda con \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Iniciar Sesión","username":"Usuario","password":"Contraseña","email_placeholder":"dirección de e-mail o nombre de usuario","caps_lock_warning":"Está activado Bloqueo de Mayúsculas","error":"Error desconocido","rate_limit":"Por favor, espera un poco antes de volver a intentar iniciar sesión.","blank_username_or_password":"Por favor, introducir tu e-mail o usuario, y tu contraseña.","reset_password":"Restablecer Contraseña","logging_in":"Iniciando Sesión","or":"O","authenticating":"Autenticando...","awaiting_confirmation":"Tu cuenta está pendiente de activación, usa el enlace de 'olvidé contraseña' para recibir otro e-mail de activación.","awaiting_approval":"Tu cuenta todavía no ha sido aprobada por un moderador. Recibirás un e-mail cuando sea aprobada.","requires_invite":"Lo sentimos pero solo se puede acceder a este foro mediante invitación.","not_activated":"No puedes iniciar sesión todavía. Anteriormente te hemos enviado un email de activación a \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor sigue las instrucciones en ese email para activar tu cuenta.","not_allowed_from_ip_address":"No puedes iniciar sesión desde esa dirección IP.","admin_not_allowed_from_ip_address":"No puedes iniciar sesión como admin desde esta dirección IP.","resend_activation_email":"Has clic aquí para enviar el email de activación nuevamente.","sent_activation_email_again":"Te hemos enviado otro e-mail de activación a \u003cb\u003e{{currentemail}}\u003c/b\u003e. Podría tardar algunos minutos en llegar; asegúrate de revisar tu carpeta de spam.","to_continue":"Por favor, inicia sesión","preferences":"Debes tener una sesión iniciada para cambiar tus preferencias de usuario.","forgot":"No me acuerdo de los detalles de mi cuenta.","google":{"title":"con Google","message":"Autenticando con Google (asegúrate de desactivar cualquier bloqueador de pop ups)"},"google_oauth2":{"title":"con Google","message":"Autenticando con Google (asegúrate de no tener habilitados bloqueadores de pop-up)"},"twitter":{"title":"con Twitter","message":"Autenticando con Twitter (asegúrate de desactivar cualquier bloqueador de pop ups)"},"instagram":{"title":"con Instagram","message":"Autenticando con Instagram (asegúrate que los bloqueadores de pop up no están activados)"},"facebook":{"title":"con Facebook","message":"Autenticando con Facebook (asegúrate de desactivar cualquier bloqueador de pop ups)"},"yahoo":{"title":"con Yahoo","message":"Autenticando con Yahoo (asegúrate de desactivar cualquier bloqueador de pop ups)"},"github":{"title":"con GitHub","message":"Autenticando con GitHub (asegúrate de desactivar cualquier bloqueador de pop ups)"}},"emoji_set":{"apple_international":"Apple/Internacional","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Sólo categorías","categories_with_featured_topics":"Categorías y temas destacados","categories_and_latest_topics":"Categorías y temas recientes"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"más...","options":"Opciones","whisper":"susurrar","unlist":"invisible","add_warning":"Ésta es una advertencia oficial.","toggle_whisper":"Activar/desactivar Susurro","toggle_unlisted":"Visible / Invisible","posting_not_on_topic":"¿A qué tema quieres responder?","saving_draft_tip":"guardando...","saved_draft_tip":"guardado","saved_local_draft_tip":"guardado localmente","similar_topics":"Tu tema es similar a...","drafts_offline":"borradores offline","group_mentioned":{"one":"Al mencionar a {{group}}, estás a punto de notificar a \u003ca href='{{group_link}}'\u003e1 persona\u003c/a\u003e – ¿seguro que quieres hacerlo?","other":"Al mencionar a {{group}}, estás a punto de notificar a \u003ca href='{{group_link}}'\u003e{{count}} personas\u003c/a\u003e – ¿seguro que quieres hacerlo?"},"duplicate_link":"Parece que tu enlace a \u003cb\u003e{{domain}}\u003c/b\u003e ha sido ya publicado en el tema por \u003cb\u003e@{{username}}\u003c/b\u003e en \u003ca href='{{post_url}}'\u003eun post {{ago}}\u003c/a\u003e – ¿seguro que quieres publicarlo de nuevo?","error":{"title_missing":"Es necesario un título","title_too_short":"El título debe ser por lo menos de {{min}} caracteres.","title_too_long":"El título no puede tener más de {{max}} caracteres.","post_missing":"El post no puede estar vacío.","post_length":"El post debe tener por lo menos {{min}} caracteres.","try_like":"¿Has probado el botón de \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Debes escoger una categoría."},"save_edit":"Guardar edición","reply_original":"Responder en el Tema Original","reply_here":"Responder Aquí","reply":"Responder","cancel":"Cancelar","create_topic":"Crear tema","create_pm":"Mensaje","title":"O pulsa Ctrl+Intro","users_placeholder":"Añadir usuario","title_placeholder":"En una frase breve, ¿de qué trata este tema?","edit_reason_placeholder":"¿Por qué lo estás editando?","show_edit_reason":"(añadir motivo de edición)","reply_placeholder":"Escribe aquí. Usa Markdown, BBCode o HTML para darle formato. Arrastra o pega imágenes.","view_new_post":"Ver tu nuevo post.","saving":"Guardando","saved":"¡Guardado!","saved_draft":"Borrador en progreso. Selecciona para continuar.","uploading":"Subiendo...","show_preview":"mostrar vista previa \u0026raquo;","hide_preview":"\u0026laquo; ocultar vista previa","quote_post_title":"Citar todo el post","bold_label":"B","bold_title":"Negrita","bold_text":"Texto en negrita","italic_label":"I","italic_title":"Cursiva","italic_text":"Texto en cursiva","link_title":"Hipervínculo","link_description":"introduzca descripción del enlace aquí","link_dialog_title":"Insertar Enlace","link_optional_text":"título opcional","link_url_placeholder":"http://ejemplo.com","quote_title":"Cita","quote_text":"Cita","code_title":"Texto preformateado","code_text":"texto preformateado precedido por 4 espacios","paste_code_text":"escribe o pega el código aquí","upload_title":"Subir","upload_description":"introduce una descripción de la imagen aquí","olist_title":"Lista numerada","ulist_title":"Lista con viñetas","list_item":"Lista de ítems","heading_label":"H","heading_title":"Encabezado","heading_text":"Encabezado","hr_title":"Linea Horizontal","help":"Ayuda de Edición con Markdown","toggler":"ocultar o mostrar el panel de edición","modal_ok":"OK","modal_cancel":"Cancelar","cant_send_pm":"Lo sentimos, no puedes enviar un mensaje a %{username}.","yourself_confirm":{"title":"¿Olvidaste añadir destinatarios?","body":"¡Vas a enviarte este mensaje a ti mismo!"},"admin_options_title":"Opciones de moderación para este tema","auto_close":{"label":"Tiempo para cierre automático del tema","error":"Por favor introduzca un valor válido.","based_on_last_post":"No cerrar hasta que el último post en el tema es al menos así de antiguo.","all":{"examples":"Introduzca el número de horas (24), tiempo absoluto (17:30) o timestamp (2013-11-22 14:00)."},"limited":{"units":"(# de horas)","examples":"Introduzca el número de horas (24)."}}},"notifications":{"title":"notificaciones por menciones a tu @nombre, respuestas a tus posts y temas, mensajes, etc","none":"No se han podido cargar las notificaciones.","empty":"No se han encontrado notificaciones.","more":"ver notificaciones antiguas","total_flagged":"total de posts reportados","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} y otro\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} y {{count}} otros\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e ha aceptado tu invitación\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e movió {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eSe te ha concedido '{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNuevo Tema\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='mensaje en tu bandeja de grupo' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensaje en la bandeja del grupo {{group_name}}\u003c/p\u003e","other":"\u003ci title='mensajes en tu bandeja de grupo' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensajes en la bandeja del grupo {{group_name}}\u003c/p\u003e"},"alt":{"mentioned":"Mencionado por","quoted":"Citado por","replied":"Respondido","posted":"Publicado por","edited":"Editado tu post por","liked":"Gustado tu post","private_message":"Mensaje privado de","invited_to_private_message":"Invitado a un mensaje privado de","invited_to_topic":"Invitado a un tema de","invitee_accepted":"Invitación aceptada por","moved_post":"Tu post fue eliminado por","linked":"Enlace a tu post","granted_badge":"Distintivo concedido","group_message_summary":"Mensajes en la bandeja del grupo"},"popup":{"mentioned":"{{username}} te mencionó en \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} te ha mencionado en \"{{topic}}\" - {{site_title}}","quoted":"{{username}} te citó en \"{{topic}}\" - {{site_title}}","replied":"{{username}} te respondió en \"{{topic}}\" - {{site_title}}","posted":"{{username}} publicó en \"{{topic}}\" - {{site_title}}","private_message":"{{username}} te envió un mensaje privado en \"{{topic}}\" - {{site_title}}","linked":"{{username}} enlazó tu publicación desde \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Añadir imagen","title_with_attachments":"Añadir una imagen o archivo","from_my_computer":"Desde mi dispositivo","from_the_web":"Desde la web","remote_tip":"enlace a la imagen","remote_tip_with_attachments":"enlace a imagen o archivo {{authorized_extensions}}","local_tip":"selecciona las imágenes desde tu dispositivo","local_tip_with_attachments":"selecciona imágenes o archivos desde tu dispositivo {{authorized_extensions}}","hint":"(también puedes arrastrarlos al editor para subirlos)","hint_for_supported_browsers":"puedes también arrastrar o pegar imágenes en el editor","uploading":"Subiendo","select_file":"Selecciona Archivo","image_link":"el link de tu imagen apuntará a"},"search":{"sort_by":"Ordenar por","relevance":"Relevancia","latest_post":"Post más reciente","most_viewed":"Más visto","most_liked":"Más \"Me gusta\" recibidos","select_all":"Seleccionar todo","clear_all":"Limpiar todo","too_short":"El término de búsqueda es demasiado corto.","result_count":{"one":"1 resultado para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} resultados para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"buscar temas, posts, usuarios o categorías","no_results":"No se ha encontrado ningún resultado.","no_more_results":"No se encontraron más resultados.","search_help":"Ayuda para buscar","searching":"Buscando ...","post_format":"#{{post_number}} por {{username}}","context":{"user":"Buscar posts por @{{username}}","category":"Buscar la categoría #{{category}}","topic":"Buscar en este tema","private_messages":"Buscar en mensajes"}},"hamburger_menu":"ir a otra lista de temas o categoría","new_item":"nuevo","go_back":"volver","not_logged_in_user":"página con el resumen de actividad y preferencias","current_user":"ir a tu página de usuario","topics":{"bulk":{"unlist_topics":"Hacer invisibles","reset_read":"Restablecer leídos","delete":"Eliminar temas","dismiss":"Descartar","dismiss_read":"Descartar todos los temas sin leer","dismiss_button":"Descartar...","dismiss_tooltip":"Descartar solo los nuevos posts o dejar de seguir los temas","also_dismiss_topics":"Parar de seguir estos temas para que no aparezcan más en mis mensajes no leídos","dismiss_new":"Ignorar nuevos","toggle":"activar selección de temas en bloque","actions":"Acciones en bloque","change_category":"Cambiar categoría","close_topics":"Cerrar temas","archive_topics":"Archivar temas","notification_level":"Cambiar el Nivel de Notificación","choose_new_category":"Elige una nueva categoría para los temas:","selected":{"one":"Has seleccionado \u003cb\u003e1\u003c/b\u003e tema.","other":"Has seleccionado \u003cb\u003e{{count}}\u003c/b\u003e temas."},"change_tags":"Cambiar etiquetas","choose_new_tags":"Elige nuevas etiquetas para estos temas:","changed_tags":"Las etiquetas de esos temas fueron cambiadas."},"none":{"unread":"No hay temas que sigas y que no hayas leído ya.","new":"No tienes temas nuevos por leer.","read":"Todavía no has leído ningún tema.","posted":"Todavía no has publicado en ningún tema.","latest":"No hay temas recientes. Qué pena...","hot":"No hay temas candentes nuevos.","bookmarks":"No tienes temas guardados en marcadores todavía.","category":"No hay temas en la categoría {{category}}.","top":"No hay temas en el top más vistos.","search":"No hay resultados de búsqueda.","educate":{"new":"\u003cp\u003eTus temas nuevos aparecen aquí.\u003c/p\u003e\u003cp\u003ePor defecto, los temas se consideran nuevos y mostrarán un indicador \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enuevo\u003c/span\u003e si fueron creados en los últimos 2 días.\u003c/p\u003e\u003cp\u003eDirígite a \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e para cambiar esto.\u003c/p\u003e","unread":"\u003cp\u003eTus temas sin leer aparecen aquí.\u003c/p\u003e\u003cp\u003ePor defecto, los temas son considerados sin leer y mostrarán contadores de posts sin leer \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e si:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreaste el tema\u003c/li\u003e\u003cli\u003eRespondiste al tema\u003c/li\u003e\u003cli\u003eLeíste el tema por más de 4 minutos\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eO si has establecido específicamente el tema como Siguiendo o Vigilando a través del control de notificaciones al pie de cada tema.\u003c/p\u003e\u003cp\u003eVisita tus \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e para cambiar esto.\u003c/p\u003e"}},"bottom":{"latest":"No hay más temas recientes para leer.","hot":"No hay más temas candentes.","posted":"No hay más temas publicados.","read":"No hay más temas leídos.","new":"No hay más nuevos temas.","unread":"No hay más temas que no hayas leído.","category":"No hay más temas en la categoría {{category}}.","top":"No hay más temas en el top más vistos.","bookmarks":"No hay más temas guardados en marcadores.","search":"No hay más resultados de búsqueda."}},"topic":{"unsubscribe":{"stop_notifications":"Ahora recibirás menos notificaciones desde \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"El estado actual de notificación para ti es"},"filter_to":{"one":"1 post en el tema","other":"{{count}} posts en el tema"},"create":"Crear tema","create_long":"Crear un nuevo tema","private_message":"Empezar un mensaje","archive_message":{"help":"Archivar mensaje","title":"Archivar"},"move_to_inbox":{"title":"Mover a la bandeja de entrada","help":"Restaurar mensaje a la bandeja de entrada"},"list":"Temas","new":"nuevo tema","unread":"sin leer","new_topics":{"one":"1 tema nuevo","other":"{{count}} temas nuevos"},"unread_topics":{"one":"1 tema sin leer","other":"{{count}} temas sin leer"},"title":"Tema","invalid_access":{"title":"Este tema es privado","description":"Lo sentimos, ¡no tienes acceso a este tema!","login_required":"Tienes que iniciar sesión para poder ver este tema."},"server_error":{"title":"El tema falló al intentar ser cargado","description":"Lo sentimos, no pudimos cargar el tema, posiblemente debido a problemas de conexión. Por favor, inténtalo nuevamente. Si el problema persiste, por favor contacta con soporte."},"not_found":{"title":"Tema no encontrado","description":"Lo sentimos, no pudimos encontrar ese tema. ¿Tal vez fue eliminado por un moderador?"},"total_unread_posts":{"one":"tienes 1 publicación sin leer en este tema","other":"tienes {{count}} publicaciones sin leer en este tema"},"unread_posts":{"one":"tienes 1 post antiguo sin leer en este tema","other":"tienes {{count}} posts antiguos sin leer en este tema"},"new_posts":{"one":"hay 1 nuevo post en este tema desde la última vez que lo leíste","other":"hay {{count}} posts nuevos en este tema desde la última vez que lo leíste"},"likes":{"one":"este tema le gusta a 1 persona","other":"este tema les gusta a {{count}} personas"},"back_to_list":"Volver a la Lista de Temas","options":"Opciones del Tema","show_links":"mostrar enlaces dentro de este tema","toggle_information":"detalles del tema","read_more_in_category":"¿Quieres leer más? Consulta otros temas en {{catLink}} o {{latestLink}}.","read_more":"¿Quieres leer más? {{catLink}} o {{latestLink}}.","browse_all_categories":"Ver todas las categorías","view_latest_topics":"ver los temas recientes","suggest_create_topic":"¿Por qué no creas un tema?","jump_reply_up":"saltar a la primera respuesta","jump_reply_down":"saltar a la última respuesta","deleted":"El tema ha sido borrado","auto_close_notice":"Este tema se cerrará automáticamente en %{timeLeft}.","auto_close_notice_based_on_last_post":"Este tema cerrara %{duration} después de la última respuesta.","auto_close_title":"Configuración de auto-cerrado","auto_close_save":"Guardar","auto_close_remove":"No Auto-Cerrar Este Tema","auto_close_immediate":{"one":"El último post se publicó hace 1 hora, por lo que el tema se cerrará inmediatamente.","other":"El último post se publicó hace %{count} horas, por lo que el tema se cerrará inmediatamente."},"timeline":{"back":"Volver","back_description":"Volver al último post sin leer","replies_short":"%{current} / %{total}"},"progress":{"title":"avances","go_top":"arriba","go_bottom":"abajo","go":"ir","jump_bottom":"salta al último post","jump_prompt":"saltar al post","jump_prompt_long":"¿Hacia qué post quieres saltar?","jump_bottom_with_number":"saltar al post %{post_number}","total":"posts totales","current":"post actual"},"notifications":{"title":"cambiar con qué frecuencia se te notifica de este tema","reasons":{"mailing_list_mode":"El modo lista de correo se encuentra activado, por lo que se te notificará de las respuestas a este tema vía email.","3_10":"Recibirás notificaciones porque estás vigilando una etiqueta de este tema.","3_6":"Recibirás notificaciones porque estás vigilando esta categoría.","3_5":"Recibirás notificaciones porque has empezado a vigilar este tema automáticamente.","3_2":"Recibirás notificaciones porque estás vigilando este tema.","3_1":"Recibirás notificaciones porque creaste este tema.","3":"Recibirás notificaciones porque estás vigilando este tema.","2_8":"Recibirás notificaciones porque estás siguiendo esta categoría.","2_4":"Recibirás notificaciones porque has publicado una respuesta en este tema.","2_2":"Recibirás notificaciones porque estás siguiendo este tema.","2":"Recibirás notificaciones porque \u003ca href=\"/users/{{username}}/preferences\"\u003ehas leído este tema\u003c/a\u003e.","1_2":"Se te notificará solo si alguien menciona tu @nombre o te responde a un post.","1":"Se te notificará si alguien menciona tu @nombre o te responde a un post.","0_7":"Estás ignorando todas las notificaciones en esta categoría.","0_2":"Estás ignorando todas las notificaciones en este tema.","0":"Estás ignorando todas las notificaciones en este tema."},"watching_pm":{"title":"Vigilar","description":"Se te notificará de cada nuevo post en este mensaje y se mostrará un contador de nuevos posts."},"watching":{"title":"Vigilar","description":"Se te notificará de cada post en este tema y se mostrará un contador de nuevos post."},"tracking_pm":{"title":"Seguir","description":"Se mostrará un contador de nuevos posts para este mensaje y se te notificará si alguien menciona tu @nombre o te responde a un post."},"tracking":{"title":"Seguir","description":"Se mostrará un contador de nuevos posts en este tema y se te notificará si alguien menciona tu @nombre o te responde a un post."},"regular":{"title":"Normal","description":"Se te notificará solo si alguien menciona tu @nombre o te responde a un post."},"regular_pm":{"title":"Normal","description":"Se te notificará solo si alguien menciona tu @nombre o te responde a un post."},"muted_pm":{"title":"Silenciar","description":"Nunca se te notificará nada sobre este hilo de mensajes."},"muted":{"title":"Silenciar","description":"No serás notificado de algo relacionado con este tema, y no aparecerá en la página de mensajes recientes."}},"actions":{"recover":"Deshacer borrar tema","delete":"Eliminar tema","open":"Abrir tema","close":"Cerrar tema","multi_select":"Seleccionar posts...","auto_close":"Auto-cierre...","pin":"Destacar tema...","unpin":"Dejar de destacar...","unarchive":"Desarchivar Tema","archive":"Archivar Tema","invisible":"Hacer invisible","visible":"Hacer visible","reset_read":"Restablecer datos de lectura","make_public":"Convertir en tema público","make_private":"Convertir en Mensaje Privado"},"feature":{"pin":"Destacar tema","unpin":"Dejar de destacar tema","pin_globally":"Destacar tema globalmente","make_banner":"Tema de encabezado","remove_banner":"Remover tema de encabezado"},"reply":{"title":"Responder","help":"comienza a escribir una respuesta a este tema"},"clear_pin":{"title":"Eliminar Destacado","help":"Elimina el estado 'Destacado' de este tema para que no aparezca más en lo más alto de tu lista de temas"},"share":{"title":"Compartir","help":"comparte el enlace a este tema"},"flag_topic":{"title":"Reportar","help":"reportar de forma privada para atención de los moderadores o enviar una notificación privada sobre él","success_message":"Has reportado este tema correctamente."},"feature_topic":{"title":"Característica de este Tema","pin":"Hacer que este tema aparezca en el top de la categoría {{categoryLink}} hasta","confirm_pin":"Hay ya {{count}} temas destacados. Que haya demasiados temas destacados puede resultar engorroso para los usuarios nuevos y anónimos. ¿Seguro que quieres destacar otro tema en esta categoría?","unpin":"Eliminar este tema del top de la categoría {{categoryLink}}.","unpin_until":"Quitar este tema del top de la categoría {{categoryLink}} o esperar al \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Los usuarios pueden desanclar el tema de forma individual por sí mismos.","pin_validation":"Es obligatorio especificar una fecha para destacar este tema.","not_pinned":"No hay temas destacados en {{categoryLink}}.","already_pinned":{"one":"Hay \u003cstrong class='badge badge-notification unread'\u003eun tema\u003c/strong\u003e destacado actualmente en {{categoryLink}}. ","other":"Temas destacados actualmente en {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Hacer que este tema aparezca en el top de todas las listas de temas hasta","confirm_pin_globally":"Hay ya {{count}} temas destacados globalmente. Que haya demasiados temas destacados puede resultar engorroso para los usuarios nuevos y anónimos. ¿Seguro que quieres destacar otro tema de forma global?","unpin_globally":"Eliminar este tema de la parte superior de todas las listas de temas.","unpin_globally_until":"Quitar este tema del top de todas las listas de temas o esperar al \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Los usuarios pueden desanclar el tema de forma individual por sí mismos.","not_pinned_globally":"No hay temas destacados globalmente.","already_pinned_globally":{"one":"Actualmente hay \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e tema destacado globalmente.","other":"Temas destacados globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Hacer de este tema una pancarta que aparece en la parte superior de todas las páginas.","remove_banner":"Retire la pancarta que aparece en la parte superior de todas las páginas.","banner_note":"Los usuarios pueden descartar la pancarta cerrándola. Sólo un tema puede ser una pancarta en cualquier momento dado.","no_banner_exists":"No hay tema de encabezado (banner).","banner_exists":"Actualmente \u003cstrong class='badge badge-notification unread'\u003ehay\u003c/strong\u003e un tema de encabezado (banner)."},"inviting":"Invitando...","automatically_add_to_groups":"Esta invitación incluye además acceso a los siguientes grupos:","invite_private":{"title":"Invitar al hilo de mensajes.","email_or_username":"Email o nombre de usuario del invitado","email_or_username_placeholder":"dirección de email o nombre de usuario","action":"Invitar","success":"Hemos invitado a ese usuario a participar en este hilo de mensajes.","success_group":"Hemos invitado a ese grupo a participar en este mensaje.","error":"Lo sentimos, hubo un error al invitar a ese usuario.","group_name":"nombre del grupo"},"controls":"Controles del tema","invite_reply":{"title":"Invitar","username_placeholder":"nombre de usuario","action":"Enviar invitación","help":"invitar a otros a este tema a través del correo electrónico o de las notificaciones","to_forum":"Enviaremos un correo electrónico breve permitiendo a tu amigo unirse inmediatamente al hacer clic en un enlace, sin necesidad de iniciar sesión.","sso_enabled":"Introduce el nombre de usuario de la persona a la que quieres invitar a este tema.","to_topic_blank":"Introduzca el nombre de usuario o dirección de correo electrónico de la persona que desea invitar a este tema.","to_topic_email":"Ha introducido una dirección de correo electrónico. Nosotros te enviaremos una invitación que le permita a su amigo responder inmediatamente a este tema.","to_topic_username":"Has introducido un nombre de usuario. Le enviaremos una notificación con un enlace invitándole a este tema.","to_username":"Introduce el nombre de usuario de la persona a la que quieras invitar. Le enviaremos una notificación con un enlace invitándole a este tema.","email_placeholder":"nombre@ejemplo.com","success_email":"Hemos enviado un email con tu invitación a \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Te notificaremos cuando se acepte. Puedes revisar la pestaña invitaciones en tu perfil de usuario para consultar el estado de tus invitaciones.","success_username":"Hemos invitado a ese usuario a participar en este tema.","error":"Lo sentimos, no pudimos invitar a esa persona. Tal vez ya haya sido invitada. (La tasa de invitaciones es limitada)"},"login_reply":"Inicia Sesión para Responder","filters":{"n_posts":{"one":"1 post","other":"{{count}} posts"},"cancel":"Quitar filtro"},"split_topic":{"title":"Mover a un tema nuevo","action":"mover a un tema nuevo","topic_name":"Nombre del tema nuevo","error":"Hubo un error moviendo los posts al nuevo tema","instructions":{"one":"Estas a punto de crear un tema nuevo y rellenarlo con el post que has seleccionado.","other":"Estas a punto de crear un tema nuevo y rellenarlo con los \u003cb\u003e{{count}}\u003c/b\u003e posts que has seleccionado."}},"merge_topic":{"title":"Mover a un tema existente","action":"mover a un tema existente","error":"Hubo un error moviendo los posts a ese tema","instructions":{"one":"Por favor escoge el tema al que quieres mover ese post.","other":"Por favor escoge el tema al que quieres mover esos \u003cb\u003e{{count}}\u003c/b\u003e posts."}},"merge_posts":{"title":"Unir posts seleccionados","action":"unir posts seleccionados","error":"Hubo un error al unir los posts seleccionados."},"change_owner":{"title":"Cambiar dueño de los posts","action":"cambiar dueño","error":"Hubo un error cambiando la autoría de los posts.","label":"Nuevo dueño de los posts","placeholder":"nombre de usuario del nuevo dueño","instructions":{"one":"Por favor escoge el nuevo dueño del {{count}} post de \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Por favor escoge el nuevo dueño de los {{count}} posts de \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Ten en cuenta que las notificaciones sobre este post no serán transferidas al nuevo usuario de forma retroactiva.\u003cbr\u003eAviso: actualmente, los datos que no dependen del post son transferidos al nuevo usuario. Usar con precaución."},"change_timestamp":{"title":"Cambiar Timestamp","action":"cambiar timestamp","invalid_timestamp":"El Timestamp no puede ser futuro","error":"Hubo un error cambiando el timestamp de este tema.","instructions":"Por favor, señecciona el nuevo timestamp del tema. Los posts en el tema serán actualizados para mantener la diferencia de tiempo."},"multi_select":{"select":"seleccionar","selected":"seleccionado ({{count}})","select_replies":"seleccionar más respuestas","delete":"eliminar seleccionado","cancel":"cancelar selección","select_all":"seleccionar todo","deselect_all":"deshacer selección","description":{"one":"Has seleccionado \u003cb\u003e1\u003c/b\u003e post.","other":"Has seleccionado \u003cb\u003e{{count}}\u003c/b\u003e posts."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citar","edit":"Editando {{link}} {{replyAvatar}} {{username}}","edit_reason":"Motivo:","post_number":"post {{number}}","last_edited_on":"post editado por última ven en","reply_as_new_topic":"Responder como tema enlazado","continue_discussion":"Continuando la discusión desde {{postLink}}:","follow_quote":"ir al post citado","show_full":"Mostrar todo el post","show_hidden":"Ver el contenido oculto.","deleted_by_author":{"one":"(post retirado por el autor. Será borrado automáticamente en %{count} hora si no es reportado)","other":"(post retirado por el autor. Será borrado automáticamente en %{count} horas si no es reportado)"},"expand_collapse":"expandir/contraer","gap":{"one":"ver 1 post oculto","other":"ver {{count}} posts ocultos"},"unread":"Post sin leer","has_replies":{"one":"{{count}} Respuesta","other":"{{count}} Respuestas"},"has_likes":{"one":"{{count}} Me gusta","other":"{{count}} Me gusta"},"has_likes_title":{"one":"1 persona le ha dado Me gusta a este post","other":"{{count}} personas le han dado Me gusta a este post"},"has_likes_title_only_you":"te ha gustado este mensaje","has_likes_title_you":{"one":"A tí y a una persona le ha gustado este mensaje","other":"A tí y a otros {{count}} les han gustado este mensaje"},"errors":{"create":"Lo sentimos, hubo un error al crear tu post. Por favor, inténtalo de nuevo.","edit":"Lo sentimos, hubo un error al editar tu post. Por favor, inténtalo de nuevo.","upload":"Lo sentimos, hubo un error al subir el archivo. Por favor, inténtalo de nuevo.","file_too_large":"Lo sentimos, ese archivo es demasiado grande (el tamaño máximo es {{max_size_kb}}kb). ¿Quizá podrías subir el archivo a un servicio de almacenamiento en la nube y compartir aquí el enlace?","too_many_uploads":"Lo siento solo puedes subir un archivo cada vez.","too_many_dragged_and_dropped_files":"Lo sentimos, sólo puedes subir 10 archivos a la vez.","upload_not_authorized":"Lo sentimos, el archivo que intenta cargar no está autorizado (authorized extension: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Lo siento, usuarios nuevos no pueden subir imágenes.","attachment_upload_not_allowed_for_new_user":"Lo siento, usuarios nuevos no pueden subir archivos adjuntos.","attachment_download_requires_login":"Lo sentimos, necesitas haber iniciado sesión para descargar archivos adjuntos."},"abandon":{"confirm":"¿Estás seguro que deseas abandonar tu post?","no_value":"No, mantener","yes_value":"Sí, abandonar"},"via_email":"este post llegó por email","via_auto_generated_email":"este post llegó a través de un email generado automáticamente","whisper":"esto post es un susurro privado para moderadores","wiki":{"about":"este post es tipo wiki"},"archetypes":{"save":"Guardar opciones"},"few_likes_left":"¡Gracias por compartir tu afecto! Te quedan solo unos pocos me gusta para hoy.","controls":{"reply":"componer una respuesta para este post","like":"me gusta este post","has_liked":"te gusta este post","undo_like":"deshacer Me gusta","edit":"edita este post","edit_anonymous":"Lo sentimos, necesitas iniciar sesión para editar este post.","flag":"reporta esta publicación de forma privada para atención de los moderadores o enviarles un notificación privada sobre el tema","delete":"elimina este post","undelete":"deshace la eliminación de este post","share":"comparte un enlace a este post","more":"Más","delete_replies":{"confirm":{"one":"¿Quieres eliminar también la respuesta directa a este post?","other":"¿Quieres eliminar también las {{count}} respuestas directas a este post?"},"yes_value":"Sí, borrar también las respuestas","no_value":"No, solo este post"},"admin":"acciones de administrador para el post","wiki":"Formato wiki","unwiki":"Deshacer formato wiki","convert_to_moderator":"Convertir a post de staff","revert_to_regular":"Eliminar el formato de post de staff","rebake":"Reconstruir HTML","unhide":"Deshacer ocultar","change_owner":"Cambiar dueño"},"actions":{"flag":"Reportar","defer_flags":{"one":"Aplazar reporte","other":"Aplazar reportes"},"undo":{"off_topic":"Deshacer reporte","spam":"Deshacer reporte","inappropriate":"Deshacer reporte","bookmark":"Deshacer marcador","like":"Deshacer Me gusta","vote":"Deshacer voto"},"people":{"off_topic":"reportó esto como off-topic","spam":"reportó esto como spam","inappropriate":"reportó esto como inapropiado","notify_moderators":"notificó a moderadores","notify_user":"envió un mensaje","bookmark":"guardó esto en marcadores","like":"le gustó esto","vote":"votó por esto"},"by_you":{"off_topic":"Has reportado esto como off-topic","spam":"Has reportado esto como Spam","inappropriate":"Has reportado esto como inapropiado","notify_moderators":"Has reportado esto para que sea moderado","notify_user":"Has enviado un mensaje a este usuario","bookmark":"Has marcado este post","like":"Te ha gustado esto","vote":"Has votado este post"},"by_you_and_others":{"off_topic":{"one":"Tú y otro usuarios habéis reportado esto como off-topic","other":"Tú y otros {{count}} usuarios habéis reportado esto como off-topic"},"spam":{"one":"Tú y otro usuario habéis reportado esto como off-topic","other":"Tú y otros {{count}} usuarios habéis reportado esto como spam"},"inappropriate":{"one":"Tú y otro usuario habéis reportado esto como inapropiado","other":"Tú y otros {{count}} usuarios habéis reportado esto como inapropiado"},"notify_moderators":{"one":"Tú y otro usuario habéis reportado esto para moderar","other":"Tú y otros {{count}} usuarios habéis reportado esto para moderar"},"notify_user":{"one":"Tú y otra persona habéis enviado un mensaje a este usuario","other":"Tú y otras {{count}} personas habéis enviado un mensaje a este usuario"},"bookmark":{"one":"Tú y otro usuario habéis marcado este post","other":"Tú y otros {{count}} usuarios habéis marcado este post"},"like":{"one":"A ti y a otro usuario os ha gustado esto","other":"A ti y a otros {{count}} usuarios os ha gustado esto"},"vote":{"one":"Tú y otro usuario habéis votado este post","other":"Tú y otros {{count}} habéis votado este post"}},"by_others":{"off_topic":{"one":"1 usuario ha reportado esto como off-topic","other":"{{count}} usuarios han reportado esto como off-topic"},"spam":{"one":"1 usuario ha reportado esto como spam","other":"{{count}} usuarios han reportado esto como spam"},"inappropriate":{"one":"1 usuario ha reportado esto como inapropiado","other":"{{count}} usuarios han reportado esto como inapropiado"},"notify_moderators":{"one":"1 usuario ha reportado esto para que sea moderado","other":"{{count}} usuarios han reportado esto para que sea moderado"},"notify_user":{"one":"1 persona ha enviado un mensaje a este usuario","other":"{{count}} personas han enviado un mensaje a este usuario"},"bookmark":{"one":"Una persona ha marcado este post","other":"{{count}} han marcado este post"},"like":{"one":"A 1 persona le gusta esto","other":"A {{count}} personas les gusta esto"},"vote":{"one":"Una persona ha votado este post","other":"{{count}} personas votaron este post"}}},"delete":{"confirm":{"one":"¿Seguro que quieres eliminar ese post?","other":"¿Seguro que quieres eliminar todos esos posts?"}},"merge":{"confirm":{"one":"¿Seguro que quieres unir esos posts?","other":"¿Seguro que quieres unir esos {{count}} posts?"}},"revisions":{"controls":{"first":"Primera revisión","previous":"Revisión anterior","next":"Siguiente revisión","last":"Última revisión","hide":"Ocultar revisión.","show":"Mostrar revisión.","revert":"Volver a esta revisión","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Muestra la producción asistida con adiciones y eleminaciones en línea","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Mostrar la producción asistida estas de lado a lado","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Mostrar las diferencias crudas a la par","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Crudo"}}}},"category":{"can":"puede\u0026hellip; ","none":"(sin categoría)","all":"Categorías","choose":"Seleccionar una categoría\u0026hellip;","edit":"editar","edit_long":"Editar","view":"Ver temas en la categoría","general":"General","settings":"Ajustes","topic_template":"Plantilla de tema","tags":"Etiquetas","tags_allowed_tags":"Las únicas etiquetas que pueden aplicarse en esta categoría:","tags_allowed_tag_groups":"Grupos de etiquetas que sólo pueden pueden utilizarse en esta categoría:","tags_placeholder":"(Opcional) lista de etiquetas permitidas","tag_groups_placeholder":"(Opcional) lista de grupos de etiquetas permitidos","delete":"Eliminar categoría","create":"Crear categoría","create_long":"Crear una nueva categoría","save":"Guardar categoría","slug":"Slug de la categoría para URL","slug_placeholder":"(Opcional) palabras-por-guiones para URL","creation_error":"Se ha producido un error al crear la categoría.","save_error":"Ha ocurrido un error al guardar la categoría","name":"Nombre de la categoría","description":"Descripción","topic":"categoría","logo":"Imagen (logo) para la categoría","background_image":"Imagen de fondo para la categoría","badge_colors":"Colores de los distintivos","background_color":"Color de fondo","foreground_color":"Colores de primer plano","name_placeholder":"Debe ser corto y conciso.","color_placeholder":"Cualquier color web","delete_confirm":"¿Estás seguro de que quieres eliminar esta categoría?","delete_error":"Ha ocurrido un error al borrar la categoría.","list":"Lista de categorías","no_description":"Por favor, añade una descripción para esta categoría.","change_in_category_topic":"Editar descripción","already_used":"Este color ha sido usado para otra categoría","security":"Seguridad","special_warning":"Aviso: esta categoría se ajusta por defecto y las opciones de seguridad no pueden ser editadas. Si no deseas utilizarla, elimínala en vez de reutilizarla.","images":"Imágenes","auto_close_label":"Cerrar automaticamente los temas después de:","auto_close_units":"horas","email_in":"Dirección de correo electrónico personalizada para el correo entrante:","email_in_allow_strangers":"Aceptar emails de usuarios anónimos sin cuenta","email_in_disabled":"La posibilidad de publicar nuevos temas por email está deshabilitada en los ajustes del sitio. Para habilitar la publicación de nuevos temas por email,","email_in_disabled_click":"activa la opción \"email in\".","suppress_from_homepage":"Ocultar categoría de la página de inicio.","allow_badges_label":"Permitir conceder distintivos en esta categoría","edit_permissions":"Editar permisos","add_permission":"Añadir permisos","this_year":"este año","position":"posición","default_position":"Posición predeterminada","position_disabled":"Las Categorías se mostrarán por orden de actividad. Para controlar el orden en que aparecen en las listas,","position_disabled_click":"activa la opción \"fixed category positions\".","parent":"Categoría primaria","notifications":{"watching":{"title":"Vigilar","description":"Vigilarás automáticamente todos los temas en estas categorías. Se te notificará de cada nuevo post en cada tema, y se mostrará un contador de nuevas respuestas."},"watching_first_post":{"title":"Vigilar Primer Post","description":"Se te notificará del primer post de cada nuevo tema en estas categorías."},"tracking":{"title":"Seguir","description":"Seguirás automáticamente todos los temas en estas categorías. Se te notificará si alguien menciona tu @nombre o te responde, y se mostrará un contador de nuevas respuestas."},"regular":{"title":"Normal","description":"Se te notificará solo si alguien menciona tu @nombre o te responde a un post."},"muted":{"title":"Silenciar","description":"No serás notificado de ningún tema en estas categorías, y no aparecerán en la página de mensajes recientes."}}},"flagging":{"title":"¡Gracias por ayudar a mantener una comunidad civilizada!","action":"Reportar post","take_action":"Tomar medidas","notify_action":"Mensaje","official_warning":"Advertencia oficial","delete_spammer":"Borrar spammer","yes_delete_spammer":"Sí, borrar spammer","ip_address_missing":"(N/D)","hidden_email_address":"(oculto)","submit_tooltip":"Enviar el reporte privado","take_action_tooltip":"Alcanzar el umbral de reportes inmediatamente, en vez de esperar a más reportes de la comunidad","cant":"Lo sentimos, no puedes reportar este post en este momento.","notify_staff":"Notificar a los administradores de forma privada","formatted_name":{"off_topic":"Está fuera de lugar","inappropriate":"Es inapropiado","spam":"Es Spam"},"custom_placeholder_notify_user":"Sé específico, constructivo y siempre amable.","custom_placeholder_notify_moderators":"Haznos saber qué te preocupa específicamente y, siempre que sea posible, añade enlaces y ejemplos relevantes.","custom_message":{"at_least":{"one":"introduce al menos un carácter","other":"introduce al menos {{count}} caracteres"},"more":{"one":"1 más...","other":"{{count}} más..."},"left":{"one":"1 restante","other":"{{count}} restantes"}}},"flagging_topic":{"title":"¡Gracias por ayudar a mantener una comunidad civilizada!","action":"Reportar tema","notify_action":"Mensaje"},"topic_map":{"title":"Resumen de temas","participants_title":"Autores frecuentes","links_title":"Enlaces populares","links_shown":"mostrar más enlaces...","clicks":{"one":"1 clic","other":"%{count} clics"}},"post_links":{"about":"expandir los demás enlaces de este post","title":{"one":"1 más","other":"%{count} más"}},"topic_statuses":{"warning":{"help":"Ésta es una advertencia oficial."},"bookmarked":{"help":"Has guardado en marcadores este tema."},"locked":{"help":"este tema está cerrado; ya no aceptan nuevas respuestas"},"archived":{"help":"este tema está archivado; está congelado y no puede ser cambiado"},"locked_and_archived":{"help":"Este tema está cerrado y archivado; no acepta nuevas respuestas y no puede ser cambiado de ningún modo."},"unpinned":{"title":"Deseleccionado como destacado","help":"Este tema se ha dejado de destacar para ti; en tu listado de temas se mostrará en orden normal"},"pinned_globally":{"title":"Destacado globalmente","help":"Este tema ha sido destacado globalmente, se mostrará en la parte superior de la página de mensajes recientes y de su categoría."},"pinned":{"title":"Destacado","help":"Este tema ha sido destacado para ti; se mostrará en la parte superior de su categoría"},"invisible":{"help":"Este tema es invisible; no se mostrará en la lista de temas y solo puede acceder a él a través de su enlace directo."}},"posts":"Posts","posts_long":"{{number}} posts en este tema","original_post":"Post Original","views":"Visitas","views_lowercase":{"one":"visita","other":"visitas"},"replies":"Respuestas","views_long":"este tema se ha visto {{number}} veces","activity":"Actividad","likes":"Likes","likes_lowercase":{"one":"me gusta","other":"me gusta"},"likes_long":"este tema tiene {{number}} me gusta","users":"Usuarios","users_lowercase":{"one":"usuario","other":"usuarios"},"category_title":"Categoría","history":"Historia","changed_by":"por {{author}}","raw_email":{"title":"E-mail Original","not_available":"¡No disponible!"},"categories_list":"Lista de categorías","filters":{"with_topics":"%{filter} temas","with_category":"Foro de %{category} - %{filter}","latest":{"title":"Recientes","title_with_count":{"one":"Reciente (1)","other":"Recientes ({{count}})"},"help":"temas con posts recientes"},"hot":{"title":"Candente","help":"una selección de los temas más candentes"},"read":{"title":"Leídos","help":"temas que ya has leído"},"search":{"title":"Buscar","help":"buscar todos los temas"},"categories":{"title":"Categorías","title_in":"Categoría - {{categoryName}}","help":"todos los temas agrupados por categoría"},"unread":{"title":"Sin leer","title_with_count":{"one":"Sin leer (1)","other":"Sin leer ({{count}})"},"help":"temas que estás vigilando o siguiendo actualmente con posts no leídos","lower_title_with_count":{"one":"{{count}} sin leer","other":"{{count}} sin leer"}},"new":{"lower_title_with_count":{"one":"1 tema nuevo","other":"{{count}} temas nuevos"},"lower_title":"nuevo","title":"Nuevo","title_with_count":{"one":"Nuevos ({{count}})","other":"Nuevos ({{count}})"},"help":"temas publicados en los últimos días"},"posted":{"title":"Mis posts","help":"temas en los que has publicado"},"bookmarks":{"title":"Marcadores","help":"temas que has guardado en marcadores"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"temas recientes en la categoría {{categoryName}}"},"top":{"title":"Top","help":"los temas más con más actividad del último año, mes, semana, o día","all":{"title":"Siempre"},"yearly":{"title":"Año"},"quarterly":{"title":"Trimestral"},"monthly":{"title":"Mes"},"weekly":{"title":"Semana"},"daily":{"title":"Día"},"all_time":"Siempre","this_year":"Año","this_quarter":"Trimestre","this_month":"Mes","this_week":"Semana","today":"Hoy","other_periods":"ver temas top"}},"browser_update":"Desafortunadamente, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003etu navegador es demasiado antiguo para funcionar en este sitio\u003c/a\u003e. Por favor \u003ca href=\"http://browsehappy.com\"\u003eactualízalo\u003c/a\u003e.","permission_types":{"full":"Crear / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"lightbox":{"download":"descargar"},"search_help":{"title":"Ayuda para búsquedas"},"keyboard_shortcuts_help":{"title":"Atajos de teclado","jump_to":{"title":"Saltar a","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Inicio","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Recientes","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nuevos","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Sin leer","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categorías","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Marcadores","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Perfil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mensajes"},"navigation":{"title":"Navegación","jump":"\u003cb\u003e#\u003c/b\u003e Ir al post #","back":"\u003cb\u003eu\u003c/b\u003e Volver","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Desplazar selección \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eIntro\u003c/b\u003e Abrir tema seleccionado","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Sección siguiente/previa"},"application":{"title":"Aplicación","create":"\u003cb\u003ec\u003c/b\u003e Crear un nuevo tema","notifications":"\u003cb\u003en\u003c/b\u003e Abrir notificaciones","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Abrir menú hamburguesa","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Abrir menú de usuario","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Mostrar temas actualizados","search":"\u003cb\u003e/\u003c/b\u003e Buscar","help":"\u003cb\u003e?\u003c/b\u003e Abrir guía de atajos de teclado","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Descartar Nuevos/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Descartar temas","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Cerrar sesión"},"actions":{"title":"Acciones","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Guardar/Quitar el tema de marcadores","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Seleccionar/Deseleccionar como destacado","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Compartir tema","share_post":"\u003cb\u003es\u003c/b\u003e Compartir post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Responder como un tema enlazado","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Responder al tema","reply_post":"\u003cb\u003er\u003c/b\u003e Responder al post","quote_post":"\u003cb\u003eq\u003c/b\u003e Citar post","like":"\u003cb\u003el\u003c/b\u003e Me gusta el post","flag":"\u003cb\u003e!\u003c/b\u003e Reportar post","bookmark":"\u003cb\u003eb\u003c/b\u003e Guardar post en marcadores","edit":"\u003cb\u003ee\u003c/b\u003e Editar post","delete":"\u003cb\u003ed\u003c/b\u003e Borrar post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Silenciar tema","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Seguimiento normal del tema (por defecto)","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Seguir tema","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Vigilar Tema"}},"badges":{"earned_n_times":{"one":"Ganó este distintivo 1 vez","other":"Ganó este distintivo %{count} veces"},"granted_on":"Concedido el %{date}","others_count":"Otras personas con este distintivo (%{count})","title":"Distintivos","allow_title":"título disponible","multiple_grant":"puede ser concedido varias veces","badge_count":{"one":"1 Distintivo","other":"%{count} distintivos"},"more_badges":{"one":"+1 Más","other":"+%{count} Más"},"granted":{"one":"1 concedido","other":"%{count} concedidos"},"select_badge_for_title":"Seleccionar una distinción para utilizar como tu título","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Primeros pasos"},"community":{"name":"Comunidad"},"trust_level":{"name":"Nivel de Confianza"},"other":{"name":"Miscelánea"},"posting":{"name":"Escritura"}}},"google_search":"\u003ch3\u003eBuscar con Google\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Etiquetas","selector_all_tags":"etiquetas","selector_no_tags":"sin etiquetas","changed":"etiquetas cambiadas:","tags":"Etiquetas","choose_for_topic":"elegir etiquetas para este tema (opcional)","delete_tag":"Eliminar etiqueta","delete_confirm":"¿Seguro que quieres eliminar esa etiqueta?","rename_tag":"Renombrar etiqueta","rename_instructions":"Elige un nuevo nombre para la etiqueta:","sort_by":"Ordenar por:","sort_by_count":"contador","sort_by_name":"nombre","manage_groups":"Administrar grupos de etiquetas","manage_groups_description":"Definir grupos para organizar etiquetas","filters":{"without_category":"%{filter} %{tag} temas","with_category":"%{filter} %{tag} temas en %{category}","untagged_without_category":"%{filter} temas sin etiquetas","untagged_with_category":"%{filter} temas sin etiquetas en %{category}"},"notifications":{"watching":{"title":"Vigilar","description":"Vigilarás todos los temas en esta etiqueta. Se te notificará de todos los nuevos temas y posts, y además aparecerá el contador de posts sin leer y nuevos posts al lado del tema."},"watching_first_post":{"title":"Vigilar Primer Post","description":"Se te notificará del primer post de cada nuevo tema en esta etiqueta."},"tracking":{"title":"Seguir","description":"Seguirás automáticamente todos los temas en esta etiqueta. Aparecerá un contador de posts sin leer y nuevos posts al lado del tema."},"regular":{"title":"Normal","description":"Se te notificará solo si alguien te menciona con tu @usuario o responde a algún post tuyo."},"muted":{"title":"Silenciado","description":"No se te notificará de nuevos temas con esta etiqueta, ni aparecerán en tu pestaña de temas no leídos."}},"groups":{"title":"Grupos de etiquetas","about":"Agregar etiquetas en grupos para administrarlas más fácilmente.","new":"Nuevo grupo","tags_label":"Etiquetas en este grupo:","parent_tag_label":"Etiqueta primaria:","parent_tag_placeholder":"Opcional","parent_tag_description":"Las etiquetas de este grupo no pueden utilizarse a menos que la etiqueta primaria esté presente. ","one_per_topic_label":"Limitar una etiqueta de este grupo por tema","new_name":"Nuevo grupo de etiquetas","save":"Guardar","delete":"Eliminar","confirm_delete":"¿Seguro que quieres eliminar este grupo de etiquetas?"},"topics":{"none":{"unread":"No hay temas que sigas y que no hayas leído ya.","new":"No tienes temas nuevos por leer.","read":"Todavía no has leído ningún tema.","posted":"Todavía no has publicado en ningún tema.","latest":"No hay temas recientes.","hot":"No hay temas populares.","bookmarks":"No tienes temas guardados en marcadores todavía.","top":"No hay temas en el top más vistos.","search":"No hay resultados de búsqueda."},"bottom":{"latest":"No hay más temas recientes para leer.","hot":"No hay más temas populares.","posted":"No hay más temas publicados.","read":"No hay más temas leídos.","new":"No hay más temas nuevos.","unread":"No hay más temas sin leer.","top":"No hay más temas en el top más vistos.","bookmarks":"No hay más temas guardados en marcadores.","search":"No hay más resultados de búsqueda."}}},"invite":{"custom_message":"Darle a tu invitación un toque personal escribiendo un","custom_message_link":"mensaje personalizado","custom_message_placeholder":"Introducir un mensaje personalizado","custom_message_template_forum":"Hey, ¡quizá deberías unirte a este foro!","custom_message_template_topic":"¡Hey, he pensado que este tema te va a encantar!"},"poll":{"voters":{"one":"votante","other":"votantes"},"total_votes":{"one":"voto total","other":"votos totales"},"average_rating":"Puntuación media: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Los votos son públicos."},"multiple":{"help":{"at_least_min_options":{"one":"Elige al menos \u003cstrong\u003e1\u003c/strong\u003e opción","other":"Elige al menos \u003cstrong\u003e%{count}\u003c/strong\u003e opciones"},"up_to_max_options":{"one":"Elige \u003cstrong\u003e1\u003c/strong\u003e opción","other":"Elige hasta \u003cstrong\u003e%{count}\u003c/strong\u003e opciones"},"x_options":{"one":"Elige \u003cstrong\u003e1\u003c/strong\u003e opción","other":"Elige \u003cstrong\u003e%{count}\u003c/strong\u003e opciones"},"between_min_and_max_options":"Elige entre \u003cstrong\u003e%{min}\u003c/strong\u003e y \u003cstrong\u003e%{max}\u003c/strong\u003e opciones"}},"cast-votes":{"title":"Votar","label":"¡Vota!"},"show-results":{"title":"Mostrar los resultados de la encuesta","label":"Mostrar resultados"},"hide-results":{"title":"Volver a los votos","label":"Ocultar resultados"},"open":{"title":"Abrir encuesta","label":"Abrir","confirm":"¿Seguro que quieres abrir esta encuesta?"},"close":{"title":"Cerrar la encuesta","label":"Cerrar","confirm":"¿Seguro que quieres cerrar esta encuesta?"},"error_while_toggling_status":"Lo sentimos, hubo un error al cambiar el estado de esta encuesta.","error_while_casting_votes":"Lo sentimos, hubo un error al registrar tus votos.","error_while_fetching_voters":"Lo sentimos, hubo un error al mostrar los votantes.","ui_builder":{"title":"Crear Encuesta","insert":"Insertar Encuesta","help":{"options_count":"Introducir al menos 2 opciones"},"poll_type":{"label":"Tipo","regular":"Una opción","multiple":"Múltiples opciones","number":"Valoración numérica"},"poll_config":{"max":"Máximo","min":"Mínimo","step":"Intervalo"},"poll_public":{"label":"Mostrar quién votó"},"poll_options":{"label":"Introducir una opción de la encuesta por línea"}}},"type_to_filter":"filtrar opciones...","admin":{"title":"Administrador de Discourse","moderator":"Moderador","dashboard":{"title":"Panel","last_updated":"Panel actualizado el:","version":"Versión","up_to_date":"¡Estás al día!","critical_available":"Actualización crítica disponible.","updates_available":"Hay actualizaciones disponibles.","please_upgrade":"¡Por favor, actualiza!","no_check_performed":"Una revisión de actualizaciones no ha sido realizada aún. Asegúrate de que sidekiq está funcionando.","stale_data":"Una revisión de actualizaciones no ha sido realizada recientemente. Asegúrate de que sidekiq está funcionando.","version_check_pending":"Parece que has actualizado recientemente. Fantástico!","installed_version":"Instalada","latest_version":"Última","problems_found":"Hemos encontrado algunos problemas con tu instalación de Discourse","last_checked":"Ultima comprobación","refresh_problems":"Refrescar","no_problems":"Ningún problema ha sido encontrado.","moderators":"Moderadores:","admins":"Administradores:","blocked":"Bloqueados:","suspended":"Suspendidos:","private_messages_short":"Mensajes privados","private_messages_title":"Mensajes","mobile_title":"Móvil","space_free":"{{size}} libre","uploads":"subidas","backups":"backups","traffic_short":"Tráfico","traffic":"Peticiones web de la app","page_views":"Peticiones de API","page_views_short":"Peticiones de API","show_traffic_report":"Mostrar informe detallado del tráfico","reports":{"today":"Hoy","yesterday":"Ayer","last_7_days":"Últimos 7 días","last_30_days":"Últimos 30 días","all_time":"Todo el tiempo","7_days_ago":"Hace 7 días","30_days_ago":"Hace 30 días","all":"Todo","view_table":"tabla","view_graph":"gráfico","refresh_report":"Actualizar reporte","start_date":"Desde fecha","end_date":"Hasta fecha","groups":"Todos los grupos"}},"commits":{"latest_changes":"Cambios recientes: ¡actualiza a menudo!","by":"por"},"flags":{"title":"Reportes","old":"Antiguo","active":"Activo","agree":"De acuerdo","agree_title":"Confirmar esta indicación como válido y correcto.","agree_flag_modal_title":"Estar de acuerdo y...","agree_flag_hide_post":"Coincido (ocultar post + enviar MP)","agree_flag_hide_post_title":"Ocultar este post y enviar automáticamente un mensaje al usuario para que lo edite de forma urgente","agree_flag_restore_post":"De acuerdo (restaurar post)","agree_flag_restore_post_title":"Restaurar este post","agree_flag":"Estar de acuerdo con la indicación","agree_flag_title":"Estar de acuerdo con la indicación y mantener la publicación intacta","defer_flag":"Aplazar","defer_flag_title":"Eliminar este indicador; no es necesaria ninguna acción en este momento.","delete":"Eliminar","delete_title":"Eliminar el post referido por este indicador.","delete_post_defer_flag":"Eliminar post y aplazar reporte","delete_post_defer_flag_title":"Eliminar post; si era el primero de un tema, eliminar el tema","delete_post_agree_flag":"Eliminar post y estar de acuerdo con la indicación","delete_post_agree_flag_title":"Eliminar post; si era el primero de un tema, eliminar el tema","delete_flag_modal_title":"Borrar y...","delete_spammer":"Eliminar spammer","delete_spammer_title":"Eliminar usuario y todos los posts y temas de ese usuario.","disagree_flag_unhide_post":"No coincido (volver a mostrar post)","disagree_flag_unhide_post_title":"Quitar todos los reportes de este post y hacerlo visible de nuevo","disagree_flag":"No coincido","disagree_flag_title":"Denegar esta indicación como inválida o incorrecta","clear_topic_flags":"Hecho","clear_topic_flags_title":"Este tema ha sido investigado y los problemas han sido resueltos. Haz clic en Hecho para eliminar los reportes.","more":"(más respuestas...)","dispositions":{"agreed":"coincidió","disagreed":"no coincidió","deferred":"aplazado"},"flagged_by":"Reportado por","resolved_by":"Resuelto por","took_action":"Tomó medidas","system":"Sistema","error":"Algo salió mal","reply_message":"Responder","no_results":"No hay reportes.","topic_flagged":"Este \u003cstrong\u003etema\u003c/strong\u003e ha sido reportado.","visit_topic":"Visita el tema para tomar medidas","was_edited":"El post fue editado después del primer reporte","previous_flags_count":"Este post ya fue marcado {{count}} veces.","summary":{"action_type_3":{"one":"fuera de tema","other":"fuera de tema x{{count}}"},"action_type_4":{"one":"inapropiado","other":"inapropiado x{{count}}"},"action_type_6":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_7":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Grupo principal","no_primary":"(ningún grupo principal)","title":"Grupos","edit":"Editar grupos","refresh":"Actualizar","new":"Nuevo","selector_placeholder":"introduce nombre de usuario","name_placeholder":"Nombre del grupo, sin espacios, al igual que la regla del nombre usuario","about":"Edita los aquí los nombres de los grupos y sus miembros","group_members":"Miembros del grupo","delete":"Borrar","delete_confirm":"Borrar este grupo?","delete_failed":"No se pudo borrar el grupo. Si este es un grupo automático, no se puede destruir.","delete_member_confirm":"¿Eliminar a '%{username}' del grupo '%{group}'?","delete_owner_confirm":"¿Quitar privilegios de propietario para '%{username}'?","name":"Nombre","add":"Añadir","add_members":"Añadir miembros","custom":"Personalizado","bulk_complete":"Los usuarios han sido añadidos al grupo.","bulk":"Añadir al grupo en masa","bulk_paste":"Pega una lista de nombres de usuario o emails, uno por línea:","bulk_select":"(selecciona un grupo)","automatic":"Automático","automatic_membership_email_domains":"Los usuarios que se registren con un dominio de e-mail que esté en esta lista serán automáticamente añadidos a este grupo:","automatic_membership_retroactive":"Aplicar la misma regla de dominio de email para usuarios registrados existentes ","default_title":"Título por defecto para todos los miembros en este grupo","primary_group":"Establecer como grupo primario automáticamente","group_owners":"Propietarios","add_owners":"Añadir propietarios","incoming_email":"Correos electrónicos entrantes personalizados","incoming_email_placeholder":"introducir dirección de email","flair_url":"URL de imagen distintiva","flair_url_placeholder":"(Opcional) URL de imagen","flair_bg_color":"Color de fondo de imagen distintiva","flair_bg_color_placeholder":"(Optional) Valor hexadecimal del color","flair_preview":"Vista previa"},"api":{"generate_master":"Generar clave maestra de API","none":"No hay ninguna clave de API activa en este momento.","user":"Usuario","title":"API","key":"Clave de API","generate":"Generar clave de API","regenerate":"Regenerar clave de API","revoke":"Revocar","confirm_regen":"Estás seguro que quieres reemplazar esa Clave de API con una nueva?","confirm_revoke":"Estás seguro que quieres revocar esa clave?","info_html":"Tu clave de API te permitirá crear y actualizar temas usando llamadas a JSON.","all_users":"Todos los usuarios","note_html":"Mantén esta clave \u003cstrong\u003esecreta\u003c/strong\u003e a buen recaudo, cualquier usuario que disponga de ella podría crear posts de cualquier usuario."},"plugins":{"title":"Plugins","installed":"Plugins instalados","name":"Nombre","none_installed":"No tienes plugins instalados.","version":"Versión","enabled":"¿Activado?","is_enabled":"S","not_enabled":"N","change_settings":"Cambiar preferencias","change_settings_short":"Ajustes","howto":"¿Cómo instalo plugins?"},"backups":{"title":"Copia de seguridad","menu":{"backups":"Copia de seguridad","logs":"Logs"},"none":"Ninguna copia disponible.","read_only":{"enable":{"title":"Activar el modo solo-lectura","label":"Activar solo-lecutra","confirm":"¿Seguro que quieres activar el modo solo-lectura?"},"disable":{"title":"Desactivar el modo solo-lectura","label":"Desactivar solo-lectura"}},"logs":{"none":"No hay información de momento..."},"columns":{"filename":"Nombre del archivo","size":"Tamaño"},"upload":{"label":"Subir","title":"Subir un backup a esta instancia","uploading":"Subiendo...","success":"El archivo '{{filename}}' se ha subido correctamente.","error":"Ha ocurrido un error al subir el archivo '{{filename}}': {{message}}"},"operations":{"is_running":"Actualmente una operación se está procesando...","failed":"La {{operation}} falló. Por favor revisa los logs","cancel":{"label":"Cancelar","title":"Cancelar la operación actual","confirm":"¿Estás seguro que quieres cancelar la operación actual?"},"backup":{"label":"Backup","title":"Crear una copia de seguridad","confirm":"¿Quieres iniciar una nueva copia de seguridad?","without_uploads":"Sí (no incluir archivos)"},"download":{"label":"Descargar","title":"Descargar la copia de seguridad"},"destroy":{"title":"Borrar la copia de seguridad","confirm":"¿Estás seguro que quieres borrar esta copia de seguridad?"},"restore":{"is_disabled":"Restaurar está deshabilitado en la configuración del sitio.","label":"Restaurar","title":"Restaurar la copia de seguridad","confirm":"¿Seguro que quieres restaurar esta copia de seguridad?"},"rollback":{"label":"Revertir","title":"Regresar la base de datos al estado funcional anterior","confirm":"¿Seguro que quieres retornar la base de datos al estado funcional previo?"}}},"export_csv":{"user_archive_confirm":"¿Seguro que quieres descargar todos tus posts?","success":"Exportación iniciada, se te notificará a través de un mensaje cuando el proceso se haya completado.","failed":"Exportación fallida, revisa los logs.","rate_limit_error":"Los posts se pueden descargar una vez al día, por favor, prueba otra vez mañana.","button_text":"Exportar","button_title":{"user":"Exportar la lista completa de usuarios en formato CSV.","staff_action":"Exportar el registro completo de acciones de administradores en formato CSV.","screened_email":"Exportar la lista completa de emails vistos en formato CSV.","screened_ip":"Exportar la lista completa de IP vistas en formato CSV.","screened_url":"Exportar la lista completa de URL vistas en formato CSV."}},"export_json":{"button_text":"Exportar"},"invite":{"button_text":"Enviar invitaciones","button_title":"Enviar invitaciones"},"customize":{"title":"Personalizar","long_title":"Personalizaciones del sitio","css":"CSS","header":"Encabezado","top":"Top","footer":"Pie de página","embedded_css":"CSS embebido","head_tag":{"text":"\u003c/head\u003e","title":"HTML insertado antes de la etiqueta \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML insertado antes de la etiqueta \u003c/body\u003e"},"override_default":"No incluir hoja de estilo estándar","enabled":"¿Activado?","preview":"vista previa","undo_preview":"eliminar vista previa","rescue_preview":"estilo por defecto","explain_preview":"Ver el sitio con esta hoja de estilo","explain_undo_preview":"Volver a la hoja de estilo personalizada activada actualmente","explain_rescue_preview":"Ver el sitio con la hoja de estilo por defecto","save":"Guardar","new":"Nuevo","new_style":"Nuevo Estilo","import":"Importar","import_title":"Selecciona un archivo o pega texto","delete":"Eliminar","delete_confirm":"¿Eliminar esta personalización?","about":"Modifica hojas de estilo CSS y cabeceras HTML en el sitio. Añade una personalización para empezar.","color":"Color","opacity":"Opacidad","copy":"Copiar","email_templates":{"title":"Diseño del email","subject":"Título del email","multiple_subjects":"Esta plantilla de email tiene múltiples asuntos.","body":"Cuerpo del email","none_selected":"Selecciona un 'diseño de email' para comenzar a editar","revert":"Revertir los cambios","revert_confirm":"¿Estás seguro de querer revertir los cambios?"},"css_html":{"title":"CSS/HTML","long_title":"Personalizaciones CSS y HTML"},"colors":{"title":"Colores","long_title":"Esquemas de color","about":"Modifica los colores utilizados en el sitio sin editar el CSS. Añade un esquema de color para empezar.","new_name":"Nuevo esquema de color","copy_name_prefix":"Copia de","delete_confirm":"¿Eliminar este esquema de color?","undo":"deshacer","undo_title":"Deshacer los cambios a este color hasta el último guardado.","revert":"rehacer","revert_title":"Restaurar este color al esquema de Discourse por defecto.","primary":{"name":"primario","description":"La mayoría del texto, iconos y bordes."},"secondary":{"name":"secundario","description":"El color de fondo principal y el color de texto de algunos botones."},"tertiary":{"name":"terciario","description":"Enlaces, algunos botones, notificaciones y color de énfasis."},"quaternary":{"name":"cuaternario","description":"Enlaces de navegación."},"header_background":{"name":"fondo del encabezado","description":"Color de fondo del encabezado del sitio."},"header_primary":{"name":"encabezado primario","description":"Texto e iconos en el encabezado del sitio."},"highlight":{"name":"resaltado","description":"El color de fondo de los elementos resaltados en la página, como temas o posts."},"danger":{"name":"peligro","description":"Color del resaltado para acciones como eliminar temas o posts."},"success":{"name":"éxito","description":"Para indicar que una acción se realizó correctamente."},"love":{"name":"me gusta","description":"El color del botón de \"me gusta\""}}},"email":{"title":"Emails","settings":"Ajustes","templates":"Plantillas","preview_digest":"Vista previa de Resumen","sending_test":"Enviando e-mail de prueba...","error":"\u003cb\u003eERROR\u003c/b\u003e - %{server_error}","test_error":"Hubo un error al enviar el email de prueba. Por favor, revisa la configuración de correo, verifica que tu servicio de alojamiento no esté bloqueando los puertos de conexión de correo, y prueba de nuevo.","sent":"Enviado","skipped":"Omitidos","bounced":"Rebotado","received":"Recibidos","rejected":"Rechazados","sent_at":"Enviado a","time":"Fecha","user":"Usuario","email_type":"Email","to_address":"A dirección","test_email_address":"dirección de email de prueba","send_test":"Enviar email de prueba","sent_test":"enviado!","delivery_method":"Método de entrega","preview_digest_desc":"Previsualiza el contenido del email de resumen enviado a usuarios inactivos.","refresh":"Actualizar","format":"Formato","html":"html","text":"texto","last_seen_user":"Último usuario visto:","reply_key":"Clave de respuesta","skipped_reason":"Saltar motivo","incoming_emails":{"from_address":"De","to_addresses":"Para","cc_addresses":"Cc","subject":"Asunto","error":"Error","none":"No se encontraron emails entrantes.","modal":{"title":"Detalles de emails entrantes","error":"Error","headers":"Cabeceras","subject":"Asunto","body":"Cuerpo","rejection_message":"Correo de rechazo"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Asunto...","error_placeholder":"Error"}},"logs":{"none":"No se han encontrado registros.","filters":{"title":"filtro","user_placeholder":"nombre de usuario","address_placeholder":"nombre@ejemplo.com","type_placeholder":"resumen, registro...","reply_key_placeholder":"clave de respuesta","skipped_reason_placeholder":"motivo"}}},"logs":{"title":"Logs","action":"Acción","created_at":"Creado","last_match_at":"Última coincidencia","match_count":"Coincidencias","ip_address":"IP","topic_id":"ID del Tema","post_id":"ID del Post","category_id":"ID de la categoría","delete":"Eliminar","edit":"Editar","save":"Guardar","screened_actions":{"block":"bloquear","do_nothing":"no hacer nada"},"staff_actions":{"title":"Acciones del staff","instructions":"Clic en los usuarios y acciones para filtrar la lista. Clic en las imágenes de perfil para ir a páginas de usuario.","clear_filters":"Mostrar todo","staff_user":"Usuario administrador","target_user":"Usuario enfocado","subject":"Sujeto","when":"Cuándo","context":"Contexto","details":"Detalles","previous_value":"Anterior","new_value":"Nuevo","diff":"Diff","show":"Mostrar","modal_title":"Detalles","no_previous":"No existe un valor anterior.","deleted":"No hay un valor nuevo. El registro ha sido borrado.","actions":{"delete_user":"Borrar usuario","change_trust_level":"cambiar nivel de confianza","change_username":"cambiar nombre de usuario","change_site_setting":"cambiar configuración del sitio","change_site_customization":"cambiar customización del sitio","delete_site_customization":"borrar customización del sitio","change_site_text":"cambiar textos","suspend_user":"suspender usuario","unsuspend_user":"desbloquear usuario","grant_badge":"conceder distintivo","revoke_badge":"revocar distintivo","check_email":"comprobar e-mail","delete_topic":"eliminar tema","delete_post":"eliminar post","impersonate":"impersonar","anonymize_user":"anonimizar usuario","roll_up":"agrupar bloqueos de IP","change_category_settings":"cambiar opciones de categoría","delete_category":"eliminar categoría","create_category":"crear categoría","block_user":"bloquear usuario","unblock_user":"desbloquear usuario","grant_admin":"conceder administración","revoke_admin":"revocar administración","grant_moderation":"conceder moderación","revoke_moderation":"revocar moderación","backup_operation":"operación de copia de seguridad de respaldo","deleted_tag":"etiqueta eliminada","renamed_tag":"etiqueta renombrada","revoke_email":"revocar email"}},"screened_emails":{"title":"Correos bloqueados","description":"Cuando alguien trata de crear una cuenta nueva, los siguientes correos serán revisados y el registro será bloqueado, o alguna otra acción será realizada.","email":"Correo electrónico","actions":{"allow":"Permitir"}},"screened_urls":{"title":"URLs bloqueadas","description":"Las URLs listadas aquí fueron utilizadas en posts de usuarios identificados como spammers.","url":"URL","domain":"Dominio"},"screened_ips":{"title":"IPs bloqueadas","description":"Direcciones IP que están siendo vigiladas. Usa \"Permitir\" para añadir direcciones IP preaprobadas.","delete_confirm":"Estás seguro que quieres remover el bloqueo para %{ip_address}?","roll_up_confirm":"¿Estás seguro de que quieres agrupar las IPs vistas con frecuencia en subredes?","rolled_up_some_subnets":"Se han agrupado con éxito las entradas de IP baneadas a estos rangos: %{subnets}.","rolled_up_no_subnet":"No había nada para agrupar.","actions":{"block":"Bloquear","do_nothing":"Permitir","allow_admin":"Permitir administrador"},"form":{"label":"Nueva:","ip_address":"Dirección IP","add":"Añadir","filter":"Búsqueda"},"roll_up":{"text":"Agrupar","title":"Crea un nuevo rango de entradas para banear si hay al menos 'min_ban_entries_for_roll_up' entradas."}},"logster":{"title":"Registros de errores"}},"impersonate":{"title":"Impersonar","help":"Utiliza esta herramienta para personificar una cuenta de usuario con fines de depuración. Tendrás que cerrar sesión al terminar.","not_found":"No se pudo encontrar a ese usuario.","invalid":"Lo sentimos, no puedes impersonarte en ese usuario."},"users":{"title":"Usuarios","create":"Añadir Usuario Administrador","last_emailed":"Último email enviado","not_found":"Lo sentimos, ese usuario no existe.","id_not_found":"Lo sentimos, esa id de usuario no existe en nuestro sistema.","active":"Activo","show_emails":"Mostrar emails","nav":{"new":"Nuevo","active":"Activo","pending":"Pendiente","staff":"Staff","suspended":"Suspendidos","blocked":"Bloqueados","suspect":"Sospechoso"},"approved":"Aprobado/s?","approved_selected":{"one":"aprobar usuario","other":"aprobar ({{count}}) usuarios"},"reject_selected":{"one":"rechazar usuario","other":"rechazar ({{count}}) usuarios"},"titles":{"active":"Usuarios activos","new":"Usuarios nuevos","pending":"Usuarios pendientes de revisión","newuser":"Usuarios con nivel de confianza 0 (Nuevo)","basic":"Usuarios con nivel de confianza 1 (Básico)","member":"Usuarios en nivel de confianza 2 (Miembro)","regular":"Usuarios en nivel de confianza 3 (Habitual)","leader":"Usuarios en nivel de confianza 4 (Líder)","staff":"Staff","admins":"Administradores","moderators":"Moderadores","blocked":"Usuarios bloqueados","suspended":"Usuarios suspendidos","suspect":"Usuarios sospechados"},"reject_successful":{"one":"1 usuario rechazado con éxito.","other":"%{count} usuarios rechazados con éxito."},"reject_failures":{"one":"Error al rechazar 1 usuario.","other":"Error al rechazar %{count} usuarios."},"not_verified":"No verificado","check_email":{"title":"Revelar la dirección de e-mail de este usuario","text":"Mostrar"}},"user":{"suspend_failed":"Algo salió mal baneando este usuario {{error}}","unsuspend_failed":"Algo salió mal quitando ban a este usuario {{error}}","suspend_duration":"¿Cuánto tiempo le gustaría aplicar ban al usuario? (days)","suspend_duration_units":"(días)","suspend_reason_label":"¿Por qué lo suspendes? Este texto \u003cb\u003eserá visible para todos\u003c/b\u003e en la página de perfil del usuario y se mostrará al usuario cuando intente iniciar sesión. Sé conciso.","suspend_reason":"Causa","suspended_by":"Suspendido por","delete_all_posts":"Eliminar todos los posts","suspend":"Suspender","unsuspend":"Quitar suspensión","suspended":"¿Suspendido?","moderator":"¿Moderador?","admin":"¿Administrador?","blocked":"¿Bloqueado?","staged":"¿Provisional?","show_admin_profile":"Administrador","edit_title":"Editar título","save_title":"Guardar título","refresh_browsers":"Forzar recarga del navegador","refresh_browsers_message":"¡Mensaje enviado a todos los clientes!","show_public_profile":"Ver perfil público","impersonate":"Impersonar a","ip_lookup":"Búsqueda de IP","log_out":"Cerrar sesión","logged_out":"El usuario ha cerrado sesión desde todos los dispositivos","revoke_admin":"Revocar administrador","grant_admin":"Conceder administración","revoke_moderation":"Revocar moderación","grant_moderation":"Conceder moderación","unblock":"Desbloquear","block":"Bloquear","reputation":"Reputación","permissions":"Permisos","activity":"Actividad","like_count":"Likes Dados / Recibidos","last_100_days":"en los últimos 100 días","private_topics_count":"Temas privados","posts_read_count":"Posts leídos","post_count":"Posts publicados","topics_entered":"Temas vistos","flags_given_count":"Reportes enviados","flags_received_count":"Reportes recibidos","warnings_received_count":"Advertencias recibidas","flags_given_received_count":"Reportes Enviados / Recibidos","approve":"Aprobar","approved_by":"aprobado por","approve_success":"Usuario aprobado y correo electrónico enviado con instrucciones para la activación.","approve_bulk_success":"¡Perfecto! Todos los usuarios seleccionados han sido aprobados y notificados.","time_read":"Tiempo de lectura","anonymize":"Anonimizar usuario","anonymize_confirm":"¿SEGURO que quieres hacer anónima esta cuenta? Esto cambiará el nombre de usuario y el email, y reseteará toda la información de perfil.","anonymize_yes":"Sí, hacer anónima esta cuenta.","anonymize_failed":"Hubo un problema al hacer anónima la cuenta.","delete":"Borrar usuario","delete_forbidden_because_staff":"Administradores y moderadores no pueden ser eliminados","delete_posts_forbidden_because_staff":"No se pueden eliminar todos los posts de admins y moderadores.","delete_forbidden":{"one":"Los usuarios no se pueden borrar si han sido registrados hace más de %{count} día, o si tienen publicaciones. Borra todas publicaciones antes de tratar de borrar un usuario.","other":"Los usuarios no se pueden borrar si han sido registrados hace más de %{count} días, o si tienen publicaciones. Borra todas publicaciones antes de tratar de borrar un usuario."},"cant_delete_all_posts":{"one":"No se pueden eliminar todos los posts. Algunos tienen más de %{count} día de antigüedad. (Ver la opción delete_user_max_post_age )","other":"No se pueden eliminar todos los posts. Algunos tienen más de %{count} días de antigüedad. (Ver la opción delete_user_max_post_age )"},"cant_delete_all_too_many_posts":{"one":"No se pueden eliminar todos los posts porque el usuario tiene más de 1 post. (Ver la opción delete_all_posts_max)","other":"No se pueden eliminar todos los posts porque el usuario tiene más de %{count} posts. (Ver la opción delete_all_posts_max)"},"delete_confirm":"Estás SEGURO que quieres borrar este usuario? Esta acción es permanente!","delete_and_block":"Eliminar y \u003cb\u003ebloquear\u003c/b\u003e este correo y esta dirección IP","delete_dont_block":"Eliminar solo.","deleted":"El usuario fue borrado.","delete_failed":"Ha habido un error al borrar ese usuario. Asegúrate que todos las publicaciones han sido borrados antes de tratando de borrar este usuario.","send_activation_email":"Enviar correo de activación","activation_email_sent":"Un correo de activación ha sido enviado.","send_activation_email_failed":"Ha habido un problema enviando otro correo de activación. %{error}","activate":"Activar Cuenta","activate_failed":"Ha habido un problem activando el usuario.","deactivate_account":"Desactivar cuenta","deactivate_failed":"Ha habido un problema desactivando el usuario.","unblock_failed":"Ha habido un problema desbloqueando el usuario.","block_failed":"Ha habido un problema bloqueando el usuario.","block_confirm":"¿Seguro que quieres bloquear a este usuario? No podrá crear nuevos temas ni publicar posts.","block_accept":"Sí, bloquear este usuario","bounce_score":"Puntuación de rebote","reset_bounce_score":{"label":"Restablecer","title":"Restablece la puntuación de rebote de nuevo a 0"},"deactivate_explanation":"Un usuario desactivado debe rehabilitar su dirección de correo.","suspended_explanation":"Un usuario suspendido no puede ingresar al sitio.","block_explanation":"Un usuario bloqueado no puede publicar posts ni crear temas.","staged_explanation":"Un usuario provisional solo puede publicar por email en temas específicos.","bounce_score_explanation":{"none":"No se han recibido rebotes recientemente desde ese email.","some":"Se han recibido algunos rebotes recientemente desde ese email.","threshold_reached":"Se recibieron muchos rebotes desde ese email."},"trust_level_change_failed":"Ha habido un problema cambiando el nivel de confianza del usuario.","suspend_modal_title":"Suspender Usuario","trust_level_2_users":"Usuarios del nivel de Confianza 2","trust_level_3_requirements":"Requerimientos para nivel de confianza 3","trust_level_locked_tip":"El nivel de confianza esta bloqueado, el sistema no promoverá o degradara al usuario.","trust_level_unlocked_tip":"El nivel de confianza esta desbloqueado, el sistema podrá promover o degradar al usuario.","lock_trust_level":"Bloquear Nivel de Confianza","unlock_trust_level":"Desbloquear Nivel de Confianza","tl3_requirements":{"title":"Requerimientos para el nivel de confianza 3","table_title":{"one":"En el último día:","other":"En los últimos %{count} días:"},"value_heading":"Valor","requirement_heading":"Requerimiento","visits":"Visitas","days":"días","topics_replied_to":"Temas en los que ha comentado","topics_viewed":"Temas vistos","topics_viewed_all_time":"Temas vistos (desde siempre)","posts_read":"Posts leídos","posts_read_all_time":"Posts leídos (desde siempre)","flagged_posts":"Posts reportados","flagged_by_users":"Usuarios que lo reportaron","likes_given":"Likes dados","likes_received":"Likes recibidos","likes_received_days":"'Me gusta' Recibidos: días únicos","likes_received_users":"'Me gusta' Recibidos: usuarios únicos.","qualifies":"Califica para el nivel de confianza 3.","does_not_qualify":"No califica para el nivel de confianza 3.","will_be_promoted":"Será promovido pronto.","will_be_demoted":"Será degradado pronto.","on_grace_period":"Actualmente en periodo de gracia de promoción, no será degradado.","locked_will_not_be_promoted":"Nivel de confianza bloqueado. Nunca será promovido.","locked_will_not_be_demoted":"Nivel de confianza bloqueado. Nunca será degradado."},"sso":{"title":"Single Sign On","external_id":"ID externa","external_username":"Nombre de usuario","external_name":"Nombre","external_email":"Email","external_avatar_url":"URL de imagen de perfil"}},"user_fields":{"title":"Campos de Usuario","help":"Añadir campos que tus usuarios pueden llenar.","create":"Crear Campo de Usuario","untitled":"Sin título","name":"Nombre del Campo","type":"Tipo de Campo","description":"Descripción del Campo","save":"Guardar","edit":"Editar","delete":"Borrar","cancel":"Cancelar","delete_confirm":"Esta seguro que quiere borrar ese campo de usuario?","options":"Opciones","required":{"title":"¿Requerido al registrarse?","enabled":"requerido","disabled":"no requerido"},"editable":{"title":"¿Editable después del registro?","enabled":"editable","disabled":"no editable"},"show_on_profile":{"title":"¿Se muestra públicamente en el perfil?","enabled":"Mostrado en el perfil","disabled":"No mostrado en el perfil"},"show_on_user_card":{"title":"¿Mostrar en las tarjetas de usuario?","enabled":"mostrado en las tarjetas de usuario","disabled":"no mostrado en las tarjetas de usuario"},"field_types":{"text":"Campo de Texto","confirm":"Confirmación","dropdown":"Lista"}},"site_text":{"description":"Puedes personalizar cualquier texto de tu foro. Empieza por buscar debajo:","search":"Busca el texto que te gustaría editar","title":"Contenido de Texto","edit":"editar","revert":"Deshacer cambios","revert_confirm":"¿Estás seguro de que quieres deshacer tus cambios?","go_back":"Volver a la búsqueda","recommended":"Recomendamos personalizar los siguientes textos para que se ajusten a tus necesidades:","show_overriden":"Sólo mostrar textos editados"},"site_settings":{"show_overriden":"Sólo mostrar lo personalizado","title":"Ajustes del sitio","reset":"restablecer","none":"ninguno","no_results":"Ningún resultado encontrado","clear_filter":"Limpiar filtro","add_url":"añadir URL","add_host":"añadir host","categories":{"all_results":"Todo","required":"Requerido","basic":"Ajustes básicos","users":"Usuarios","posting":"Publicar","email":"Email","files":"Archivos","trust":"Niveles de confianza","security":"Seguridad","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Límites de velocidad","developer":"Desarrollador","embedding":"Embebido","legal":"Legal","user_api":"API de usuario","uncategorized":"Otros","backups":"Copias de seguridad","login":"Login","plugins":"Plugins","user_preferences":"Preferencias de los Usuarios","tags":"Etiquetas","search":"Búsqueda"}},"badges":{"title":"Distintivos","new_badge":"Nuevo distintivo","new":"Nuevo","name":"Nombre","badge":"Distintivo","display_name":"Nombre a mostrar","description":"Descripción","long_description":"Descripción completa","badge_type":"Tipo de distintivo","badge_grouping":"Grupo","badge_groupings":{"modal_title":"Grupos de distintivos"},"granted_by":"Concedido por","granted_at":"Concedido en","reason_help":"(Enlace a un post o tema)","save":"Guardar","delete":"Borrar","delete_confirm":"¿Estás seguro de que quieres eliminar este distintivo?","revoke":"Revocar","reason":"Motivo","expand":"Expandir \u0026hellip;","revoke_confirm":"¿Estás seguro de que quieres revocar este distintivo?","edit_badges":"Editar distintivos","grant_badge":"Condecer distintivo","granted_badges":"Distintivos concedidos","grant":"Conceder","no_user_badges":"%{name} no tiene ningún distintivo.","no_badges":"No hay distintivos para conceder.","none_selected":"Selecciona un distintivo para empezar","allow_title":"Permitir usar distintivo como título","multiple_grant":"Puede ser concedido varias veces","listable":"Mostrar distintivo en la página pública de distintivos","enabled":"Activar distintivo","icon":"Icono","image":"Imagen","icon_help":"Usa ya sea una clase Font Awesome o una URL a la imagen","query":"Consulta (SQL) para otorgar el distintivo","target_posts":"La consulta tiene como objetivo posts","auto_revoke":"Ejecutar diariamente la consulta de revocación","show_posts":"Mostrar el post por el que se concedió el distintivo en la página de distintivos","trigger":"Activador","trigger_type":{"none":"Actualizar diariamente","post_action":"Cuando un usuario interactúa con un post","post_revision":"Cuando un usuario edita o crea un post","trust_level_change":"Cuando cambia el nivel de confianza de un usuario","user_change":"Cuando se edita o se crea un usuario","post_processed":"Después de procesar un post"},"preview":{"link_text":"Vista previa de los distintivos concedidos","plan_text":"Vista previa con el planteamiento de tu query","modal_title":"Vista previa de la query para el distintivo","sql_error_header":"Ha ocurrido un error con la consulta.","error_help":"Mira los siguientes enlaces para ayudarte con las queries de los distintivos.","bad_count_warning":{"header":"¡ADVERTENCIA!","text":"Faltan algunas muestras a la hora de conceder el distintivo. Esto ocurre cuando la query del distintivo devuelve IDs de usuarios o de posts que no existen. Esto podría causar resultados inesperados más tarde - por favor, revisa de nuevo tu query."},"no_grant_count":"No hay distintivos para asignar.","grant_count":{"one":"\u003cb\u003e%{count}\u003c/b\u003e distintivos para conceder.","other":"\u003cb\u003e%{count}\u003c/b\u003e distintivos para conceder."},"sample":"Ejemplo:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e por publicar en %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e por publicar en %{link} el \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e el \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Añade nuevos emojis que estarán disponibles para todos. (CONSEJO: arrasta varios archivos a la vez)","add":"Añadir nuevo Emoji","name":"Nombre","image":"Imagen","delete_confirm":"¿Estás seguro de querer eliminar el emoji :%{name}:?"},"embedding":{"get_started":"Si quieres insertar Discourse en otro sitio web, empieza por añadir su host.","confirm_delete":"¿Seguro que quieres borrar ese host?","sample":"Usa el siguiente código HTML en tu sitio para crear e insertar temas. Reempalza \u003cb\u003eREPLACE_ME\u003c/b\u003e con la URL canónica de la página donde quieres insertar.","title":"Insertado","host":"Hosts Permitidos","edit":"editar","category":"Publicar a Categoría","add_host":"Añadir Host","settings":"Ajustes de Insertado","feed_settings":"Ajustes de Feed","feed_description":"Discourse podrá importar tu contenido de forma más fácil si proporcionas un feed RSS/ATOM de tu sitio.","crawling_settings":"Ajustes de Crawlers","crawling_description":"Cuando Discourse crea temas para tus posts, si no hay un feed RSS/ATOM presente intentará analizar el contenido de tu HTML. A veces puede ser difícil extraer tu contenido, por eso facilitamos la opción de especificar reglas CSS para hacer la extracción más fácil.","embed_by_username":"Usuario para la creación de temas","embed_post_limit":"Máximo número de posts a incluir","embed_username_key_from_feed":"Clave para extraer usuario de discourse del feed","embed_title_scrubber":"Expresión regular utilizada para depurar el título de los posts","embed_truncate":"Truncar los posts insertados","embed_whitelist_selector":"Selector CSS para permitir elementos a embeber","embed_blacklist_selector":"Selector CSS para restringir elementos a embeber","embed_classname_whitelist":"Clases CSS permitidas","feed_polling_enabled":"Importar posts usando RSS/ATOM","feed_polling_url":"URL del feed RSS/ATOM del que extraer datos","save":"Guardar ajustes de Insertado"},"permalink":{"title":"Enlaces permanentes","url":"URL","topic_id":"ID del tema","topic_title":"Tema","post_id":"ID del post","post_title":"Post","category_id":"Id de la categoría","category_title":"Categoría","external_url":"URL externa","delete_confirm":"¿Seguro que quieres eliminar este enlace permanente?","form":{"label":"Nuevo:","add":"Añadir","filter":"Buscar (URL o URL externa)"}}}}},"en":{"js":{"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""}},"composer":{"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?"},"details":{"title":"Hide Details"},"admin":{"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?"},"embedding":{"path_whitelist":"Path Whitelist"}}}}};
I18n.locale = 'es';
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
//! locale : spanish (es)
//! author : Julio Napurí : https://github.com/julionc

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var monthsShortDot = 'ene._feb._mar._abr._may._jun._jul._ago._sep._oct._nov._dic.'.split('_'),
        monthsShort = 'ene_feb_mar_abr_may_jun_jul_ago_sep_oct_nov_dic'.split('_');

    var es = moment.defineLocale('es', {
        months : 'enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre'.split('_'),
        monthsShort : function (m, format) {
            if (/-MMM-/.test(format)) {
                return monthsShort[m.month()];
            } else {
                return monthsShortDot[m.month()];
            }
        },
        monthsParseExact : true,
        weekdays : 'domingo_lunes_martes_miércoles_jueves_viernes_sábado'.split('_'),
        weekdaysShort : 'dom._lun._mar._mié._jue._vie._sáb.'.split('_'),
        weekdaysMin : 'do_lu_ma_mi_ju_vi_sá'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D [de] MMMM [de] YYYY',
            LLL : 'D [de] MMMM [de] YYYY H:mm',
            LLLL : 'dddd, D [de] MMMM [de] YYYY H:mm'
        },
        calendar : {
            sameDay : function () {
                return '[hoy a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            nextDay : function () {
                return '[mañana a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            nextWeek : function () {
                return 'dddd [a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            lastDay : function () {
                return '[ayer a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            lastWeek : function () {
                return '[el] dddd [pasado a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            sameElse : 'L'
        },
        relativeTime : {
            future : 'en %s',
            past : 'hace %s',
            s : 'unos segundos',
            m : 'un minuto',
            mm : '%d minutos',
            h : 'una hora',
            hh : '%d horas',
            d : 'un día',
            dd : '%d días',
            M : 'un mes',
            MM : '%d meses',
            y : 'un año',
            yy : '%d años'
        },
        ordinalParse : /\d{1,2}º/,
        ordinal : '%dº',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return es;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
