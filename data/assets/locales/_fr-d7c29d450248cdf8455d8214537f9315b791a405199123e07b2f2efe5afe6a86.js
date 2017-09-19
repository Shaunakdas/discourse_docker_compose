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
r += "Il y ";
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
r += "<a href='/unread'>a 1 sujet non lu</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>a " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " sujets non lus</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "et ";
return r;
},
"false" : function(d){
var r = "";
r += "a ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 nouveau</a> sujet";
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
r += "et ";
return r;
},
"false" : function(d){
var r = "";
r += "a ";
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
})() + " nouveaux</a> sujets";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restant, ou ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "consulter les autres sujets dans ";
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
r += "Ce sujet a ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 réponse";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " réponses";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "  ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "avec un haut ratio de J'aime/Message";
return r;
},
"med" : function(d){
var r = "";
r += "avec un très haut ratio J'aime/Message";
return r;
},
"high" : function(d){
var r = "";
r += "avec un énorme ratio J'aime/Message";
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

MessageFormat.locale.fr = function (n) {
  if (n >= 0 && n < 2) {
    return 'one';
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
I18n.translations = {"fr":{"js":{"number":{"format":{"separator":",","delimiter":" "},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Octet","other":"Octets"},"gb":"Go","kb":"Ko","mb":"Mo","tb":"To"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"H:mm","timeline_date":"MMM YYYY","long_no_year":"DD MMM H:mm","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"DD MMM YYY H:mm","long_with_year_no_time":"DD MMM YYYY","full_with_year_no_time":"Do MMMM, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"il y a %{date}","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1j","other":"%{count}j"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1y","other":"%{count}a"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} mins"},"x_hours":{"one":"1 heure","other":"%{count} heures"},"x_days":{"one":"1 jour","other":"%{count} jours"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"Il y a 1 min","other":"Il y a %{count} mins"},"x_hours":{"one":"Il y a 1 heure","other":"Il y a %{count} heures"},"x_days":{"one":"Il y a 1 jour","other":"Il y a %{count} jours"}},"later":{"x_days":{"one":"1 jour plus tard","other":"%{count} jours plus tard"},"x_months":{"one":"1 mois plus tard","other":"%{count} mois plus tard"},"x_years":{"one":"1 année plus tard","other":"%{count} années plus tard"}},"previous_month":"Mois précédent","next_month":"Mois suivant"},"share":{"topic":"partager ce sujet","post":"message #%{postNumber}","close":"fermer","twitter":"partager ce lien sur Twitter","facebook":"partager ce lien sur Facebook","google+":"partager ce lien sur Google+","email":"envoyer ce lien dans un courriel"},"action_codes":{"public_topic":"rendre ce sujet public %{when}","private_topic":"rendre ce sujet privé %{when}","split_topic":"a scindé ce sujet %{when}","invited_user":"a invité %{who} %{when}","invited_group":"a invité %{who} %{when}","removed_user":"a retiré %{who} %{when}","removed_group":"a retiré %{who} %{when}","autoclosed":{"enabled":"fermé %{when}","disabled":"ouvert %{when}"},"closed":{"enabled":"fermé %{when}","disabled":"ouvert %{when}"},"archived":{"enabled":"archivé %{when}","disabled":"désarchivé %{when}"},"pinned":{"enabled":"épinglé %{when}","disabled":"désépinglé %{when}"},"pinned_globally":{"enabled":"épinglé globalement %{when}","disabled":"désépinglé %{when}"},"visible":{"enabled":"listé %{when}","disabled":"délisté %{when}"}},"topic_admin_menu":"actions administrateur pour ce sujet","emails_are_disabled":"Le courriel sortant a été désactivé par un administrateur. Aucune notification courriel ne sera envoyée.","bootstrap_mode_enabled":"Pour rendre le lancement de votre site plus facile, vous êtes en mode 'bootstrap'. Tout nouveau utilisateur sera accordé le niveau de confirance 1 et aura les résumés par courriel hebdomadaires activés. Ceci cessera d'être le cas lorsque le nombre d'utilisateurs dépassera %{min_users}.","bootstrap_mode_disabled":"Le mode Bootstrap sera désactivé dans les prochaines 24 heures.","s3":{"regions":{"us_east_1":"États-Unis est (Virginie)","us_west_1":"États-Unis ouest (Californie)","us_west_2":"États-Unis ouest (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"UE (Irlande)","eu_central_1":"UE (Francfort)","ap_southeast_1":"Asie-Pacifique (Singapour)","ap_southeast_2":"Asie-Pacifique (Sydney)","ap_south_1":"Asie-Pacifique (Bombay)","ap_northeast_1":"Asie-Pacifique (Tokyo)","ap_northeast_2":"Asie-Pacifique (Séoul)","sa_east_1":"Amérique du Sud (Sao Paulo)","cn_north_1":"Chine (Pékin)"}},"edit":"éditer le titre et la catégorie de ce sujet","not_implemented":"Cette fonctionnalité n'a pas encore été implémentée, désolé.","no_value":"Non","yes_value":"Oui","generic_error":"Désolé, une erreur est survenue.","generic_error_with_reason":"Une erreur est survenue : %{error}","sign_up":"S'inscrire","log_in":"Se connecter","age":"Âge","joined":"Inscrit","admin_title":"Admin","flags_title":"Signalements","show_more":"afficher plus","show_help":"options","links":"Liens","links_lowercase":{"one":"lien","other":"liens"},"faq":"FAQ","guidelines":"Charte","privacy_policy":"Politique de confidentialité","privacy":"Confidentialité","terms_of_service":"Conditions Générales d'Utilisation","mobile_view":"Vue mobile","desktop_view":"Vue bureau","you":"Vous","or":"ou","now":"à l'instant","read_more":"lire la suite","more":"Plus","less":"Moins","never":"jamais","every_30_minutes":"toutes les 30 minutes","every_hour":"chaque heure","daily":"quotidiennes","weekly":"hebdomadaires","every_two_weeks":"toutes les deux semaines","every_three_days":"tous les trois jours","max_of_count":"maximum sur {{count}}","alternation":"ou","character_count":{"one":"{{count}} caractère","other":"{{count}} caractères"},"suggested_topics":{"title":"Sujets suggérés","pm_title":"Messages suggérés"},"about":{"simple_title":"À propos","title":"À propos de %{title}","stats":"Statistiques du site","our_admins":"Nos administrateurs","our_moderators":"Nos modérateurs","stat":{"all_time":"Depuis toujours","last_7_days":"Les 7 derniers jours","last_30_days":"Les 30 derniers jours"},"like_count":"J'aime","topic_count":"Sujets","post_count":"Nombre de messages","user_count":"Nouveaux utilisateurs","active_user_count":"Utilisateurs actifs","contact":"Nous contacter","contact_info":"En cas de problème critique ou urgent sur ce site, veuillez nous contacter : %{contact_info}"},"bookmarked":{"title":"Signet","clear_bookmarks":"Vider les signets","help":{"bookmark":"Cliquer pour ajouter le premier message de ce sujet à vos signets","unbookmark":"Cliquer pour retirer tous les signets de ce sujet"}},"bookmarks":{"not_logged_in":"désolé, vous devez être connecté pour ajouter des messages dans vos signets","created":"vous avez ajouté ce messages à vos signets","not_bookmarked":"vous avez lu ce message ; cliquez pour l’ajouter à vos signets","last_read":"ceci est le dernier message que vous avez lu ; cliquez pour l'ajouter à vos signets","remove":"Retirer de vos signets","confirm_clear":"Êtes-vous sûr de vouloir effacer tous les signets de ce sujet ?"},"topic_count_latest":{"one":"{{count}} sujet récent.","other":"{{count}} sujets récents."},"topic_count_unread":{"one":"{{count}} sujet non lu.","other":"{{count}} sujets non lus."},"topic_count_new":{"one":"{{count}} nouveau sujet.","other":"{{count}} nouveaux sujets."},"click_to_show":"Cliquez pour afficher.","preview":"prévisualiser","cancel":"annuler","save":"Sauvegarder les modifications","saving":"Sauvegarde en cours...","saved":"Sauvegardé !","upload":"Envoyer","uploading":"Envoi en cours...","uploading_filename":"Envoi de {{filename}}...","uploaded":"Envoyé !","enable":"Activer","disable":"Désactiver","undo":"Annuler","revert":"Rétablir","failed":"Échec","switch_to_anon":"Activer le mode anonyme","switch_from_anon":"Quitter le mode anonyme","banner":{"close":"Ignorer cette bannière.","edit":"Éditer cette bannière \u003e\u003e"},"choose_topic":{"none_found":"Aucun sujet trouvé.","title":{"search":"Rechercher un sujet par son nom, URL ou ID :","placeholder":"renseignez ici le titre du sujet"}},"queue":{"topic":"Sujet :","approve":"Approuver","reject":"Rejeter","delete_user":"Supprimer l'utilisateur","title":"Nécessite l'approbation","none":"Il n'y a pas de messages à vérifier.","edit":"Éditer","cancel":"Annuler","view_pending":"voir les messages en attente","has_pending_posts":{"one":"Ce sujet a \u003cb\u003e1\u003c/b\u003e message en attente de validation","other":"Ce sujet a \u003cb\u003e{{count}}\u003c/b\u003e messages en attente de validation"},"confirm":"Sauvegarder les modifications","delete_prompt":"Êtes-vous sûr de vouloir supprimer \u003cb\u003e%{username}\u003c/b\u003e ? Cela supprimera tous ses messages et bloquera son courriel et son adresse IP.","approval":{"title":"Ce message doit être approuvé","description":"Votre nouveau message a bien été envoyé, mais il doit être approuvé par un modérateur avant d'apparaître publiquement. Merci de votre patience.","pending_posts":{"one":"Vous avez \u003cstrong\u003eun\u003c/strong\u003e message en attente.","other":"Vous avez \u003cstrong\u003e{{count}}\u003c/strong\u003e messages en attente."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a démarré \u003ca href='{{topicUrl}}'\u003ele sujet\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVous\u003c/a\u003e avez démarré \u003ca href='{{topicUrl}}'\u003ele sujet\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a répondu à \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVous\u003c/a\u003e avez répondu à \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a répondu à \u003ca href='{{topicUrl}}'\u003ece sujet\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eVous\u003c/a\u003e avez répondu à \u003ca href='{{topicUrl}}'\u003ece sujet\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e a mentionné \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user2Url}}'\u003eVous\u003c/a\u003e avez été mentionné par \u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVous\u003c/a\u003e avez mentionné \u003ca href='{{user2Url}}'\u003e{{user}}\u003c/a\u003e","posted_by_user":"Rédigé par \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Rédigé par \u003ca href='{{userUrl}}'\u003evous\u003c/a\u003e","sent_by_user":"Envoyé par \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Envoyé par \u003ca href='{{userUrl}}'\u003evous\u003c/a\u003e"},"directory":{"filter_name":"filtrer par pseudo","title":"Utilisateurs","likes_given":"Donnés","likes_received":"Reçus","topics_entered":"Vus","topics_entered_long":"Sujets consultés","time_read":"Temps de lecture","topic_count":"Sujets","topic_count_long":"Sujets créés","post_count":"Réponses","post_count_long":"Réponses envoyés","no_results":"Aucun résultat n'a été trouvé.","days_visited":"Visites","days_visited_long":"Jours visités","posts_read":"Lus","posts_read_long":"Messages lus","total_rows":{"one":"1 utilisateur","other":"%{count} utilisateurs"}},"groups":{"empty":{"posts":"Il n'y a aucun message de la part des membres de ce groupe.","members":"Il n'y a aucun membre dans ce groupe.","mentions":"Il n'y a aucune mention de ce groupe.","messages":"Il n'y a aucun message pour ce groupe.","topics":"Il n'y a aucun sujet de la part des membres de ce groupe."},"add":"Ajouter","selector_placeholder":"Ajouter des membres","owner":"propriétaire","visible":"Ce groupe est visible par tous les utilisateurs","index":"Groupes","title":{"one":"groupe","other":"groupes"},"members":"Membres","topics":"Sujets","posts":"Messages","mentions":"Mentions","messages":"Messages","alias_levels":{"title":"Qui peut envoyer un message et @notifier ce groupe ?","nobody":"Personne","only_admins":"Seulement les administrateurs ","mods_and_admins":"Seulement les modérateurs et les administrateurs ","members_mods_and_admins":"Seulement les membres du groupe, les modérateurs et les administrateurs ","everyone":"Tout le monde"},"trust_levels":{"title":"Niveau de confiance automatiquement attribué lorsque les membres sont ajoutés :","none":"Aucun"},"notifications":{"watching":{"title":"Surveiller","description":"Vous serez notifié de chaque nouvelle réponse dans chaque message, et le nombre de nouvelles réponses sera affiché."},"watching_first_post":{"title":"Surveiller les nouveaux sujets","description":"Vous serez uniquement notifié du premier message de chaque sujet de ce groupe."},"tracking":{"title":"Suivre","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond, et le nombre de nouvelles réponses sera affiché."},"regular":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"muted":{"title":"Silencieux","description":"Nous ne serez jamais notifié de quoi que ce soit à propos des nouveaux sujets dans ce groupe."}}},"user_action_groups":{"1":"J'aime donnés","2":"J'aime reçus","3":"Signets","4":"Sujets","5":"Réponses","6":"Réponses","7":"Mentions","9":"Citations","11":"Éditions","12":"Eléments envoyés","13":"Boîte de réception","14":"En attente"},"categories":{"all":"toutes les catégories","all_subcategories":"toutes","no_subcategory":"aucune","category":"Catégorie","category_list":"Afficher la liste des catégories","reorder":{"title":"Réordonner les catégories","title_long":"Réorganiser la liste des catégories","fix_order":"Corriger les positions","fix_order_tooltip":"Toutes les catégories n'ont pas une position unique. Cela peut provoquer des résultats non souhaités.","save":"Enregistrer l'ordre","apply_all":"Appliquer","position":"Position"},"posts":"Messages","topics":"Sujets","latest":"Récents","latest_by":"dernier sujet de","toggle_ordering":"modifier le mode du tri","subcategories":"Sous-catégories","topic_sentence":{"one":"1 sujet","other":"%{count} sujets"},"topic_stat_sentence":{"one":"%{count} nouveau sujet par %{unit}.","other":"%{count} nouveaux sujets par %{unit}."}},"ip_lookup":{"title":"Rechercher l'adresse IP","hostname":"Nom de l'hôte","location":"Localisation","location_not_found":"(inconnu)","organisation":"Société","phone":"Téléphone","other_accounts":"Autres comptes avec cette adresse IP :","delete_other_accounts":"Supprimer %{count}","username":"pseudo","trust_level":"NC","read_time":"temps de lecture","topics_entered":"sujets visités","post_count":"# messages","confirm_delete_other_accounts":"Êtes-vous sûr de vouloir supprimer tous ces comptes ?"},"user_fields":{"none":"(choisir une option)"},"user":{"said":"{{username}} :","profile":"Profil","mute":"Silencieux","edit":"Modifier les préférences","download_archive":"Télécharger mes messages","new_private_message":"Nouveau message privé","private_message":"Message privé","private_messages":"Messages privés","activity_stream":"Activité","preferences":"Préférences","expand_profile":"Développer","bookmarks":"Signets","bio":"À propos de moi","invited_by":"Invité par","trust_level":"Niveau de confiance","notifications":"Notifications","statistics":"Statistiques","desktop_notifications":{"label":"Notifications de bureau","not_supported":"Les notifications ne sont pas supportées avec ce navigateur. Désolé.","perm_default":"Activer les notifications","perm_denied_btn":"Permission refusée","perm_denied_expl":"Vous n'avez pas autorisé les notifications. Autorisez-les depuis les paramètres de votre navigateur.","disable":"Désactiver les notifications","enable":"Activer les notifications","each_browser_note":"Note : Vous devez changer ce paramètre sur chaque navigateur que vous utilisez."},"dismiss_notifications":"Tout ignorer","dismiss_notifications_tooltip":"Marquer les notifications comme lues","disable_jump_reply":"Ne pas aller à mon nouveau message après avoir répondu","dynamic_favicon":"Faire apparaître le nombre de sujets récemment créés ou mis à jour sur l'icône navigateur","external_links_in_new_tab":"Ouvrir tous les liens externes dans un nouvel onglet","enable_quoting":"Proposer de citer le texte sélectionné","change":"modifier","moderator":"{{user}} est un modérateur","admin":"{{user}} est un administrateur","moderator_tooltip":"Cet utilisateur est un modérateur","admin_tooltip":"Cet utilisateur est un administrateur","blocked_tooltip":"Cet utilisateur est bloqué","suspended_notice":"L'utilisateur est suspendu jusqu'au {{date}}.","suspended_reason":"Raison :","github_profile":"GitHub","email_activity_summary":"Résumé d'activité","mailing_list_mode":{"label":"Liste de diffusion","enabled":"Activer la liste de diffusion","instructions":"Ce réglage outrepasse le résumé d'activités.\u003cbr /\u003e\nLes sujets et catégories passés en silencieux ne sont pas inclus dans ces courriels.\n","daily":"Envoyer des informations quotidiennes","individual":"Envoyer un courriel pour chaque nouveau message","many_per_day":"M'envoyer un courriel pour chaque nouveau message (environ {{dailyEmailEstimate}} par jour)","few_per_day":"M'envoyer un courriel pour chaque nouveau message (environ 2 par jour)"},"tag_settings":"Tags","watched_tags":"Surveillés","watched_tags_instructions":"Vous surveillerez automatiquement tous les sujets avec ces tags. Vous serez notifié de tous les nouveaux messages et sujets, et le nombre de nouveaux messages apparaîtra à coté du sujet.","tracked_tags":"Suivis","tracked_tags_instructions":"Vous allez suivre automatiquement tous les sujets avec ces tags. Le nombre de nouveaux messages apparaîtra à côté du sujet.","muted_tags":"Silencieux","muted_tags_instructions":"Vous ne serez notifié de rien concernant les nouveaux sujets avec ces tags, et ils n'apparaîtront pas dans la liste des sujets récents.","watched_categories":"Surveillés","watched_categories_instructions":"Vous surveillerez automatiquement tous les sujets de ces catégories. Vous serez notifié de tous les nouveaux messages et sujets, et le nombre de nouveaux messages apparaîtra à coté du sujet.","tracked_categories":"Suivies","tracked_categories_instructions":"Vous allez suivre automatiquement tous les sujets dans ces catégories. Le nombre de nouveaux messages apparaîtra à côté du sujet.","watched_first_post_categories":"Surveiller les nouveaux sujets","watched_first_post_categories_instructions":"Vous serez notifié du premier message de chaque sujet dans ces catégories.","watched_first_post_tags":"Surveiller les nouveaux sujets","watched_first_post_tags_instructions":"Vous serez notifié du premier message de chaque sujet avec ces tags.","muted_categories":"Silencieuses","muted_categories_instructions":"Vous ne serez notifié de rien concernant les nouveaux sujets dans ces catégories, et elles n'apparaîtront pas dans les dernières catégories.","delete_account":"Supprimer mon compte","delete_account_confirm":"Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action ne peut pas être annulée !","deleted_yourself":"Votre compte a été supprimé avec succès.","delete_yourself_not_allowed":"Vous ne pouvez pas supprimer votre compte maintenant. Contactez un administrateur pour faire supprimer votre compte pour vous.","unread_message_count":"Messages","admin_delete":"Supprimer","users":"Utilisateurs","muted_users":"Silencieux","muted_users_instructions":"Cacher toutes les notifications de ces utilisateurs.","muted_topics_link":"Afficher les sujets en sourdine","watched_topics_link":"Afficher les sujets surveillés","automatically_unpin_topics":"Désépingler automatiquement les sujets quand j'arrive à la fin.","apps":"Applications","revoke_access":"Révoquer l'accès","undo_revoke_access":"Annuler la révocation d'accès","api_permissions":"Permissions :","api_approved":"Approuvé :","api_read":"lecture","api_read_write":"lecture et écriture","staff_counters":{"flags_given":"signalements utiles","flagged_posts":"messages signalés","deleted_posts":"messages supprimés","suspensions":"suspensions","warnings_received":"avertissements"},"messages":{"all":"Tous","inbox":"Boîte de réception","sent":"Envoyé","archive":"Archive","groups":"Mes groupes","bulk_select":"Sélectionner des messages","move_to_inbox":"Déplacer dans la boîte de réception","move_to_archive":"Archiver","failed_to_move":"Impossible de déplacer les messages sélectionnés (peut-être que votre connexion est coupée)","select_all":"Tout sélectionner"},"change_password":{"success":"(courriel envoyé)","in_progress":"(courriel en cours d'envoi)","error":"(erreur)","action":"Envoyer un courriel de réinitialisation du mot de passe","set_password":"Définir le mot de passe"},"change_about":{"title":"Modifier À propos de moi","error":"Il y a eu une erreur lors de la modification de cette valeur."},"change_username":{"title":"Modifier le pseudo","confirm":"Si vous changez votre pseudonyme, toutes les citations existantes de vos messages et les mentions avec votre @pseudo seront cassées. Êtes-vous sûr de vouloir le changer ?","taken":"Désolé, ce pseudo est déjà pris.","error":"Il y a eu une erreur lors du changement de votre pseudo.","invalid":"Ce pseudo est invalide. Il ne doit être composé que de lettres et de chiffres."},"change_email":{"title":"Modifier l'adresse de courriel","taken":"Désolé, cette adresse de courriel est indisponible.","error":"Il y a eu une erreur lors du changement d'adresse de courriel. Cette adresse est peut-être déjà utilisée ?","success":"Nous avons envoyé un courriel à cette adresse. Merci de suivre les instructions."},"change_avatar":{"title":"Modifier votre image de profil","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basé sur","gravatar_title":"Modifier votre avatar sur le site de Gravatar","refresh_gravatar_title":"Actualiser votre Gravatar","letter_based":"Image de profil attribuée par le système","uploaded_avatar":"Avatar personnalisé","uploaded_avatar_empty":"Ajouter un avatar personnalisé","upload_title":"Envoyer votre avatar","upload_picture":"Envoyer une image","image_is_not_a_square":"Attention : nous avons découpé votre image ; la largeur et la hauteur n'étaient pas égales.","cache_notice":"Votre photo de profil a bien été modifié, mais il se peut qu'il mette un certain temps à apparaître à cause des caches de navigateur."},"change_profile_background":{"title":"Arrière-plan du profil","instructions":"L'arrière-plan du profil sera centré avec une largeur par défaut de 850 pixels."},"change_card_background":{"title":"Arrière-plan de la carte de l'utilisateur","instructions":"Les images d'arrière-plan seront centrées avec une taille par défaut de 590 pixels."},"email":{"title":"Courriel","instructions":"Ne sera jamais visible publiquement","ok":"Nous vous enverrons un courriel de confirmation","invalid":"Merci d'entrer une adresse de courriel valide","authenticated":"Votre adresse de courriel a été authentifiée par {{provider}}","frequency_immediately":"Nous vous enverrons un courriel immédiatement si vous n'avez pas lu le contenu en question.","frequency":{"one":"Nous vous enverrons des courriels seulement si nous ne vous avons pas vu sur le site dans la dernière minute.","other":"Nous vous enverrons des courriels seulement si nous ne vous avons pas vu sur le site dans les dernières {{count}} minutes."}},"name":{"title":"Nom d'utilisateur","instructions":"Votre nom complet (facultatif)","instructions_required":"Votre nom complet","too_short":"Votre nom est trop court","ok":"Votre nom a l'air correct"},"username":{"title":"Pseudo","instructions":"Unique, sans espaces, court","short_instructions":"Les gens peuvent vous mentionner avec @{{username}}","available":"Votre pseudo est disponible","global_match":"L'adresse de courriel correspond au pseudo enregistré","global_mismatch":"Déjà enregistré. Essayez {{suggestion}} ?","not_available":"Non disponible. Essayez {{suggestion}} ?","too_short":"Votre pseudo est trop court","too_long":"Votre pseudo est trop long","checking":"Vérification de la disponibilité du pseudo...","enter_email":"Pseudo trouvé ; entrez l'adresse de courriel correspondante","prefilled":"L'adresse de courriel correspond à ce pseudo enregistré"},"locale":{"title":"Langue de l'interface","instructions":"Langue de l'interface.  Le changement sera pris en compte lorsque vous actualiserez la page.","default":"(par défaut)"},"password_confirmation":{"title":"Confirmation du mot de passe"},"last_posted":"Dernier message","last_emailed":"Dernier courriel","last_seen":"Vu","created":"Inscrit","log_out":"Se déconnecter","location":"Localisation","card_badge":{"title":"Badge pour la carte de l'utilisateur"},"website":"Site internet","email_settings":"Courriel","like_notification_frequency":{"title":"Notifier lors d'un J'aime","always":"Toujours","first_time_and_daily":"La première fois qu'un message est aimé et quotidiennement","first_time":"La première fois qu'un message est aimé","never":"Jamais"},"email_previous_replies":{"title":"Inclure les réponses précédentes en bas des courriels","unless_emailed":"sauf si déjà envoyé","always":"toujours","never":"jamais"},"email_digests":{"title":"Lorsque je ne visite pas le site, m'envoyer un courriel avec un résumé des sujets et réponses populaires","every_30_minutes":"toutes les 30 minutes","every_hour":"toutes les heures","daily":"quotidien","every_three_days":"tous les trois jours","weekly":"hebdomadaire","every_two_weeks":"toutes les deux semaines"},"include_tl0_in_digests":"Inclure les contributions des nouveaux utilisateurs dans les résumés par courriel","email_in_reply_to":"Inclure un extrait du message auquel il a été répondu dans les courriels","email_direct":"M'envoyer un courriel quand quelqu'un me cite, répond à mon message ou mentionne mon @pseudo ou m'invite à rejoindre un sujet","email_private_messages":"M'envoyer un courriel quand quelqu'un m'envoie un message privé","email_always":"Recevoir des notifications par email même lorsque je suis actif sur le site","other_settings":"Autre","categories_settings":"Catégories","new_topic_duration":{"label":"Considérer les sujets comme nouveaux quand","not_viewed":"Je ne les ai pas encore vus","last_here":"créés depuis ma dernière visite","after_1_day":"créés depuis hier","after_2_days":"créés durant les 2 derniers jours","after_1_week":"créés durant les 7 derniers jours","after_2_weeks":"créés durant les 2 dernières semaines"},"auto_track_topics":"Suivre automatiquement les sujets que je consulte","auto_track_options":{"never":"jamais","immediately":"immédiatement","after_30_seconds":"après 30 secondes","after_1_minute":"après 1 minute","after_2_minutes":"après 2 minutes","after_3_minutes":"après 3 minutes","after_4_minutes":"après 4 minutes","after_5_minutes":"après 5 minutes","after_10_minutes":"après 10 minutes"},"invited":{"search":"commencer à saisir pour rechercher vos invitations...","title":"Invitations","user":"Utilisateurs","sent":"Envoyé","none":"Il n'y a pas d'invitations en attente à afficher.","truncated":{"one":"Afficher la première invitation.","other":"Afficher les {{count}} premières invitations."},"redeemed":"Invitations acceptées","redeemed_tab":"Utilisées","redeemed_tab_with_count":"Invitations acceptées ({{count}})","redeemed_at":"Acceptée le","pending":"Invitations en attente","pending_tab":"En attente","pending_tab_with_count":"En attente ({{count}})","topics_entered":"Sujets consultés","posts_read_count":"Messages lus","expired":"Cette invitation a expiré.","rescind":"Supprimer","rescinded":"Invitation annulée","reinvite":"Renvoyer l'invitation","reinvite_all":"Renvoyer toutes les invitations","reinvited":"Invitation renvoyée","reinvited_all":"Invitations renvoyées !","time_read":"Temps de lecture","days_visited":"Ratio de présence","account_age_days":"Âge du compte en jours","create":"Envoyer une invitation","generate_link":"Copier le lien d'invitation","generated_link_message":"\u003cp\u003eLe lien d'invitation a été généré avec succès !\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eLe lien d'invitation est valide uniquement pour cette adresse : \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Vous n'avez encore invité personne. Vous pouvez envoyé des invitations individuelles, ou en masse en \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eenvoyant un fichier d'invitation contenant la liste des courriels\u003c/a\u003e.","text":"Invitation massive depuis un fichier","uploading":"Envoi en cours...","success":"Le fichier a été correctement importé. Vous serez notifié par message privé lorsque le traitement sera terminé.","error":"Il y a eu une erreur lors de l'envoi de '{{filename}}' : {{message}}"}},"password":{"title":"Mot de passe","too_short":"Votre mot de passe est trop court.","common":"Ce mot de passe est trop commun.","same_as_username":"Votre mot de passe est le même que votre pseudo.","same_as_email":"Votre mot de passe est le même que votre adresse mail.","ok":"Votre mot de passe semble correct.","instructions":"Au moins %{count} caractères."},"summary":{"title":"Résumé","stats":"Statistiques","time_read":"temps de lecture","topic_count":{"one":"sujets créés","other":"sujets créés"},"post_count":{"one":"message créé","other":"messages créés"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e donné","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e donnés"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e reçu","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e reçus"},"days_visited":{"one":"jour visité","other":"jours visités"},"posts_read":{"one":"message lu","other":"messages lus"},"bookmark_count":{"one":"signet","other":"signets"},"top_replies":"Réponses les plus référencées","no_replies":"Pas encore de message.","more_replies":"Plus de réponses","top_topics":"Sujets les plus référencés","no_topics":"Pas encore de sujet.","more_topics":"Plus de sujets","top_badges":"Badges les plus accordés","no_badges":"Pas encore de badge.","more_badges":"Plus de badges","top_links":"Liens les plus suivis","no_links":"Pas encore de lien.","most_liked_by":"Les plus aimés par","most_liked_users":"Plus aimé","most_replied_to_users":"Ayant le plus de réponses","no_likes":"Aucun J'aime."},"associated_accounts":"Connexions","ip_address":{"title":"Dernières adresses IP"},"registration_ip_address":{"title":"Adresse IP d'enregistrement"},"avatar":{"title":"Image de profil","header_title":"profil, messages, signets et préférences"},"title":{"title":"Titre"},"filters":{"all":"Tous"},"stream":{"posted_by":"Rédigé par","sent_by":"Envoyé par","private_message":"message privé","the_topic":"le sujet"}},"loading":"Chargement…","errors":{"prev_page":"lors d'une tentative de chargement","reasons":{"network":"Erreur réseau","server":"Erreur serveur","forbidden":"Accès refusé","unknown":"Erreur","not_found":"Page introuvable"},"desc":{"network":"Veuillez vérifier votre connexion.","network_fixed":"On dirait que c'est revenu.","server":"Code d'erreur: {{status}}","forbidden":"Vous n'êtes pas autorisé à voir cela.","not_found":"Oups, l'application a essayé de charger une URL qui n'existe pas.","unknown":"Une erreur est survenue."},"buttons":{"back":"Retour","again":"Réessayer","fixed":"Charger la page"}},"close":"Fermer","assets_changed_confirm":"Ce site vient d'être mis à jour. Rafraîchir maintenant pour accéder à la nouvelle version ?","logout":"Vous avez été déconnecté","refresh":"Rafraîchir","read_only_mode":{"enabled":"Le site est en mode lecture seule. Vous pouvez continer à naviguer, mais les réponses, J'aime et autre interactions sont désactivées pour l'instant.","login_disabled":"Impossible de se connecté quand le site est en mode lecture seule.","logout_disabled":"Impossible de se deconnecter quand le site est en mode lecture seule."},"too_few_topics_and_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eDémarrons cette discussion!\u003c/a\u003e Il y a actuellement \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e sujets et \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e messages. Les nouveaux visiteurs ont besoin de quelques conversations pour lire et répondre.","too_few_topics_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eDémarrons cette discussion !\u003c/a\u003e Il y a actuellement \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e sujets. Les nouveaux visiteurs ont besoin de quelques conversations à lire et répondre.","too_few_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eDémarrons cette discussion !\u003c/a\u003e Il y a actuellement \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e messages. Les nouveaux visiteurs ont besoin de quelques conversations à lire et répondre.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e a atteint la limite de %{siteSettingRate} définie dans les paramètres du site.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e a dépassé la limite de %{siteSettingRate} définie dans les paramètres du site.","rate":{"one":"1 erreur/%{duration}","other":"%{count} erreurs/%{duration}"}},"learn_more":"en savoir plus…","year":"an","year_desc":"sujets créés durant les 365 derniers jours","month":"mois","month_desc":"sujets créés durant les 30 derniers jours","week":"semaine","week_desc":"sujets créés durant les 7 derniers jours","day":"jour","first_post":"Premier message","mute":"Désactiver","unmute":"Activer","last_post":"Dernier message","last_reply_lowercase":"dernière réponse","replies_lowercase":{"one":"réponse","other":"réponses"},"signup_cta":{"sign_up":"S'inscrire","hide_session":"Me le rappeler demain.","hide_forever":"non merci","hidden_for_session":"Très bien, je vous proposerai demain. Vous pouvez toujours cliquer sur 'Se connecter' pour créer un compte.","intro":"Bonjour! :heart_eyes: Vous semblez apprécier la discussion, mais n'avez pas encore créé de compte.","value_prop":"Quand vous créez votre compte, nous stockons ce que vous avez lu pour vous positionner systématiquement sur le bon emplacement à votre retour. Vous  avez également des notifications, ici et par courriel, quand de nouveaux messages sont postés. Et vous pouvez aimer les messages pour partager vos coups de cœurs. :heartbeat:"},"summary":{"enabled_description":"Vous visualisez un résumé de ce sujet : les messages importants choisis par la communauté.","description":"Il y a \u003cb\u003e{{replyCount}}\u003c/b\u003e réponses.","description_time":"Il y a \u003cb\u003e{{replyCount}}\u003c/b\u003e réponses avec un temps estimé de lecture de \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e.","enable":"Résumer ce sujet","disable":"Afficher tous les messages"},"deleted_filter":{"enabled_description":"Ce sujet contient des messages supprimés, qui ont été cachés.","disabled_description":"Les messages supprimés de ce sujet sont visibles.","enable":"Cacher les messages supprimés","disable":"Afficher les messages supprimés"},"private_message_info":{"title":"Message privé","invite":"Inviter d'autres utilisateurs…","remove_allowed_user":"Êtes-vous sûr de vouloir supprimer {{name}} de ce message privé ?","remove_allowed_group":"Êtes-vous sûr de vouloir supprimer {{name}} de ce message privé ?"},"email":"Courriel","username":"Pseudo","last_seen":"Vu","created":"Créé","created_lowercase":"créé","trust_level":"Niveau de confiance","search_hint":"pseudo, courriel ou adresse IP","create_account":{"title":"Créer un nouveau compte","failed":"Quelque chose s'est mal passé, peut-être que cette adresse de courriel est déjà enregistrée, essayez le lien Mot de passe oublié."},"forgot_password":{"title":"Réinitialisation du mot de passe","action":"J'ai oublié mon mot de passe","invite":"Saisir votre pseudo ou votre adresse de courriel, et vous recevrez un nouveau mot de passe par courriel.","reset":"Réinitialiser votre mot de passe","complete_username":"Si un compte correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_email":"Si un compte correspond à l'adresse de courriel \u003cb\u003e%{email}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_username_found":"Nous avons trouvé un compte correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_email_found":"Nous avons trouvé un compte correspond au courriel \u003cb\u003e%{email}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_username_not_found":"Aucun compte ne correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Aucun compte ne correspond à \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Se connecter","username":"Utilisateur","password":"Mot de passe","email_placeholder":"courriel ou pseudo","caps_lock_warning":"Majuscules vérrouillées","error":"Erreur inconnue","rate_limit":"Merci de patienter avant de vous reconnecter.","blank_username_or_password":"Merci de saisir votre courriel ou pseudo, et mot de passe.","reset_password":"Réinitialiser le mot de passe","logging_in":"Connexion en cours…","or":"ou","authenticating":"Authentification…","awaiting_confirmation":"Votre compte est en attente d'activation, utilisez le lien mot de passe oublié pour demander un nouveau courriel d'activation.","awaiting_approval":"Votre compte n'a pas encore été approuvé par un modérateur. Vous recevrez une confirmation par courriel lors de l'activation.","requires_invite":"Désolé, l'accès à ce forum est sur invitation seulement.","not_activated":"Vous ne pouvez pas vous encore vous connecter. Nous avons envoyé un courriel d'activation à \u003cb\u003e{{sentTo}}\u003c/b\u003e. Merci de suivre les instructions afin d'activer votre compte.","not_allowed_from_ip_address":"Vous ne pouvez pas vous connecter depuis cette adresse IP.","admin_not_allowed_from_ip_address":"Vous ne pouvez pas vous connecter comme administrateur depuis cette adresse IP.","resend_activation_email":"Cliquez ici pour envoyer à nouveau le courriel d'activation.","sent_activation_email_again":"Nous venons d'envoyer un nouveau courriel d'activation à \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Il peut prendre quelques minutes à arriver; n'oubliez pas de vérifier votre répertoire spam.","to_continue":"Veuillez vous connecter","preferences":"Vous devez être connecté pour modifier vos préférences utilisateur.","forgot":"J'ai oublié les détails de mon compte","google":{"title":"via Google","message":"Authentification via Google (assurez-vous que les popups ne soient pas bloquées)"},"google_oauth2":{"title":"via Google","message":"Authentification via Google (assurez-vous que les popups ne soient pas bloquées)"},"twitter":{"title":"via Twitter","message":"Authentification via Twitter (assurez-vous que les popups ne soient pas bloquées)"},"instagram":{"title":"avec Instagram","message":"Authentification via Instagtram (assurez-vous que les popups ne soient pas bloquées)"},"facebook":{"title":"via Facebook","message":"Authentification via Facebook (assurez-vous que les popups ne soient pas bloquées)"},"yahoo":{"title":"via Yahoo","message":"Authentification via Yahoo (assurez-vous que les popups ne soient pas bloquées)"},"github":{"title":"via GitHub","message":"Authentification via GitHub (assurez-vous que les popups ne soient pas bloquées)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Catégories seules","categories_with_featured_topics":"Catégories et sujets sélectionnés","categories_and_latest_topics":"Catégories et sujets récents"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"plus...","options":"Options","whisper":"murmure","unlist":"non listé","add_warning":"Ceci est un avertissement officiel.","toggle_whisper":"Modifier le murmure","toggle_unlisted":"Modifier la visibilité","posting_not_on_topic":"À quel sujet voulez-vous répondre ?","saving_draft_tip":"sauvegarde en cours...","saved_draft_tip":"sauvegardé","saved_local_draft_tip":"sauvegardé en local","similar_topics":"Votre message est similaire à...","drafts_offline":"sauvegardé hors ligne","group_mentioned":{"one":"En mentionnant {{group}}, vous êtes sur le point de notifier \u003ca href='{{group_link}}'\u003e1 personne\u003c/a\u003e – êtes-vous sûr ?","other":"En mentionnant {{group}}, vous êtes sur le point de notifier \u003ca href='{{group_link}}'\u003e{{count}} personnes\u003c/a\u003e – êtes-vous sûr ?"},"duplicate_link":"Il semblerait que votre lien vers \u003cb\u003e{{domain}}\u003c/b\u003e a déjà été partagé par \u003cb\u003e@{{username}}\u003c/b\u003e dans \u003ca href='{{post_url}}'\u003eune réponse {{ago}}\u003c/a\u003e – êtes vous sûr de vouloir le partager à nouveau ?","error":{"title_missing":"Le titre est obligatoire.","title_too_short":"Le titre doit avoir au moins {{min}} caractères","title_too_long":"Le titre ne doit pas dépasser les {{max}} caractères","post_missing":"Le message ne peut être vide","post_length":"Le message doit avoir au moins {{min}} caractères","try_like":"Avez-vous essayé le bouton \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e ?","category_missing":"Vous devez choisir une catégorie"},"save_edit":"Sauvegarder la modification","reply_original":"Répondre sur le sujet d'origine","reply_here":"Répondre ici","reply":"Répondre","cancel":"Annuler","create_topic":"Créer un sujet","create_pm":"Message privé","title":"ou appuyez sur Ctrl+Entrée","users_placeholder":"Ajouter un utilisateur","title_placeholder":"Quel est votre sujet en une phrase descriptive ?","edit_reason_placeholder":"pourquoi éditez-vous ?","show_edit_reason":"(ajouter la raison de l'édition)","reply_placeholder":"Écrivez ici. Utilisez Markdown, BBCode, ou HTML pour mettre en forme. Glissez ou collez des images.","view_new_post":"Voir votre nouveau message.","saving":"Sauvegarde","saved":"Sauvegardé !","saved_draft":"Vous avez un message brouillon en cours. Sélectionner cette barre pour reprendre son édition.","uploading":"Envoi en cours…","show_preview":"afficher la prévisualisation \u0026raquo;","hide_preview":"\u0026laquo; cacher la prévisualisation","quote_post_title":"Citer le message en entier","bold_label":"G","bold_title":"Gras","bold_text":"texte en gras","italic_label":"I","italic_title":"Italique","italic_text":"texte en italique","link_title":"Lien","link_description":"saisir ici la description du lien","link_dialog_title":"Insérez le lien","link_optional_text":"titre optionnel","link_url_placeholder":"http://example.com","quote_title":"Citation","quote_text":"Citation","code_title":"Texte préformaté","code_text":"texte préformaté indenté par 4 espaces","paste_code_text":"saisir ou coller le code ici","upload_title":"Envois de fichier","upload_description":"saisir ici la description de votre fichier","olist_title":"Liste numérotée","ulist_title":"Liste à puces","list_item":"Élément","heading_label":"T","heading_title":"Titre","heading_text":"Titre","hr_title":"Barre horizontale","help":"Aide Markdown","toggler":"Afficher ou cacher le composer","modal_ok":"OK","modal_cancel":"Annuler","cant_send_pm":"Désolé, vous ne pouvez pas envoyer de message à l'utilisateur %{username}.","yourself_confirm":{"title":"Avez-vous oublié d'ajouter des destinataires ?","body":"Pour le moment, ce message est uniquement envoyé à vous-même !"},"admin_options_title":"Paramètres optionnels pour ce sujet","auto_close":{"label":"Heure de fermeture automatique de ce sujet :","error":"Merci d'entrer une valeur valide.","based_on_last_post":"Ne pas fermer tant que le dernier message dans ce sujet n'est pas plus ancien que ceci.","all":{"examples":"Saisir un nombre d'heures (24), une heure absolue (17:30) ou une date (2013-11-22 14:00)."},"limited":{"units":"(# d'heures)","examples":"Saisir le nombre d'heures (24)."}},"details_title":"Résumé","details_text":"Ce texte sera caché"},"notifications":{"title":"notifications des mentions de votre @pseudo, des réponses à vos messages, à vos sujets, etc.","none":"Actuellement il est impossible de montrer les notifications.","empty":"Aucune notification trouvée.","more":"voir les anciennes notifications","total_flagged":"Nombre total de messages signalés","mentioned":"\u003ci title='mentionné' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='cité' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='avec réponse' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='édité' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='aimé' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} et 1 autre\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} et {{count}} autres\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='message privé' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='message privé' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invité' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='invitation accepté' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e a accepté votre invitation\u003c/p\u003e","moved_post":"\u003ci title='message déplacé' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e a déplacé {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge décerné' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eVous avez gagné {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNouveau sujet\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='message dans la boite de réception de groupe' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e{{count}} message dans votre boite de réception {{group_name}} \u003c/p\u003e","other":"\u003ci title='messages dans la boite de réception de groupe' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages dans votre boite de réception {{group_name}} \u003c/p\u003e"},"alt":{"mentioned":"Mentionné par","quoted":"Cité par","replied":"Répondu","posted":"Message par","edited":"Editer votre message par","liked":"Aime votre message","private_message":"Message privé de","invited_to_private_message":"Invité pour un message privé par","invited_to_topic":"Invité à un sujet par","invitee_accepted":"Invitation acceptée par","moved_post":"Votre message a été déplacé par","linked":"Lien vers votre message","granted_badge":"Badge attribué","group_message_summary":"Messages dans la boite de réception de groupe."},"popup":{"mentioned":"{{username}} vous a mentionné dans «{{topic}}» - {{site_title}}","group_mentioned":"{{username}} vous a mentionné dans «{{topic}}» - {{site_title}}","quoted":"{{username}} vous a cité dans «{{topic}}» - {{site_title}}","replied":"{{username}} vous a répondu dans «{{topic}}» - {{site_title}}","posted":"{{username}} a posté dans «{{topic}}» - {{site_title}}","private_message":"{{username}} vous a envoyé un message direct «{{topic}}» - {{site_title}}","linked":"{{username}} a créé un lien vers votre message posté dans «{{topic}}» - {{site_title}}"}},"upload_selector":{"title":"Ajouter une image","title_with_attachments":"Ajouter une image ou un fichier","from_my_computer":"Depuis mon appareil","from_the_web":"Depuis le Web","remote_tip":"lien vers l'image","remote_tip_with_attachments":"lien vers l'image ou le fichier {{authorized_extensions}}","local_tip":"sélectionnez des images depuis votre appareil","local_tip_with_attachments":"sélectionnez des images ou des fichiers depuis votre appareil {{authorized_extensions}}","hint":"(vous pouvez également faire un glisser-déposer dans l'éditeur pour les télécharger)","hint_for_supported_browsers":"vous pouvez aussi glisser/déposer ou coller des images dans l'éditeur","uploading":"Fichier en cours d'envoi","select_file":"Sélectionner Fichier","image_link":"lien vers lequel l'image pointera"},"search":{"sort_by":"Trier par","relevance":"Pertinence","latest_post":"Dernier message","most_viewed":"Plus vu","most_liked":"Plus aimé","select_all":"Sélectionner tout","clear_all":"Tout désélectionner","too_short":"Votre terme de recherche est trop court.","result_count":{"one":"1 résultat pour \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} résultats pour \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"rechercher des sujets, messages, utilisateurs ou catégories","no_results":"Aucun résultat.","no_more_results":"Aucun résultat supplémentaire.","search_help":"Aide à la recherche","searching":"Recherche en cours…","post_format":"#{{post_number}} par {{username}}","context":{"user":"Chercher dans les messages de @{{username}}","category":"Rechercher dans la catégorie #{{category}}","topic":"Rechercher dans ce sujet","private_messages":"Rechercher des messages"}},"hamburger_menu":"aller à une autre catégorie ou liste de sujets","new_item":"nouveau","go_back":"retour","not_logged_in_user":"page utilisateur avec un résumé de l'activité en cours et les préférences ","current_user":"voir la page de l'utilisateur","topics":{"bulk":{"unlist_topics":"Ne plus lister les sujets","reset_read":"Réinitialiser la lecture","delete":"Supprimer les sujets","dismiss":"Ignorer","dismiss_read":"Ignorer tous les sujets non lus","dismiss_button":"Ignorer...","dismiss_tooltip":"Ignorer les nouveaux messages ou arrêter des suivre les sujets","also_dismiss_topics":"Arrêter de suivre ces sujets pour qu'ils ne soient plus jamais marqués comme non lus","dismiss_new":"Ignorer les nouveaux","toggle":"activer la sélection multiple des sujets","actions":"Actions sur sélection multiple","change_category":"Modifier la Catégorie","close_topics":"Fermer les sujets","archive_topics":"Sujets archivés","notification_level":"Modifier le niveau de notification","choose_new_category":"Choisissez la nouvelle catégorie pour les sujets :","selected":{"one":"Vous avez sélectionné \u003cb\u003e1\u003c/b\u003e sujet.","other":"Vous avez sélectionné \u003cb\u003e{{count}}\u003c/b\u003e sujets."},"change_tags":"Changer les Tags","choose_new_tags":"Choisir les nouveaux tags pour ces sujets :","changed_tags":"Les tags de ces sujets ont été modifiés."},"none":{"unread":"Vous n'avez aucun sujet non lu.","new":"Vous n'avez aucun nouveau sujet.","read":"Vous n'avez lu aucun sujet pour le moment.","posted":"Vous n'avez écrit aucun message pour le moment.","latest":"Il n'y a aucun sujet pour le moment. C'est triste...","hot":"Il n'y a aucun sujet populaire pour le moment.","bookmarks":"Vous n'avez pas encore ajouté de sujet à vos signets","category":"Il n'y a aucun sujet sur {{category}}.","top":"Il n'y a pas de meilleurs sujets.","search":"Votre recherche ne retourne aucun résultat.","educate":{"new":"\u003cp\u003eVos nouveaux sujets apparaissent ici.\u003c/p\u003e\u003cp\u003ePar défaut, les sujets sont considérés comme nouveaux et affichent l'indicateur \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enouveau\u003c/span\u003e lorsqu'ils ont été créés depuis moins de 2 jours.\u003c/p\u003e\u003cp\u003eVous pouvez modifier cela dans vos \u003ca href=\"%{userPrefsUrl}\"\u003epréférences\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eVos sujets non lus apparaissent ici.\u003c/p\u003e\u003cp\u003ePar défaut, les sujets considérés comme non lus et qui affichent le nombre de messages non lus \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e sont ceux :\u003c/p\u003e \u003cul\u003e\u003cli\u003eque vous avez crées\u003c/li\u003e\u003cli\u003eauxquels vous avez répondus\u003c/li\u003e\u003cli\u003eque vous avez lus plus de 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eou que vous avez explicitement suivis ou surveillés.\u003c/p\u003e\u003cp\u003eVous pouvez modifier cela dans vos \u003ca href=\"%{userPrefsUrl}\"\u003epréférences\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Il n'y a plus de sujets à lire.","hot":"Il n'y a plus de sujets populaires à lire.","posted":"Il n'y a plus de sujets à lire.","read":"Il n'y a plus de sujets à lire.","new":"Il n'y a plus de nouveaux sujets.","unread":"Il n'y a plus de sujets à lire.","category":"Il n'y a plus de sujets dans {{category}} à lire.","top":"Il n'y a plus de meilleurs sujets.","bookmarks":"Il n'y a plus de sujets dans vos signets.","search":"Il n'y a plus de résultats à votre recherche."}},"topic":{"unsubscribe":{"stop_notifications":"Vous recevrez moins de notifications pour \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Votre statut de notification est"},"filter_to":{"one":"1 message dans le sujet","other":"{{count}} messages dans le sujet"},"create":"Créer votre sujet","create_long":"Créer un nouveau sujet","private_message":"Écrire un message","archive_message":{"help":"Transférer message dans votre archive","title":"Archive"},"move_to_inbox":{"title":"Déplacer dans la boîte de réception","help":"Redéplacer dans la boîte de réception"},"list":"Sujets","new":"nouveau sujet","unread":"non lus","new_topics":{"one":"1 nouveau sujet","other":"{{count}} nouveaux sujets"},"unread_topics":{"one":"1 sujet non lu","other":"{{count}} sujets non lus"},"title":"Sujet","invalid_access":{"title":"Ce sujet est privé","description":"Désolé, vous n'avez pas accès à ce sujet !","login_required":"Vous devez vous connecter pour voir ce sujet de discussion."},"server_error":{"title":"Sujet impossible à charger","description":"Désolé, nous n'avons pu charger ce sujet, probablement du à un problème de connexion. Merci de réessayer à nouveau. Si le problème persiste, merci de nous le faire savoir."},"not_found":{"title":"Sujet non trouvé","description":"Désolé, nous n'avons pas trouvé ce sujet. Peut-être a t-il été retiré par un modérateur ?"},"total_unread_posts":{"one":"vous avez 1 message non-lu dans ce sujet","other":"vous avez {{count}} messages non lus dans ce sujet"},"unread_posts":{"one":"vous avez 1 message non lu sur ce sujet","other":"vous avez {{count}} messages non lus sur ce sujet"},"new_posts":{"one":"il y a 1 nouveau message sur ce sujet depuis votre derniere lecture","other":"il y a {{count}} nouveaux messages sur ce sujet depuis votre derniere lecture"},"likes":{"one":"1 personne a aimé ce sujet","other":"{{count}} personnes ont aimés ce sujet"},"back_to_list":"Retour à la liste des sujets","options":"Options du sujet","show_links":"afficher les liens dans ce sujet","toggle_information":"afficher les détails de ce sujet","read_more_in_category":"Vous voulez en lire plus ? Afficher d'autres sujets dans {{catLink}} ou {{latestLink}}.","read_more":"Vous voulez en lire plus ? {{catLink}} or {{latestLink}}.","browse_all_categories":"Voir toutes les catégories","view_latest_topics":"voir les derniers sujets","suggest_create_topic":"Pourquoi ne pas créer votre sujet ?","jump_reply_up":"aller à des réponses précédentes","jump_reply_down":"allez à des réponses ultérieures","deleted":"Ce sujet a été supprimé","auto_close_notice":"Ce sujet sera automatiquement fermé %{timeLeft}.","auto_close_notice_based_on_last_post":"Ce sujet sera fermé %{duration} après la dernière réponse.","auto_close_title":"Paramètres de fermeture automatique","auto_close_save":"Sauvegarder","auto_close_remove":"Ne pas fermer automatiquement ce sujet","auto_close_immediate":{"one":"Le dernier message dans ce sujet est déjà vieux de 1 heure donc le sujet sera immédiatement fermé.","other":"Le dernier message dans ce sujet est déjà vieux de %{count} heures donc le sujet sera immédiatement fermé."},"timeline":{"back":"Retour","back_description":"Revenir sur le dernier message non lu","replies_short":"%{current} / %{total}"},"progress":{"title":"progression dans le sujet","go_top":"haut","go_bottom":"bas","go":"aller","jump_bottom":"aller au dernier message","jump_prompt":"aller au message","jump_prompt_long":"À quel message voulez-vous aller ?","jump_bottom_with_number":"aller au message %{post_number}","total":"total messages","current":"message courant"},"notifications":{"title":"modifier la fréquence des notifications concernant ce sujet","reasons":{"mailing_list_mode":"Vous avez activé la liste de diffusion, vous serez donc notifié des réponses à ce sujet par courriel.","3_10":"Vous recevrez des notifications car vous surveillez un tag de ce sujet.","3_6":"Vous recevrez des notifications parce que vous surveillez cette catégorie.","3_5":"Vous recevrez des notifications parce que vous avez commencé à surveiller ce sujet automatiquement.","3_2":"Vous recevrez des notifications car vous surveillez ce sujet.","3_1":"Vous recevrez des notifications car vous avez créé ce sujet.","3":"Vous recevrez des notifications car vous surveillez ce sujet.","2_8":"Vous recevrez des notifications parce que vous suivez cette catégorie.","2_4":"Vous recevrez des notifications car vous avez écrit une réponse dans ce sujet.","2_2":"Vous recevrez des notifications car vous suivez ce sujet.","2":"Vous recevrez des notifications car vous \u003ca href=\"/users/{{username}}/preferences\"\u003eavez lu ce sujet\u003c/a\u003e.","1_2":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond.","1":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond.","0_7":"Vous ignorez toutes les notifications de cette catégorie.","0_2":"Vous ignorez toutes les notifications de ce sujet.","0":"Vous ignorez toutes les notifications de ce sujet."},"watching_pm":{"title":"Suivre attentivement","description":"Vous serez notifié de chaque nouvelle réponse dans ce message, et le nombre de nouvelles réponses apparaîtra."},"watching":{"title":"Surveiller","description":"Vous serez notifié de chaque nouvelle réponse dans ce sujet, et le nombre de nouvelles réponses apparaîtra."},"tracking_pm":{"title":"Suivi simple","description":"Le nombre de nouvelles réponses apparaîtra pour ce message. Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"tracking":{"title":"Suivi","description":"Le nombre de nouvelles réponses apparaîtra pour ce sujet. Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"regular":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"regular_pm":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"muted_pm":{"title":"Silencieux","description":"Vous ne serez jamais averti de quoi que ce soit à propos de ce message."},"muted":{"title":"Silencieux","description":"Vous ne serez jamais notifié de rien concernant ce sujet, et il n'apparaîtra pas des les derniers sujets."}},"actions":{"recover":"Annuler Suppression Sujet","delete":"Supprimer Sujet","open":"Ouvrir Sujet","close":"Fermer le sujet","multi_select":"Sélectionner les messages...","auto_close":"Fermeture automatique...","pin":"Épingler la discussion...","unpin":"Désépingler la discussion...","unarchive":"Désarchiver le sujet","archive":"Archiver le sujet","invisible":"Retirer de la liste des sujets","visible":"Afficher dans la liste des sujets","reset_read":"Réinitialiser les lectures","make_public":"Rendre le sujet public","make_private":"Rendre le sujet privé"},"feature":{"pin":"Épingler la discussion","unpin":"Désépingler la discussion","pin_globally":"Épingler le sujet globalement","make_banner":"Sujet à la une","remove_banner":"Retirer le sujet à la une"},"reply":{"title":"Répondre","help":"commencez à répondre à ce sujet"},"clear_pin":{"title":"Désépingler","help":"Supprimer l'épingle ce sujet afin qu'il n'apparaisse plus en tête de votre liste de sujet"},"share":{"title":"Partager","help":"partager ce sujet"},"flag_topic":{"title":"Signaler","help":"signaler secrètement ce sujet pour attirer l'attention ou envoyer une notification privée à son propos.","success_message":"Vous avez signalé ce sujet avec succès."},"feature_topic":{"title":"Mettre ce sujet en évidence","pin":"Faire apparaître ce sujet en haut de la catégorie {{categoryLink}} jusqu'à","confirm_pin":"Vous avez déjà {{count}} sujets épinglés. S'il y a trop de sujets épinglés cela peut être lourd pour les nouveaux utilisateurs et utilisateurs anonymes. Êtes-vous sûr de vouloir ajouter un nouveau sujet épinglé dans cette catégorie?","unpin":"Enlever ce sujet du haut de la catégorie {{categoryLink}}.","unpin_until":"Enlever ce sujet du haut de la catégorie {{categoryLink}} ou attendre jusqu'à \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Les utilisateurs peuvent enlever l'épingle de ce sujet eux-mêmes.","pin_validation":"Une date est requise pour épingler ce sujet.","not_pinned":"Aucun sujet actuellement épinglé dans {{categoryLink}}.","already_pinned":{"one":"Sujets actuellement épinglés dans  {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Sujets actuellement épinglés dans  {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Faire apparaître ce sujet en haut de toutes les listes de sujet jusqu'à ","confirm_pin_globally":"Vous avez déjà {{count}} sujets épinglés globalement. S'il y a trop de sujets épinglés cela peut être lourd pour les nouveaux utilisateurs et les utilisateurs anonymes. Êtes-vous sûr de vouloir rajouter une sujet épinglé globalement?","unpin_globally":"Enlever ce sujet du haut de toutes les listes de sujet.","unpin_globally_until":"Enlever ce sujet du haut de toutes les listes de sujet ou attendre jusqu'à \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Les utilisateurs peuvent enlever l'épingle du sujet individuellement.","not_pinned_globally":"Aucun sujet épinglé globalement.","already_pinned_globally":{"one":"Sujets actuellement épinglés globalement : \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Sujets actuellement épinglés globalement : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Mettre ce sujet à la une, il apparaîtra en haut de chaque page.","remove_banner":"Enlever le sujet à la une qui apparaît en haut de chaque page.","banner_note":"Les utilisateurs peuvent ignorer le sujet à la une. Seul un sujet peut être mis à la une à la fois.","no_banner_exists":"Il n'y a pas de sujet à la une.","banner_exists":"Il y \u003cstrong class='badge badge-notification unread'\u003ea\u003c/strong\u003e un sujet à la une."},"inviting":"Invitation en cours…","automatically_add_to_groups":"Cette invitation inclut également l'accès aux groupes suivants :","invite_private":{"title":"Inviter dans la discussion","email_or_username":"Adresse de courriel ou @pseudo de l'invité","email_or_username_placeholder":"adresse de courriel ou @pseudo","action":"Inviter","success":"Nous avons invité cet utilisateur à participer à cette discussion.","success_group":"Nous avons invité ce groupe à participer à cette discussion.","error":"Désolé, il y a eu une erreur lors de l'invitation de cet utilisateur.","group_name":"nom du groupe"},"controls":"Actions sur le sujet","invite_reply":{"title":"Inviter","username_placeholder":"pseudo","action":"Envoyer une invitation","help":"inviter d'autres personnes sur ce sujet par email ou notifications","to_forum":"Nous allons envoyer un courriel à votre ami pour lui permettre de participer au forum juste en cliquant sur un lien, sans qu'il ait à se connecter.","sso_enabled":"Entrez le nom d'utilisateur de la personne que vous souhaitez inviter sur ce sujet.","to_topic_blank":"Entrez le pseudo ou l'adresse email de la personne que vous souhaitez inviter sur ce sujet.","to_topic_email":"Vous avez entré une adresse email. Nous allons envoyer une invitation à votre ami lui permettant de répondre immédiatement à ce sujet.","to_topic_username":"Vous avez entré un nom d'utilisateur. Nous allons envoyer une notification avec un lien les invitant sur ce sujet.","to_username":"Entrez le nom d'utilisateur de la personne que vous souhaitez inviter. Nous enverrons une notification avec un lien les invitant sur ce sujet.","email_placeholder":"nom@exemple.com","success_email":"Nous avons envoyé un email à \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Nous vous avertirons lorsqu'il aura répondu à votre invitation. Suivez l'état de vos invitations dans l'onglet prévu à cet effet sur votre page utilisateur.","success_username":"Nous avons invité cet utilisateur à participer à ce sujet.","error":"Désolé, nous n'avons pas pu inviter cette personne. Elle a peut-être déjà été invitée ? (Le nombre d'invitations est limité)"},"login_reply":"Se connecter pour répondre","filters":{"n_posts":{"one":"1 message","other":"{{count}} messages"},"cancel":"Supprimer le filtre"},"split_topic":{"title":"Déplacer vers un nouveau sujet","action":"déplacer vers un nouveau sujet","topic_name":"Titre du nouveau sujet","error":"Il y a eu une erreur en déplaçant les messages vers un nouveau sujet.","instructions":{"one":"Vous êtes sur le point de créer un nouveau sujet avec le message que vous avez sélectionné.","other":"Vous êtes sur le point de créer un nouveau sujet avec les \u003cb\u003e{{count}}\u003c/b\u003e messages que vous avez sélectionné."}},"merge_topic":{"title":"Déplacer vers Sujet Existant","action":"déplacer vers un sujet existant","error":"Il y a eu une erreur en déplaçant ces messages dans ce sujet.","instructions":{"one":"Merci de sélectionner le sujet dans laquelle vous souhaitez déplacer le message que vous avez sélectionné.","other":"Merci de sélectionner le sujet dans laquelle vous souhaitez déplacer les \u003cb\u003e{{count}}\u003c/b\u003e messages que vous avez sélectionné."}},"merge_posts":{"title":"Fusionner les messages sélectionnés","action":"fusionner les messages sélectionnés","error":"Il y a eu une erreur lors de la fusion des messages sélectionnés."},"change_owner":{"title":"Modifier l'auteur des messages","action":"modifier l'auteur","error":"Il y a eu une erreur durant le changement d'auteur.","label":"Nouvel auteur des messages","placeholder":"pseudo du nouvel auteur","instructions":{"one":"Veuillez choisir un nouvel auteur pour le message de \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Veuillez choisir un nouvel auteur pour les {{count}} messages de \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Aucune notification à propos de ce message ne seront transféré rétroactivement à ce nouvel auteur. \u003cbr\u003eAttention: Actuellement, aucune donnée lié au message n'est transféré vers le nouvel auteur. À utiliser avec précaution."},"change_timestamp":{"title":"Modifier la date/heure","action":"modifier la date/heure","invalid_timestamp":"La date/heure ne peut être dans le futur","error":"Il y a eu une erreur lors de la modification de la date/heure de ce sujet.","instructions":"Veuillez sélectionner la nouvelle date/heure du sujet. Les messages dans ce topic seront mis à jour pour maintenir la même différence d'heure."},"multi_select":{"select":"sélectionner","selected":"({{count}}) sélectionnés","select_replies":"selectionner +réponses","delete":"supprimer la sélection","cancel":"annuler la sélection","select_all":"tout sélectionner","deselect_all":"tout désélectionner","description":{"one":"vous avez sélectionné \u003cb\u003e1\u003c/b\u003e message.","other":"Vous avez sélectionné \u003cb\u003e{{count}}\u003c/b\u003e messages."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"Citer","edit":"Éditer {{link}} par {{replyAvatar}} {{username}}","edit_reason":"Raison :","post_number":"message {{number}}","last_edited_on":"message dernièrement édité le","reply_as_new_topic":"Répondre en créant un sujet lié","continue_discussion":"Suite du sujet {{postLink}}:","follow_quote":"Voir le message cité","show_full":"Voir le message en entier","show_hidden":"Afficher le contenu caché.","deleted_by_author":{"one":"(message supprimé par son auteur, sera supprimé automatiquement dans %{count} heure à moins qu'il ne soit signalé)","other":"(message supprimé par son auteur, sera supprimé automatiquement dans %{count} heures à moins qu'il ne soit signalé)"},"expand_collapse":"étendre/réduire","gap":{"one":"voir 1 réponse cachée","other":"voir {{count}} réponses cachées"},"unread":"Ce message est non lu","has_replies":{"one":"{{count}} Réponse","other":"{{count}} Réponses"},"has_likes":{"one":"{{count}} J'aime","other":"{{count}} J'aime"},"has_likes_title":{"one":"1 personne a aimé ce message","other":"{{count}} personnes ont aimé ce message"},"has_likes_title_only_you":"vous avez aimé ce message","has_likes_title_you":{"one":"vous et 1 autre personne ont aimé ce message","other":"vous et {{count}} autres personnes ont aimé ce message"},"errors":{"create":"Désolé, il y a eu une erreur lors de la publication de votre message. Merci de réessayer.","edit":"Désolé, il y a eu une erreur lors de l'édition de votre message. Merci de réessayer.","upload":"Désolé, il y a eu une erreur lors de l'envoi du fichier. Merci de réessayer.","file_too_large":"Désolé, ce fichier est trop gros (la taille maximale est {{max_size_kb}}kb). Pourquoi ne pas télécharger votre gros fichier sur un service partagé cloud, puis partager le lien?","too_many_uploads":"Désolé, vous ne pouvez envoyer qu'un seul fichier à la fois.","too_many_dragged_and_dropped_files":"Désolé, vous ne pouvez télécharger que 10 fichiers à la fois.","upload_not_authorized":"Désolé, le fichier que vous êtes en train d'envoyer n'est pas autorisé (extensions autorisées : {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Désolé, les nouveaux utilisateurs ne peuvent pas envoyer d'image.","attachment_upload_not_allowed_for_new_user":"Désolé, les nouveaux utilisateurs ne peuvent pas envoyer de fichier.","attachment_download_requires_login":"Désolé, vous devez être connecté pour télécharger une pièce jointe."},"abandon":{"confirm":"Êtes-vous sûr de vouloir abandonner votre message ?","no_value":"Non, le conserver","yes_value":"Oui, abandonner"},"via_email":"message depuis un courriel","via_auto_generated_email":"ce message est arrivé via un courriel généré automatiquement","whisper":"ce message est un murmure privé pour les modérateurs","wiki":{"about":"ce message est un wiki"},"archetypes":{"save":"Sauvegarder les options"},"few_likes_left":"Merci de partager votre amour! Vous avez plus que quelques j'aime à distribuer pour aujourd'hui.","controls":{"reply":"Rédiger une réponse à ce message","like":"J'aime ce message","has_liked":"vous avez aimé ce message","undo_like":"annuler J'aime","edit":"Éditer ce message","edit_anonymous":"Désolé, mais vous devez être connecté pour éditer ce message.","flag":"signaler secrètement ce message pour attirer l'attention ou envoyer une notification privée à son sujet","delete":"Supprimer ce message","undelete":"Annuler la suppression de ce message","share":"partager ce message","more":"Plus","delete_replies":{"confirm":{"one":"Voulez-vous aussi supprimer la réponse qui suit directement ce message ?","other":"Voulez-vous aussi supprimer les  {{count}} réponses qui suivent directement ce message ?"},"yes_value":"Oui, supprimer les réponses également","no_value":"Non, juste ce message"},"admin":"action sur message d'administrateur","wiki":"Basculer en mode wiki","unwiki":"Retirer le mode wiki","convert_to_moderator":"Ajouter la couleur modérateur","revert_to_regular":"Retirer la couleur modérateur","rebake":"Reconstruire l'HTML","unhide":"Ré-afficher","change_owner":"Modifier la propriété"},"actions":{"flag":"Signaler","defer_flags":{"one":"Reporter le signalement","other":"Reporter les signalements"},"undo":{"off_topic":"Annuler le signalement","spam":"Annuler le signalement","inappropriate":"Annuler le signalement","bookmark":"Retirer de vos signets","like":"Annuler J'aime","vote":"Retirer votre vote"},"people":{"off_topic":"signalé comme hors-sujet.","spam":"signalé comme spam","inappropriate":"signalé comme inapproprié","notify_moderators":"signalé aux modérateurs","notify_user":"a envoyé un message","bookmark":"ajouté aux signets","like":"a aimé ceci","vote":"a voté pour ce message"},"by_you":{"off_topic":"Vous l'avez signalé comme étant hors-sujet","spam":"Vous l'avez signalé comme étant du spam","inappropriate":"Vous l'avez signalé comme inapproprié","notify_moderators":"Vous l'avez signalé pour modération","notify_user":"Vous avez envoyé un message à cet utilisateur","bookmark":"Vous l'avez ajouté à vos signets","like":"Vous l'avez aimé","vote":"Vous avez voté pour"},"by_you_and_others":{"off_topic":{"one":"Vous et 1 autre personne l'avez signalé comme étant hors-sujet","other":"Vous et {{count}} autres personnes l'avez signalé comme étant hors-sujet"},"spam":{"one":"Vous et 1 autre personne l'avez signalé comme étant du spam","other":"Vous et {{count}} autres personnes l'avez signalé comme étant du spam"},"inappropriate":{"one":"Vous et 1 autre personne l'avez signalé comme inapproprié","other":"Vous et {{count}} autres personnes l'avez signalé comme inapproprié"},"notify_moderators":{"one":"Vous et 1 autre personne l'avez signalé pour modération","other":"Vous et {{count}} autres personnes l'avez signalé pour modération"},"notify_user":{"one":"1 autre personne et vous avez envoyé un message à cet utilisateur","other":"{{count}} autres personnes et vous avez envoyé un message à cet utilisateur"},"bookmark":{"one":"Vous et 1 autre personne l'avez ajouté à vos signets","other":"Vous et {{count}} autres personnes l'avez ajouté à vos signets"},"like":{"one":"Vous et 1 autre personne l'avez aimé","other":"Vous et {{count}} autres personnes l'avez aimé"},"vote":{"one":"Vous et 1 autre personne avez voté pour","other":"Vous et {{count}} autres personnes avez voté pour"}},"by_others":{"off_topic":{"one":"1 personne l'a signalé comme étant hors-sujet","other":"{{count}} personnes l'ont signalé comme étant hors-sujet"},"spam":{"one":"1 personne a signalé ceci comme étant du spam","other":"{{count}} personnes ont signalé ceci comme étant du spam"},"inappropriate":{"one":"1 personne a signalé ceci comme étant inapproprié","other":"{{count}} personnes ont signalé ceci comme étant inapproprié"},"notify_moderators":{"one":"1 personne a signalé ceci pour modération","other":"{{count}} personnes ont signalé pour modération"},"notify_user":{"one":"1 personne a envoyé un message à cet utilisateur","other":"{{count}} personnes ont envoyé un message à cet utilisateur"},"bookmark":{"one":"1 personne a ajouté ceci à ses signets","other":"{{count}} personnes ont ajouté ceci à leurs signets"},"like":{"one":"1 personne a aimé ceci","other":"{{count}} personnes ont aimé ceci"},"vote":{"one":"1 personne a voté pour ce message","other":"{{count}} personnes ont voté pour ce message"}}},"delete":{"confirm":{"one":"Êtes-vous sûr de vouloir supprimer ce message ?","other":"Êtes-vous sûr de vouloir supprimer tous ces messages ?"}},"merge":{"confirm":{"one":"Êtes-vous sûr de vouloir fusionner ces messages ?","other":"Êtes-vous sûr de vouloir fusionner ces {{count}} messages ?"}},"revisions":{"controls":{"first":"Première Révision","previous":"Révision précédente","next":"Révision suivante","last":"Dernière révision","hide":"Masquer la révision","show":"Afficher la révision","revert":"Revenir à cette révision","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Afficher le rendu avec les ajouts et les retraits en ligne","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Afficher les diffs de rendus côte-à-côte","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Afficher les différences de la source côte-à-côte","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Brut"}}}},"category":{"can":"peut\u0026hellip; ","none":"(pas de catégorie)","all":"Toutes les catégories","choose":"Sélectionner une catégorie\u0026hellip;","edit":"éditer","edit_long":"Modifier","view":"Voir les sujets dans cette catégorie","general":"Général","settings":"Paramètres","topic_template":"Modèle de Sujet","tags":"Tags","tags_allowed_tags":"Tags pouvant être utilisés uniquement dans cette catégorie :","tags_allowed_tag_groups":"Groupes de tags pouvant être utilisés uniquement dans cette catégorie :","tags_placeholder":"(Facultatif) liste des tags autorisés","tag_groups_placeholder":"(Facultatif) liste des groupes de tags autorisés","delete":"Supprimer la catégorie","create":"Nouvelle catégorie","create_long":"Créer une nouvelle catégorie","save":"Enregistrer la catégorie","slug":"Identifiant de la catégorie","slug_placeholder":"(Facultatif) insérer tirets entre mots dans url","creation_error":"Il y a eu une erreur lors de la création de la catégorie.","save_error":"Il y a eu une erreur lors de la sauvegarde de la catégorie.","name":"Nom de la catégorie","description":"Description","topic":"catégorie du sujet","logo":"Logo de la catégorie","background_image":"Image de fond de la catégorie","badge_colors":"Couleurs du badge","background_color":"Couleur du fond","foreground_color":"Couleur du texte","name_placeholder":"Un ou deux mots maximum","color_placeholder":"N'importe quelle couleur","delete_confirm":"Êtes-vous sûr de vouloir supprimer cette catégorie ?","delete_error":"Il y a eu une erreur lors de la suppression.","list":"Liste des catégories","no_description":"Veuillez ajouter une description pour cette catégorie","change_in_category_topic":"Éditer la description","already_used":"Cette couleur est déjà utilisée par une autre catégorie","security":"Sécurité","special_warning":"Avertissement : cette catégorie est une catégorie pré-remplie et les réglages de sécurité ne peuvent pas être modifiés. Si vous ne souhaitez pas utiliser cette catégorie, supprimez-là au lieu de détourner sa fonction.","images":"Images","auto_close_label":"Fermer automatiquement après :","auto_close_units":"heures","email_in":"Adresse de courriel entrante personnalisée :","email_in_allow_strangers":"Accepter les courriels d'utilisateurs anonymes sans compte","email_in_disabled":"La possibilité de créer des nouveaux sujets via courriel est désactivé dans les Paramètres. Pour l'activer,","email_in_disabled_click":"activer le paramètre \"email in\".","suppress_from_homepage":"Retirer cette catégorie de la page d'accueil","allow_badges_label":"Autoriser les badges à être accordé dans cette catégorie","edit_permissions":"Éditer les permissions","add_permission":"Ajouter une Permission","this_year":"cette année","position":"position","default_position":"Position par défaut","position_disabled":"Les catégories seront affichées dans l'ordre d'activité. Pour contrôler l'ordre des catégories dans la liste,","position_disabled_click":"activer le paramètre \"fixed category positions\"","parent":"Catégorie Parent","notifications":{"watching":{"title":"S'abonner","description":"Vous surveillerez automatiquement tous les sujets dans ces catégories. Vous serez notifié des nouveaux messages dans tous les sujets, et le nombre de nouvelles réponses sera affiché."},"watching_first_post":{"title":"Surveiller les nouveaux sujets","description":"Vous serez uniquement notifié du premier message de chaque sujet dans ces catégories."},"tracking":{"title":"Suivi","description":"Vous allez suivre automatiquement tous les sujets dans ces catégories. Vous serez notifié lorsque quelqu'un mentionne votre @pseudo ou vous répond, et le nombre de nouvelles réponses sera affiché."},"regular":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"muted":{"title":"Silencieux","description":"Vous ne serez jamais notifié de rien concernant les nouveaux sujets dans ces catégories, et elles n'apparaîtront pas dans les dernières catégories."}}},"flagging":{"title":"Merci de nous aider à garder notre communauté aimable !","action":"Signaler ce message","take_action":"Signaler","notify_action":"Message","official_warning":"Avertissement officiel","delete_spammer":"Supprimer le spammeur","yes_delete_spammer":"Oui, supprimer le spammeur","ip_address_missing":"(N/A)","hidden_email_address":"(masqué)","submit_tooltip":"Soumettre le signalement privé","take_action_tooltip":"Atteindre le seuil de signalement immédiatement, plutôt que d'attendre plus de signalement de la communauté.","cant":"Désolé, vous ne pouvez pas signaler ce message pour le moment","notify_staff":"Notifier les responsables de manière privée","formatted_name":{"off_topic":"C'est hors-sujet","inappropriate":"C'est inapproprié","spam":"C'est du spam"},"custom_placeholder_notify_user":"Soyez précis, constructif, et toujours respectueux.","custom_placeholder_notify_moderators":"Dites-nous ce qui vous dérange spécifiquement, et fournissez des liens pertinents et exemples si possible.","custom_message":{"at_least":{"one":"saisir au moins 1 caractère","other":"saisir au moins {{count}} caractères"},"more":{"one":"1 restant...","other":"{{count}} restants..."},"left":{"one":"1 restant","other":"{{count}} restants"}}},"flagging_topic":{"title":"Merci de nous aider à garder notre communauté civilisé !","action":"Signaler Sujet","notify_action":"Message"},"topic_map":{"title":"Résumé du sujet","participants_title":"Auteurs fréquents","links_title":"Liens populaires","links_shown":"afficher plus de liens...","clicks":{"one":"1 clic","other":"%{count} clics"}},"post_links":{"about":"développer plus de liens pour ce message","title":{"one":"1 autre","other":"%{count} autres "}},"topic_statuses":{"warning":{"help":"Ceci est un avertissement officiel."},"bookmarked":{"help":"Vous avez ajouté ce sujet à vos signets"},"locked":{"help":"Ce sujet est fermé ; il n'accepte plus de nouvelles réponses"},"archived":{"help":"Ce sujet est archivé; il est gelé et ne peut être modifié"},"locked_and_archived":{"help":"Ce sujet est fermé et archivé ; il n'accepte plus de nouvelles réponses et ne peut plus être modifié"},"unpinned":{"title":"Désépinglé","help":"Ce sujet est désépinglé pour vous; il sera affiché dans l'ordre par défaut"},"pinned_globally":{"title":"Épingler globalement","help":"Ce sujet est épinglé globalement; il apparaîtra en premier dans la liste des derniers sujets et dans sa catégorie"},"pinned":{"title":"Épingler","help":"Ce sujet est épinglé pour vous; il s'affichera en haut de sa catégorie"},"invisible":{"help":"Ce sujet n'apparait plus dans la liste des sujets et sera seulement accessible via un lien direct"}},"posts":"Messages","posts_long":"il y a {{number}} messages dans ce sujet","original_post":"Message original","views":"Vues","views_lowercase":{"one":"vue","other":"vues"},"replies":"Réponses","views_long":"ce sujet a été vu {{number}} fois","activity":"Activité","likes":"J'aime","likes_lowercase":{"one":"J'aime","other":"J'aime"},"likes_long":"il y a {{number}} J'aime dans ce sujet","users":"Utilisateurs","users_lowercase":{"one":"utilisateur","other":"utilisateurs"},"category_title":"Catégorie","history":"Historique","changed_by":"par {{author}}","raw_email":{"title":"Couriel au format brut","not_available":"Indisponible !"},"categories_list":"Liste des Catégories","filters":{"with_topics":"Sujets %{filter}","with_category":"Sujets %{filter} sur %{category}","latest":{"title":"Récents","title_with_count":{"one":"Récent ({{count}})","other":"Récents ({{count}})"},"help":"sujets avec des messages récents"},"hot":{"title":"Populaires","help":"une sélection de sujets populaires"},"read":{"title":"Lus","help":"sujets que vous avez lus, dans l'ordre de dernière lecture"},"search":{"title":"Rechercher","help":"rechercher dans tous les sujets"},"categories":{"title":"Catégories","title_in":"Catégorie - {{categoryName}}","help":"tous les sujets regroupés par catégorie"},"unread":{"title":"Non lus","title_with_count":{"one":"Non lu (1)","other":"Non lus ({{count}})"},"help":"sujets avec des messages non lus que vous suivez ou surveillez","lower_title_with_count":{"one":"1 non lu","other":"{{count}} non lus"}},"new":{"lower_title_with_count":{"one":"1 nouveau","other":"{{count}} nouveaux"},"lower_title":"nouveau","title":"Nouveaux","title_with_count":{"one":"Nouveau (1)","other":"Nouveaux ({{count}})"},"help":"sujets créés dans les derniers jours"},"posted":{"title":"Mes Messages","help":"sujets auxquels vous avez participé"},"bookmarks":{"title":"Signets","help":"sujets ajoutés à vos signets"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"derniers sujets dans la catégorie {{categoryName}}"},"top":{"title":"Top","help":"les meilleurs sujets de l'année, du mois, de la semaine ou du jour","all":{"title":"Depuis toujours"},"yearly":{"title":"Annuel"},"quarterly":{"title":"Trimestriel"},"monthly":{"title":"Mensuel"},"weekly":{"title":"Hebdomadaire"},"daily":{"title":"Quotidien"},"all_time":"Depuis toujours","this_year":"Année","this_quarter":"Trimestre","this_month":"Mois","this_week":"Semaine","today":"Aujourd'hui","other_periods":"voir le top"}},"browser_update":"Malheureusement, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003evotre navigateur est trop vieux pour ce site\u003c/a\u003e. Merci \u003ca href=\"http://browsehappy.com\"\u003ede mettre à jour votre navigateur\u003c/a\u003e.","permission_types":{"full":"Créer / Répondre / Voir","create_post":"Répondre / Voir","readonly":"Voir"},"lightbox":{"download":"télécharger"},"search_help":{"title":"Aide à la recherche"},"keyboard_shortcuts_help":{"title":"Raccourcis clavier","jump_to":{"title":"Aller à","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Accueil","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Récents","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nouveaux","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Non lus","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Catégories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Signets","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Aller au sujet #","back":"\u003cb\u003eu\u003c/b\u003e Retour","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Déplacer la sélection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e ou \u003cb\u003eEntrée\u003c/b\u003e Ouvrir le sujet sélectionné","next_prev":"\u003cb\u003eMAJ.\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eMAJ.\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Section suivante/précédente"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Créer un nouveau sujet","notifications":"\u003cb\u003en\u003c/b\u003e Ouvrir les notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Ouvrir le menu hamburger","user_profile_menu":"\u003cb\u003ep\u003c/b\u003eOuvrir le menu utilisateur","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Montrer les sujets mis à jour récemment","search":"\u003cb\u003e/\u003c/b\u003e Rechercher","help":"\u003cb\u003e?\u003c/b\u003e Ouvrir l'aide du clavier","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Ignorer les nouveaux messages","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Ignorer les sujets","log_out":"\u003cb\u003eMAJ.\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eMAJ.\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Se déconnecter"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Modifier le signet du sujet","pin_unpin_topic":"\u003cb\u003eMAJ.\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Épingler/désépingler le sujet","share_topic":"\u003cb\u003eMAJ.\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Partager le sujet","share_post":"\u003cb\u003es\u003c/b\u003e Partager le message","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Répondre en tant que sujet lié","reply_topic":"\u003cb\u003eMAJ.\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Répondre au sujet","reply_post":"\u003cb\u003er\u003c/b\u003e Répondre au message","quote_post":"\u003cb\u003eq\u003c/b\u003e Citer le message","like":"\u003cb\u003el\u003c/b\u003e Aimer le message","flag":"\u003cb\u003e!\u003c/b\u003e Signaler le message","bookmark":"\u003cb\u003eb\u003c/b\u003e Ajouter le message aux signets","edit":"\u003cb\u003ee\u003c/b\u003e Modifier le message","delete":"\u003cb\u003ed\u003c/b\u003e Supprimer le message","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mettre le sujet en silencieux","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Notifications par défaut pour le sujet","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Suivre le sujet","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Surveiller le sujet"}},"badges":{"earned_n_times":{"one":"A reçu ce badge 1 fois","other":"A reçu ce badge %{count} fois"},"granted_on":"Accordé le %{date}","others_count":"Autres utilisateurs avec ce badge (%{count})","title":"Badges","allow_title":"titre disponible","multiple_grant":"attribué plusieurs fois","badge_count":{"one":"1 badge","other":"%{count} badges"},"more_badges":{"one":"+1 autre","other":"+%{count} autres"},"granted":{"one":"1 décerné","other":"%{count} décernés"},"select_badge_for_title":"Sélectionner un badge comme titre","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Initiation"},"community":{"name":"Communauté"},"trust_level":{"name":"Niveau de confiance"},"other":{"name":"Autre"},"posting":{"name":"Contribution"}}},"google_search":"\u003ch3\u003eRechercher avec Google\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Tous les tags","selector_all_tags":"tous les tags","selector_no_tags":"aucun tags","changed":"tags modifiés :","tags":"Tags","choose_for_topic":"choisir des tags optionnels pour ce sujet","delete_tag":"Supprimer le tag","delete_confirm":"Êtes-vous sûr de vouloir supprimer ce tag ?","rename_tag":"Renommer ce tag","rename_instructions":"Choisir un nouveau nom pour ce tag :","sort_by":"Trier par :","sort_by_count":"nombre","sort_by_name":"nom","manage_groups":"Gérer les groupes de tags","manage_groups_description":"Définir des groupes pour organiser les tags","filters":{"without_category":"%{filter} %{tag} sujets","with_category":"%{filter} %{tag} sujets dans %{category}","untagged_without_category":"%{filter} sujets non tagués","untagged_with_category":"%{filter} sujets non tagués dans %{category}"},"notifications":{"watching":{"title":"Abonné","description":"Vous surveillerez automatiquement tous les sujets avec ce tag. Vous serez notifié de tous les nouveaux messages et sujets, et le nombre de messages non lus et nouveaux apparaîtra à côté du sujet."},"watching_first_post":{"title":"Surveiller les nouveaux sujets","description":"Vous serez uniquement notifié du premier message de chaque sujet avec ce tag."},"tracking":{"title":"Suivi","description":"Vous allez suivre automatiquement tous les sujets avec ce tag. Le nombre de messages non lus et nouveaux apparaîtra à côté du sujet."},"regular":{"title":"Normal","description":"Vous serez notifié si un utilisateur mentionne votre @pseudo ou répond à votre message."},"muted":{"title":"Silencieux","description":"Vous ne recevrez aucune notification sur des nouveaux sujets avec ce tag, et ils n’apparaîtront pas dans l'onglet non lus."}},"groups":{"title":"Groupes de tags","about":"Ajouter des tags aux groupes pour les gérer plus facilement.","new":"Nouveau groupe","tags_label":"Tags dans ce groupe :","parent_tag_label":"Tag parent :","parent_tag_placeholder":"Facultatif","parent_tag_description":"Les tags de ce groupe ne peuvent pas être utilisés sauf si le tag parent est présent.","one_per_topic_label":"Limiter à un tag de ce groupe par sujet","new_name":"Nouveau groupe de tags","save":"Sauvegarder","delete":"Supprimer","confirm_delete":"Êtes-vous sûr de vouloir supprimer ce groupe de tags ?"},"topics":{"none":{"unread":"Vous n'avez aucun sujet non lu.","new":"Vous n'avez aucun nouveau sujet.","read":"Vous n'avez lu aucun sujet pour le moment.","posted":"Vous n'avez écrit dans aucun sujet pour le moment.","latest":"Il n'y a pas de sujets récents.","hot":"Il n'y a pas de sujets populaires.","bookmarks":"Vous n'avez pas encore ajouté de sujets à vos signets","top":"Il n'y a pas de meilleurs sujets.","search":"Il n'y a pas de résultats de recherche."},"bottom":{"latest":"Il n'y a plus de sujets récents.","hot":"Il n'y a plus de sujets populaires.","posted":"Il n'y a plus de sujets publiés.","read":"Il n'y a plus de sujets lus.","new":"Il n'y a plus de nouveaux sujets.","unread":"Il n'y a plus de sujets non lus.","top":"Il n'y a plus de meilleurs sujets.","bookmarks":"Il n'y a plus de sujets dans vos signets.","search":"Il n'y a plus de résultats de recherche."}}},"invite":{"custom_message":"Rendez votre invitation plus personnelle en écrivant un","custom_message_link":"message personnalisé","custom_message_placeholder":"Entrez votre message personnalisé","custom_message_template_forum":"Hey, tu devrais rejoindre ce forum !","custom_message_template_topic":"Hey, je pensais que tu pourrais aimer ce sujet !"},"poll":{"voters":{"one":"votant","other":"votants"},"total_votes":{"one":"vote au total","other":"votes au total"},"average_rating":"Notation moyenne : \u003cstrong\u003e%{average}\u003c/strong\u003e","public":{"title":"Les votes sont publics."},"multiple":{"help":{"at_least_min_options":{"one":"Choisissez au moins \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choisissez au moins \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choisissez jusqu'à \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choisissez jusqu'à \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choisissez \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choisissez \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choisissez entre \u003cstrong\u003e%{min}\u003c/strong\u003e et \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"cast-votes":{"title":"Distribuez vos votes","label":"Votez maintenant !"},"show-results":{"title":"Afficher les résultats du sondage","label":"Afficher les résultats"},"hide-results":{"title":"Retourner au vote","label":"Masquer les résultats"},"open":{"title":"Ouvrir le sondage","label":"Ouvrir","confirm":"Êtes-vous sûr de vouloir ouvrir ce sondage ?"},"close":{"title":"Fermer le sondage","label":"Fermer","confirm":"Êtes-vous sûr de vouloir fermer ce sondage ?"},"error_while_toggling_status":"Désolé, il y a eu une erreur lors du changement de statut de ce sondage.","error_while_casting_votes":"Désolé, il y a eu une erreur lors de l'envoi de vos votes.","error_while_fetching_voters":"Désolé, il y a eu une erreur lors de l'affichage des votants.","ui_builder":{"title":"Créer un sondage","insert":"Insérer le sondage","help":{"options_count":"Entrez au moins 2 options"},"poll_type":{"label":"Type","regular":"Choix unique","multiple":"Choix multiple","number":"Nombre"},"poll_config":{"max":"Max","min":"Min","step":"Pas"},"poll_public":{"label":"Afficher les votants"},"poll_options":{"label":"Entrez une option de sondage par ligne"}}},"details":{"title":"Cacher le texte"},"type_to_filter":"Commencez à taper pour filtrer...","admin":{"title":"Administrateur","moderator":"Modérateur","dashboard":{"title":"Tableau de bord","last_updated":"Tableau de bord actualisé le :","version":"Version de Discourse","up_to_date":"Vous utilisez la dernière version de Discourse.","critical_available":"Une mise à jour critique est disponible.","updates_available":"Des mises à jour sont disponibles.","please_upgrade":"Veuillez mettre à jour !","no_check_performed":"Une vérification des mises à jour n'a pas été effectuée. Vérifiez que sidekiq est en cours d'exécution.","stale_data":"Une vérification des mises à jour n'a pas été effectuée récemment. Vérifiez que sidekiq est en cours d'exécution.","version_check_pending":"On dirait que vous avez fait une mise à jour récemment. Fantastique!","installed_version":"Version installée","latest_version":"Dernière version","problems_found":"Quelques problèmes ont été trouvés dans votre installation de Discourse :","last_checked":"Dernière vérification","refresh_problems":"Rafraîchir","no_problems":"Aucun problème n'a été trouvé.","moderators":"Modérateurs :","admins":"Administateurs :","blocked":"Bloqués :","suspended":"Suspendu :","private_messages_short":"Msgs","private_messages_title":"Messages","mobile_title":"Mobile","space_free":"{{size}} libre","uploads":"téléchargements","backups":"sauvegardes","traffic_short":"Trafic","traffic":"Requêtes Web Application","page_views":"Requêtes API","page_views_short":"Requêtes API","show_traffic_report":"Voir rapport de trafic détaillé","reports":{"today":"Aujourd'hui","yesterday":"Hier","last_7_days":"les 7 derniers jours","last_30_days":"les 30 derniers jours","all_time":"Depuis toujours","7_days_ago":"il y a 7 jours","30_days_ago":"il y a 30 jours","all":"Tous","view_table":"tableau","view_graph":"graphique","refresh_report":"Actualiser le rapport","start_date":"Date de début","end_date":"Date de fin","groups":"Tous les groupes"}},"commits":{"latest_changes":"Dernières modifications: merci de mettre à jour régulièrement!","by":"par"},"flags":{"title":"Signalements","old":"Ancien","active":"Actifs","agree":"Accepter","agree_title":"Confirme que le signalement est correct et valide.","agree_flag_modal_title":"Accepter et...","agree_flag_hide_post":"Accepter (cacher le message + envoi d'un MP)","agree_flag_hide_post_title":"Masquer ce message et envoyer automatiquement un message à l'utilisateur afin qu'il le modifie rapidement","agree_flag_restore_post":"Accepter (restauré le message)","agree_flag_restore_post_title":"Restaurer ce message","agree_flag":"Accepter le signalement","agree_flag_title":"Accepter le signalement et garder le message inchangé","defer_flag":"Reporter","defer_flag_title":"Retirer le signalement; il ne requière pas d'action pour le moment.","delete":"Supprimer","delete_title":"Supprimer le message signalé.","delete_post_defer_flag":"Supprimer le message et reporter le signalement","delete_post_defer_flag_title":"Supprimer le message; si c'est le premier message, le sujet sera supprimé","delete_post_agree_flag":"Supprimer le message et accepter le signalement","delete_post_agree_flag_title":"Supprimer le message; si c'est le premier message, le sujet sera supprimé","delete_flag_modal_title":"Supprimer et...","delete_spammer":"Supprimer le spammer","delete_spammer_title":"Supprimer cet utilisateur et tous ses messages et sujets de ce dernier.","disagree_flag_unhide_post":"Refuser (ré-afficher le message)","disagree_flag_unhide_post_title":"Supprimer tous les signalements de ce message et ré-affiché ce dernier","disagree_flag":"Refuser","disagree_flag_title":"Refuser le signalement car il est invalide ou incorrect","clear_topic_flags":"Terminer","clear_topic_flags_title":"Ce sujet a été étudié et les problèmes ont été résolus. Cliquez sur Terminer pour enlever les signalements.","more":"(plus de réponses...)","dispositions":{"agreed":"accepté","disagreed":"refusé","deferred":"reporté"},"flagged_by":"Signalé par","resolved_by":"Résolu par","took_action":"Prendre une mesure","system":"Système","error":"Quelque chose s'est mal passé","reply_message":"Répondre","no_results":"Il n'y a aucun signalements.","topic_flagged":"Ce \u003cstrong\u003esujet\u003c/strong\u003e a été signalé.","visit_topic":"Consulter le sujet pour intervenir","was_edited":"Le message a été édité après le premier signalement","previous_flags_count":"Ce message a déjà été signalé {{count}} fois.","summary":{"action_type_3":{"one":"hors sujet","other":"hors sujet x{{count}}"},"action_type_4":{"one":"inaproprié","other":"inaproprié x{{count}}"},"action_type_6":{"one":"personnalisé","other":"personnalisé x{{count}}"},"action_type_7":{"one":"personnalisé","other":"personnalisé x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Groupe primaire","no_primary":"(pas de groupe primaire)","title":"Groupes","edit":"Éditer les groupes","refresh":"Actualiser","new":"Nouveau","selector_placeholder":"entrer le pseudo","name_placeholder":"Nom du groupe, sans espace, mêmes règles que pour les pseudos","about":"Modifier votre adhésion et les noms ici","group_members":"Membres du groupe","delete":"Supprimer","delete_confirm":"Supprimer ce groupe ?","delete_failed":"Impossible de supprimer le groupe. Si c'est un groupe automatique il ne peut être détruit.","delete_member_confirm":"Enlever '%{username}' du groupe '%{group}'?","delete_owner_confirm":"Retirer les privilèges de propriétaire pour '%{username}' ?","name":"Nom","add":"Ajouter","add_members":"Ajouter des membres","custom":"Personnaliser","bulk_complete":"Les utilisateurs ont été ajoutés au groupe","bulk":"Ajouter au groupe en masse","bulk_paste":"Coller une liste de pseudo ou courriel, un par ligne :","bulk_select":"(sélectionner un groupe)","automatic":"Automatique","automatic_membership_email_domains":"Les utilisateurs qui s'enregistrent avec un domaine courriel qui correspond exactement à un élément de cette liste seront automatiquement ajoutés à ce groupe:","automatic_membership_retroactive":"Appliquer la même règle de domaine courriel pour les utilisateurs existants","default_title":"Titre par défaut pour tous les utilisateurs de ce groupe","primary_group":"Définir comme groupe primaire automatiquement","group_owners":"Propriétaires","add_owners":"Ajouter des propriétaires","incoming_email":"Adresse e-mail d'expédition personnalisée","incoming_email_placeholder":"Entrer une adresse e-mail","flair_url":"URL de la vignette d'avatar","flair_url_placeholder":"(Facultatif) URL de l'image","flair_bg_color":"Couleur de l'arrière-plan de la vignette d'avatar","flair_bg_color_placeholder":"(Facultatif) Couleur en héxadécimal","flair_preview":"Prévisualiser"},"api":{"generate_master":"Générer une clé Maître pour l'API","none":"Il n'y a pas de clés API actives en ce moment.","user":"Utilisateur","title":"API","key":"Clé API","generate":"Générer","regenerate":"Regénérer","revoke":"Révoquer","confirm_regen":"Êtes-vous sûr de vouloir remplacer cette clé API par une nouvelle ?","confirm_revoke":"Êtes-vous sûr de vouloir révoquer cette clé ?","info_html":"Cette clé vous permettra de créer et mettre à jour des sujets à l'aide d'appels JSON.","all_users":"Tous les Utilisateurs","note_html":"Gardez cette clé \u003cstrong\u003esecrète\u003c/strong\u003e ! Tous les personnes qui la possède peuvent créer des messages au nom de n'import quel utilisateur."},"plugins":{"title":"Plugins","installed":"Plugins installés","name":"Nom du plugin","none_installed":"Vous n'avez aucun plugin installé.","version":"Version du plugin","enabled":"Activé ?","is_enabled":"O","not_enabled":"N","change_settings":"Changer les paramètres","change_settings_short":"Paramètres","howto":"Comment installer des plugins ?"},"backups":{"title":"Sauvegardes","menu":{"backups":"Sauvegardes","logs":"Journaux"},"none":"Aucune sauvegarde disponible.","read_only":{"enable":{"title":"Activer le mode lecture seule","label":"Activer la lecture seule","confirm":"Etes-vous sûr de vouloir activer le mode lecture seule?"},"disable":{"title":"Désactiver le mode lecture seule","label":"Désactiver lecture seule"}},"logs":{"none":"Pas de journaux pour l'instant..."},"columns":{"filename":"Nom du fichier","size":"Taille"},"upload":{"label":"Envoyer","title":"Envoyer une sauvegarde à cette instance","uploading":"Envoi en cours...","success":"'{{filename}}' a été envoyé avec succès.","error":"Il y a eu une erreur lors de l'envoi de '{{filename}}': {{message}}"},"operations":{"is_running":"Une opération est en cours d'exécution ...","failed":"Le/La {{operation}} a échoué(e). Veuillez consulter les journaux.","cancel":{"label":"Annuler","title":"Annuler l'opération en cours","confirm":"Êtes-vous sûr de vouloir annuler l'opération en cours?"},"backup":{"label":"Sauvegarder","title":"Créer une sauvegarde","confirm":"Voulez-vous démarrer une nouvelle sauvegarde ?","without_uploads":"Oui (ne pas inclure les fichiers)"},"download":{"label":"Télécharger","title":"Télécharger la sauvegarde"},"destroy":{"title":"Supprimer la sauvegarde","confirm":"Êtes-vous sûr de vouloir détruire cette sauvegarde?"},"restore":{"is_disabled":"La restauration est désactivée dans les paramètres du site.","label":"Restaurer","title":"Restaurer la sauvegarde","confirm":"Êtes-vous sûr de vouloir restaurer cette sauvegarde?"},"rollback":{"label":"Revenir en arrière","title":"Restaurer (RollBack) la base de données à l'état de travail précédent","confirm":"Êtes-vous sûr de vouloir restaurer la base de données à l'état de fonctionnement précédent?"}}},"export_csv":{"user_archive_confirm":"Êtes-vous sûr de vouloir télécharger vos messages?","success":"L'exportation a été démarrée. Vous serez notifié par message lorsque le traitement sera terminé.","failed":"L'export a échoué. Veuillez consulter les logs.","rate_limit_error":"Les messages peuvent être téléchargés une fois par jour, veuillez ressayer demain.","button_text":"Exporter","button_title":{"user":"Exporter la liste des utilisateurs dans un fichier CSV.","staff_action":"Exporter la liste des actions des responsables dans un fichier CSV.","screened_email":"Exporter la liste des adresses de courriel sous surveillance dans un fichier CSV.","screened_ip":"Exporter la liste complète des adresses IP sous surveillance dans un fichier CSV.","screened_url":"Exporter toutes les URL sous surveillance vers un fichier CSV"}},"export_json":{"button_text":"Exporter"},"invite":{"button_text":"Envoyer invitations","button_title":"Envoyer invitations"},"customize":{"title":"Personnaliser","long_title":"Personnalisation du site","css":"CSS","header":"En-tête","top":"Top","footer":"Pied de page","embedded_css":"CSS intégré","head_tag":{"text":"\u003c/head\u003e","title":"HTML qui sera inséré avant la balise \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML qui sera inséré avant la balise \u003c/body\u003e"},"override_default":"Ne pas inclure la feuille de style par défaut","enabled":"Activé ?","preview":"prévisualiser","undo_preview":"supprimer l'aperçu","rescue_preview":"style par défaut","explain_preview":"Voir le site avec la feuille de style personnalisé","explain_undo_preview":"Revenir à la feuille de style personnalisé actuellement activée","explain_rescue_preview":"Voir le site avec la feuille de style par défaut","save":"Sauvegarder","new":"Nouveau","new_style":"Nouveau style","import":"Importer","import_title":"Sélectionnez un fichier ou collez du texte","delete":"Supprimer","delete_confirm":"Supprimer cette personnalisation","about":"Modification des feuilles de styles et en-têtes de votre site. Ajouter un style personnalisé pour commencer.","color":"Couleur","opacity":"Opacité","copy":"Copier","email_templates":{"title":"Modèle de courriel","subject":"Objet","multiple_subjects":"Ce modèle d'e-mail a plusieurs objets.","body":"Corps","none_selected":"Choisissez un modèle de courriel pour commencer l'édition","revert":"Annuler les changements","revert_confirm":"Êtes-vous sur de vouloir annuler vos changements ?"},"css_html":{"title":"CSS/HTML","long_title":"Personnalisation du CSS et HTML"},"colors":{"title":"Couleurs","long_title":"Palettes de couleurs","about":"Modification des couleurs utilisés par le site sans écrire du CSS. Ajouter une palette pour commencer.","new_name":"Nouvelle palette de couleurs","copy_name_prefix":"Copie de","delete_confirm":"Supprimer cette palette de couleurs ?","undo":"annuler","undo_title":"Annuler vos modifications sur cette couleur depuis la dernière fois qu'elle a été sauvegarder.","revert":"rétablir","revert_title":"Rétablir la couleur de la palette par défaut de Discourse.","primary":{"name":"primaire","description":"La plupart des textes, icônes et bordures."},"secondary":{"name":"secondaire","description":"Les couleurs principales du fond et des textes de certains boutons."},"tertiary":{"name":"tertiaire","description":"Liens, boutons, notifications et couleurs d'accentuation."},"quaternary":{"name":"quaternaire","description":"Liens de navigation."},"header_background":{"name":"fond du header","description":"Couleur de fond du header."},"header_primary":{"name":"header primaire","description":"Textes et icônes du header. "},"highlight":{"name":"accentuation","description":"La couleur de fond des éléments accentués sur la page, comme les messages et sujets."},"danger":{"name":"danger","description":"Couleur d'accentuation pour les actions comme les messages et sujets supprimés."},"success":{"name":"succès","description":"Utiliser pour indiquer qu'une action a réussi."},"love":{"name":"aimer","description":"La couleur du bouton \"J'aime\"."}}},"email":{"title":"Courriels","settings":"Paramètrage","templates":"Modèles","preview_digest":"Prévisualisation du courriel","sending_test":"Envoi en cours du courriel de test...","error":"\u003cb\u003eERREUR\u003c/b\u003e - %{server_error}","test_error":"Il y a eu un problème avec l'envoi du courriel de test. Veuillez vérifier vos paramètres, que votre hébergeur ne bloque pas les connections aux courriels, et réessayer.","sent":"Envoyés","skipped":"Ignorés","bounced":"Rejeté","received":"Reçus","rejected":"Rejetés","sent_at":"Envoyer à","time":"Heure","user":"Utilisateur","email_type":"Type de courriel","to_address":"À l'adresse","test_email_address":"Adresse de courriel à tester","send_test":"Envoyer un courriel de test","sent_test":"Envoyé !","delivery_method":"Méthode d'envoi","preview_digest_desc":"Prévisualiser le contenu des courriels hebdomadaires sommaires envoyés aux utilisateurs inactifs.","refresh":"Rafraîchir","format":"Format","html":"html","text":"texte","last_seen_user":"Dernière utilisateur vu :","reply_key":"Répondre","skipped_reason":"Passer Raison","incoming_emails":{"from_address":"De","to_addresses":"A","cc_addresses":"Cc","subject":"Objet","error":"Erreur","none":"Aucun courriel reçu.","modal":{"title":"Détails du courriel entrant","error":"Erreur","headers":"En-têtes","subject":"Subject","body":"Body","rejection_message":"Courriel de refus"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Objet...","error_placeholder":"Erreur"}},"logs":{"none":"Pas de journaux trouvés.","filters":{"title":"Filtrer","user_placeholder":"pseudo","address_placeholder":"nom@exemple.com","type_placeholder":"résumé, inscription...","reply_key_placeholder":"clé de réponse","skipped_reason_placeholder":"raison"}}},"logs":{"title":"Journaux","action":"Action","created_at":"Créé","last_match_at":"Dernière occurence","match_count":"Occurences","ip_address":"IP","topic_id":"Identifiant du sujet","post_id":"Identifiant du message","category_id":"ID catégorie","delete":"Supprimer","edit":"Éditer","save":"Sauvegarder","screened_actions":{"block":"bloquer","do_nothing":"ne rien faire"},"staff_actions":{"title":"Actions des modérateurs","instructions":"Cliquez sur les pseudos et les actions pour filtrer la liste. Cliquez sur les images de profil pour aller aux pages des utilisateurs.","clear_filters":"Tout Afficher","staff_user":"Membre de l'équipe des modérateurs","target_user":"Utilisateur cible","subject":"Sujet","when":"Quand","context":"Contexte","details":"Détails","previous_value":"Précédent","new_value":"Nouveau","diff":"Diff","show":"Afficher","modal_title":"Détails","no_previous":"Il n'y a pas de valeur précédente.","deleted":"Pas de nouvelle valeur. L'enregistrement a été supprimé.","actions":{"delete_user":"Supprimer l'utilisateur","change_trust_level":"modifier le niveau de confiance","change_username":"modifier pseudo","change_site_setting":"modifier les paramètres du site","change_site_customization":"modifier la personnalisation du site","delete_site_customization":"supprimer la personnalisation du site","change_site_text":"modifier le texte du site","suspend_user":"suspendre l'utilisateur","unsuspend_user":"retirer la suspension de l'utilisateur","grant_badge":"décerné le badge","revoke_badge":"retirer le badge","check_email":"vérifier l'adresse courriel","delete_topic":"supprimer le sujet","delete_post":"supprimer le message","impersonate":"incarner","anonymize_user":"rendre l'utilisateur anonyme","roll_up":"consolider des blocs d'IP","change_category_settings":"modifier les paramètres de la catégorie","delete_category":"supprimer la catégorie","create_category":"créer une catégorie","block_user":"bloquer l'utilisateur","unblock_user":"débloquer l'utilisateur","grant_admin":"Accorder les droits d'admin","revoke_admin":"Révoquer les droits d'admin","grant_moderation":"Accorder les droits de modération","revoke_moderation":"Révoquer les droits de modération","backup_operation":"sauvegarde","deleted_tag":"tag supprimé","renamed_tag":"tag renommé","revoke_email":"révoquer le courriel"}},"screened_emails":{"title":"Courriels affichés","description":"Lorsque quelqu'un essaye de créé un nouveau compte, les adresses de courriel suivantes seront vérifiées et l'inscription sera bloquée, ou une autre action sera réalisée.","email":"Courriel","actions":{"allow":"Autoriser"}},"screened_urls":{"title":"URL affichées","description":"Les URL listées ici ont été utilisées dans des messages émis par des utilisateurs ayant été identifié comme spammeur.","url":"URL","domain":"Domaine"},"screened_ips":{"title":"IP surveillés","description":"Adresses IP qui sont surveillés. Utiliser \"Autoriser\" pour ajouter les adresses IP à la liste blanche.","delete_confirm":"Êtes-vous sûr de vouloir supprimer la règle pour %{ip_address} ?","roll_up_confirm":"Êtes-vous certain de vouloir consolider les adresses IP interdites sous forme de plages de sous réseaux ?","rolled_up_some_subnets":"Consolidation réussie des adresses IP interdites vers ces plages de sous réseau: %{subnets}.","rolled_up_no_subnet":"Aucune consolidation possible.","actions":{"block":"Bloquer","do_nothing":"Autoriser","allow_admin":"Autoriser les administrateurs"},"form":{"label":"Nouveau :","ip_address":"Adresse IP","add":"Ajouter","filter":"Rechercher"},"roll_up":{"text":"Consolider","title":"Créer de nouvelles plages de sous réseaux à bannir s'il y a au moins 'min_ban_entries_for_roll_up' entrées."}},"logster":{"title":"Logs d'erreurs"}},"impersonate":{"title":"Incarner","help":"Utiliser cet outil pour incarner un compte utilisateur à des fins de tests.\nVous devrez vous déconnecter une fois terminé.","not_found":"Cet utilisateur n'a pas été trouvé.","invalid":"Désolé, vous ne pouvez pas vous faire passer pour cet utilisateur."},"users":{"title":"Utilisateurs","create":"Ajouter un administateur","last_emailed":"Derniers contacts","not_found":"Désolé ce pseudo n'existe pas dans notre système.","id_not_found":"Désolé cet identifiant d'utilisateur n'existe pas dans notre système.","active":"Actifs","show_emails":"Afficher les adresses de courriels","nav":{"new":"Nouveaux","active":"Actifs","pending":"En attente","staff":"Responsables","suspended":"Suspendus","blocked":"Bloqués","suspect":"Suspect"},"approved":"Approuvé ?","approved_selected":{"one":"Approuver l'utilisateur","other":"Approuver les {{count}} utilisateurs"},"reject_selected":{"one":"utilisateur rejeté","other":"utilisateurs rejetés ({{count}})"},"titles":{"active":"Utilisateurs actifs","new":"Nouveaux utilisateurs","pending":"Utilisateur en attente","newuser":"Utilisateurs au niveau de confiance 0 (Nouveaux utilisateurs)","basic":"Utilisateurs au niveau de confiance 1 (Utilisateurs de base)","member":"Utilisateurs au Niveau de confiance 2 (Membre)","regular":"Utilisateurs au Niveau de confiance 3 (Habitué)","leader":"Utilisateurs au Niveau de confiance 4 (Meneur)","staff":"Membres de l'équipe des responables","admins":"Administrateurs","moderators":"Modérateurs","blocked":"Utilisateurs bloqués","suspended":"Utilisateurs suspendus","suspect":"Utilisateurs suspects"},"reject_successful":{"one":"Utilisateur rejeté avec succès.","other":"%{count} utilisateurs rejetés avec succès."},"reject_failures":{"one":"Utilisateur dont le rejet a échoué.","other":"%{count} utilisateurs dont le rejet a échoué."},"not_verified":"Non verifié","check_email":{"title":"Afficher l'adresse courriel de cet utilisateur","text":"Afficher"}},"user":{"suspend_failed":"Il y a eu un problème pendant la suspension de cet utilisateur {{error}}","unsuspend_failed":"Il y a eu un problème pendant le retrait de la suspension de cet utilisateur {{error}}","suspend_duration":"Combien de temps l'utilisateur sera suspendu ?","suspend_duration_units":"(jours)","suspend_reason_label":"Pourquoi suspendez-vous ? Ce texte \u003cb\u003esera visible par tout le monde\u003c/ b\u003e sur la page du profil de cet utilisateur, et sera affiché à l'utilisateur quand ils essaient de se connecter. Soyez bref.","suspend_reason":"Raison","suspended_by":"Suspendu par","delete_all_posts":"Supprimer tous les messages","suspend":"Suspendre","unsuspend":"Retirer la suspension","suspended":"Suspendu ?","moderator":"Modérateur ?","admin":"Admin ?","blocked":"Bloqué ?","staged":"En attente?","show_admin_profile":"Admin","edit_title":"Modifier le titre","save_title":"Sauvegarder le titre","refresh_browsers":"Forcer le rafraîchissement du navigateur","refresh_browsers_message":"Message envoyé à tous les clients !","show_public_profile":"Afficher le profil public","impersonate":"Incarner","ip_lookup":"IP de consultation","log_out":"Déconnecter l'utilisateur","logged_out":"L'utilisateur s'est déconnecté de tous les appareils","revoke_admin":"Révoquer les droits d'admin","grant_admin":"Accorder les droits d'admin","revoke_moderation":"Révoquer les droits de modération","grant_moderation":"Accorder les droits de modération","unblock":"Débloquer","block":"Bloquer","reputation":"Réputation","permissions":"Permissions","activity":"Activité","like_count":"J'aimes donnés / reçus","last_100_days":"dans les 100 derniers jours","private_topics_count":"Messages privés","posts_read_count":"Messages lus","post_count":"Messages crées","topics_entered":"Sujets vus","flags_given_count":"Signalements effectués","flags_received_count":"Signalements reçus","warnings_received_count":"Avertissements reçus","flags_given_received_count":"Signalements émis / reçus","approve":"Approuvé","approved_by":"approuvé par","approve_success":"Utilisateur approuvé et un courriel avec les instructions d'activation a été envoyé.","approve_bulk_success":"Bravo! Tous les utlisateurs sélectionnés ont été approuvés et notifiés.","time_read":"Temps de lecture","anonymize":"Rendre l'utilisateur anonyme","anonymize_confirm":"Êtes-vous sûr de vouloir rendre ce compte anonyme ? Ceci entraînera la modification du pseudo et de l'adresse courriel, et réinitialisera les informations du profil.","anonymize_yes":"Oui, rendre ce compte anonyme","anonymize_failed":"Il y a eu un problème lors de l'anonymisation de ce compte.","delete":"Supprimer l'utilisateur","delete_forbidden_because_staff":"Administrateurs et modérateurs ne peuvent pas être supprimés.","delete_posts_forbidden_because_staff":"Vous ne pouvez pas supprimer tous les messages des administrateurs ou des modérateurs.","delete_forbidden":{"one":"Les utilisateurs ne peuvent pas être supprimés s'ils ont posté des messages Supprimer tous les messages avant d'essayer de supprimer un utilisateur. (Les messages plus vieux que %{count} jour ne peut pas être supprimé.)","other":"Les utilisateurs ne peuvent pas être supprimés s'ils ont crée des messages. Supprimer tous les messages avant d'essayer de supprimer un utilisateur. (Les messages plus vieux que %{count} jours ne peuvent pas être supprimés.)"},"cant_delete_all_posts":{"one":"Impossible de supprimer tout les messages. Certains messages sont âgés de plus de  %{count} jour. (voir l'option delete_user_max_post_age)","other":"Impossible de supprimer tout les messages. Certains messages sont âgés de plus de  %{count} jours. (voir l'option delete_user_max_post_age)"},"cant_delete_all_too_many_posts":{"one":"Impossible de supprimer tout les messages parce-que l'utilisateur a plus d'un message. (delete_all_posts_max)","other":"Impossible de supprimer tout les messages parce-que l'utilisateur a plus de %{count} messages. (delete_all_posts_max)"},"delete_confirm":"Êtes-vous SÛR de vouloir supprimer cet utilisateur ? Cette action est irréversible !","delete_and_block":"Supprimer et \u003cb\u003ebloquer\u003c/b\u003e cette adresse de courriel et adresse IP.","delete_dont_block":"Supprimer uniquement","deleted":"L'utilisateur a été supprimé.","delete_failed":"Il y a eu une erreur lors de la suppression de l'utilisateur. Veuillez vous assurez que tous ses messages ont bien été supprimmés avant d'essayer de supprimer l'utilisateur.","send_activation_email":"Envoyer le courriel d'activation","activation_email_sent":"Un courriel d'activation a été envoyé.","send_activation_email_failed":"Il y a eu un problème lors du renvoi du courriel d'activation. %{error}","activate":"Activer le compte","activate_failed":"Il y a eu un problème lors de l'activation du compte.","deactivate_account":"Désactive le compte","deactivate_failed":"Il y a eu un problème lors de la désactivation du compte.","unblock_failed":"Problème rencontré lors du déblocage de l'utilisateur.","block_failed":"Problème rencontré lors du blocage de l'utilisateur.","block_confirm":"Êtes-vous sûr de vouloir bloquer cet utilisateur ? Il ne pourra plus créer de sujets ou messages.","block_accept":"Oui, bloquer cet utilisateur","bounce_score":"Score de rejet","reset_bounce_score":{"label":"Réinitialiser","title":"Réinitialiser compteur de rejets à 0"},"deactivate_explanation":"Un utilisateur désactivé doit revalider son adresse de courriel.","suspended_explanation":"Un utilisateur suspendu ne peut pas se connecter.","block_explanation":"Un utilisateur bloqué ne peut pas écrire de message, ni créer de sujet.","staged_explanation":"Un utilisateur en attente ne peut envoyer des messages par courriel que pour des sujets spécifiques.","bounce_score_explanation":{"none":"Aucune rejet récent pour cette adresse courriel.","some":"Quelques rejets récents pour cette adresse courriel.","threshold_reached":"Trop de rejets récents pour cette adresse courriel."},"trust_level_change_failed":"Il y a eu un problème lors de la modification du niveau de confiance de l'utilisateur.","suspend_modal_title":"Suspendre l'utilisateur","trust_level_2_users":"Utilisateurs de niveau de confiance 2","trust_level_3_requirements":"Niveaux de confiance 3 Pré-requis","trust_level_locked_tip":"Le niveau de confiance est verrouillé. Le système ne changera plus le niveau de confiance de cet utilisateur.","trust_level_unlocked_tip":"les niveaux de confiance sont déverrouillés. Le système pourra promouvoir ou rétrograder des utilisateurs.","lock_trust_level":"Verrouiller le niveau de confiance","unlock_trust_level":"Déverrouiller le niveau de confiance","tl3_requirements":{"title":"Pré-requis pour le niveau de confiance 3","table_title":{"one":"Lors du dernier jour :","other":"Lors des %{count} derniers jours :"},"value_heading":"Valeur","requirement_heading":"Pré-requis","visits":"Visites","days":"jours","topics_replied_to":"Sujets auxquels l'utilisateur a répondu","topics_viewed":"Sujets vus","topics_viewed_all_time":"Sujets vus (depuis le début)","posts_read":"Messages lus","posts_read_all_time":"Messages lus (depuis le début)","flagged_posts":"Messages signalés","flagged_by_users":"Utilisateurs signalés","likes_given":"J'aimes donnés","likes_received":"J'aimes reçus","likes_received_days":"J'aime reçus : par jour","likes_received_users":"J'aime reçus : par utilisateur","qualifies":"Admissible au niveau de confiance 3.","does_not_qualify":"Non admissible au niveau de confiance 3.","will_be_promoted":"Sera promu prochainement.","will_be_demoted":"Sera rétrograder prochainement.","on_grace_period":"Actuellement en période de grâce, sera bientôt rétrograder.","locked_will_not_be_promoted":"Niveau de confiance verrouillé. Ne sera jamais promu.","locked_will_not_be_demoted":"Niveau de confiance verrouillé. Ne sera jamais rétrograder."},"sso":{"title":"Authentification unique (SSO)","external_id":"ID Externe","external_username":"Pseudo","external_name":"Nom","external_email":"Courriel","external_avatar_url":"URL de l'image de profil"}},"user_fields":{"title":"Champs utilisateurs","help":"Ajouter des champs que vos utilisateurs pourront remplir.","create":"Créer un champ utilisateur","untitled":"Sans titre","name":"Nom du champ","type":"Type du champ","description":"Description du champs","save":"Sauvegarder","edit":"Modifier","delete":"Supprimer","cancel":"Annuler","delete_confirm":"Etes vous sur de vouloir supprimer ce champ utilisateur ?","options":"Options","required":{"title":"Obligatoire à l'inscription ?","enabled":"obligatoire","disabled":"optionnel"},"editable":{"title":"Modifiable après l'inscription ?","enabled":"modifiable","disabled":"non modifiable"},"show_on_profile":{"title":"Afficher dans le profil public","enabled":"affiché dans le profil","disabled":"pas affiché dans le profil"},"show_on_user_card":{"title":"Montrer sur la carte de l'utilisateur?","enabled":"montré sur la carte de l'utilisateur","disabled":"non montré sur la carte de l'utilisateur"},"field_types":{"text":"Zone de texte","confirm":"Confirmation","dropdown":"Menu déroulant"}},"site_text":{"description":"Vous pouvez personnaliser n'importe quel libellé dans votre forum. Commencez en utilisant la recherche ci-dessous :","search":"Cherchez le texte que vous souhaitez modifier","title":"Contenu","edit":"modifier","revert":"Annuler les changements","revert_confirm":"Êtes-vous sur de vouloir annuler vos changements ?","go_back":"Retour à la recherche","recommended":"Nous vous recommandons de personnaliser le texte suivant selon vos besoins :","show_overriden":"Ne montrer que ce qui a été personnalisé"},"site_settings":{"show_overriden":"Ne montrer que ce qui a été changé","title":"Paramètres","reset":"rétablir","none":"rien","no_results":"Aucun résultat trouvé.","clear_filter":"Effacer","add_url":"ajouter URL","add_host":"ajouter hôte","categories":{"all_results":"Toutes","required":"Requis","basic":"Globaux","users":"Utilisateurs","posting":"Messages","email":"Courriel","files":"Fichiers","trust":"Niveaux de confiance","security":"Sécurité","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limites des taux","developer":"Développeur","embedding":"Externe","legal":"Légal","user_api":"API utilisateur","uncategorized":"Autre","backups":"Sauvegardes","login":"Connexion","plugins":"Plugins","user_preferences":"Préférences","tags":"Tags","search":"Rechercher"}},"badges":{"title":"Badges","new_badge":"Nouveau Badge","new":"Nouveau","name":"Nom","badge":"Badge","display_name":"Nom affiché","description":"Description","long_description":"Description longue","badge_type":"Type de badge","badge_grouping":"Groupe","badge_groupings":{"modal_title":"Regroupement de badge"},"granted_by":"Décerné par","granted_at":"Décerné le","reason_help":"(Lien vers un message ou sujet)","save":"Sauvegarder","delete":"Supprimer","delete_confirm":"Ëtes-vous sûr de vouloir supprimer ce badge ?","revoke":"Retirer","reason":"Raison","expand":"Développer \u0026hellip;","revoke_confirm":"Êtes-vous sur de vouloir retirer ce badge à cet utilisateur ?","edit_badges":"Modifier les badges","grant_badge":"Décerner le badge","granted_badges":"Badges décernés","grant":"Décerner","no_user_badges":"%{name} ne s'est vu décerné aucun badge.","no_badges":"Il n'y a aucun badges qui peuvent être décernés.","none_selected":"Sélectionnez un badge pour commencer","allow_title":"Autoriser l'utilisation du badge comme titre","multiple_grant":"Peut être décerné plusieurs fois","listable":"Afficher le badge sur la page publique des badges","enabled":"Activer le badge","icon":"Icône","image":"Image","icon_help":"Utilisez une classe CSS Font Awesome ou une URL d'image","query":"Requête du badge (SQL)","target_posts":"Requête sur les messages","auto_revoke":"Exécuter la requête de révocation quotidiennement","show_posts":"Afficher le message concerné par le badge sur la page des badges.","trigger":"Déclencheur","trigger_type":{"none":"Mettre à jour quotidiennement","post_action":"Lorsqu'un utilisateur agit sur un message","post_revision":"Lorsqu'un utilisateur modifie ou crée un message","trust_level_change":"Lorsqu'un utilisateur change de niveau de confiance","user_change":"Lorsqu'un utilisateur est modifié ou crée","post_processed":"Après un message est traité"},"preview":{"link_text":"Aperçu du badge accordé","plan_text":"Aperçu avant le plan de requête","modal_title":"Aperçu de la requête du badge","sql_error_header":"Il y a une erreur avec la requête.","error_help":"Consulter les liens suivants pour obtenir de l'aide sur les requêtes de badge.","bad_count_warning":{"header":"ATTENTION !","text":"Certains badges n'ont pas été décernés. Ceci se produit  lorsque la requête du badge retourne des identifiants d'utilisateurs ou de messages qui n’existent plus. Cela peut produire des résultats non attendus - veuillez vérifier votre requête."},"no_grant_count":"Aucun badge à assigner.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge à assigner.","other":"\u003cb\u003e%{count}\u003c/b\u003e badges à assigner."},"sample":"Exemple :","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e pour son message dans %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e pour son message dans %{link} à \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e à \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Ajouter un nouvel emoji qui sera disponible pour tout le monde. (Conseil: glisser-déposer plusieurs fichiers en même temps)","add":"Ajouter un nouvel emoji","name":"Nom","image":"Image","delete_confirm":"Etes vous sûr de vouloir supprimer l'emoji :%{name}: ?"},"embedding":{"get_started":"Si vous aimeriez intégrer Discourse dans un autre site, commencez par ajouter l'hôte.","confirm_delete":"Êtes-vous sûr de vouloir supprimer cet hôte?","sample":"Introduire le code HTML suivant dans votre site pour créer et intégrer des sujets Discourse. Remplacer \u003cb\u003eREPLACE_ME\u003c/b\u003e avec l'URL de la page dans laquelle vous l'intégrer.","title":"Intégration externe","host":"Hôtes permis","edit":"éditer","category":"Ajouter dans catégorie","add_host":"Ajouter hôte","settings":"Paramètres d'intégration externe","feed_settings":"Paramètres de flux RSS/ATOM","feed_description":"Fournir un flux RSS/ATOM pour votre site peut améliorer la capacité de Discourse à importer votre contenu.","crawling_settings":"Paramètres de robot","crawling_description":"Quand Discourse crée des sujets pour vos message, s'il n'y a pas de flux RSS/ATOM présent, il essayera de parser le contenu à partir du HTML. Parfois il peut être difficile d'extraire votre contenu, alors nous vous donnons ici la possibilité de spécifier des règles CSS pour faciliter l'extraction.","embed_by_username":"Pseudo pour création de sujet","embed_post_limit":"Le nombre maximum de messages à intégrer","embed_username_key_from_feed":"Clé pour extraire le pseudo du flux.","embed_title_scrubber":"Expression régulière utilisée pour nettoyer le titre des messages","embed_truncate":"Tronquer les messages intégrés","embed_whitelist_selector":"Sélecteur CSS pour les éléments qui seront autorisés dans les contenus intégrés","embed_blacklist_selector":"Sélecteur CSS pour les éléments qui seront interdits dans les contenus intégrés","embed_classname_whitelist":"Classes CSS autorisées","feed_polling_enabled":"Importer les messages via flux RSS/ATOM","feed_polling_url":"URL du flux RSS/ATOM à importer","save":"Sauvegarder paramètres d'intégration"},"permalink":{"title":"Permaliens","url":"URL","topic_id":"ID sujet","topic_title":"Sujet","post_id":"ID message","post_title":"Message","category_id":"ID catégorie","category_title":"Catégorie","external_url":"URL externe","delete_confirm":"Êtes-vous sur de vouloir supprimer ce permalien ?","form":{"label":"Nouveau :","add":"Ajouter","filter":"Rechercher (URL ou URL externe)"}}}}},"en":{"js":{"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""}},"composer":{"auto_close":{"all":{"units":""}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?"},"admin":{"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?"},"embedding":{"path_whitelist":"Path Whitelist"}}}}};
I18n.locale = 'fr';
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
//! locale : french (fr)
//! author : John Fischer : https://github.com/jfroffice

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var fr = moment.defineLocale('fr', {
        months : 'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'.split('_'),
        monthsShort : 'janv._févr._mars_avr._mai_juin_juil._août_sept._oct._nov._déc.'.split('_'),
        monthsParseExact : true,
        weekdays : 'dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi'.split('_'),
        weekdaysShort : 'dim._lun._mar._mer._jeu._ven._sam.'.split('_'),
        weekdaysMin : 'Di_Lu_Ma_Me_Je_Ve_Sa'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Aujourd\'hui à] LT',
            nextDay: '[Demain à] LT',
            nextWeek: 'dddd [à] LT',
            lastDay: '[Hier à] LT',
            lastWeek: 'dddd [dernier à] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'dans %s',
            past : 'il y a %s',
            s : 'quelques secondes',
            m : 'une minute',
            mm : '%d minutes',
            h : 'une heure',
            hh : '%d heures',
            d : 'un jour',
            dd : '%d jours',
            M : 'un mois',
            MM : '%d mois',
            y : 'un an',
            yy : '%d ans'
        },
        ordinalParse: /\d{1,2}(er|)/,
        ordinal : function (number) {
            return number + (number === 1 ? 'er' : '');
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return fr;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
