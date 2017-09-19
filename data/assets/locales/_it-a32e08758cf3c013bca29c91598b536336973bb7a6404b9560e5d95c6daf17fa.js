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
r += "C'è <a href='/unread'>1 argomento non letto</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "Ci sono <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " argomenti non letti</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "e ";
return r;
},
"false" : function(d){
var r = "";
r += "è ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 nuovo</a> argomento";
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
r += "e ";
return r;
},
"false" : function(d){
var r = "";
r += "Ci sono ";
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
})() + " nuovi</a>  argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restanti, o ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "visualizza altri argomenti in ";
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
r += "Questo argomento ha ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 risposta";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " risposte";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "con un alto rapporto \"mi piace\" / messaggi";
return r;
},
"med" : function(d){
var r = "";
r += "con un altissimo rapporto \"mi piace\" / messaggi";
return r;
},
"high" : function(d){
var r = "";
r += "con un estremamente alto rapporto \"mi piace\" / messaggi";
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

MessageFormat.locale.it = function ( n ) {
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
I18n.translations = {"it":{"js":{"number":{"format":{"separator":",","delimiter":" '"},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Byte"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"D MMM h:mm a","long_no_year_no_time":"D MMM","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM YYYY h:mm a","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"D MMM LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} fa","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1g","other":"%{count}gg"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min.","other":"%{count} min."},"x_hours":{"one":"1 ora","other":"%{count} ore"},"x_days":{"one":"1 giorno","other":"%{count} giorni"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 minuto fa","other":"%{count} minuti fa"},"x_hours":{"one":"1 ora fa","other":"%{count} ore fa"},"x_days":{"one":"un giorno fa","other":"%{count} giorni fa"}},"later":{"x_days":{"one":"1 giorno dopo","other":"%{count} giorni dopo"},"x_months":{"one":"1 mese dopo","other":"%{count} mesi dopo"},"x_years":{"one":"1 anno dopo","other":"%{count} anni dopo"}},"previous_month":"Mese Precedente","next_month":"Mese Successivo"},"share":{"topic":"Condividi un link a questa conversazione","post":"messaggio n°%{postNumber}","close":"chiudi","twitter":"Condividi questo link su Twitter","facebook":"Condividi questo link su Facebook","google+":"Condividi questo link su Google+","email":"invia questo collegamento via email"},"action_codes":{"public_topic":"ha reso questo argomento pubblico %{when}","private_topic":"ha reso questo argomento privato %{when}","split_topic":"ha separato questo argomento %{when}","invited_user":"Invitato %{who} %{when}","invited_group":"invitato %{who} %{when}","removed_user":"rimosso %{who} %{when}","removed_group":"cancellato %{who} %{when}","autoclosed":{"enabled":"chiuso %{when}","disabled":"aperto %{when}"},"closed":{"enabled":"chiuso %{when}","disabled":"aperto %{when}"},"archived":{"enabled":"archiviato %{when}","disabled":"dearchiviato %{when}"},"pinned":{"enabled":"appuntato %{when}","disabled":"spuntato %{when}"},"pinned_globally":{"enabled":"appuntato globalmente %{when}","disabled":"spuntato %{when}"},"visible":{"enabled":"listato %{when}","disabled":"delistato %{when}"}},"topic_admin_menu":"azioni amministrative sull'argomento","emails_are_disabled":"Tutte le email in uscita sono state disabilitate a livello globale da un amministratore. Non sarà inviata nessun tipo di notifica via email.","bootstrap_mode_enabled":"Per aiutarti ad avviare il tuo nuovo sito, adesso sei in modalità bootstrap. Tutti i nuovi utenti saranno automaticamente promossi al livello 1 e riceveranno il riassunto quotidiano degli aggiornamenti via email. Questa modalità sarà disattivata automaticamente quando avrai più di %{min_users} utenti.","bootstrap_mode_disabled":"La modalità bootstrap sarà disattivata entro 24 ore.","s3":{"regions":{"us_east_1":"Stati Uniti Est (Virginia del Nord)","us_west_1":"Stati Uniti Ovest (California del Nord)","us_west_2":"Stati Uniti Ovest (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"Europa (Irlanda)","eu_central_1":"Europa (Francoforte)","ap_southeast_1":"Asia Pacifico (Singapore)","ap_southeast_2":"Asia Pacifico (Sidney)","ap_south_1":"Asia Pacifico (Mumbai)","ap_northeast_1":"Asia Pacifico (Tokyo)","ap_northeast_2":"Asia Pacifico (Seoul)","sa_east_1":"America del Sud (San Paolo)","cn_north_1":"Cina (Beijing)"}},"edit":"modifica titolo e categoria dell'argomento","not_implemented":"Spiacenti! Questa funzione non è stata ancora implementata.","no_value":"No","yes_value":"Sì","generic_error":"Spiacenti! C'è stato un problema.","generic_error_with_reason":"Si è verificato un errore: %{error}","sign_up":"Iscriviti","log_in":"Accedi","age":"Età","joined":"Iscritto","admin_title":"Amministrazione","flags_title":"Segnalazioni","show_more":"Altro","show_help":"opzioni","links":"Link","links_lowercase":{"one":"collegamento","other":"collegamenti"},"faq":"FAQ","guidelines":"Linee Guida","privacy_policy":"Tutela Privacy","privacy":"Privacy","terms_of_service":"Termini di Servizio","mobile_view":"Visualizzazione Mobile","desktop_view":"Visualizzazione Desktop","you":"Tu","or":"oppure","now":"ora","read_more":"continua","more":"Più","less":"Meno","never":"mai","every_30_minutes":"ogni 30 minuti","every_hour":"ogni ora","daily":"giornaliero","weekly":"settimanale","every_two_weeks":"bisettimanale","every_three_days":"ogni tre giorni","max_of_count":"massimo di {{count}}","alternation":"o","character_count":{"one":"{{count}} carattere","other":"{{count}} caratteri"},"suggested_topics":{"title":"Discussioni Suggerite","pm_title":"Messaggi Suggeriti"},"about":{"simple_title":"Informazioni","title":"Informazioni su %{title}","stats":"Statistiche del Sito","our_admins":"I Nostri Amministratori","our_moderators":"I Nostri Moderatori","stat":{"all_time":"Sempre","last_7_days":"ultimi 7 giorni","last_30_days":"ultimi 30 giorni"},"like_count":"Mi piace","topic_count":"Argomenti","post_count":"Messaggi","user_count":"Nuovi Utenti","active_user_count":"Utenti Attivi","contact":"Contattaci","contact_info":"Nel caso di un problema grave o urgente riguardante il sito, per favore contattaci all'indirizzo %{contact_info}."},"bookmarked":{"title":"Segnalibro","clear_bookmarks":"Cancella Segnalibri","help":{"bookmark":"Clicca per aggiungere un segnalibro al primo messaggio di questo argomento","unbookmark":"Clicca per rimuovere tutti i segnalibri a questo argomento"}},"bookmarks":{"not_logged_in":"spiacenti, devi essere connesso per aggiungere segnalibri ai messaggi","created":"hai inserito questo messaggio nei segnalibri.","not_bookmarked":"hai letto questo messaggio; clicca per inserirlo nei segnalibri","last_read":"questo è l'ultimo messaggio che hai letto; clicca per inserirlo nei segnalibri","remove":"Rimuovi Segnalibro","confirm_clear":"Sei sicuro di voler cancellare tutti segnalibri da questo argomento?"},"topic_count_latest":{"one":"{{count}} discussione nuova o aggiornata","other":"{{count}} argomenti nuovi o aggiornati."},"topic_count_unread":{"one":"{{count}} discussione non letta.","other":"{{count}} argomenti non letti."},"topic_count_new":{"one":"{{count}} nuovo argomento.","other":"{{count}} nuovi argomenti."},"click_to_show":"Clicca per visualizzare.","preview":"Anteprima","cancel":"annulla","save":"Salva modifiche","saving":"Salvataggio...","saved":"Salvato!","upload":"Carica","uploading":"In caricamento...","uploading_filename":"Sto caricando {{filename}}...","uploaded":"Caricato!","enable":"Attiva","disable":"Disattiva","undo":"Annulla","revert":"Ripristina","failed":"Fallito","switch_to_anon":"Avvia Modalità Anonima","switch_from_anon":"Esci Modalità Anonima","banner":{"close":"Nascondi questo banner.","edit":"Modifica questo annuncio \u003e\u003e"},"choose_topic":{"none_found":"Nessun argomento trovato.","title":{"search":"Cerca conversazioni per nome, indirizzo o numero:","placeholder":"digita il titolo della conversazione"}},"queue":{"topic":"Argomento:","approve":"Approva","reject":"Scarta","delete_user":"Elimina Utente","title":"Richiede Approvazione","none":"Non ci sono messaggi da revisionare.","edit":"Modifica","cancel":"Annulla","view_pending":"vedi messaggi in attesa","has_pending_posts":{"one":"Questo argomento ha \u003cb\u003e1\u003c/b\u003e messaggio in attesa di approvazione","other":"Questo argomento ha \u003cb\u003e{{count}}\u003c/b\u003e messaggi in attesa di approvazione"},"confirm":"Salva Modifiche","delete_prompt":"Sei sicuro di voler eliminare \u003cb\u003e%{username}\u003c/b\u003e? Ciò cancellerà tutti i suoi messaggi e bloccherà il suo indirizzo email e l'indirizzo IP.","approval":{"title":"Il Messaggio Richiede Approvazione","description":"Abbiamo ricevuto il tuo messaggio ma prima che appaia è necessario che venga approvato da un moderatore. Per favore sii paziente.","pending_posts":{"one":"Hai \u003cstrong\u003e1\u003c/strong\u003e messaggio in attesa.","other":"Hai \u003cstrong\u003e{{count}}\u003c/strong\u003e messaggi in attesa."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha pubblicato \u003ca href='{{topicUrl}}'\u003el'argomento\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eTu\u003c/a\u003e hai pubblicato \u003ca href='{{topicUrl}}'\u003el'argomento\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha risposto a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eTu\u003c/a\u003e hai risposto a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha risposto \u003ca href='{{topicUrl}}'\u003eall'argomento\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e hai risposto \u003ca href='{{topicUrl}}'\u003eall'argomento\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTu\u003c/a\u003e hai menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003eTu\u003c/a\u003e hai menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTu\u003c/a\u003e hai menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Pubblicato da \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Pubblicato da \u003ca href='{{userUrl}}'\u003ete\u003c/a\u003e","sent_by_user":"Inviato da \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Inviato da \u003ca href='{{userUrl}}'\u003ete\u003c/a\u003e"},"directory":{"filter_name":"filtra per nome utente","title":"Utenti","likes_given":"Dati","likes_received":"Ricevuti","topics_entered":"Visualizzati","topics_entered_long":"Argomenti Visualizzati","time_read":"Tempo di Lettura","topic_count":"Argomenti","topic_count_long":"Argomenti Creati","post_count":"Risposte","post_count_long":"Risposte Inviate","no_results":"Nessun risultato trovato.","days_visited":"Visite","days_visited_long":"Giorni Frequenza","posts_read":"Letti","posts_read_long":"Messaggi Letti","total_rows":{"one":"1 utente","other":"%{count} utenti"}},"groups":{"empty":{"posts":"Non ci sono messaggi dai membri di questo gruppo.","members":"Non ci sono membri in questo gruppo.","mentions":"Non ci sono menzioni a questo gruppo.","messages":"Non ci sono messaggi per questo gruppo.","topics":"Non ci sono argomenti da membri di questo gruppo."},"add":"Aggiungi","selector_placeholder":"Aggiungi membri","owner":"proprietario","visible":"Il Gruppo è visibile a tutti gli utenti","index":"Gruppi","title":{"one":"gruppo","other":"gruppi"},"members":"Membri","topics":"Argomenti","posts":"Messaggi","mentions":"Menzioni","messages":"Messaggi","alias_levels":{"title":"Chi può inviare @menzionare e inviare messaggi a questo gruppo?","nobody":"Nessuno","only_admins":"Solo gli amministratori","mods_and_admins":"Solo i moderatori e gli amministratori","members_mods_and_admins":"Solo i membri del gruppo, i moderatori e gli amministratori","everyone":"Tutti"},"trust_levels":{"title":"Livello di esperienza automaticamente assegnato ai membri quando vengono aggiunti:","none":"Nessuno"},"notifications":{"watching":{"title":"In osservazione","description":"Verrai avvertito per ogni nuovo messaggio, e verrà mostrato il conteggio delle nuove risposte."},"watching_first_post":{"title":"Osservando Primo Messaggio","description":"Sarai avvertito soltanto per il primo messaggio in ogni nuovo argomento in questo gruppo."},"tracking":{"title":"Seguendo","description":"Verrai avvertito se qualcuno menziona il tuo @nome o ti risponde, e verrà mostrato un conteggio delle nuove risposte."},"regular":{"title":"Esperto","description":"Verrai avvertito se qualcuno menziona il tuo @nome o ti risponde."},"muted":{"title":"Silenziato","description":"Non verrai mai avvertito per i nuovi argomenti in questo gruppo."}}},"user_action_groups":{"1":"Mi piace - Assegnati","2":"Mi piace - Ricevuti","3":"Segnalibri","4":"Argomenti","5":"Risposte","6":"Risposte","7":"Menzioni","9":"Citazioni","11":"Modifiche","12":"Inviati","13":"Posta in arrivo","14":"In Attesa"},"categories":{"all":"tutte le categorie","all_subcategories":"tutte","no_subcategory":"nessuno","category":"Categoria","category_list":"Visualizza l'elenco delle categorie","reorder":{"title":"Riordina Categorie","title_long":"Riorganizza l'elenco di categorie","fix_order":"Posizioni Fisse","fix_order_tooltip":"Non tutte le categorie hanno un numero di posizionamento univoco, ciò potrebbe causare risultati inattesi.","save":"Salva Ordinamento","apply_all":"Applica","position":"Posizione"},"posts":"Messaggi","topics":"Argomenti","latest":"Più recenti","latest_by":"i più recenti di","toggle_ordering":"inverti l'ordinamento","subcategories":"Sottocategorie","topic_sentence":{"one":"1 argomento","other":"%{count} argomenti"},"topic_stat_sentence":{"one":"%{count} nuovo argomento nell'ultimo %{unit}.","other":"%{count} nuovi argomenti nell'ultimo %{unit}."}},"ip_lookup":{"title":"Ricerca Indirizzo IP","hostname":"Hostname","location":"Località","location_not_found":"(sconosciuto)","organisation":"Organizzazione","phone":"Telefono","other_accounts":"Altri account con questo indirizzo IP:","delete_other_accounts":"Cancella %{count}","username":"nome utente","trust_level":"TL","read_time":"durata lettura","topics_entered":"argomenti visualizzati","post_count":"n° messaggi","confirm_delete_other_accounts":"Sicuro di voler cancellare questi account?"},"user_fields":{"none":"(scegli un'opzione)"},"user":{"said":"{{username}}:","profile":"Profilo","mute":"Ignora","edit":"Modifica opzioni","download_archive":"Scarica i miei messaggi","new_private_message":"Nuovo Messaggio","private_message":"Messaggio","private_messages":"Messaggi","activity_stream":"Attività","preferences":"Opzioni","expand_profile":"Espandi","bookmarks":"Segnalibri","bio":"Su di me","invited_by":"Invitato Da","trust_level":"Livello Esperienza","notifications":"Notifiche","statistics":"Statistiche","desktop_notifications":{"label":"Notifiche Desktop","not_supported":"Spiacenti, le notifiche non sono supportate su questo browser.","perm_default":"Attiva Notifiche","perm_denied_btn":"Permesso Negato","perm_denied_expl":"Hai negato il permesso per le notifiche. Autorizza le notifiche tramite le impostazioni del tuo browser.","disable":"Disabilita Notifiche","enable":"Abilita Notifiche","each_browser_note":"Nota: devi modificare questa impostazione per ogni browser che utilizzi."},"dismiss_notifications":"Chiudi Tutti","dismiss_notifications_tooltip":"Imposta tutte le notifiche non lette come lette ","disable_jump_reply":"Non saltare al mio messaggio dopo la mia risposta","dynamic_favicon":"Visualizza il conteggio degli argomenti nuovi / aggiornati sull'icona del browser","external_links_in_new_tab":"Apri tutti i link esterni in nuove schede","enable_quoting":"Abilita \"rispondi quotando\" per il testo evidenziato","change":"cambia","moderator":"{{user}} è un moderatore","admin":"{{user}} è un amministratore","moderator_tooltip":"Questo utente è un moderatore","admin_tooltip":"Questo utente è un amministratore","blocked_tooltip":"Questo utente è bloccato","suspended_notice":"Questo utente è sospeso fino al {{date}}.","suspended_reason":"Motivo: ","github_profile":"Github","tag_settings":"Etichette","watched_tags":"Osservate","muted_tags":"Silenziati","watched_categories":"Osservate","tracked_categories":"Seguite","muted_categories":"Silenziate","muted_categories_instructions":"Non ti verrà notificato nulla sui nuovi argomenti in queste categorie, e non compariranno nell'elenco Ultimi.","delete_account":"Cancella il mio account","delete_account_confirm":"Sei sicuro di voler cancellare il tuo account in modo permanente? Questa azione non può essere annullata!","deleted_yourself":"Il tuo account è stato eliminato con successo.","delete_yourself_not_allowed":"Non puoi eliminare il tuo account in questo momento. Contatta un amministratore e chiedigli di cancellarlo per te.","unread_message_count":"Messaggi","admin_delete":"Cancella","users":"Utenti","muted_users":"Silenziati","muted_users_instructions":"Occulta tutte le notifiche da questi utenti.","muted_topics_link":"Mostra argomenti silenziati","automatically_unpin_topics":"Spunta automaticamente gli argomenti quando arrivi in fondo.","staff_counters":{"flags_given":"segnalazioni utili","flagged_posts":"messaggi segnalati","deleted_posts":"messaggi cancellati","suspensions":"sospensioni","warnings_received":"avvisi"},"messages":{"all":"Tutti","inbox":"In arrivo","sent":"Spediti","archive":"Archiviati","groups":"I Miei Gruppi","bulk_select":"Seleziona messaggi","move_to_inbox":"Sposta in arrivo","move_to_archive":"Archivia","failed_to_move":"Errore nello spostare i messaggi selezionati (forse la tua connessione non è attiva)","select_all":"Seleziona Tutti"},"change_password":{"success":"(email inviata)","in_progress":"(invio email in corso)","error":"(errore)","action":"Invia l'email per il ripristino della password","set_password":"Imposta Password"},"change_about":{"title":"Modifica i dati personali","error":"Si è verificato un errore durante la modifica del valore."},"change_username":{"title":"Cambia Utente","taken":"Spiacenti, questo nome utente è già riservato.","error":"C'è stato un problema nel cambio del tuo nome utente.","invalid":"Nome utente non valido: usa solo lettere e cifre"},"change_email":{"title":"Cambia email","taken":"Spiacenti, questa email non è disponibile.","error":"C'è stato un errore nel cambio dell'email; potrebbe essere già usata da un altro utente.","success":"Abbiamo inviato una email a questo indirizzo. Segui le indicazioni di conferma."},"change_avatar":{"title":"Cambia l'immagine del tuo profilo","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basato su","gravatar_title":"Cambia il tuo avatar sul sito Gravatar","refresh_gravatar_title":"Ricarica il tuo Gravatar","letter_based":"Immagine del profilo assegnata dal sistema","uploaded_avatar":"Immagine personalizzata","uploaded_avatar_empty":"Aggiungi un'immagine personalizzata","upload_title":"Carica la tua foto","upload_picture":"Carica Immagine","image_is_not_a_square":"Attenzione: abbiamo ritagliato l'immagine; la larghezza e l'altezza non erano uguali.","cache_notice":"Hai cambiato correttamente la tua immagine di profilo ma potrebbe volerci un po' prima di vederla apparire a causa della cache del browser."},"change_profile_background":{"title":"Sfondo Profilo","instructions":"Gli sfondi del profilo saranno centrati e avranno per difetto un'ampiezza di 850px."},"change_card_background":{"title":"Sfondo Scheda Utente","instructions":"Le immagini di sfondo saranno centrate e per difetto avranno un'ampiezza di 590px."},"email":{"title":"Email","instructions":"Mai mostrato pubblicamente","ok":"Ti invieremo una email di conferma","invalid":"Inserisci un indirizzo email valido","authenticated":"{{provider}} ha autenticato la tua email","frequency_immediately":"Ti invieremo immediatamente una email se non hai letto ciò per cui ti stiamo scrivendo.","frequency":{"one":"TI invieremo un email solo se non ti avremo visto nell'ultimo minuto.","other":"Ti invieremo una email solo se non ti si vede da almeno {{count}} minuti."}},"name":{"title":"Nome","instructions":"Nome completo (facoltativo)","instructions_required":"Il tuo nome completo","too_short":"Il nome è troppo breve","ok":"Il nome sembra adeguato"},"username":{"title":"Nome utente","instructions":"Deve essere univoco, senza spazi e breve","short_instructions":"Gli utenti possono citarti scrivendo @{{username}}","available":"Il nome utente è disponibile","global_match":"L'email corrisponde al nome utente registrato","global_mismatch":"Già registrato. Prova {{suggestion}}?","not_available":"Non disponibile. Prova {{suggestion}}?","too_short":"Il nome utente è troppo corto","too_long":"Il nome utente è troppo lungo","checking":"Controllo la disponibilità del nome utente...","enter_email":"Nome utente trovato; inserisci l'email corrispondente","prefilled":"L'email corrisponde al nome utente registrato"},"locale":{"title":"Lingua dell'interfaccia","instructions":"Lingua dell'interfaccia utente. Cambierà quando aggiornerai la pagina.","default":"(default)"},"password_confirmation":{"title":"Ripeti la password"},"last_posted":"Ultimo Messaggio","last_emailed":"Ultima email inviata","last_seen":"Ultima visita","created":"Membro da","log_out":"Esci","location":"Località","card_badge":{"title":"Distintivo Scheda Utente"},"website":"Sito Web","email_settings":"Email","like_notification_frequency":{"title":"Notifica alla ricezione di \"Mi piace\".","always":"Sempre","first_time_and_daily":"La prima volta che un messaggio riceve un \"Mi piace\" e giornalmente","first_time":"La prima volta che un messaggio riceve un \"Mi piace\"","never":"Mai"},"email_previous_replies":{"title":"Includi risposte precedenti al fondo delle email","unless_emailed":"a meno che non sia stato già inviato","always":"sempre","never":"mai"},"email_digests":{"every_30_minutes":"ogni 30 minuti","every_hour":"ogni ora","daily":"ogni giorno","every_three_days":"ogni tre giorni","weekly":"ogni settimana","every_two_weeks":"ogni due settimane"},"email_in_reply_to":"Nelle email includi un estratto delle risposte al messaggio","email_direct":"Inviami un'email quando qualcuno mi cita, risponde a un mio messaggio, menziona il mio @nome o mi invita ad un argomento","email_private_messages":"Inviami una email quando qualcuno mi scrive un messaggio","email_always":"Inviami notifiche via email anche quando sono collegato al sito","other_settings":"Altro","categories_settings":"Categorie","new_topic_duration":{"label":"Considera un argomento \"nuovo\" se","not_viewed":"non ancora visti","last_here":"è stato creato dopo la mia ultima visita","after_1_day":"creato nell'ultimo giorno","after_2_days":"creato negli ultimi 2 giorni","after_1_week":"creato nell'ultima settimana","after_2_weeks":"creato nelle ultime 2 settimane"},"auto_track_topics":"Segui automaticamente gli argomenti che leggo","auto_track_options":{"never":"mai","immediately":"Immediatamente","after_30_seconds":"dopo 30 secondi","after_1_minute":"dopo 1 minuto","after_2_minutes":"dopo 2 minuti","after_3_minutes":"dopo 3 minuti","after_4_minutes":"dopo 4 minuti","after_5_minutes":"dopo 5 minuti","after_10_minutes":"dopo 10 minuti"},"invited":{"search":"digita per cercare inviti...","title":"Inviti","user":"Utente Invitato","sent":"Spedito","none":"Non ci sono inviti in sospeso da visualizzare.","truncated":{"one":"Mostro il primo invito.","other":"Mostro i primi {{count}} inviti."},"redeemed":"Inviti Accettati","redeemed_tab":"Riscattato","redeemed_tab_with_count":"Riscattato ({{count}})","redeemed_at":"Accettato","pending":"Inviti in sospeso","pending_tab":"In sospeso","pending_tab_with_count":"In sospeso ({{count}})","topics_entered":"Argomenti Visti","posts_read_count":"Messaggi Letti","expired":"L'invito è scaduto.","rescind":"Rimuovi","rescinded":"Invito revocato","reinvite":"Rinvia Invito","reinvited":"Invito rinviato","time_read":"Ora di Lettura","days_visited":"Presenza (giorni)","account_age_days":"Età dell'utente in giorni","create":"Invia un Invito","generate_link":"Copia il collegamento di invito","generated_link_message":"\u003cp\u003eIl collegamento di invito è stato generato con successo!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eIl collegamento sarà valido solo per la seguente email: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Non hai ancora invitato nessuno qui. Puoi inviare inviti individuali, o invitare un gruppo di persone caricando un \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003efile di invito di massa\u003c/a\u003e.","text":"Invito di Massa da File","uploading":"In caricamento...","success":"Il file è stato caricato con successo, riceverai un messaggio di notifica quando il processo sarà completato.","error":"Si è verificato un errore durante il caricamento {{filename}}': {{message}}"}},"password":{"title":"Password","too_short":"La password è troppo breve.","common":"Questa password è troppo comune.","same_as_username":"La tua password è uguale al tuo nome utente.","same_as_email":"La password coincide con l'email.","ok":"La password è adeguata","instructions":"Minimo %{count} caratteri."},"summary":{"title":"Riepilogo","stats":"Statistiche","time_read":"tempo di lettura","topic_count":{"one":"argomento creato","other":"argomenti creati"},"post_count":{"one":"messaggio creato","other":"messaggi creati"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e assegnato","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e assegnati"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e ricevuto","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e ricevuti"},"days_visited":{"one":"Giorno visitato","other":"giorni di frequenza"},"posts_read":{"one":"messaggio letto","other":"messaggi letti"},"bookmark_count":{"one":"segnalibro","other":"segnalibri"},"top_replies":"Migliori Risposte","no_replies":"Ancora nessuna risposta.","more_replies":"Altre Risposte","top_topics":"Migliori Argomenti","no_topics":"Ancora nessun argomento.","more_topics":"Altri Argomenti","top_badges":"Migliori Distintivi","no_badges":"Ancora nessun distintivo.","more_badges":"Altri Distintivi","top_links":"Migliori Collegamenti","no_links":"Ancora nessun collegamento.","no_likes":"Ancora nessun \"Mi piace\"."},"associated_accounts":"Login","ip_address":{"title":"Ultimo indirizzo IP"},"registration_ip_address":{"title":"Indirizzo IP di Registrazione"},"avatar":{"title":"Immagine Profilo","header_title":"profilo, messaggi, segnalibri e preferenze"},"title":{"title":"Titolo"},"filters":{"all":"Tutti"},"stream":{"posted_by":"Pubblicato da","sent_by":"Inviato da","private_message":"messaggio","the_topic":"l'argomento"}},"loading":" Caricamento...","errors":{"prev_page":"durante il caricamento","reasons":{"network":"Errore di Rete","server":"Errore del Server","forbidden":"Accesso Negato","unknown":"Errore","not_found":"Pagina Non Trovata"},"desc":{"network":"Per favore controlla la connessione.","network_fixed":"Sembra essere tornato.","server":"Codice di errore: {{status}}","forbidden":"Non hai i permessi per visualizzarlo.","not_found":"Oops, l'applicazione ha cercato di caricare una URL inesistente.","unknown":"Qualcosa è andato storto."},"buttons":{"back":"Torna Indietro","again":"Riprova","fixed":"Carica Pagina"}},"close":"Chiudi","assets_changed_confirm":"Questo sito è stato aggiornato. Aggiornare ora alla nuova versione?","logout":"Ti sei disconnesso.","refresh":"Ricarica","read_only_mode":{"enabled":"Questo sito è in modalità di sola lettura. Puoi continuare a navigare nel sito, ma le risposte, i \"Mi piace\" e altre azioni sono per il momento disabilitate.","login_disabled":"L'accesso è disabilitato quando il sito è in modalità di sola lettura.","logout_disabled":"Il logout è disabilitato quando il sito è in modalità di sola lettura."},"too_few_topics_and_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eCominciamo a discutere!\u003c/a\u003e Ci sono al momento \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e argomenti e \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e messaggi. I nuovi visitatori vogliono qualche discussione da leggere e a cui rispondere.","too_few_topics_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eCominciamo a discutere!\u003c/a\u003e Ci sono al momento \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e argomenti. I nuovi visitatori vogliono qualche discussione da leggere e a cui rispondere.","too_few_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eCominciamo a discutere!\u003c/a\u003e Ci sono al momento \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e argomenti e \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e messaggi. I nuovi visitatori vogliono qualche discussione da leggere e a cui rispondere.","learn_more":"per saperne di più...","year":"all'anno","year_desc":"argomenti creati negli ultimi 365 giorni","month":"al mese","month_desc":"argomenti creati negli ultimi 30 giorni","week":"a settimana","week_desc":"argomenti creati negli ultimi 7 giorni","day":"al giorno","first_post":"Primo messaggio","mute":"Ignora","unmute":"Attiva","last_post":"Ultimo messaggio","last_reply_lowercase":"ultima risposta","replies_lowercase":{"one":"risposta","other":"risposte"},"signup_cta":{"sign_up":"Iscriviti","hide_session":"Ricordamelo domani","hide_forever":"no grazie","hidden_for_session":"Ok, te lo chiederò domani. Puoi sempre usare \"Accedi\" per creare un account.","intro":"Ciao! :heart_eyes: A quanto pare ti sta piacendo la discussione, ma non sei ancora iscritto.","value_prop":"Quando hai un account ci ricordiamo esattamente cosa stavi leggendo, così potrai riprendere da dove ti eri fermato. Inoltre ricevi le notifiche, sia qui sia via email, ogni volta che ci saranno nuovi messaggi. Inoltre potrai metterei i \"Mi piace\" ai messaggi e condividerne l'apprezzamento. :heartbeat:"},"summary":{"enabled_description":"Stai visualizzando un riepilogo dell'argomento: è la comunità a determinare quali sono i messaggi più interessanti.","description":"Ci sono \u003cb\u003e{{replyCount}}\u003c/b\u003e risposte.","description_time":"Ci sono \u003cb\u003e{{replyCount}}\u003c/b\u003e risposte con un tempo stimato di lettura di \u003cb\u003e{{readingTime}} minuti\u003c/b\u003e.","enable":"Riassumi Questo Argomento","disable":"Mostra Tutti i Messaggi"},"deleted_filter":{"enabled_description":"Questo argomento contiene messaggi eliminati, che sono quindi nascosti.","disabled_description":"I messaggi eliminati di questo argomento sono ora visibili.","enable":"Nascondi Messaggi Eliminati","disable":"Mostra Messaggi Eliminati"},"private_message_info":{"title":"Messaggio","invite":"Invita altri utenti...","remove_allowed_user":"Davvero vuoi rimuovere {{name}} da questo messaggio?"},"email":"Email","username":"Nome utente","last_seen":"Ultima visita","created":"Creato","created_lowercase":"creato","trust_level":"Livello Esperienza","search_hint":"nome utente, email o indirizzo IP","create_account":{"title":"Crea Nuovo Account","failed":"Qualcosa non ha funzionato. Forse questa email è già registrata, prova a usare il link di recupero password"},"forgot_password":{"title":"Reimposta Password","action":"Ho dimenticato la password","invite":"Inserisci il nome utente o l'indirizzo email. Ti manderemo un'email per l'azzeramento della password.","reset":"Azzera Password","complete_username":"Se un account corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e, a breve dovresti ricevere un'email con le istruzioni per ripristinare la tua password.","complete_email":"Se un account corrisponde a \u003cb\u003e%{email}\u003c/b\u003e,  a breve dovresti ricevere un'email contenente le istruzioni per ripristinare la password.","complete_username_found":"C'è un account che corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e, a breve dovresti ricevere una email con le istruzioni per reimpostare la tua password. ","complete_email_found":"C'è un account che corrisponde alla email \u003cb\u003e%{email}\u003c/b\u003e, a breve dovresti ricevere una email con le istruzioni per reimpostare la tua password. ","complete_username_not_found":"Nessun account corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nessun account corrisponde alla email \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Accedi","username":"Utente","password":"Password","email_placeholder":"email o nome utente","caps_lock_warning":"Il Blocco Maiuscole è attivo","error":"Errore sconosciuto","rate_limit":"Per favore attendi prima di provare nuovamente ad accedere.","blank_username_or_password":"Per favore inserisci la tua email o il tuo nome utente, e la password.","reset_password":"Azzera Password","logging_in":"Connessione in corso...","or":"Oppure","authenticating":"Autenticazione...","awaiting_confirmation":"Il tuo account è in attesa di attivazione, usa il collegamento \"password dimenticata\" per ricevere una nuova email di attivazione.","awaiting_approval":"Il tuo account non è stato ancora approvato da un membro dello staff. Ti invieremo un'email non appena verrà approvato.","requires_invite":"Spiacenti, l'accesso a questo forum e solo ad invito.","not_activated":"Non puoi ancora effettuare l'accesso. Abbiamo inviato un'email di attivazione a \u003cb\u003e{{sentTo}}\u003c/b\u003e. Per favore segui le istruzioni contenute nell'email per attivare l'account.","not_allowed_from_ip_address":"Non puoi collegarti con questo indirizzo IP.","admin_not_allowed_from_ip_address":"Non puoi collegarti come amministratore dal quell'indirizzo IP.","resend_activation_email":"Clicca qui per inviare nuovamente l'email di attivazione.","sent_activation_email_again":"Ti abbiamo mandato un'altra email di attivazione su \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Potrebbero essere necessari alcuni minuti di attesa; assicurati di controllare anche la cartella dello spam.","to_continue":"Per favore accedi","preferences":"Devi effettuare l'accesso per cambiare le impostazioni.","forgot":"Non ricordo i dettagli del mio account","google":{"title":"con Google","message":"Autenticazione tramite Google (assicurati che il blocco pop up non sia attivo)"},"google_oauth2":{"title":"con Google","message":"Autenticazione tramite Google (assicurati che il blocco pop up non siano attivo)"},"twitter":{"title":"con Twitter","message":"Autenticazione con Twitter (assicurati che il blocco pop up non sia attivo)"},"instagram":{"title":"con Instagram","message":"Autenticazione con Instagram (assicurati che il blocco pop up non sia attivo)"},"facebook":{"title":"con Facebook","message":"Autenticazione con Facebook (assicurati che il blocco pop up non sia attivo)"},"yahoo":{"title":"con Yahoo","message":"Autenticazione con Yahoo (assicurati che il blocco pop up non sia attivo)"},"github":{"title":"con GitHub","message":"Autenticazione con GitHub (assicurati che il blocco pop up non sia attivo)"}},"shortcut_modifier_key":{"shift":"Maiusc","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"altro...","options":"Opzioni","whisper":"sussurra","add_warning":"Questo è un avvertimento ufficiale.","toggle_whisper":"Attiva/Disattiva Sussurri","posting_not_on_topic":"A quale argomento vuoi rispondere?","saving_draft_tip":"salvataggio...","saved_draft_tip":"salvato","saved_local_draft_tip":"salvato in locale","similar_topics":"Il tuo argomento è simile a...","drafts_offline":"bozze offline","error":{"title_missing":"Il titolo è richiesto","title_too_short":"Il titolo deve essere lungo almeno {{min}} caratteri","title_too_long":"Il titolo non può essere più lungo di {{max}} caratteri","post_missing":"Il messaggio non può essere vuoto","post_length":"Il messaggio deve essere lungo almeno {{min}} caratteri","try_like":"Hai provato il pulsante \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Devi scegliere una categoria"},"save_edit":"Salva Modifiche","reply_original":"Rispondi all'Argomento Originale","reply_here":"Rispondi Qui","reply":"Rispondi","cancel":"Annulla","create_topic":"Crea Argomento","create_pm":"Messaggio","title":"O premi Ctrl+Enter","users_placeholder":"Aggiunti un utente","title_placeholder":"In breve, di cosa tratta questo argomento?","edit_reason_placeholder":"perché stai scrivendo?","show_edit_reason":"(aggiungi motivo della modifica)","reply_placeholder":"Scrivi qui. Per formattare il testo usa Markdown, BBCode o HTML. Trascina o incolla le immagini.","view_new_post":"Visualizza il tuo nuovo messaggio.","saving":"Salvataggio","saved":"Salvato!","saved_draft":"Hai un messaggio in bozza in sospeso. Seleziona per riprendere la modifica.","uploading":"In caricamento...","show_preview":"visualizza anteprima \u0026raquo;","hide_preview":"\u0026laquo; nascondi anteprima","quote_post_title":"Cita l'intero messaggio","bold_title":"Grassetto","bold_text":"testo in grassetto","italic_title":"Italic","italic_text":"testo italic","link_title":"Collegamento","link_description":"inserisci qui la descrizione del collegamento","link_dialog_title":"Inserisci il collegamento","link_optional_text":"titolo opzionale","link_url_placeholder":"http://esempio.com","quote_title":"Citazione","quote_text":"Citazione","code_title":"Testo preformattato","code_text":"rientra il testo preformattato di 4 spazi","paste_code_text":"digita o incolla il codice qui","upload_title":"Carica","upload_description":"inserisci qui la descrizione del caricamento","olist_title":"Elenco Numerato","ulist_title":"Elenco Puntato","list_item":"Elemento lista","heading_title":"Intestazione","heading_text":"Intestazione","hr_title":"Linea Orizzontale","help":"Aiuto Inserimento Markdown","toggler":"nascondi o mostra il pannello di editing","modal_ok":"OK","modal_cancel":"Annulla","cant_send_pm":"Spiacenti, non puoi inviare un messaggio a %{username}.","admin_options_title":"Impostazioni dello staff opzionali per l'argomento","auto_close":{"label":"Tempo per auto-chiusura argomento:","error":"Inserisci un valore valido.","based_on_last_post":"Non chiudere finché l'ultimo messaggio dell'argomento non è almeno altrettanto vecchio.","all":{"examples":"Inserisci un numero di ore (24), un orario assoluto (17:30) o un timestamp (2013-11-22 14:00)."},"limited":{"units":"(n° di ore)","examples":"Inserisci il numero di ore (24)."}}},"notifications":{"title":"notifiche di menzioni @nome, risposte ai tuoi messaggi e argomenti ecc.","none":"Impossibile caricare le notifiche al momento.","more":"visualizza le notifiche precedenti","total_flagged":"totale argomenti segnalati","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003eha accettato il tuo invito\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e ha spostato {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eGuadagnato '{{description}}'\u003c/p\u003e","alt":{"mentioned":"Menzionato da","quoted":"Citato da","replied":"Risposto","posted":"Messaggio da","edited":"Modifica il tuo messaggio da","liked":"Ha assegnato un \"Mi piace\" al tuo messaggio","private_message":"Messaggio privato da","invited_to_private_message":"Invitato a un messaggio privato da","invited_to_topic":"Invitato a un argomento da","invitee_accepted":"Invito accettato da","moved_post":"Il tuo messaggio è stato spostato da","linked":"Collegamento al tuo messaggio","granted_badge":"Distintivo assegnato","group_message_summary":"Messaggi nel gruppo in arrivo"},"popup":{"mentioned":"{{username}} ti ha menzionato in \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} ti ha menzionato in \"{{topic}}\" - {{site_title}}","quoted":"{{username}} ti ha citato in \"{{topic}}\" - {{site_title}}","replied":"{{username}} ti ha risposto in \"{{topic}}\" - {{site_title}}","posted":"{{username}} ha pubblicato in \"{{topic}}\" - {{site_title}}","private_message":"{{username}} ti ha inviato un messaggio privato in \"{{topic}}\" - {{site_title}}","linked":"{{username}} ha aggiunto un collegamento a un tuo messaggio da \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Aggiungi un'immagine","title_with_attachments":"Aggiungi un'immagine o un file","from_my_computer":"Dal mio dispositivo","from_the_web":"Dal web","remote_tip":"collegamento all'immagine","remote_tip_with_attachments":"collegamento all'immagine o al file {{authorized_extensions}}","local_tip":"seleziona immagini dal tuo dispositivo","local_tip_with_attachments":"seleziona immagini o file dal tuo dispositivo {{authorized_extensions}}","hint":"(puoi anche trascinarle nell'editor per caricarle)","hint_for_supported_browsers":"puoi fare il \"trascina e rilascia\" o incollare immagini nell'editor","uploading":"In caricamento","select_file":"Seleziona File","image_link":"collegamento a cui la tua immagine punterà"},"search":{"sort_by":"Ordina per","relevance":"Rilevanza","latest_post":"Ultimo Messaggio","most_viewed":"Più Visti","most_liked":"Con più \"Mi Piace\"","select_all":"Seleziona Tutto","clear_all":"Cancella Tutto","result_count":{"one":"1 risultato per \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} risultati per \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"cerca argomenti, messaggi, utenti o categorie","no_results":"Nessun risultato trovato.","no_more_results":"Nessun altro risultato trovato.","search_help":"Cerca aiuto","searching":"Ricerca in corso...","post_format":"#{{post_number}} da {{username}}","context":{"user":"Cerca messaggi di @{{username}}","topic":"Cerca in questo argomento","private_messages":"Cerca messaggi"}},"hamburger_menu":"vai ad un'altra lista di argomenti o categoria","new_item":"nuovo","go_back":"indietro","not_logged_in_user":"pagina utente con riassunto delle attività correnti e delle impostazioni","current_user":"vai alla pagina utente","topics":{"bulk":{"unlist_topics":"Deselezione Topics","reset_read":"Reimposta Lettura","delete":"Elimina Argomenti","dismiss":"Chiudi","dismiss_read":"Chiudi tutti i non letti","dismiss_button":"Chiudi...","dismiss_tooltip":"Chiudi solo gli ultimi messaggi o smetti di seguire gli argomenti","also_dismiss_topics":"Smetti di seguire questi argomenti così che non compariranno più come non letti per me","dismiss_new":"Chiudi Nuovo","toggle":"commuta la selezione multipla degli argomenti","actions":"Azioni Multiple","change_category":"Cambia Categoria","close_topics":"Chiudi Argomenti","archive_topics":"Archivia Argomenti","notification_level":"Cambia Livello Notifiche","choose_new_category":"Scegli la nuova categoria per gli argomenti:","selected":{"one":"Hai selezionato \u003cb\u003e1\u003c/b\u003e argomento.","other":"Hai selezionato \u003cb\u003e{{count}}\u003c/b\u003e argomenti."},"change_tags":"Cambia Etichette","choose_new_tags":"Scegli nuove etichette per i seguenti argomenti:","changed_tags":"Le etichette per quegli argomenti sono state cambiate."},"none":{"unread":"Non ci sono argomenti non letti.","new":"Non ci sono nuovi argomenti.","read":"Non hai ancora letto nessun argomento.","posted":"Non hai ancora scritto in nessun argomento.","latest":"Non ci sono argomenti più recenti. Ciò è triste.","hot":"Non ci sono argomenti caldi.","bookmarks":"Non hai ancora argomenti nei segnalibri.","category":"Non ci sono argomenti in {{category}}.","top":"Non ci sono argomenti di punta.","search":"Non ci sono risultati della ricerca.","educate":{"new":"\u003cp\u003eQui compaiono i nuovi argomenti.\u003c/p\u003e\u003cp\u003ePer difetto, gli argomenti vengono considerati nuovi e mostrano l'indicatore \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enuovo\u003c/span\u003e se sono stati creati negli ultimi 2 giorni.\u003c/p\u003e\u003cp\u003ePuoi cambiare questa configurazione nelle tue \u003ca href=\"%{userPrefsUrl}\"\u003epreferenze\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eQui compaiono gli argomenti che non hai letto.\u003c/p\u003e\u003cp\u003ePer difetto, gli argomenti sono considerati non letti e ne viene mostrato un conteggio \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e se hai:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreato l'argomento\u003c/li\u003e\u003cli\u003eRisposto all'argomento\u003c/li\u003e\u003cli\u003eLetto l'argomento per più di 4 minuti\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOppure se hai esplicitamente impostato l'argomento come Seguito o Osservato usando il pannello delle notifiche in fondo ad ogni argomento.\u003c/p\u003e\u003cp\u003ePuoi cambiare questa configurazione nelle tue \u003ca href=\"%{userPrefsUrl}\"\u003epreferenze\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Non ci sono altri argomenti più recenti.","hot":"Non ci sono altri argomenti caldi.","posted":"Non ci sono altri argomenti pubblicati.","read":"Non ci sono altri argomenti letti.","new":"Non ci sono altri argomenti nuovi.","unread":"Non ci sono altri argomenti non letti","category":"Non ci sono altri argomenti nella categoria {{category}}.","top":"Non ci sono altri argomenti di punta.","bookmarks":"Non ci sono ulteriori argomenti nei segnalibri.","search":"Non ci sono altri risultati di ricerca."}},"topic":{"unsubscribe":{"stop_notifications":"Da ora riceverai meno notifiche per \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Lo stato delle tue notifiche è"},"create":"Nuovo Argomento","create_long":"Crea un nuovo Argomento","private_message":"Inizia a scrivere un messaggio","archive_message":{"help":"Sposta il messaggio nel tuo archivio","title":"Archivio"},"move_to_inbox":{"title":"Sposta in arrivo","help":"Sposta il messaggio di nuovo nella posta in arrivo"},"list":"Argomenti","new":"nuovo argomento","unread":"non letto","new_topics":{"one":"1 nuovo argomento","other":"{{count}} nuovi argomenti"},"unread_topics":{"one":"1 argomento non letto","other":"{{count}} argomenti non letti"},"title":"Argomento","invalid_access":{"title":"L'argomento è privato","description":"Spiacenti, non puoi accedere a questo argomento!","login_required":"Devi connetterti per vedere questo argomento."},"server_error":{"title":"Errore di caricamento dell'argomento","description":"Spiacenti, non è stato possibile caricare questo argomento, probabilmente per un errore di connessione. Per favore riprova. Se il problema persiste, faccelo sapere."},"not_found":{"title":"Argomento non trovato","description":"Spiacenti, non abbiamo trovato l'argomento. Forse è stato rimosso da un moderatore?"},"total_unread_posts":{"one":"c'è un post non letto in questa discussione","other":"hai {{count}} messagi non letti in questo argomento"},"unread_posts":{"one":"Hai 1 vecchio messaggio non letto in questo argomento","other":"hai {{count}} vecchi messaggi non letti in questo argomento"},"new_posts":{"one":"c'è 1 nuovo messaggio in questo argomento dalla tua ultima lettura","other":"ci sono {{count}} nuovi messaggi in questo argomento dalla tua ultima lettura"},"likes":{"one":"c'è 1 \"Mi piace\" in questo argomento","other":"ci sono {{count}} \"Mi piace\" in questo argomento"},"back_to_list":"Torna alla Lista Argomenti","options":"Opzioni Argomento","show_links":"mostra i collegamenti in questo argomento","toggle_information":"commuta i dettagli dell'argomento","read_more_in_category":"Vuoi saperne di più? Leggi altri argomenti in {{catLink}} o {{latestLink}}.","read_more":"Vuoi saperne di più? {{catLink}} o {{latestLink}}.","browse_all_categories":"Scorri tutte le categorie","view_latest_topics":"visualizza gli argomenti più recenti","suggest_create_topic":"Perché non crei un argomento?","jump_reply_up":"passa a una risposta precedente","jump_reply_down":"passa a una risposta successiva","deleted":"L'argomento è stato cancellato","auto_close_notice":"Questo argomento si chiuderà automaticamente %{timeLeft}.","auto_close_notice_based_on_last_post":"Questo argomento si chiuderà %{duration} dopo l'ultima risposta.","auto_close_title":"Impostazioni di auto-chiusura","auto_close_save":"Salva","auto_close_remove":"Non chiudere automaticamente questo argomento","progress":{"title":"Avanzamento dell'argomento","go_top":"alto","go_bottom":"basso","go":"vai","jump_bottom":"salta all'ultimo messaggio","jump_bottom_with_number":"Passa al messaggio %{post_number}","total":"totale messaggi","current":"messaggio corrente"},"notifications":{"reasons":{"3_6":"Riceverai notifiche perché stai osservando questa categoria.","3_5":"Riceverai notifiche poiché hai iniziato ad osservare questo argomento automaticamente.","3_2":"Riceverai notifiche perché stai osservando questo argomento.","3_1":"Riceverai notifiche perché hai creato questo argomento.","3":"Riceverai notifiche perché stai osservando questo argomento.","2_8":"Riceverai notifiche perché stai seguendo questa categoria.","2_4":"Riceverai notifiche perché hai pubblicato una risposta a questo argomento.","2_2":"Riceverai notifiche perché stai seguendo questo argomento.","2":"Riceverai notifiche perché \u003ca href=\"/users/{{username}}/preferences\"\u003ehai letto questo argomento\u003c/a\u003e.","1_2":"Riceverai notifiche se qualcuno menziona il tuo @nome o ti risponde.","1":"Riceverai notifiche se qualcuno menziona il tuo @nome o ti risponde.","0_7":"Stai ignorando tutte le notifiche di questa categoria.","0_2":"Stai ignorando tutte le notifiche di questo argomento.","0":"Stai ignorando tutte le notifiche di questo argomento."},"watching_pm":{"title":"In osservazione","description":"Riceverai una notifica per ogni nuova risposta a questo messaggio, e comparirà un conteggio delle nuove risposte."},"watching":{"title":"In osservazione","description":"Riceverai una notifica per ogni nuova risposta in questo argomento, e comparirà un conteggio delle nuove risposte."},"tracking_pm":{"title":"Seguito","description":"Per questo messaggio apparirà un conteggio delle nuove risposte. Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"tracking":{"title":"Seguito","description":"Per questo argomento apparirà un conteggio delle nuove risposte. Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"regular":{"title":"Normale","description":"Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"regular_pm":{"title":"Normale","description":"Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"muted_pm":{"title":"Silenziato","description":"Non ti verrà notificato nulla per questo messaggio."},"muted":{"title":"Silenziato","description":"Non riceverai mai notifiche o altro circa questo argomento e non apparirà nella sezione Ultimi."}},"actions":{"recover":"Ripristina Argomento","delete":"Cancella Argomento","open":"Apri Argomento","close":"Chiudi Argomento","multi_select":"Seleziona Messaggi...","auto_close":"Chiudi Automaticamente...","pin":"Appunta Argomento...","unpin":"Spunta Argomento...","unarchive":"De-archivia Argomento","archive":"Archivia Argomento","invisible":"Rendi Invisibile","visible":"Rendi Visibile","reset_read":"Reimposta Dati Letti"},"feature":{"pin":"Appunta Argomento","unpin":"Spunta Argomento","pin_globally":"Appunta Argomento Globalmente","make_banner":"Argomento Annuncio","remove_banner":"Rimuovi Argomento Annuncio"},"reply":{"title":"Rispondi","help":"inizia a scrivere una risposta a questo argomento"},"clear_pin":{"title":"Spunta","help":"Rimuovi la spunta da questo argomento, così non comparirà più in cima alla lista degli argomenti"},"share":{"title":"Condividi","help":"condividi un collegamento a questo argomento"},"flag_topic":{"title":"Segnala","help":"segnala questo argomento o invia una notifica privata","success_message":"Hai segnalato questo argomento con successo."},"feature_topic":{"title":"Poni argomento in primo piano","pin":"Poni questo argomento in cima alla categoria {{categoryLink}} fino a","confirm_pin":"Hai già {{count}} argomenti puntati. Troppi argomenti puntati potrebbero essere un peso per gli utenti nuovi o anonimi. Sicuro di voler puntare un altro argomento in questa categoria?","unpin":"Rimuovi questo argomento dalla cima della categoria {{categoryLink}}.","unpin_until":"Rimuovi questo argomento dalla cima della categoria {{categoryLink}} o attendi fino a \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Gli utenti possono spuntare gli argomenti individualmente per loro stessi.","pin_validation":"È richiesta una data per appuntare questo argomento.","not_pinned":"Non ci sono argomenti appuntati in {{categoryLink}}.","already_pinned":{"one":"Argomenti attualmente appuntati in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Argomenti attualmente appuntati in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Poni questo argomento in cima a tutte le liste di argomenti fino a","confirm_pin_globally":"Hai già {{count}} argomenti puntati globalmente. Troppi argomenti puntati potrebbero essere un peso per gli utenti nuovi o anonimi. Sicuro di voler puntare un altro argomento globalmente?","unpin_globally":"Togli questo argomento dalla cima degli altri argomenti.","unpin_globally_until":"Rimuovi questo argomento dalla cima di tutte le liste di argomenti o attendi fino a \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Gli utenti possono spuntare gli argomenti autonomamente per loro stessi.","not_pinned_globally":"Non ci sono argomenti appuntati globalmente.","already_pinned_globally":{"one":"Argomenti attualmente appuntati globalmente in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Argomenti attualmente appuntati globalmente {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Rendi questo argomento uno striscione che apparirà in cima a tutte le pagine.","remove_banner":"Rimuovi lo striscione che appare in cima a tutte le pagine.","banner_note":"Gli utenti possono rimuovere lo striscione chiudendolo. Solo un argomento alla volta può diventare uno striscione.","no_banner_exists":"Non c'è alcun argomento annuncio.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eC'è\u003c/strong\u003e attualmente un argomento annuncio."},"inviting":"Sto invitando...","invite_private":{"title":"Invita al Messaggio","email_or_username":"Email o Utente di chi invita","email_or_username_placeholder":"indirizzo email o nome utente","action":"Invita","success":"Abbiamo invitato l'utente a partecipare a questo messaggio.","error":"Spiacenti, si è verificato un errore durante l'invito dell'utente.","group_name":"nome gruppo"},"controls":"Impostazioni Argomento","invite_reply":{"title":"Invita","username_placeholder":"nome utente","action":"Invia Invito","help":"invita altri su questo argomento via email o tramite notifiche","to_forum":"Invieremo una breve email che permetterà al tuo amico di entrare subito cliccando un collegamento, senza bisogno di effettuare il collegamento.","sso_enabled":"Inserisci il nome utente della persona che vorresti invitare su questo argomento.","to_topic_blank":"Inserisci il nome utente o l'indirizzo email della persona che vorresti invitare su questo argomento.","to_topic_email":"Hai inserito un indirizzo email. Invieremo una email di invito che permetterà al tuo amico di rispondere subito a questo argomento.","to_topic_username":"Hai inserito un nome utente. Gli invieremo una notifica con un collegamento per invitarlo su questo argomento.","to_username":"Inserisci il nome utente della persona che vorresti invitare. Gli invieremo una notifica con un collegamento di invito a questo argomento.","email_placeholder":"nome@esempio.com","success_email":"Abbiamo inviato un invito via email a \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Ti avvertiremo quando l'invito verrà riscattato. Controlla la sezione \"inviti\" sulla tua pagina utente per tracciarne lo stato.","success_username":"Abbiamo invitato l'utente a partecipare all'argomento.","error":"Spiacenti, non siamo riusciti ad invitare questa persona. E' stata per caso già invitata (gli inviti sono limitati)? "},"login_reply":"Collegati per Rispondere","filters":{"n_posts":{"one":"1 post","other":"{{count}} messaggi"},"cancel":"Rimuovi filtro"},"split_topic":{"title":"Sposta in un nuovo argomento","action":"sposta in un nuovo argomento","topic_name":"Nome Nuovo Argomento","error":"Si è verificato un errore spostando il messaggio nel nuovo argomento.","instructions":{"one":"Stai per creare un nuovo argomento riempiendolo con il messaggio che hai selezionato.","other":"Stai per creare un nuovo argomento riempiendolo con i \u003cb\u003e{{count}}\u003c/b\u003e messaggi che hai selezionato."}},"merge_topic":{"title":"Sposta in Argomento Esistente","action":"sposta in un argomento esistente","error":"Si è verificato un errore nello spostare i messaggi nell'argomento.","instructions":{"one":"Per favore scegli l'argomento dove spostare il messaggio.","other":"Per favore scegli l'argomento di destinazione dove spostare i \u003cb\u003e{{count}}\u003c/b\u003e messaggi."}},"change_owner":{"title":"Cambia Proprietario dei Messaggi","action":"cambia proprietà","error":"Si è verificato un errore durante il cambio di proprietà dei messaggi.","label":"Nuovo Proprietario dei Messaggi","placeholder":"nome utente del nuovo proprietario","instructions":{"one":"Seleziona il nuovo proprietario del messaggio di \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Seleziona il nuovo proprietario dei {{count}} messaggi di \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Nota che ogni notifica circa questo messaggio non verrà trasferita al nuovo utente in modo retroattivo.\u003cbr\u003eAttenzione: al momento nessun dato messaggio-dipendente è stato trasferito al nuovo utente. Usare con cautela."},"change_timestamp":{"title":"Cambia Timestamp","action":"cambia timestamp","invalid_timestamp":"Il timestamp non può essere nel futuro.","error":"Errore durante la modifica del timestamp dell'argomento.","instructions":"Seleziona il nuovo timestamp per l'argomento. I messaggi nell'argomento saranno aggiornati in modo che abbiano lo stesso intervallo temporale."},"multi_select":{"select":"scegli","selected":"selezionati ({{count}})","select_replies":"seleziona +risposte","delete":"elimina i selezionati","cancel":"annulla selezione","select_all":"seleziona tutto","deselect_all":"deseleziona tutto","description":{"one":"Hai selezionato \u003cb\u003e1\u003c/b\u003e messaggio.","other":"Hai selezionato \u003cb\u003e{{count}}\u003c/b\u003e messaggi."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"rispondi citando","edit":"Modifica in corso {{link}} {{replyAvatar}} {{username}}","edit_reason":"Motivo:","post_number":"messaggio {{number}}","last_edited_on":"ultima modifica al messaggio:","reply_as_new_topic":"Rispondi come Argomento collegato","continue_discussion":"Continua la discussione da {{postLink}}:","follow_quote":"vai al messaggio citato","show_full":"Mostra Messaggio Completo","show_hidden":"Visualizza contenuto nascosto.","deleted_by_author":{"one":"(post eliminato dall'autore, sarà automaticamente cancellato in %{count} ore se non contrassegnato)","other":"(messaggio eliminato dall'autore, verrà automaticamente cancellato in %{count} ore se non segnalato)"},"expand_collapse":"espandi/raggruppa","gap":{"one":"visualizza 1 risposta nascosta","other":"visualizza {{count}} riposte nascoste"},"unread":"Messaggio non letto","has_replies":{"one":"{{count}} Risposta","other":"{{count}} Risposte"},"has_likes":{"one":"{{count}} \"Mi piace\"","other":"{{count}} \"Mi piace\""},"has_likes_title":{"one":"Una persona ha messo \"Mi piace\" a questo messaggio","other":"{{count}} persone hanno messo \"Mi piace\" a questo messaggio"},"has_likes_title_only_you":"hai messo \"Mi piace\" a questo messaggio","has_likes_title_you":{"one":"tu e un'altra persona avete messo \"Mi piace\" a questo messaggio","other":"tu e altre {{count}} persone avete messo \"Mi piace\" a questo messaggio"},"errors":{"create":"Spiacenti, si è verificato un errore nel creare il tuo messaggio. Prova di nuovo.","edit":"Spiacenti, si è verificato un errore nel modificare il tuo messaggio. Prova di nuovo.","upload":"Spiacenti, si è verificato un errore durante il caricamento del file. Prova di nuovo.","too_many_uploads":"Spiacenti, puoi caricare un solo file per volta.","too_many_dragged_and_dropped_files":"Spiacenti, puoi caricare solo 10 file alla volta.","upload_not_authorized":"Spiacenti, il file che stai cercando di caricare non è autorizzato (estensioni autorizzate: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Spiacenti, i nuovi utenti non possono caricare immagini.","attachment_upload_not_allowed_for_new_user":"Spiacenti, i nuovi utenti non possono caricare allegati.","attachment_download_requires_login":"Spiacenti, devi essere collegato per poter scaricare gli allegati."},"abandon":{"confirm":"Sicuro di voler abbandonare il tuo messaggio?","no_value":"No, mantienilo","yes_value":"Si, abbandona"},"via_email":"questo messaggio è arrivato via email","whisper":"questo messaggio è un sussurro privato per i moderatori","wiki":{"about":"questo messaggio è una guida"},"archetypes":{"save":"Opzioni di salvataggio"},"few_likes_left":"Grazie per aver condiviso l'amore! Hai ancora pochi \"Mi piace\" rimasti per oggi.","controls":{"reply":"inizia a comporre una risposta a questo messaggio","like":"metti \"Mi piace\" al messaggio","has_liked":"ti è piaciuto questo messaggio","undo_like":"rimuovi il \"Mi piace\"","edit":"modifica questo messaggio","edit_anonymous":"Spiacente, effettua l'accesso per poter modificare questo messaggio.","flag":"segnala privatamente questo messaggio o invia una notifica privata","delete":"cancella questo messaggio","undelete":"recupera questo messaggio","share":"condividi un collegamento a questo messaggio","more":"Di più","delete_replies":{"confirm":{"one":"Vuoi anche cancellare la risposta diretta a questo post?","other":"Vuoi anche cancellare le {{count}} risposte dirette a questo messaggio?"},"yes_value":"Si, cancella anche le risposte","no_value":"No, solo questo messaggio"},"admin":"azioni post-amministrazione","wiki":"Rendi Wiki","unwiki":"Rimuovi Wiki","convert_to_moderator":"Aggiungi Colore Staff","revert_to_regular":"Rimuovi Colore Staff","rebake":"Ricrea HTML","unhide":"Mostra nuovamente","change_owner":"Cambia Proprietà"},"actions":{"flag":"Segnala","defer_flags":{"one":"Ignora segnalazione","other":"Annulla segnalazioni"},"undo":{"off_topic":"Rimuovi segnalazione","spam":"Rimuovi segnalazione","inappropriate":"Rimuovi segnalazione","bookmark":"Annulla segnalibro","like":"Annulla il \"Mi piace\"","vote":"Rimuovi voto"},"people":{"off_topic":"l'hanno segnalato come fuori tema","spam":"l'hanno segnalato come spam","inappropriate":"l'hanno segnalato come inappropriato","notify_moderators":"hanno informato i moderatori","notify_user":"hanno inviato un messaggio","bookmark":"l'hanno aggiunto ai segnalibri","like":"hanno messo \"Mi piace\"","vote":"hanno votato"},"by_you":{"off_topic":"L'hai segnalato come fuori tema","spam":"L'hai segnalato come spam","inappropriate":"L'hai segnalato come inappropriato","notify_moderators":"L'hai segnalato per la moderazione","notify_user":"Hai inviato un messaggio a questo utente","bookmark":"Hai inserito questo messaggio nei segnalibri","like":"Ti piace","vote":"Hai votato per questo messaggio"},"by_you_and_others":{"off_topic":{"one":"Tu e un'altra persona lo avete contrassegnato come fuori tema","other":"Tu e {{count}} altre persone lo avete contrassegnato come fuori tema"},"spam":{"one":"Tu e un'altra persona lo avete contrassegnato come spam","other":"Tu e {{count}} altre persona lo avete contrassegnato come spam"},"inappropriate":{"one":"Tu e un'altra persona lo avete contrassegnato come non appropriato","other":"Tu e  {{count}} altre persone lo avete contrassegnato come non appropriato"},"notify_moderators":{"one":"Tu e un'altra persona lo avete contrassegnato per la moderazione","other":"Tu e {{count}} altre persone lo avete contrassegnato per la moderazione"},"notify_user":{"one":"Tu e un'altra persona avete inviato un messaggio a questo utente","other":"Tu e {{count}} altre persone avete inviato un messaggio a questo utente"},"bookmark":{"one":"Tu e un'altra persona avete inserito questo messaggio nei segnalibri","other":"Tu e {{count}} altre persone avete inserito questo messaggio nei segnalibri"},"like":{"one":"A te e a un'altra persona è piaciuto","other":"A te e a {{count}} altre persone è piaciuto"},"vote":{"one":"Tu e un'altra persona avete votato per questo messaggio","other":"Tu e {{count}} altre persone avete votato per questo messaggio"}},"by_others":{"off_topic":{"one":"Una persona lo ha contrassegnato come fuori tema","other":"{{count}} persone lo hanno contrassegnato come fuori tema"},"spam":{"one":"Una persona lo ha contrassegnato come spam","other":"{{count}} persone lo hanno contrassegnato come spam"},"inappropriate":{"one":"Una persona lo ha contrassegnato come non appropriato","other":"{{count}} persone lo hanno contrassegnato come non appropriato"},"notify_moderators":{"one":"Una persona lo ha contrassegnato per la moderazione","other":"{{count}} persone lo hanno contrassegnato per la moderazione"},"notify_user":{"one":"Una persona ha inviato un messaggio a questo utente","other":"{{count}} persone hanno inviato un messaggio a questo utente"},"bookmark":{"one":"Una persona ha inserito un segnalibro a questo post","other":"{{count}} persone hanno inserito un segnalibro a questo post"},"like":{"one":"A una persona è piaciuto","other":"A {{count}} persone è piaciuto"},"vote":{"one":"Una persona ha votato per questo post","other":"{{count}} persone hanno votato per questo post"}}},"delete":{"confirm":{"one":"Sei sicuro di voler cancellare questo messaggio?","other":"Sei sicuro di voler cancellare tutti questi messaggi?"}},"revisions":{"controls":{"first":"Prima revisione","previous":"Revisione precedente","next":"Prossima revisione","last":"Ultima revisione","hide":"Nascondi revisione","show":"Mostra revisione","revert":"Ritorna a questa revisione","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Mostra il risultato con le aggiunte e le rimozioni in linea","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Mostra le differenze del risultato fianco a fianco","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Mostra le differenze nei sorgenti fianco-a-fianco","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Raw"}}}},"category":{"can":"può\u0026hellip;","none":"(nessuna categoria)","all":"Tutte le categorie","choose":"Seleziona una categoria\u0026hellip;","edit":"modifica","edit_long":"Modifica","view":"Visualizza Argomenti della Categoria","general":"Generale","settings":"Impostazioni","topic_template":"Modello di Argomento","tags":"Etichette","tags_allowed_tags":"Etichette che si possono usare soltanto in questa categoria:","delete":"Elimina Categoria","create":"Crea Categoria","create_long":"Crea una nuova categoria","save":"Salva Categoria","slug":"Abbreviazione di categoria","slug_placeholder":"(Facoltativo) parole-sillabate per URL","creation_error":"Si è verificato un errore nella creazione della categoria.","save_error":"Si è verificato un errore durante il salvataggio della categoria.","name":"Nome Categoria","description":"Descrizione","topic":"argomento della categoria","logo":"Immagine Categoria","background_image":"Immagine di sfondo della categoria","badge_colors":"Colori dei distintivi","background_color":"Colore di sfondo","foreground_color":"Colore in primo piano","name_placeholder":"Una o due parole al massimo","color_placeholder":"Qualsiasi colore web","delete_confirm":"Sei sicuro di voler cancellare questa categoria?","delete_error":"Si è verificato un errore durante la cancellazione della categoria.","list":"Elenca Categorie","no_description":"Aggiungi una descrizione alla categoria.","change_in_category_topic":"Modifica Descrizione","already_used":"Questo colore è già stato usato in un'altra categoria.","security":"Sicurezza","special_warning":"Attenzione: questa è una categoria predefinita e le impostazioni di sicurezza ne vietano la modifica. Se non vuoi usare questa categoria, cancellala invece di modificarla.","images":"Immagini","auto_close_label":"Chiudi automaticamente l'argomento dopo:","auto_close_units":"ore","email_in":"Indirizzo email personalizzato:","email_in_allow_strangers":"Accetta email da utenti anonimi senza alcun account","email_in_disabled":"Le Impostazioni Sito non permettono di creare nuovi argomenti via email. Per abilitare la creazione di argomenti via email,","email_in_disabled_click":"abilita l'impostazione \"email entrante\".","suppress_from_homepage":"Elimina questa categoria dalla homepage.","allow_badges_label":"Permetti l'assegnazione di distintivi in questa categoria","edit_permissions":"Modifica Permessi","add_permission":"Aggiungi Permesso","this_year":"quest'anno","position":"posizione","default_position":"Posizione di default","position_disabled":"Le categorie verranno mostrate in ordine d'attività. Per modificare l'ordinamento delle categorie nelle liste,","position_disabled_click":"attiva l'impostazione \"posizione fissa delle categorie\".","parent":"Categoria Superiore","notifications":{"watching":{"title":"In osservazione"},"tracking":{"title":"Seguendo"},"regular":{"title":"Normale","description":"Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"muted":{"title":"Silenziato","description":"Non ti verrà mai notificato nulla sui nuovi argomenti di queste categorie, e non compariranno nell'elenco dei Non letti."}}},"flagging":{"title":"Grazie per aiutarci a mantenere la nostra comunità civile!","action":"Segnala Messaggio","take_action":"Procedi","notify_action":"Messaggio","delete_spammer":"Cancella Spammer","yes_delete_spammer":"Sì, cancella lo spammer","ip_address_missing":"(N/D)","hidden_email_address":"(nascosto)","submit_tooltip":"Invia la segnalazione privata","take_action_tooltip":"Raggiungi la soglia di segnalazioni immediatamente, piuttosto che aspettare altre segnalazioni della comunità","cant":"Spiacenti, al momento non puoi segnalare questo messaggio.","notify_staff":"Notifica staff privatamente","formatted_name":{"off_topic":"E' fuori tema","inappropriate":"È inappropriato","spam":"E' Spam"},"custom_placeholder_notify_user":"Sii dettagliato, costruttivo e sempre gentile.","custom_placeholder_notify_moderators":"Facci sapere esattamente cosa ti preoccupa, fornendo collegamenti pertinenti ed esempi ove possibile."},"flagging_topic":{"title":"Grazie per aiutarci a mantenere la nostra comunità civile!","action":"Segnala Argomento","notify_action":"Messaggio"},"topic_map":{"title":"Riassunto Argomento","participants_title":"Autori Assidui","links_title":"Collegamenti Di Successo","clicks":{"one":"1 click","other":"%{count} click"}},"topic_statuses":{"warning":{"help":"Questo è un avvertimento ufficiale."},"bookmarked":{"help":"Hai aggiunto questo argomento ai segnalibri"},"locked":{"help":"Questo argomento è chiuso; non sono ammesse nuove risposte"},"archived":{"help":"Questo argomento è archiviato; è bloccato e non può essere modificato"},"locked_and_archived":{"help":"Questo argomento è chiuso e archiviato; non sono ammesse nuove risposte e non può essere modificato"},"unpinned":{"title":"Spuntato","help":"Questo argomento è per te spuntato; verrà mostrato con l'ordinamento di default"},"pinned_globally":{"title":"Appuntato Globalmente","help":"Questo argomento è appuntato globalmente; verrà mostrato in cima all'elenco Ultimi e nella sua categoria."},"pinned":{"title":"Appuntato","help":"Questo argomento è per te appuntato; verrà mostrato con l'ordinamento di default"},"invisible":{"help":"Questo argomento è invisibile; non verrà mostrato nella liste di argomenti ed è possibile accedervi solo tramite collegamento diretto"}},"posts":"Messaggi","posts_long":"ci sono {{number}} messaggi in questo argomento","original_post":"Messaggio Originale","views":"Visite","views_lowercase":{"one":"visita","other":"visite"},"replies":"Risposte","views_long":"questo argomento è stato visto {{number}} volte","activity":"Attività","likes":"Mi piace","likes_lowercase":{"one":"mi piace","other":"mi piace"},"likes_long":"ci sono {{number}} \"Mi piace\" in questo argomento","users":"Utenti","users_lowercase":{"one":"utente","other":"utenti"},"category_title":"Categoria","history":"Storia","changed_by":"da {{author}}","raw_email":{"title":"Email Greggia","not_available":"Non disponibile!"},"categories_list":"Lista Categorie","filters":{"with_topics":"%{filter} argomenti","with_category":"%{filter} %{category} argomenti","latest":{"title":"Ultimi","title_with_count":{"one":"Ultimo (1)","other":"Ultimi ({{count}})"},"help":"argomenti con messaggi recenti"},"hot":{"title":"Caldo","help":"una selezione degli argomenti più caldi"},"read":{"title":"Letti","help":"argomenti che hai letto, in ordine di lettura"},"search":{"title":"Cerca","help":"cerca tutti gli argomenti"},"categories":{"title":"Categorie","title_in":"Categoria - {{categoryName}}","help":"tutti gli argomenti raggruppati per categoria"},"unread":{"title":"Non letti","title_with_count":{"one":"Non letto (1)","other":"Non letti ({{count}})"},"help":"argomenti che stai osservando o seguendo contenenti messaggi non letti","lower_title_with_count":{"one":"1 non letto","other":"{{count}} non letti"}},"new":{"lower_title_with_count":{"one":"1 nuovo","other":"{{count}} nuovi"},"lower_title":"nuovo","title":"Nuovi","title_with_count":{"one":"Nuovo (1)","other":"Nuovi ({{count}})"},"help":"argomenti creati negli ultimi giorni"},"posted":{"title":"I miei Messaggi","help":"argomenti in cui hai scritto"},"bookmarks":{"title":"Segnalibri","help":"argomenti che hai aggiunto ai segnalibri"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"ultimi argomenti nella categoria {{categoryName}}"},"top":{"title":"Di Punta","help":"gli argomenti più attivi nell'ultimo anno, mese, settimana o giorno","all":{"title":"Tutti"},"yearly":{"title":"Annuale"},"quarterly":{"title":"Trimestrale"},"monthly":{"title":"Mensile"},"weekly":{"title":"Settimanale"},"daily":{"title":"Giornaliero"},"all_time":"Tutti","this_year":"Anno","this_quarter":"Trimestre","this_month":"Mese","this_week":"Settimana","today":"Oggi","other_periods":"vedi argomenti di punta"}},"browser_update":"Purtroppo \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eil tuo browser è troppo vecchio per funzionare su questo forum\u003c/a\u003e. Per favore \u003ca href=\"http://browsehappy.com\"\u003eaggiorna il browser\u003c/a\u003e.","permission_types":{"full":"Crea / Rispondi / Visualizza","create_post":"Rispondi / Visualizza","readonly":"Visualizza"},"lightbox":{"download":"scarica"},"search_help":{"title":"Aiuto Ricerca"},"keyboard_shortcuts_help":{"title":"Scorciatorie Tastiera","jump_to":{"title":"Salta A","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Ultimi","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nuovi","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Non letti","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categorie","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Segnalibri","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profilo","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messaggi"},"navigation":{"title":"Navigazione","jump":"\u003cb\u003e#\u003c/b\u003e Vai al messaggio n°","back":"\u003cb\u003eu\u003c/b\u003e Indietro","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Sposta la selezione \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e o \u003cb\u003eEnter\u003c/b\u003e Apri l'argomento selezionato","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Prossima/precedente sezione"},"application":{"title":"Applicazione","create":"\u003cb\u003ec\u003c/b\u003e Crea un nuovo argomento","notifications":"\u003cb\u003en\u003c/b\u003e Apri notifiche","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Apri il menu hamburger","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Apri menu utente","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Mostra argomenti aggiornati","search":"\u003cb\u003e/\u003c/b\u003e Cerca","help":"\u003cb\u003e?\u003c/b\u003e Apri la legenda tasti","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Chiudi Nuovi Messaggi","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Chiudi Argomenti","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Esci"},"actions":{"title":"Azioni"}},"badges":{"earned_n_times":{"one":"Guadagnato questo distintivo 1 volta","other":"Guadagnato questo distintivo %{count} volte"},"granted_on":"Assegnata %{date}","others_count":"Altri utenti con questo distintivo (%{count})","title":"Distintivi","allow_title":"titolo disponibile","badge_count":{"one":"1 Distintivo","other":"%{count} Distintivi"},"select_badge_for_title":"Seleziona un distintivo da usare come tuo titolo"},"tagging":{"all_tags":"Etichette","selector_all_tags":"tutte le etichette","selector_no_tags":"nessuna etichetta","changed":"etichette cambiate:","tags":"Etichette","choose_for_topic":"scegli delle etichette opzionali per questo argomento","delete_tag":"Cancella Etichetta","delete_confirm":"Sicuro di voler cancellare questa etichetta?","rename_tag":"Rinomina Etichetta","rename_instructions":"Scegli un altro nome per l'etichetta:","manage_groups":"Gestisci Gruppi Etichette","manage_groups_description":"Definisci gruppi per organizzare le etichette","filters":{"without_category":"%{filter} %{tag} argomenti","with_category":"%{filter} %{tag} argomenti in %{category}","untagged_without_category":"%{filter} argomenti non etichettati","untagged_with_category":"%{filter} argomenti non etichettati in %{category}"},"groups":{"title":"Gruppi Etichette","about":"Aggiungi etichette a gruppi per poterle gestire più facilmente.","tags_label":"Etichette in questo gruppo:","parent_tag_label":"Etichetta padre:","parent_tag_description":"Le etichette di questo gruppo non possono essere usate finché è presente l'etichetta padre.","one_per_topic_label":"Limita ad una sola etichetta per argomento in questo gruppo","new_name":"Nuovo Gruppo Etichette","confirm_delete":"Sicuro di voler cancellare questo gruppo di etichette?"}},"poll":{"voters":{"one":"votante","other":"votanti"},"total_votes":{"one":"voto totale","other":"voti totali"},"average_rating":"Voto medio: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"I voti sono pubblici."},"multiple":{"help":{"at_least_min_options":{"one":"Scegli almeno \u003cstrong\u003e1\u003c/strong\u003e opzione","other":"Scegli almeno \u003cstrong\u003e%{count}\u003c/strong\u003e opzioni"},"up_to_max_options":{"one":"Scegli fino a \u003cstrong\u003e1\u003c/strong\u003e opzione","other":"Scegli fino a \u003cstrong\u003e%{count}\u003c/strong\u003e opzioni"},"x_options":{"one":"Scegli \u003cstrong\u003e1\u003c/strong\u003e opzione","other":"Scegli \u003cstrong\u003e%{count}\u003c/strong\u003e opzioni"},"between_min_and_max_options":"Scegli tra \u003cstrong\u003e%{min}\u003c/strong\u003e e \u003cstrong\u003e%{max}\u003c/strong\u003e opzioni"}},"cast-votes":{"title":"Vota","label":"Vota!"},"show-results":{"title":"Visualizza i risultati del sondaggio","label":"Mostra i risultati"},"hide-results":{"title":"Torna ai tuoi voti","label":"Nascondi i risultati"},"open":{"title":"Apri il sondaggio","label":"Apri","confirm":"Sicuro di voler aprire questo sondaggio?"},"close":{"title":"Chiudi il sondaggio","label":"Chiudi","confirm":"Sicuro di voler chiudere questo sondaggio?"},"error_while_toggling_status":"Spiacenti, si è verificato un errore nel commutare lo stato di questo sondaggio.","error_while_casting_votes":"Spiacenti, si è verificato un errore nella votazione.","error_while_fetching_voters":"Spiacenti, si è verificato un errore nel visualizzare i votanti.","ui_builder":{"title":"Crea Sondaggio","insert":"Inserisci Sondaggio","help":{"options_count":"Inserisci almeno 2 opzioni"},"poll_type":{"label":"Tipo","regular":"Scelta Singola","multiple":"Scelta Multipla","number":"Votazione Numerica"},"poll_config":{"max":"Massimo","min":"Minimo","step":"Passo"},"poll_public":{"label":"Mostra i votanti"},"poll_options":{"label":"Inserisci un'opzione di sondaggio per riga"}}},"type_to_filter":"digita per filtrare...","admin":{"title":"Amministratore Discourse","moderator":"Moderatore","dashboard":{"title":"Cruscotto","last_updated":"Ultimo aggiornamento cruscotto:","version":"Versione","up_to_date":"Sei aggiornato!","critical_available":"È disponibile un aggiornamento essenziale.","updates_available":"Sono disponibili aggiornamenti.","please_upgrade":"Aggiorna!","no_check_performed":"Non è stato effettuato un controllo sugli aggiornamenti. Assicurati che sidekiq sia attivo.","stale_data":"Non è stato effettuato un controllo recente sugli aggiornamenti. Assicurati che sidekiq sia attivo.","version_check_pending":"Sembra che tu abbia aggiornato di recente. Ottimo!","installed_version":"Installata","latest_version":"Ultima","problems_found":"Si sono verificati dei problemi con la tua installazione di Discourse:","last_checked":"Ultimo controllo","refresh_problems":"Aggiorna","no_problems":"Nessun problema rilevato.","moderators":"Moderatori:","admins":"Amministratori:","blocked":"Bloccati:","suspended":"Sospesi: ","private_messages_short":"MP","private_messages_title":"Messaggi","mobile_title":"Mobile","space_free":"{{size}} liberi","uploads":"caricamenti","backups":"backup","traffic_short":"Traffico","traffic":"Richieste web dell'applicazione","page_views":"Richieste API","page_views_short":"Richieste API","show_traffic_report":"Mostra rapporto di traffico dettagliato","reports":{"today":"Oggi","yesterday":"Ieri","last_7_days":"Ultimi 7 Giorni","last_30_days":"Ultimi 30 Giorni","all_time":"Di Sempre","7_days_ago":"7 Giorni Fa","30_days_ago":"30 Giorni Fa","all":"Tutti","view_table":"tabella","refresh_report":"Aggiorna Rapporto","start_date":"Data Inizio","end_date":"Data Fine","groups":"Tutti i gruppi"}},"commits":{"latest_changes":"Ultime modifiche: per favore aggiorna spesso!","by":"da"},"flags":{"title":"Segnalazioni","old":"Vecchi","active":"Attivi","agree":"Acconsento","agree_title":"Conferma che questa segnalazione è valida e corretta","agree_flag_modal_title":"Acconsento e...","agree_flag_hide_post":"D'accordo (nascondi il messaggio e invia MP)","agree_flag_hide_post_title":"Nascondi questo messaggio e invia automaticamente all'utente un messaggio chiedendogli di modificarlo","agree_flag_restore_post":"D'accordo (ripristina messaggio)","agree_flag_restore_post_title":"Ripristina questo messaggio","agree_flag":"Accetta la segnalazione","agree_flag_title":"Accetta la segnalazione e non modificare il messaggio","defer_flag":"Ignora","defer_flag_title":"Rimuovi segnalazione; non è necessaria alcuna azione questa volta.","delete":"Cancella","delete_title":"Cancella il messaggio a cui si riferisce la segnalazione.","delete_post_defer_flag":"Cancella il messaggio e Ignora la segnalazione","delete_post_defer_flag_title":"Cancella il messaggio: se è il primo, cancella l'argomento","delete_post_agree_flag":"Elimina messaggio e Accetta la segnalazione","delete_post_agree_flag_title":"Cancella il messaggio: se è il primo, cancella l'argomento","delete_flag_modal_title":"Cancella e...","delete_spammer":"Cancella lo Spammer","delete_spammer_title":"Rimuovi l'utente e tutti i suoi messaggi ed argomenti.","disagree_flag_unhide_post":"Rifiuta (mostra il messaggio)","disagree_flag_unhide_post_title":"Rimuovi ogni segnalazione dal messaggio e rendilo nuovamente visibile","disagree_flag":"Rifiuta","disagree_flag_title":"Nega questa segnalazione perché non valida o non corretta","clear_topic_flags":"Fatto","clear_topic_flags_title":"L'argomento è stato esaminato e i problemi risolti. Clicca su Fatto per rimuovere le segnalazioni.","more":"(altre risposte...)","dispositions":{"agreed":"accettate","disagreed":"non accettate","deferred":"ignorate"},"flagged_by":"Segnalato da","resolved_by":"Risolto da","took_action":"Azione intrapresa","system":"Sistema","error":"Qualcosa non ha funzionato","reply_message":"Rispondi","no_results":"Non ci sono segnalazioni.","topic_flagged":"Questo \u003cstrong\u003eargomento\u003c/strong\u003e è stato segnalato.","visit_topic":"Visita l'argomento per intervenire","was_edited":"Il messaggio è stato modificato dopo la prima segnalazione","previous_flags_count":"Questo messaggio è stato già segnalato {{count}} volte.","summary":{"action_type_3":{"one":"off-topic ","other":"fuori tema x{{count}}"},"action_type_4":{"one":"inappropriato","other":"inappropriati x{{count}}"},"action_type_6":{"one":"personalizzato","other":"personalizzati x{{count}}"},"action_type_7":{"one":"personalizzato","other":"personalizzati x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Gruppo Primario","no_primary":"(nessun gruppo primario)","title":"Gruppi","edit":"Modifica Gruppi","refresh":"Aggiorna","new":"Nuovo","selector_placeholder":"inserisci nome utente","name_placeholder":"Nome del gruppo, senza spazi, stesse regole del nome utente","about":"Modifica qui la tua appartenenza ai gruppi e i loro nomi","group_members":"Membri del gruppo","delete":"Cancella","delete_confirm":"Cancellare questo gruppo?","delete_failed":"Impossibile cancellare il gruppo. Se questo è un gruppo automatico, non può essere eliminato.","delete_member_confirm":"Rimuovere '%{username}' dal gruppo '%{group}'?","delete_owner_confirm":"Rimuovere i privilegi per '%{username}'?","name":"Nome","add":"Aggiungi","add_members":"Aggiungi membri","custom":"Personalizzato","bulk_complete":"Gli utenti sono stati aggiunti al gruppo.","bulk":"Aggiunta Massiva al Gruppo","bulk_paste":"Incolla una lista di nomi utente o di email, uno per riga:","bulk_select":"(seleziona un gruppo)","automatic":"Automatico","automatic_membership_email_domains":"Gli utenti che si registrano con un dominio email che corrisponde esattamente a uno presente in questa lista, saranno aggiunti automaticamente a questo gruppo:","automatic_membership_retroactive":"Applica la stessa regola sul dominio email per aggiungere utenti registrati esistenti","default_title":"Titolo predefinito per tutti gli utenti di questo gruppo","primary_group":"Imposta automaticamente come gruppo principale","group_owners":"Proprietari","add_owners":"Aggiungi proprietari","incoming_email":"Indirizzo email personalizzato","incoming_email_placeholder":"inserisci l'indirizzo e-mail"},"api":{"generate_master":"Genera una Master API Key","none":"Non ci sono chiavi API attive al momento.","user":"Utente","title":"API","key":"Chiave API","generate":"Genera","regenerate":"Rigenera","revoke":"Revoca","confirm_regen":"Sei sicuro di voler sostituire la API Key con una nuova?","confirm_revoke":"Sei sicuro di revocare la chiave?","info_html":"La tua chiave API ti permetterà di creare e aggiornare gli argomenti usando chiamate JSON.","all_users":"Tutti gli Utenti","note_html":"Mantieni \u003cstrong\u003esegreta\u003c/strong\u003e questa chiave, tutti gli utenti che la possiedono possono creare messaggi per conto di altri."},"plugins":{"title":"Plugin","installed":"Plugin Installati","name":"Nome","none_installed":"Non hai installato nessun plugin.","version":"Versione","enabled":"Abilitato?","is_enabled":"S","not_enabled":"N","change_settings":"Cambia Impostazioni","change_settings_short":"Impostazioni","howto":"Come installo i plugin?"},"backups":{"title":"Backup","menu":{"backups":"Backup","logs":"Log"},"none":"Nessun backup disponibile.","read_only":{"enable":{"title":"Abilita la modalità sola-lettura","label":"Abilita sola-lettura","confirm":"Sei sicuro di voler abilitare la modalità sola-lettura?"},"disable":{"title":"Disattiva la modalità di sola-lettura","label":"Disattiva sola-lettura"}},"logs":{"none":"Nessun log al momento..."},"columns":{"filename":"Nome del file","size":"Dimensione"},"upload":{"label":"Carica","title":"Carica un backup su questa istanza","uploading":"In caricamento...","success":"'{{filename}}' è stato caricato con successo.","error":"Si è verificato un errore durante il caricamento {{filename}}': {{message}}"},"operations":{"is_running":"Un'operazione è attualmente in esecuzione...","failed":"{{operation}} non è riuscito/a. Controlla i log per saperne di più.","cancel":{"label":"Annulla","title":"Annulla l'operazione in corso","confirm":"Sei sicuro di voler annullare l'operazione corrente?"},"backup":{"label":"Backup","title":"Crea un backup","confirm":"Vuoi creare un nuovo backup?","without_uploads":"Sì (non includere i file)"},"download":{"label":"Scarica","title":"Scarica il backup"},"destroy":{"title":"Rimuovi il backup","confirm":"Sicuro di voler distruggere questo backup?"},"restore":{"is_disabled":"Il ripristino è disabilitato nelle opzioni del sito.","label":"Ripristina","title":"Ripristina il backup","confirm":"Sei sicuro di voler ripristinare questo backup?"},"rollback":{"label":"Rollback","title":"Ripristina il database a una versione funzionante precedente","confirm":"Sei sicuro di voler ripristinare il database alla versione funzionante precedente?"}}},"export_csv":{"user_archive_confirm":"Sei sicuro di voler scaricare i tuoi messaggi?","success":"Esportazione iniziata, verrai avvertito con un messaggio al termine del processo.","failed":"Esportazione fallita. Controlla i log.","rate_limit_error":"I messaggi possono essere scaricati una volta al giorno, prova ancora domani.","button_text":"Esporta","button_title":{"user":"Esporta l'intero elenco di utenti in formato CSV.","staff_action":"Esporta il registro di tutte le azioni dello staff in formato CSV.","screened_email":"Esporta tutta la lista delle email schermate in formato CSV.","screened_ip":"Esporta tutta la lista degli IP schermati in formato CSV.","screened_url":"Esporta tutta la lista degli URL schermati in formato CSV."}},"export_json":{"button_text":"Esportare"},"invite":{"button_text":"Manda Inviti","button_title":"Manda Inviti"},"customize":{"title":"Personalizza","long_title":"Personalizzazioni Sito","css":"CSS","header":"Intestazione","top":"Alto","footer":"Fondo pagina","embedded_css":"CSS incorporato","head_tag":{"text":"\u003c/head\u003e","title":"HTML da inserire prima del tag \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML da inserire prima del tag \u003c/body\u003e"},"override_default":"Non includere fogli di stile standard","enabled":"Attivo?","preview":"anteprima","undo_preview":"rimuovi anteprima","rescue_preview":"stile default","explain_preview":"Visualizza il sito con questo foglio di stile personalizzato","explain_undo_preview":"Torna al foglio di stile personalizzato attualmente attivo.","explain_rescue_preview":"Visualizza il sito con il foglio di stile predefinito","save":"Salva","new":"Nuovo","new_style":"Nuovo Stile","import":"Importare","import_title":"Seleziona un file o incolla del testo","delete":"Cancella","delete_confirm":"Cancella questa personalizzazione?","about":"Modifica i fogli di stile CSS e le intestazioni HTML del sito. Aggiungi una personalizzazione per iniziare.","color":"Colore","opacity":"Opacità","copy":"Copia","email_templates":{"title":"Modelli e-mail","subject":"Oggetto","multiple_subjects":"Questo modello email ha più di un campo oggetto.","body":"Corpo","none_selected":"Scegli un modello di e-mail per iniziare la modifica.","revert":"Annulla Cambiamenti","revert_confirm":"Sei sicuro di voler annullare i cambiamenti?"},"css_html":{"title":"CSS/HTML","long_title":"Personalizzazioni CSS e HTML"},"colors":{"title":"Colori","long_title":"Combinazioni Colori","about":"Modifica i colori utilizzati sul sito senza scrivere CSS. Aggiungi una combinazione per iniziare.","new_name":"Nuova Combinazione Colori","copy_name_prefix":"Copia di","delete_confirm":"Eliminare questa combinazione di colori?","undo":"annulla","undo_title":"Annulla le modifiche effettuate a questo colore dall'ultimo salvataggio.","revert":"ripristina","revert_title":"Reimposta questo colore alla combinazione colori di default di Discourse.","primary":{"name":"primario","description":"Per la maggior parte del testo, icone e bordi."},"secondary":{"name":"secondario","description":"Il colore di sfondo principale e il colore del testo di alcuni pulsanti"},"tertiary":{"name":"terziario","description":"Colore dei collegamenti, alcuni pulsanti, notifiche e evidenziati."},"quaternary":{"name":"quaternario","description":"Collegamenti di navigazione."},"header_background":{"name":"sfondo intestazione","description":"Colore di sfondo dell'intestazione del sito."},"header_primary":{"name":"intestazione primaria","description":"Testo e icone dell'intestazione del sito."},"highlight":{"name":"evidenzia","description":"Il colore di sfondo degli elementi evidenziati nella pagina, come messaggi e argomenti."},"danger":{"name":"pericolo","description":"Colore per evidenzare azioni come la cancellazione di messaggi e argomenti."},"success":{"name":"successo","description":"Utilizzato per indicare che un'azione è stata completata con successo."},"love":{"name":"amo","description":"Il colore del bottone \"Mi piace\"."}}},"email":{"title":"Email","settings":"Impostazioni","templates":"Modelli","preview_digest":"Anteprima Riepilogo","sending_test":"Invio email di prova in corso...","error":"\u003cb\u003eERRORE\u003c/b\u003e - %{server_error}","test_error":"C'è stato un problema nell'invio dell'email di test. Controlla nuovamente le impostazioni email, verifica che il tuo host non blocchi le connessioni email e riprova.","sent":"Inviato","skipped":"Omesso","received":"Ricevute","rejected":"Rifiutate","sent_at":"Inviato Alle","time":"Ora","user":"Utente","email_type":"Tipo di Email","to_address":"Indirizzo Destinazione","test_email_address":"indirizzo email da testare","send_test":"Invia una email di prova","sent_test":"inviata!","delivery_method":"Metodo di consegna","preview_digest_desc":"Vedi in anteprima il contenuto delle email di riepilogo inviate agli utenti inattivi.","refresh":"Aggiorna","format":"Formato","html":"html","text":"testo","last_seen_user":"Ultimo Utente Visto:","reply_key":"Chiave di risposta","skipped_reason":"Motivo Omissione","incoming_emails":{"from_address":"Da","to_addresses":"A","cc_addresses":"Cc","subject":"Oggetto","error":"Errore","none":"Nessuna email in entrata.","modal":{"title":"Dettagli posta in arrivo","error":"Errore","headers":"Intestazione","subject":"Oggetto","body":"Corpo","rejection_message":"Mail di Rifiuto"},"filters":{"from_placeholder":"da@esempio.com","to_placeholder":"a@esempio.com","cc_placeholder":"cc@esempio.com","subject_placeholder":"Oggetto...","error_placeholder":"Errore"}},"logs":{"none":"Nessun log trovato.","filters":{"title":"Filtro","user_placeholder":"nome utente","address_placeholder":"nome@esempio.com","type_placeholder":"riepilogo, iscrizione...","reply_key_placeholder":"chiave di risposta","skipped_reason_placeholder":"motivo"}}},"logs":{"title":"Log","action":"Azione","created_at":"Creato","last_match_at":"Ultima corrispondenza","match_count":"Corrispondenze","ip_address":"IP","topic_id":"ID argomento","post_id":"ID messaggio","category_id":"ID categoria","delete":"Cancella","edit":"Modifica","save":"Salva","screened_actions":{"block":"blocca","do_nothing":"non fare nulla"},"staff_actions":{"title":"Azioni Staff","instructions":"Fai clic sui nomi utenti e sulle azioni per filtrare la lista. Fai clic sulle immagini del profilo per andare alle pagine utenti.","clear_filters":"Mostra Tutto","staff_user":"Utente","target_user":"Destinatario","subject":"Oggetto","when":"Quando","context":"Contesto","details":"Dettagli","previous_value":"Precedente","new_value":"Nuovo","diff":"Diff","show":"Mostra","modal_title":"Dettagli","no_previous":"Non c'è un valore precedente.","deleted":"Nessun nuovo valore. Il registro è stato cancellato.","actions":{"delete_user":"cancella l'utente","change_trust_level":"cambia livello esperienza","change_username":"cambia nome utente","change_site_setting":"modifica le impostazioni del sito","change_site_customization":"modifica la personalizzazione del sito","delete_site_customization":"cancella la personalizzazione del sito","change_site_text":"cambia il testo del sito","suspend_user":"utente sospeso","unsuspend_user":"utente riattivato","grant_badge":"assegna distintivo","revoke_badge":"revoca distintivo","check_email":"controlla email","delete_topic":"cancella argomento","delete_post":"cancella messaggio","impersonate":"impersona","anonymize_user":"rendi anonimo l'utente ","roll_up":"inibisci blocchi di indirizzi IP","change_category_settings":"cambia le impostazioni della categoria","delete_category":"cancella categoria","create_category":"crea categoria","block_user":"blocca utente","unblock_user":"sblocca utente","grant_admin":"assegna amministrazione","revoke_admin":"revoca amministrazione","grant_moderation":"assegna moderazione","revoke_moderation":"revoca moderazione","backup_operation":"operazione di backup","deleted_tag":"etichetta cancellata","renamed_tag":"etichetta rinominata"}},"screened_emails":{"title":"Email Scansionate","description":"Quando qualcuno cerca di creare un nuovo account, verrando controllati i seguenti indirizzi email  e la registrazione viene bloccata, o eseguita qualche altra azione.","email":"Indirizzo email","actions":{"allow":"Permetti"}},"screened_urls":{"title":"URL scansionati","description":"I seguenti URL sono stati usati in messaggi da utenti identificati come spammer.","url":"URL","domain":"Dominio"},"screened_ips":{"title":"IP scansionati","description":"Gli indirizzi IP che sono sotto controllo. Usa \"Permetti\" per inserirli nella lista bianca.","delete_confirm":"Davvero vuoi rimuovere la regola per %{ip_address}?","roll_up_confirm":"Sicuro di voler raggruppare in sottoreti gli indirizzi IP schermati normalmente?","rolled_up_some_subnets":"L'elenco di indirizzi IP interdetti sono stati sintetizzati con successo: %{subnets}.","rolled_up_no_subnet":"Non c'era nulla da sintetizzare.","actions":{"block":"Blocca","do_nothing":"Permetti","allow_admin":"Abilita Amministratore"},"form":{"label":"Nuovo:","ip_address":"Indirizzo IP","add":"Aggiungi","filter":"Cerca"},"roll_up":{"text":"Sintetizza","title":"Crea nuovi elenchi di indirizzi IP interdetti se ci sono almeno 'min_ban_entries_for_roll_up' elementi."}},"logster":{"title":"Log Errori"}},"impersonate":{"title":"Impersona","help":"Usa questo strumento per impersonare un account utente ai fini del debugging. Una volta finito dovrai scollegarti.","not_found":"Impossibile trovare questo utente.","invalid":"Spiacenti, non puoi impersonare questo utente."},"users":{"title":"Utenti","create":"Aggiungi Utente Amministratore","last_emailed":"Ultima email inviata","not_found":"Spiacenti, questo nome utente non esiste nel sistema.","id_not_found":"Spiacenti, nel nostro sistema non esiste questo id utente.","active":"Attivo","show_emails":"Mostra email","nav":{"new":"Nuovi","active":"Attivi","pending":"In attesa","staff":"Staff","suspended":"Sospesi","blocked":"Bloccati","suspect":"Sospetti"},"approved":"Approvato?","approved_selected":{"one":"approva l'utente","other":"approva gli utenti ({{count}})"},"reject_selected":{"one":"rifiuta l'utente","other":"rifiuta utenti ({{count}})"},"titles":{"active":"Utenti Attivi","new":"Nuovi Utenti","pending":"Revisione degli utenti in sospeso","newuser":"Utenti con Livello Esperienza 0 (Nuovo)","basic":"Utenti con Livello Esperienza 1 (Base)","member":"Utenti al Livello Esperienza 2 (Assiduo)","regular":"Utenti al Livello Esperienza 3 (Esperto)","leader":"Utenti al Livello Esperienza 4 (Veterano)","staff":"Staff","admins":"Utenti Amministratori","moderators":"Moderatori","blocked":"Utenti Bloccati","suspended":"Utenti Sospesi","suspect":"Utenti Sospetti"},"reject_successful":{"one":"1 utente rifiutato.","other":"%{count} utenti rifiutati."},"reject_failures":{"one":"Impossibile rifiutare 1 utente","other":"Impossibile rifiutare %{count} utenti."},"not_verified":"Non verificato","check_email":{"title":"Mostra l'indirizzo email di questo utente","text":"Mostra"}},"user":{"suspend_failed":"Si è verificato un errore sospendendo questo utente {{error}}","unsuspend_failed":"Si è verificato un errore riabilitando questo utente {{error}}","suspend_duration":"Per quanto tempo l'utente sarà sospeso?","suspend_duration_units":"(giorni)","suspend_reason_label":"Perché lo stai sospendendo? Questo testo \u003cb\u003esarà visibile a tutti\u003c/b\u003e nella pagina del profilo dell'utente, e gli verrà mostrato tutte le volte che effettuerà il login. Scrivi il meno possibile.","suspend_reason":"Motivo","suspended_by":"Sospeso da","delete_all_posts":"Cancella tutti i messaggi","suspend":"Sospendi","unsuspend":"Riabilita","suspended":"Sospeso?","moderator":"Moderatore?","admin":"Amministratore?","blocked":"Bloccato?","staged":"Temporaneo?","show_admin_profile":"Amministratore","edit_title":"Modifica Titolo","save_title":"Salva Titolo","refresh_browsers":"Forza l'aggiornamento del browser","refresh_browsers_message":"Messaggio inviato a tutti i client!","show_public_profile":"Mostra Profilo Pubblico","impersonate":"Impersona","ip_lookup":"IP Lookup","log_out":"Disconnetti","logged_out":"L'utente è stato disconnesso da tutti i terminali","revoke_admin":"Revoca privilegi di amministrazione","grant_admin":"Assegna privilegi di amministrazione","revoke_moderation":"Revoca privilegi di moderazione","grant_moderation":"Assegna diritti di moderazione","unblock":"Sblocca","block":"Blocca","reputation":"Reputazione","permissions":"Permessi","activity":"Attività","like_count":"\"Mi piace\" Assegnati / Ricevuti","last_100_days":"negli ultimi 100 giorni","private_topics_count":"Argomenti Privati","posts_read_count":"Messaggi Letti","post_count":"Messaggi Creati","topics_entered":"Argomenti Visti","flags_given_count":"Segnalazioni Fatte","flags_received_count":"Segnalazioni Ricevute","warnings_received_count":"Avvertimenti Ricevuti","flags_given_received_count":"Segnalazioni Fatte / Ricevute","approve":"Approva","approved_by":"approvato da","approve_success":"Utente approvato ed email inviata con istruzioni di attivazione.","approve_bulk_success":"Riuscito! Tutti gli utenti selezionati sono stati approvati e notificati.","time_read":"Tempo di lettura","anonymize":"Rendi Anonimo Utente ","anonymize_confirm":"Sei SICURO di voler rendere anonimo questo account? Verrà cambiato il nome utente e la email e reimpostate tutte le informazioni del profilo.","anonymize_yes":"Sì, rendi anonimo questo account","anonymize_failed":"Si è verificato un problema nel rendere anonimo l'account.","delete":"Cancella utente","delete_forbidden_because_staff":"Amministratori e moderatori non possono essere cancellati.","delete_posts_forbidden_because_staff":"Impossibile cancellare tutti i messaggi degli amministratori e dei moderatori.","delete_forbidden":{"one":"Non è possibile cancellare utenti se hanno post attivi. Elimina tutti i posti prima di cancellare un utente (post più vecchi di %{count} giorni non possono essere cancellati).","other":"Non è possibile cancellare utenti se hanno messaggi. Elimina tutti i messaggi prima di cancellare un utente (i messaggi più vecchi di %{count} giorni non possono essere cancellati)."},"cant_delete_all_posts":{"one":"Non posso cancellare tutti i post. Alcuni sono più vecchi di %{count} giorno. (L'impostazione delete_user_max_post_age.)","other":"Impossibile cancellare tutti i messaggi. Alcuni sono più vecchi di %{count} giorni. (L'impostazione delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Non posso cancellare tutti i post perché l'utente ha più di 1 post. (delete_all_posts_max.)","other":"Impossibile cancellare tutti i messaggi perché l'utente ha più di %{count} messaggi. (delete_all_posts_max.)"},"delete_confirm":"Sei SICURO di voler eliminare questo utente? Non è possibile annullare!","delete_and_block":"Elimina e \u003cb\u003eblocca\u003c/b\u003e questa email e indirizzo IP","delete_dont_block":"Elimina soltanto","deleted":"L'utente è stato cancellato.","delete_failed":"Si è verificato un errore nella cancellazione dell'utente. Assicurati che tutti i messaggi siano stati cancellati prima di provare a cancellare l'utente.","send_activation_email":"Invia Email Attivazione","activation_email_sent":"Un'email di attivazione è stata inviata.","send_activation_email_failed":"Si è verificato un errore nell'invio di un'altra email di attivazione. %{error}","activate":"Attiva Account","activate_failed":"Si è verificato un problema nell'attivazione dell'utente.","deactivate_account":"Disattiva Account","deactivate_failed":"Si è verificato un errore durante la disattivazione dell'utente.","unblock_failed":"Si è verificato un errore durante lo sblocco dell'utente.","block_failed":"Si è verificato un errore durante il blocco dell'utente.","block_confirm":"Sei sicuro di voler bloccare questo utente? Non sarà più in grado di creare alcun nuovo argomento o messaggio.","block_accept":"Sì, blocca questo utente","deactivate_explanation":"Un utente disattivato deve riconvalidare la propria email.","suspended_explanation":"Un utente sospeso non può fare il login.","block_explanation":"Un utente bloccato non può pubblicare messaggi o iniziare argomenti.","trust_level_change_failed":"C'è stato un problema nel cambio di livello di esperienza di questo utente.  ","suspend_modal_title":"Sospendi Utente","trust_level_2_users":"Utenti con Livello Esperienza 2","trust_level_3_requirements":"Requisiti per Livello Esperienza 3","trust_level_locked_tip":"il livello di esperienza è bloccato, il sistema non promuoverà né degraderà l'utente","trust_level_unlocked_tip":"il livello di esperienza è sbloccato, il sistema può promuovere o degradare l'utente","lock_trust_level":"Blocca Livello Esperienza","unlock_trust_level":"Sblocca Livello Esperienza","tl3_requirements":{"title":"Requisiti per Livello Esperienza 3","value_heading":"Valore","requirement_heading":"Requisito","visits":"Visite","days":"giorni","topics_replied_to":"Argomenti Risposti A","topics_viewed":"Argomenti Visti","topics_viewed_all_time":"Argomenti Visti (di sempre)","posts_read":"Messaggi Letti","posts_read_all_time":"Messaggi Letti (di sempre)","flagged_posts":"Messaggi Segnalati","flagged_by_users":"Utenti Segnalatori","likes_given":"Mi piace - Assegnati","likes_received":"Mi piace - Ricevuti","likes_received_days":"\"Mi piace\" Ricevuti: singoli giorni","likes_received_users":"\"Mi piace\" Ricevuti: singoli utenti","qualifies":"Requisiti soddisfatti per il livello di esperienza 3.","does_not_qualify":"Mancano i requisiti per il livello esperienza 3.","will_be_promoted":"Verrà presto promosso.","will_be_demoted":"Verrà presto degradato.","on_grace_period":"Al momento la promozione si trova nel periodo di grazia, non verrà degradato.","locked_will_not_be_promoted":"Livello esperienza bloccato. Non verrà mai promosso.","locked_will_not_be_demoted":"Livello esperienza bloccato. Non verrà mai degradato."},"sso":{"title":"Single Sign On","external_id":"ID Esterno","external_username":"Nome utente","external_name":"Nome","external_email":"Email","external_avatar_url":"URL dell'Immagine Profilo"}},"user_fields":{"title":"Campi Utente","help":"Tutti i campi che i tuoi utenti possono riempire.","create":"Crea Campo Utente","untitled":"Senza nome","name":"Nome Campo","type":"Tipo Campo","description":"Descrizione Campo","save":"Salva","edit":"Modifica","delete":"Cancella","cancel":"Annulla","delete_confirm":"Sicuro di voler cancellare il campo utente?","options":"Opzioni","required":{"title":"Richiesto durante l'iscrizione?","enabled":"richiesto","disabled":"non richiesto"},"editable":{"title":"Modificabile dopo l'iscrizione?","enabled":"modificabile","disabled":"non modificabile"},"show_on_profile":{"title":"Mostrare nel profilo pubblico?","enabled":"mostrato nel profilo","disabled":"non mostrato nel profilo"},"show_on_user_card":{"title":"Mostrare sulla scheda utente?","enabled":"mostrato sulla scheda utente","disabled":"non mostrato sulla scheda utente"},"field_types":{"text":"Campo Testo","confirm":"Conferma","dropdown":"A tendina"}},"site_text":{"description":"Puoi personalizzare qualsiasi testo del tuo forum. Comincia effettuando una ricerca qui sotto:","search":"Trova il testo che vorresti modificare","title":"Contenuto Testuale","edit":"modifica","revert":"Annulla Modifiche","revert_confirm":"Sei sicuro di voler annullare le modifiche?","go_back":"Torna alla Ricerca","recommended":"Consigliamo di personalizzare il seguente testo per tue adattarlo alle necessità:","show_overriden":"Mostra solo le opzioni sovrascritte"},"site_settings":{"show_overriden":"Mostra solo le opzioni sovrascritte","title":"Impostazioni","reset":"reimposta","none":"nessuno","no_results":"Nessun risultato trovato.","clear_filter":"Pulisci","add_url":"aggiungi URL","add_host":"aggiungi host","categories":{"all_results":"Tutti","required":"Obbligatorie","basic":"Di Base","users":"Utenti","posting":"Pubblicazione","email":"Email","files":"File","trust":"Livelli Esperienza","security":"Sicurezza","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limiti Frequenza","developer":"Sviluppatore","embedding":"Incorporo","legal":"Legale","uncategorized":"Altro","backups":"Backup","login":"Accesso","plugins":"Plugin","user_preferences":"Preferenze Utente","tags":"Etichette"}},"badges":{"title":"Distintivi","new_badge":"Nuovo Distintivo","new":"Nuovo","name":"Nome","badge":"Distintivo","display_name":"Nome Visualizzato","description":"Descrizione","long_description":"Descrizione Lunga","badge_type":"Tipo Distintivo","badge_grouping":"Gruppo","badge_groupings":{"modal_title":"Raggruppamento Distintivi"},"granted_by":"Assegnata Da","granted_at":"Assegnata in data","reason_help":"(Un collegamento a un messaggio o argomento)","save":"Salva","delete":"Cancella","delete_confirm":"Sei sicuro di voler cancellare questo distintivo?","revoke":"Revoca","reason":"Motivazione","expand":"Espandi \u0026hellip;","revoke_confirm":"Sei sicuro di voler revocare questo distintivo?","edit_badges":"Modifica Distintivi","grant_badge":"Assegna Distintivo","granted_badges":"Distintivi Assegnati","grant":"Assegna","no_user_badges":"%{name} non ha ricevuto alcun distintivo.","no_badges":"Non ci sono distintivi da assegnare.","none_selected":"Seleziona un distintivo per iniziare","allow_title":"Permetti di utilizzare un distintivo come titolo","multiple_grant":"Può essere assegnata più volte","listable":"Mostra distintivo sulla pagina pubblica dei distintivi","enabled":"Attiva distintivo","icon":"Icona","image":"Immagine","icon_help":"Usa una classe Font Awesome o la URL di un'immagine","query":"Query Distintivo (SQL)","target_posts":"Interroga i messaggi destinazione","auto_revoke":"Avvia l'istruzione di revoca giornalmente","show_posts":"Visualizza i messaggi che assegnano distintivi sulla pagina dei distintivi","trigger":"Trigger","trigger_type":{"none":"Aggiorna giornalmente","post_action":"Quando un utente agisce su un messaggio","post_revision":"Quando un utente modifica o crea un messaggio","trust_level_change":"Quando un utente cambia livello di esperienza","user_change":"Quando un utente viene modificato o creato","post_processed":"Dopo che un messaggio viene elaborato"},"preview":{"link_text":"Anteprima distintivi guadagnati","plan_text":"Anteprima con query plan","modal_title":"Anteprima Query Distintivo","sql_error_header":"Si è verificato un errore con la query.","error_help":"Visita i seguenti collegamenti per un aiuto con le query dei distintivi.","bad_count_warning":{"header":"ATTENZIONE!","text":"Ci sono esempi di grant mancanti. Ciò accade quando la query dei distintivi ritorna ID utenti o ID messaggi inesistenti. Successivamente ciò può causare risultati inattesi - controlla bene la tua query."},"no_grant_count":"Nessun distintivo da assegnare.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e distintivo da assegnare.","other":"\u003cb\u003e%{count}\u003c/b\u003e distintivi da assegnare."},"sample":"Esempio:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e per messaggio in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e per messaggio in %{link} in data \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e in data \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Aggiungi nuovi emoji da mettere a disposizione per tutti. (Suggerimento: trascina e rilascia più file in una volta sola)","add":"Aggiungi Nuovo Emoji","name":"Nome","image":"Immagine","delete_confirm":"Sicuro di voler cancellare l'emoji :%{name}:?"},"embedding":{"get_started":"Se lo desideri, puoi incorporare Discourse in un altro sito web. Comincia aggiungendo il nome dell'host","confirm_delete":"Sicuro di voler cancellare questo host?","sample":"Utilizza il seguente codice HTML nel tuo sito per creare e incorporare gli argomenti di Discourse. Sostituisci \u003cb\u003eREPLACE_ME\u003c/b\u003e con l'URL canonical della pagina in cui lo stai incorporando.","title":"Incorporo","host":"Host Abilitati","edit":"modifica","category":"Pubblica nella Categoria","add_host":"Aggiungi Host","settings":"Impostazioni di incorporo","feed_settings":"Impostazioni Feed","feed_description":"Aggiungendo un feed RSS/ATOM al tuo sito, migliora la capacità di Discourse di importare i tuoi contenuti.","crawling_settings":"Impostazioni del crawler","crawling_description":"Quando Discourse crea gli argomenti per i tuoi messaggi, se non è presente nessun feed RSS/ATOM, cercherà di estrarre il contenuto dal codice HTML. Il contenuto può risultate a volte ostico da estrarre e, per semplificare il processo, forniamo la possibilità di specificare le regole CSS.","embed_by_username":"Nome utente per la creazione dell'argomento","embed_post_limit":"Numero massimo di messaggi da includere","embed_username_key_from_feed":"Chiave per ottenere il nome utente discourse dal feed","embed_truncate":"Tronca i messaggi incorporati","embed_whitelist_selector":"Selettore CSS per gli elementi da permettere negli embed","embed_blacklist_selector":"Selettore CSS per gli elementi da rimuovere dagli embed","feed_polling_enabled":"Importa i messaggi via RSS/ATOM","feed_polling_url":"URL del feed RSS/ATOM da recuperare","save":"Salva Impostazioni Inclusione"},"permalink":{"title":"Collegamenti permanenti","url":"URL","topic_id":"ID dell'argomento","topic_title":"Argomento","post_id":"ID del messaggio","post_title":"Messaggio","category_id":"ID della categoria","category_title":"Categoria","external_url":"URL esterna","delete_confirm":"Sei sicuro di voler cancellare questo collegamento permanente?","form":{"label":"Nuovo:","add":"Aggiungi","filter":"Cerca (URL o URL Esterna)"}}}}},"en":{"js":{"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"email_activity_summary":"Activity Summary","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","watched_topics_link":"Show watched topics","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","invited":{"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To"}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"}},"search":{"too_short":"Your search term is too short.","context":{"category":"Search the #{{category}} category"}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."}},"post":{"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?"},"via_auto_generated_email":"this post arrived via an auto generated email","merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"keyboard_shortcuts_help":{"jump_to":{"top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top"},"actions":{"bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"multiple_grant":"awarded multiple times","more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"new":"New Group","parent_tag_placeholder":"Optional","save":"Save","delete":"Delete"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"email":{"bounced":"Bounced"},"logs":{"staff_actions":{"actions":{"revoke_email":"revoke email"}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'it';
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
//! locale : italian (it)
//! author : Lorenzo : https://github.com/aliem
//! author: Mattia Larentis: https://github.com/nostalgiaz

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var it = moment.defineLocale('it', {
        months : 'gennaio_febbraio_marzo_aprile_maggio_giugno_luglio_agosto_settembre_ottobre_novembre_dicembre'.split('_'),
        monthsShort : 'gen_feb_mar_apr_mag_giu_lug_ago_set_ott_nov_dic'.split('_'),
        weekdays : 'Domenica_Lunedì_Martedì_Mercoledì_Giovedì_Venerdì_Sabato'.split('_'),
        weekdaysShort : 'Dom_Lun_Mar_Mer_Gio_Ven_Sab'.split('_'),
        weekdaysMin : 'Do_Lu_Ma_Me_Gi_Ve_Sa'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Oggi alle] LT',
            nextDay: '[Domani alle] LT',
            nextWeek: 'dddd [alle] LT',
            lastDay: '[Ieri alle] LT',
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[la scorsa] dddd [alle] LT';
                    default:
                        return '[lo scorso] dddd [alle] LT';
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : function (s) {
                return ((/^[0-9].+$/).test(s) ? 'tra' : 'in') + ' ' + s;
            },
            past : '%s fa',
            s : 'alcuni secondi',
            m : 'un minuto',
            mm : '%d minuti',
            h : 'un\'ora',
            hh : '%d ore',
            d : 'un giorno',
            dd : '%d giorni',
            M : 'un mese',
            MM : '%d mesi',
            y : 'un anno',
            yy : '%d anni'
        },
        ordinalParse : /\d{1,2}º/,
        ordinal: '%dº',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return it;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
