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
r += "Há ";
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
r += "<a href='/unread'>1 não lido</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " não lidos</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 novo</a> tópico";
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
})() + " novos</a> tópicos";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ou ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "veja outros tópicos em ";
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
r += "Este tópico tem ";
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
r += (pf_0[ MessageFormat.locale["pt_BR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "com uma proporção alta de curtidas";
return r;
},
"med" : function(d){
var r = "";
r += "com uma proporção muito alta de curtidas";
return r;
},
"high" : function(d){
var r = "";
r += "com uma proporção extremamente alta de curtidas";
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

MessageFormat.locale.pt_BR = function ( n ) {
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
I18n.translations = {"pt_BR":{"js":{"number":{"format":{"separator":",","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM AAAA","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, YY \u003cbr/\u003eLT","wrap_ago":"%{date} atrás","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuto","other":"%{count} minutos"},"x_hours":{"one":"1 hora","other":"%{count} horas"},"x_days":{"one":"1 dia","other":"%{count} dias"},"date_year":"MMM D, YY"},"medium_with_ago":{"x_minutes":{"one":"1 minuto atrás","other":"%{count} minutos atrás"},"x_hours":{"one":"1 hora atrás","other":"%{count} horas atrás"},"x_days":{"one":"1 dia atrás","other":"%{count} dias atrás"}},"later":{"x_days":{"one":"1 dia depois","other":"%{count} dias depois"},"x_months":{"one":"1 mês depois","other":"%{count} meses depois"},"x_years":{"one":"1 ano depois","other":"%{count} anos depois"}},"previous_month":"Mês Anterior","next_month":"Próximo Mês"},"share":{"topic":"compartilhe o link desse tópico","post":"mensagem #%{postNumber}","close":"fechar","twitter":"compartilhe este link no Twitter","facebook":"compartilhe este link no Facebook","google+":"compartilhe este link no Google+","email":"enviar esse link para um email"},"action_codes":{"public_topic":"tornou este tópico público em %{when}","private_topic":"tornou este tópico privado em %{when}","split_topic":"dividiu este tópico %{when}","invited_user":"convidou %{who} %{when}","invited_group":"convidou %{who} %{when}","removed_user":"removido %{who} %{when}","removed_group":"removido %{who} %{when}","autoclosed":{"enabled":"fechou %{when}","disabled":"abriu %{when}"},"closed":{"enabled":"fechou %{when}","disabled":"abriu %{when}"},"archived":{"enabled":"arquivou %{when}","disabled":"desarquivou %{when}"},"pinned":{"enabled":"fixou %{when}","disabled":"desafixou %{when}"},"pinned_globally":{"enabled":"fixou globalmente %{when}","disabled":"desafixou %{when}"},"visible":{"enabled":"listou %{when}","disabled":"desalistou %{when}"}},"topic_admin_menu":"ações administrativas do tópico","emails_are_disabled":"Todo o envio de email foi globalmente desabilitado por algum administrador. Nenhum email de notificações de qualquer tipo será enviado.","bootstrap_mode_enabled":"Para fazer o lançamento do seu novo site mais fácil, você está no modo de inicialização. A todos os novos usuários será concedido nível de confiança 1 e terão o resumo diário das atualizações ativado. Isso será automaticamente desativado quando a contagem total de usuários exceder %{min_users} usuários.","bootstrap_mode_disabled":"O modo de inicialização será desativado nas próximas 24 horas.","s3":{"regions":{"us_east_1":"Leste dos EUA (N. da Virgínia)","us_west_1":"Oeste dos EUA (N. da Califórnia)","us_west_2":"Leste dos EUA (Oregon)","us_gov_west_1":"AWS GovCloud (EUA)","eu_west_1":"EU (Irlanda)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Ásia Pacífico (Singapura)","ap_southeast_2":"Ásia Pacífico (Sidney)","ap_south_1":"Ásia-Pacífico (Mumbai)","ap_northeast_1":"Ásia Pacífico (Tóquio)","ap_northeast_2":"Ásia Pacífico (Seul)","sa_east_1":"América do Sul (São Paulo)","cn_north_1":"China (Beijing)"}},"edit":"edite o título e a categoria deste tópico","not_implemented":"Esse recurso ainda não foi implementado, desculpe!","no_value":"Não","yes_value":"Sim","generic_error":"Pedimos desculpa, ocorreu um erro.","generic_error_with_reason":"Ocorreu um erro: %{error}","sign_up":"Registrar","log_in":"Entrar","age":"Idade","joined":"Aderiu","admin_title":"Admin","flags_title":"Sinalizações","show_more":"mostrar mais","show_help":"opções","links":"Links","links_lowercase":{"one":"link","other":"links"},"faq":"FAQ","guidelines":"Orientações","privacy_policy":"Política de Privacidade","privacy":"Privacidade","terms_of_service":"Termos do Serviço","mobile_view":"VIsualização Mobile","desktop_view":"Visualização Desktop","you":"Você","or":"ou","now":"agora","read_more":"leia mais","more":"Mais","less":"Menos","never":"nunca","every_30_minutes":"a cada 30 minutos","every_hour":"a cada hora","daily":"diário","weekly":"semanal","every_two_weeks":"a cada duas semanas","every_three_days":"a cada três dias","max_of_count":"max de {{count}}","alternation":"ou","character_count":{"one":"{{count}} caracter","other":"{{count}} caracteres"},"suggested_topics":{"title":"Tópicos sugeridos","pm_title":"Mensagens Sugeridas"},"about":{"simple_title":"Sobre","title":"Sobre %{title}","stats":"Estatísticas do Site","our_admins":"Nossos administradores","our_moderators":"Nossos moderadores","stat":{"all_time":"Desde o começo","last_7_days":"Últimos 7 dias","last_30_days":"Últimos 30 dias"},"like_count":"Curtidas","topic_count":"Tópicos","post_count":"Mensagens","user_count":"Novos Usuários","active_user_count":"Usuários Ativos","contact":"Contate-nos","contact_info":"Em caso de um evento crítico ou de urgência afetando este site, por favor contacte-nos em %{contact_info}."},"bookmarked":{"title":"Favorito","clear_bookmarks":"Limpar Favoritos","help":{"bookmark":"Clique para adicionar o primeiro post deste tópico aos favoritos","unbookmark":"Clique para remover todos os favoritos neste tópico"}},"bookmarks":{"not_logged_in":"desculpe, você precisa estar logado para favoritar mensagens","created":"você favoritou essa resposta","not_bookmarked":"você já leu esta mensagem; clique para favoritar.","last_read":"este é a última resposta que você leu; clique para favoritar.","remove":"Remover favorito","confirm_clear":"Tem certeza que deseja apagar todos os atalhos deste tópico?"},"topic_count_latest":{"one":"{{count}} tópico novo ou atualizado.","other":"{{count}} tópicos novos ou atualizados."},"topic_count_unread":{"one":"{{count}} tópico não lido.","other":"{{count}} tópicos não lidos."},"topic_count_new":{"one":"{{count}} novo tópico.","other":"{{count}} novos tópicos."},"click_to_show":"Clique para mostrar.","preview":"pré-visualização","cancel":"cancelar","save":"Salvar mudanças","saving":"Salvando...","saved":"Salvo!","upload":"Enviar","uploading":"Enviando...","uploading_filename":"Enviando {{filename}}","uploaded":"Enviado!","enable":"Habilitar","disable":"Desabilitar","undo":"Desfazer","revert":"Reverter","failed":"Falhou","switch_to_anon":"Entrar no Modo Anônimo","switch_from_anon":"Sair do Modo Anônimo","banner":{"close":"Ignorar este banner.","edit":"Editar este banner \u003e\u003e"},"choose_topic":{"none_found":"Nenhum tópico encontrado.","title":{"search":"Procurar por um Tópico pelo nome, url ou id:","placeholder":"digite o título do tópico aqui"}},"queue":{"topic":"Tópico:","approve":"Aprovar","reject":"Rejeitar","delete_user":"Deletar Usuário","title":"Aprovação Necessária","none":"Não existem mensagens para revisar.","edit":"Editar","cancel":"Cancelar","view_pending":"ver mensagens pendentes","has_pending_posts":{"one":"Este tópico tem \u003cb\u003e1\u003c/b\u003e mensagem aguardando aprovação","other":"Este tópico tem \u003cb\u003e{{count}}\u003c/b\u003e mensagens aguardando aprovação"},"confirm":"Salvar Mudanças","delete_prompt":"Você tem certeza que quer deletar \u003cb\u003e%{username}\u003c/b\u003e? Esta ação irá remover todas as suas postagens e bloquear seu email e endereço IP.","approval":{"title":"Aprovação Necessária da Mensagem","description":"Nós recebemos sua nova postagem mas é necessário que seja aprovada por um moderador antes de ser exibida. Por favor tenha paciência.","pending_posts":{"one":"Você tem \u003cstrong\u003e1\u003c/strong\u003e mensagem pendente.","other":"Você tem \u003cstrong\u003e{{count}}\u003c/strong\u003e mensagens pendentes."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e postou \u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e postou \u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e respondeu a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003evocê\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVocê\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003evocê\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003evocê\u003c/a\u003e"},"directory":{"filter_name":"filtrar por nome de usuário","title":"Usuários","likes_given":"Dados","likes_received":"Recebidos","topics_entered":"Visualizados","topics_entered_long":"Tópicos Vizualizados","time_read":"Tempo Lido","topic_count":"Tópicos","topic_count_long":"Tópicos Criados","post_count":"Respostas","post_count_long":"Respostas Postadas","no_results":"Nenhum resultado foi encontrado.","days_visited":"Visitas","days_visited_long":"Dias Visitados","posts_read":"Lidos","posts_read_long":"Postagens Lidas","total_rows":{"one":"1 usuário","other":"%{count} usuários"}},"groups":{"empty":{"posts":"Não há postagens por membros deste grupo.","members":"Não há membros neste grupo.","mentions":"Não há menção a este grupo.","messages":"Não há mensagens para este grupo.","topics":"Não há topicos por membros deste grupo."},"add":"Adicionar","selector_placeholder":"Adicionar membros","owner":"proprietário","visible":"Grupo é visível para todos os usuários","index":"Grupos","title":{"one":"grupo","other":"grupos"},"members":"Membros","topics":"Tópicos","posts":"Mensagens","mentions":"Menções","messages":"Mensagens","alias_levels":{"title":"Quem pode enviar mensagem e @mention a este grupo?","nobody":"Ninguém","only_admins":"Somente administradores","mods_and_admins":"Somente moderadores e Administradores","members_mods_and_admins":"Somente membros do grupo, moderadores e administradores","everyone":"Todos"},"trust_levels":{"title":"Nível de Confiança automaticamente concedido aos membros quando eles são incluídos","none":"Nenhum"},"notifications":{"watching":{"title":"Observando","description":"Você será notificado sobre toda nova postagem em toda mensagem, e uma contagem de novas mensagens será mostrada."},"watching_first_post":{"title":"Observando o primeiro post","description":"Você somente será notificado sobre a primeira postagem em cada novo tópico neste grupo."},"tracking":{"title":"Monitorando","description":"Você será notificado se alguém mencionar seu @name ou responder a você, e uma contagem de novas respostas será mostrada."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar seu @name ou responder a você."},"muted":{"title":"Silenciado","description":"Você nunca será notificado sobre novos tópicos nesse grupo."}}},"user_action_groups":{"1":"Curtidas dadas","2":"Curtidas recebidas","3":"Favoritos","4":"Tópicos","5":"Respostas","6":"Respostas","7":"Menções","9":"Citações","11":"Edições","12":"Itens enviados","13":"Caixa de Entrada","14":"Pendente"},"categories":{"all":"todas as categorias","all_subcategories":"todos","no_subcategory":"nenhum","category":"Categoria","category_list":"Exibir lista de categorias.","reorder":{"title":"Reordenar Categorias","title_long":"Reorganizar a lista de categorias","fix_order":"Fixar Posições","fix_order_tooltip":"Algumas categorias não possuem um número de posição único, o que pode causar resultados inesperados.","save":"Salvar Ordem","apply_all":"Aplicar","position":"Posição"},"posts":"Respostas","topics":"Tópicos","latest":"Recentes","latest_by":"recentes por","toggle_ordering":"alternar controle de ordenação","subcategories":"Subcategorias","topic_stat_sentence":{"one":"%{count} novo tópico nos últimos %{unit}.","other":"%{count} novos tópicos nos últimos %{unit}."}},"ip_lookup":{"title":"Pesquisa do endereço de IP","hostname":"Nome do host","location":"Localização","location_not_found":"(desconhecido)","organisation":"Organização","phone":"Telefone","other_accounts":"Outras contas com esse endereço de IP:","delete_other_accounts":"Excluir %{count}","username":"nome de usuário","trust_level":"TL","read_time":"tempo de leitura","topics_entered":"tópicos em que entrou","post_count":"# mensagens","confirm_delete_other_accounts":"Você tem certeza que deseja apagar essas contas?"},"user_fields":{"none":"(selecione uma opção)"},"user":{"said":"{{username}}:","profile":"Perfil","mute":"Silenciar","edit":"Editar Preferências","download_archive":"Fazer Download dos Meus Posts","new_private_message":"Nova Mensagem","private_message":"Mensagem","private_messages":"Mensagens","activity_stream":"Atividade","preferences":"Preferências","expand_profile":"Expandir","bookmarks":"Favoritos","bio":"Sobre mim","invited_by":"Convidado por","trust_level":"Nível de Confiança","notifications":"Notificações","statistics":"Estatísticas","desktop_notifications":{"label":"Notificações de Área de Trabalho","not_supported":"Notificações não são suportadas nesse browser. Desculpe-nos.","perm_default":"Habilitar Notificações","perm_denied_btn":"Permissão Negada","perm_denied_expl":"Você negou a permissão para notificações. Configure as permissões para notificações no seu navegador.","disable":"Desativar Notificações","enable":"Ativar Notificações","each_browser_note":"Nota: Você deve modificar essa configuração em todos navegadores que você usa."},"dismiss_notifications":"Descartar tudo","dismiss_notifications_tooltip":"Marcar todas as notificações não lidas como lidos","disable_jump_reply":"Não pular para o meu tópico depois que eu respondo","dynamic_favicon":"Exibir ícone no navegador de tópicos novos / atualizados.","external_links_in_new_tab":"Abrir todos os links externos em uma nova aba","enable_quoting":"Ativar resposta citando o texto destacado","change":"alterar","moderator":"{{user}} é um moderador","admin":"{{user}} é um administrador","moderator_tooltip":"Esse usuário é da moderação","admin_tooltip":"Esse usuário é da administração","blocked_tooltip":"Esse usuário está bloqueado.","suspended_notice":"Esse usuário está suspenso até {{date}}.","suspended_reason":"Motivo:","github_profile":"Github","email_activity_summary":"Sumário de Atividades","mailing_list_mode":{"label":"Modo de lista de discussão","enabled":"Ativar o modo lista de discussão","instructions":"Essa opção sobrepõe o sumário de atividades.\u003cbr /\u003e\nTópicos e categorias silenciados não são incluídos nesses emails.\n","daily":"Enviar atualizações diárias","individual":"Enviar email para cada postagem nova","many_per_day":"Me envie um email para cada nova postagem (aproximadamente {{dailyEmailEstimate}} por dia)","few_per_day":"Me envie um email para cada nova postagem (aproximadamente 2 por dia)"},"tag_settings":"Etiquetas","watched_tags":"Observadas","watched_tags_instructions":"Você vai observar automaticamente todos os tópicos com estas etiquetas. Você será notificado de todas as novas mensagens e tópicos.  Além disso, a contagem de mensagens novas também aparecerá ao lado do tópico.","tracked_tags":"Monitoradas","tracked_tags_instructions":"Você vai monitorar automaticamente todos os tópicos com essas etiquetas. A contagem de mensagens novas aparecerá ao lado do tópico.","muted_tags":"Silenciado","muted_tags_instructions":"Você não será notificado sobre novos tópicos com estas etiquetas, e eles não aparecerão nos tópicos Recentes","watched_categories":"Observando","watched_categories_instructions":"Você vai observar automaticamente todos os tópicos dessas categorias. Você será notificado de todas as novas mensagens e tópicos.  Além disso, a contagem de mensagens novas também aparecerá ao lado do tópico.","tracked_categories":"Monitoradas","tracked_categories_instructions":"Você vai monitorar automaticamente todos os tópicos dessas categorias. A contagem de mensagens novas aparecerá ao lado do tópico.","watched_first_post_categories":"Observando a primeira mensagem","watched_first_post_categories_instructions":"Você será notificado sobre a primeira postagem em cada novo tópico destas categorias.","watched_first_post_tags":"Observando a primeira mensagem","watched_first_post_tags_instructions":"Você será notificado sobre a primeira postagem em cada novo tópico com estas etiquetas.","muted_categories":"Silenciado","muted_categories_instructions":"Você não será notificado sobre novos tópicos nessas categorias, e não aparecerão no Recentes","delete_account":"Excluir Minha Conta","delete_account_confirm":"Tem certeza de que deseja excluir permanentemente a sua conta? Essa ação não pode ser desfeita!","deleted_yourself":"Sua conta foi excluída com sucesso.","delete_yourself_not_allowed":"Você não pode excluir a sua conta agora. Contate um administrador para apagar a sua conta para você.","unread_message_count":"Mensagens Privadas","admin_delete":"Apagar","users":"Usuários","muted_users":"Silenciado","muted_users_instructions":"Suprimir todas as notificações destes usuários.","muted_topics_link":"Mostrar tópicos silenciados","watched_topics_link":"Mostrar tópicos observados","automatically_unpin_topics":"Desafixar automaticamente os tópicos quando eu chegar ao fundo.","staff_counters":{"flags_given":"sinalizadas úteis","flagged_posts":"posts sinalizados","deleted_posts":"posts apagados","suspensions":"suspensões","warnings_received":"avisos"},"messages":{"all":"Todas","inbox":"Caixa de entrada","sent":"Enviado","archive":"Arquivo","groups":"Meus Grupos","bulk_select":"Selecionar mensagens","move_to_inbox":"Mover para Caixa de Entrada","move_to_archive":"Arquivar","failed_to_move":"Falha ao mover as mensagens selecionadas (talvez você esteja sem conexão com a rede)","select_all":"Selecionar Tudo"},"change_password":{"success":"(email enviado)","in_progress":"(enviando email)","error":"(erro)","action":"alterar","set_password":"Definir Senha"},"change_about":{"title":"Modificar Sobre Mim","error":"Houve um erro ao alterar esse valor."},"change_username":{"title":"Alterar Nome de Usuário","confirm":"Se você mudar seu Nome de Usuário, todas as citações das suas respostas e as menções ao seu @nome serão desfeitas. Você tem certeza?","taken":"Desculpe, esse Nome de Usuário já está sendo usado.","error":"Houve um erro ao alterar o seu Nome de Usuário.","invalid":"Esse Nome de Usuário é inválido. Deve conter apenas números e letras."},"change_email":{"title":"Alterar Email","taken":"Desculpe, esse email não é válido.","error":"Houve um erro ao alterar seu email. Talvez ele já esteja sendo usado neste forum?","success":"Enviamos um email para esse endereço. Por favor, siga as instruções de confirmação."},"change_avatar":{"title":"Alterar sua imagem de perfil","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baseado em","gravatar_title":"Alterar seu avatar no site do Gravatar","refresh_gravatar_title":"Atualize seu Gravatar","letter_based":"Sistema concedeu imagem de perfil.","uploaded_avatar":"Foto pessoal","uploaded_avatar_empty":"Adicionar foto pessoal","upload_title":"Enviar sua foto","upload_picture":"Enviar imagem","image_is_not_a_square":"Aviso: nós cortamos sua imagem; largura e altura não eram iguais.","cache_notice":"Você alterou sua foto de perfil com sucesso, porém pode levar algum tempo para que a mesma apareça devido ao cachê do navegador."},"change_profile_background":{"title":"Fundo do perfil","instructions":"Fundos do perfil será centralizado e tera uma largura padrão de 850px."},"change_card_background":{"title":"Plano de fundo de usuário","instructions":"As Imagens de fundo serão centralizadas e deverão ter largura de 590px"},"email":{"title":"Email","instructions":"Nunca mostrar ao público","ok":"Nós vamos pedir confirmação por email","invalid":"Insira um endereço de email","authenticated":"Seu email foi autenticado por {{provider}}","frequency_immediately":"Não se preocupe, caso você não leia uma mensagem, enviaremos um email para você.","frequency":{"one":"Nós apenas te enviaremos email se não o tivermos visto no último minuto.","other":"Nós apenas te enviaremos email se não o tivermos visto nos últimos {{count}} minutos."}},"name":{"title":"Nome","instructions":"Seu nome completo (opcional)","instructions_required":"Seu nome completo","too_short":"Seu nome é muito curto","ok":"Seu nome parece bom"},"username":{"title":"Nome de Usuário","instructions":"Únicos, sem espaços e curto","short_instructions":"As pessoas podem mencionar você usando @{{username}}.","available":"Seu nome de usuário está disponível","global_match":"O email corresponde ao nome de usuário registrado","global_mismatch":"Já está registado. Tente {{suggestion}}?","not_available":"Não está disponível. Tente {{suggestion}}?","too_short":"Seu nome de usuário é muito curto","too_long":"Seu nome de usuário é muito longo","checking":"Verificando disponibilidade do Nome de Usuário...","enter_email":"Nome de usuário encontrado, insira o email correspondente. ","prefilled":"Email corresponde a esse nome de usuário registrado"},"locale":{"title":"idioma de interface","instructions":"Idioma de interface do usuário. Será alterado quando você atualizar a página.","default":"(padrão)"},"password_confirmation":{"title":"Senha novamente"},"last_posted":"Última resposta","last_emailed":"Último email enviado","last_seen":"Visto","created":"Entrou","log_out":"Sair","location":"Localização","card_badge":{"title":"Cartão de emblemas do usuário"},"website":"Web Site","email_settings":"Email","like_notification_frequency":{"title":"Notificar ao ser curtido","always":"Sempre","first_time_and_daily":"Postagem é curtida pela primeira vez e diariamente","first_time":"Primeira curtida em um post","never":"Nunca"},"email_previous_replies":{"title":"Incluir respostas anteriores ao fim dos emails","unless_emailed":"exceto o enviado anteriormente","always":"sempre","never":"nunca"},"email_digests":{"title":"Mande-me um email com o sumário dos tópicos e respostas populares quando eu não visitar o fórum","every_30_minutes":"a cada 30 minutos","every_hour":"a cada hora","daily":"diariamente","every_three_days":"a cada três dias","weekly":"semanalmente","every_two_weeks":"a cada duas semanas"},"include_tl0_in_digests":"Incluir o conteúdo de usuários novos nos emails de sumário","email_in_reply_to":"Incluir um excerto das respostas ao post nos emails","email_direct":"Me envie um email quando alguém me citar, responder minhas mensagens, mencionar meu @usuário, ou me convidar para um tópico","email_private_messages":"Me envie um email quando alguém me enviar mensagem particular","email_always":"Envie-me notificações mesmo quando eu estiver ativo no site.","other_settings":"Outros","categories_settings":"Categorias","new_topic_duration":{"label":"Considerar tópicos como novos quando","not_viewed":"Eu ainda não os vi","last_here":"criado desde de que estive aqui pela última vez","after_1_day":"criado(s) no último(s) dia","after_2_days":"criado(s) nos último(s) 2 dias","after_1_week":"criado na última semana","after_2_weeks":"criado nas últimas 2 semanas"},"auto_track_topics":"Monitorar automaticamente tópicos que eu entro","auto_track_options":{"never":"nunca","immediately":"imediatamente","after_30_seconds":"depois de 30 segundos","after_1_minute":"depois de 1 minuto","after_2_minutes":"depois de 2 minutos","after_3_minutes":"depois de 3 minutos","after_4_minutes":"depois de 4 minutos","after_5_minutes":"depois de 5 minutos","after_10_minutes":"depois de 10 minutos"},"invited":{"search":"digite para pesquisar convites...","title":"Convites","user":"Usuários convidados","sent":"Enviado","none":"Não existem convites pendentes para exibir.","truncated":{"one":"Mostrando os primeiro convite.","other":"Mostrando os primeiros {{count}} convites."},"redeemed":"Convites usados","redeemed_tab":"Resgatado","redeemed_tab_with_count":"Resgatado ({{count}})","redeemed_at":"Usado","pending":"Convites pendentes","pending_tab":"Pendente","pending_tab_with_count":"Pendente ({{count}})","topics_entered":"Tópicos vistos","posts_read_count":"Mensagens vistas","expired":"Este convite expirou.","rescind":"Remover","rescinded":"Convite removido","reinvite":"Reenviar convite","reinvite_all":"Reenviar todos os convites","reinvited":"Convite reenviado","reinvited_all":"Todos os convites foram reenviados!","time_read":"Tempo de leitura","days_visited":"Dias visitados","account_age_days":"Idade da conta em dias","create":"Enviar um convite","generate_link":"Copiar Link do Convite","generated_link_message":"\u003cp\u003eLink do convite gerado com sucesso!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eLink do convite válido apenas para este endereço de email: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Você ainda não convidou ninguém. Você pode enviar convites individuais, ou enviar vários de uma vez através da ferramenta de \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eenviar em massa\u003c/a\u003e.","text":"Convidar em massa a partir de arquivo","uploading":"Subindo...","success":"Arquivo enviado com sucesso, você será notificado por mensagem quando o processo estiver completo.","error":"Houve um erro ao enviar '{{filename}}': {{message}}"}},"password":{"title":"Senha","too_short":"A sua senha é muito curta.","common":"Essa senha é muito comum.","same_as_username":"Sua senha é a mesma que o seu nome de usuário.","same_as_email":"Sua senha é a mesma que o seu email.","ok":"A sua senha parece boa.","instructions":"Deve ter pelo menos %{count} caracteres."},"summary":{"title":"Resumo","stats":"Estatísticas","time_read":"tempo de leitura","topic_count":{"one":"tópico criado","other":"tópicos criados"},"post_count":{"one":"post criado","other":"posts criados"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dada","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dadas"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e recebida","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e recebidas"},"days_visited":{"one":"dia visitado","other":"dias visitados"},"posts_read":{"one":"post lido","other":"posts lidos"},"bookmark_count":{"one":"favorito","other":"favoritos"},"top_replies":"Mais Respondidos","no_replies":"Nenhuma resposta ainda.","more_replies":"Mais Respostas","top_topics":"Principais tópicos","no_topics":"Nenhum tópico ainda.","more_topics":"Mais Tópicos","top_badges":"Principais Emblemas","no_badges":"Nenhum emblema ainda.","more_badges":"Mais Emblemas","top_links":"Principais Links","no_links":"Ainda sem nenhum link.","most_liked_by":"Mais Curtidos Por","most_liked_users":"Mais Curtidos","most_replied_to_users":"Mais Respondidos","no_likes":"Ainda sem nenhuma curtida."},"associated_accounts":"Logins","ip_address":{"title":"Último endereço IP"},"registration_ip_address":{"title":"Endereço IP de Registro"},"avatar":{"title":"Imagem de Perfil","header_title":"perfil, mensagens, favoritos e preferências"},"title":{"title":"Título"},"filters":{"all":"Todos"},"stream":{"posted_by":"Postado por","sent_by":"Enviado por","private_message":"mensagem","the_topic":"o tópico"}},"loading":"Carregando...","errors":{"prev_page":"ao tentar carregar","reasons":{"network":"Erro de Rede","server":"Erro de Servidor","forbidden":"Acesso Negado","unknown":"Erro","not_found":"Página não encontrada"},"desc":{"network":"Por favor verifique sua conexão.","network_fixed":"Parece que voltou.","server":"Código de erro: {{status}}","forbidden":"Você não tem permissão para ver isso.","not_found":"Oops, a aplicação tentou carregar uma URL que não existe.","unknown":"Algo deu errado."},"buttons":{"back":"Voltar","again":"Tentar de novo","fixed":"Carregar Página"}},"close":"Fechar","assets_changed_confirm":"Este site foi atualizado. Obter a última versão?","logout":"Você foi desconectado.","refresh":"Atualizar","read_only_mode":{"enabled":"Este site está em modo de leitura apenas. Por favor continue a navegar, no entanto, respostas, curtidas e outras ações estão desativadas por enquanto.","login_disabled":"O login é desativado enquanto o site está em modo de somente leitura.","logout_disabled":"O logout é desativado enquanto o site está em modo de somente leitura."},"too_few_topics_and_posts_notice":"Vamos \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ecomeçar essa discussão!\u003c/a\u003e Existem atualmente \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tópicos e \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e mensagens. Novos visitantes precisam de algumas conversas para ler e responder.","too_few_topics_notice":"Vamos \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ecomeçar essa discussão!\u003c/a\u003e Existem atualmente \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tópicos. Novos visitantes precisam de algumas conversas para ler e responder.","too_few_posts_notice":"Vamos \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ecomeçar essa discussão!\u003c/a\u003e Existem atualmente \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e mensagens. Novos visitantes precisam de algumas conversas para ler e responder.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e alcançou a configuração limite do site de %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e excedeu a configuração limite do site de %{siteSettingRate}.","rate":{"one":"1 erro/%{duration}","other":"%{count} erros/%{duration}"}},"learn_more":"aprenda mais...","year":"ano","year_desc":"tópicos criados nos últimos 365 dias","month":"mês","month_desc":"tópicos criados nos últimos 30 dias","week":"semana","week_desc":"tópicos criados nos últimos 7 dias","day":"dia","first_post":"Primeira resposta","mute":"Silenciar","unmute":"Reativar","last_post":"Última resposta","last_reply_lowercase":"última resposta","replies_lowercase":{"one":"resposta","other":"respostas"},"signup_cta":{"sign_up":"Registrar-se","hide_session":"Lembre-me amanhã","hide_forever":"não obrigado","hidden_for_session":"OK, Eu vou perguntar amanhã. Você pode também sempre usar o 'Registre-se' para criar uma conta.","intro":"Ei você! :heart_eyes: Para que você está gostando da discussão, mas ainda não criou uma conta.","value_prop":"Quando você cria uma conta, nós lembramos exatamente o que você leu, assim você sempre volta exatamente aonde estava. Você também recebe notificações, aqui e por e-mail, quando novas mensagens são feitas. E você pode curtir tópicos para compartilhar o amor. :heartbeat:"},"summary":{"enabled_description":"Você está vendo um sumário deste tópico: os posts mais interessantes conforme determinados pela comunidade.","description":"Existem \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas.","description_time":"Existem \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas com tempo de leitura estimado em \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Resumir Este Tópico","disable":"Exibir Todas as Mensagens"},"deleted_filter":{"enabled_description":"Este tópico contém posts deletados, que foram escondidos.","disabled_description":"Os posts deletados deste tópico estão sendo mostrados.","enable":"Esconder respostas apagadas","disable":"Mostrar Posts Deletados"},"private_message_info":{"title":"Mensagem","invite":"Convidar outros...","remove_allowed_user":"Tem a certeza que deseja remover {{name}} desta mensagem?","remove_allowed_group":"Tem a certeza que deseja remover {{name}} desta mensagem?"},"email":"Email","username":"Nome de Usuário","last_seen":"Visto","created":"Criado","created_lowercase":"criado","trust_level":"Nível de confiança","search_hint":"nome de usuário, email ou endereço de IP","create_account":{"title":"Criar nova conta","failed":"Alguma coisa deu errado, talvez este email já esteja registrado, tente usar o Esqueci a Senha."},"forgot_password":{"title":"Redefinir Senha","action":"Esqueci minha senha","invite":"Coloque seu Nome de Usuário ou endereço de email, e nós lhe enviaremos um email para refazer sua senha.","reset":"Recuperar senha","complete_username":"Se uma conta corresponder a este usuário \u003cb\u003e%{username}\u003c/b\u003e, você receberá um email com instruções de como reiniciar sua senha rapidamente.","complete_email":"Se uma conta corresponder a este email \u003cb\u003e%{email}\u003c/b\u003e, você receberá um email com instruções de como reiniciar sua senha rapidamente.","complete_username_found":"Encontramos uma conta que possui o nome de usuário \u003cb\u003e%{username}\u003c/b\u003e, você deverá receber um email com instruções em como resetar sua senha em breve.","complete_email_found":"Encontramos uma conta com \u003cb\u003e%{email}\u003c/b\u003e, você deve receber um email com instruções em como resetar sua senha em breve.","complete_username_not_found":"Nenhuma conta com usuário \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nenhuma conta com \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Log In","username":"Usuário","password":"Senha","email_placeholder":"e-mail ou Nome de Usuário","caps_lock_warning":"CAIXA ALTA está ligado","error":"Erro desconhecido","rate_limit":"Por favor aguarde antes de tentar logar novamente.","blank_username_or_password":"Por favor, coloque seu email ou Nome de Usuário, e senha.","reset_password":"Recuperar senha","logging_in":"Entrando...","or":"Ou","authenticating":"Autenticando...","awaiting_confirmation":"A sua conta está aguardando ativação, utilize o link 'Esqueci a Senha' para pedir um novo link para ativar o email.","awaiting_approval":"Sua conta ainda não foi aprovada por um membro da equipe. Você receberá um email quando sua conta for aprovada.","requires_invite":"Desculpe, o acesso a este fórum é permitido somente por convite de outro membro.","not_activated":"Você não pode entrar ainda. Nós lhe enviamos um email de ativação anteriormente no endereço \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor siga as instruções contidas neste email para ativar a sua conta.","not_allowed_from_ip_address":"Você não pode logar deste endereço IP.","admin_not_allowed_from_ip_address":"Você não pode entrar como administrador a partir deste endereço IP.","resend_activation_email":"Clique aqui para enviar o email de ativação novamente.","sent_activation_email_again":"Nós enviamos mais um email de ativação para você no endereço \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Pode ser que demore alguns minutos para chegar; verifique sempre sua caixa de spams.","to_continue":"Por favor efetue o login","preferences":"Você precisa estar logado para mudar suas preferências de usuário.","forgot":"Não me recordo dos detalhes da minha conta.","google":{"title":"Entrar com Google","message":"Autenticando com Google (certifique-se de que os bloqueadores de popup estejam desativados)"},"google_oauth2":{"title":"com Google","message":"Autenticação com o Google (tenha certeza que bloqueadores de popup não estão ligados)"},"twitter":{"title":"Entrar com Twitter","message":"Autenticando com Twitter (certifique-se de que os bloqueadores de popup estejam desativados)"},"instagram":{"title":"Entrar com Instagram","message":"Autenticando com o Instagram (tenha certeza de que bloqueadores de pop up não estejam ativados)"},"facebook":{"title":"Entrar com Facebook","message":"Autenticando com Facebook (certifique-se de que os bloqueadores de popup estejam desativados)"},"yahoo":{"title":"Entrar com Yahoo","message":"Autenticando com Yahoo (certifique-se de que os bloqueadores de popup estejam desativados)"},"github":{"title":"com GitHub","message":"Autenticando com GitHub (certifique-se de que os bloqueadores de popup estejam desativados)"}},"emoji_set":{"apple_international":"Apple/Internacional","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"mais...","options":"Opções","whisper":"sussuro","unlist":"Não listado","add_warning":"Este é um aviso oficial.","toggle_whisper":"Habilitar Sussuro","toggle_unlisted":"Alterar não listado","posting_not_on_topic":"Qual tópico você gostaria de responder?","saving_draft_tip":"gravando...","saved_draft_tip":"salvo","saved_local_draft_tip":"salvo localmente","similar_topics":"Seu tópico é parecido com...","drafts_offline":"rascunhos offline","duplicate_link":"Parece que o seu link para \u003cb\u003e{{domain}}\u003c/b\u003e já foi postado no tópico por \u003cb\u003e@{{username}}\u003c/b\u003e em \u003ca href='{{post_url}}'\u003euma resposta {{ago}}\u003c/a\u003e – tem certeza que deseja postá-lo novamente?","error":{"title_missing":"Título é obrigatório","title_too_short":"O título tem que ter no mínimo {{min}} caracteres","title_too_long":"O título não pode ter mais de {{max}} caracteres","post_missing":"A resposta não pode estar vazia","post_length":"A resposta tem que ter no mínimo {{min}} caracteres","try_like":"Já tentou o botão \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Você precisa escolher uma categoria"},"save_edit":"Salvar alterações","reply_original":"Responder em um Tópico Novo","reply_here":"Responda aqui","reply":"Responder","cancel":"Cancelar","create_topic":"Criar Tópico","create_pm":"Mensagem","title":"Ou pressione Ctrl+Enter","users_placeholder":"Adicionar um usuário","title_placeholder":"Sobre o que é esta discussão em uma pequena frase?","edit_reason_placeholder":"por que você está editando?","show_edit_reason":"(adicione motivo da edição)","reply_placeholder":"Escreva aqui. Use Markdown, BBCode ou HTML para formatar. Arraste ou cole uma imagens.","view_new_post":"Ver sua nova resposta.","saving":"Salvando","saved":"Salvo!","saved_draft":"Rascunho salvo, clique em selecionar para continuar editando.","uploading":"Enviando...","show_preview":"mostrar pré-visualização \u0026raquo;","hide_preview":"\u0026laquo; esconder pré-visualização","quote_post_title":"Citar toda a resposta","bold_title":"Negrito","bold_text":"texto em negrito","italic_title":"Itálico","italic_text":"texto em itálico","link_title":"Link","link_description":"digite a descrição do link aqui","link_dialog_title":"Inserir link","link_optional_text":"título opcional","link_url_placeholder":"http://exemplo.com","quote_title":"Bloco de citação","quote_text":"Bloco de citação","code_title":"Texto pré-formatado","code_text":"identar texto pre-formatado em 4 espaços","paste_code_text":"escreva ou cole o código aqui","upload_title":"Enviar","upload_description":"digite aqui a descrição do arquivo enviado","olist_title":"Lista numerada","ulist_title":"Lista de itens","list_item":"Item da lista","heading_title":"Título","heading_text":"Título","hr_title":"Barra horizontal","help":"Ajuda da edição Markdown","toggler":"esconder ou exibir o painel de composição","modal_ok":"OK","modal_cancel":"Cancelar","cant_send_pm":"Desculpe, você não pode enviar uma mensagem para %{username}.","yourself_confirm":{"title":"Você se esqueceu de adicionar destinatários?","body":"No momento esta mensagem está sendo enviada apenas para si mesmo!"},"admin_options_title":"Configurações opcionais da equipe para este tópico","auto_close":{"label":"Tempo para fechamento automático do tópico:","error":"Por favor, digite um valor válido.","based_on_last_post":"Não feche até que o último post no tópico seja o mais velho.","all":{"examples":"Insira o número de horaas (24), hora absoluta (17:30) ou o timestamp (2013-11-22 14:00)."},"limited":{"units":"(núm. de horas)","examples":"Insira o número de horas (24)."}}},"notifications":{"title":"notificações de menção de @name, respostas às suas postagens,  tópicos, mensagens, etc","none":"Não foi possível carregar notificações no momento.","empty":"Não foi encontrada nenhuma notificação.","more":"ver notificações antigas","total_flagged":"total de mensagens sinalizadas","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} e mais 1 pessoa\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} e outras {{count}} pessoas\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eAdquirido '{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNovo Tópico\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensagem na caixa de entrada de {{group_name}}\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensagens na caixa de entrada de {{group_name}}\u003c/p\u003e"},"alt":{"mentioned":"Mencionado por","quoted":"Citado por","replied":"Respondido","posted":"Mensagem por","edited":"Edição na sua mensagem por","liked":"Curtiu sua mensagem","private_message":"Mensagem privada de","invited_to_private_message":"Convidou para uma mensagem privada","invited_to_topic":"Convite para um tópico de","invitee_accepted":"Convite aceito por","moved_post":"Seu tópico foi movido por","linked":"Link para sua mensagem","granted_badge":"Emblema concedido","group_message_summary":"Mensagens na caixa de entrada do grupo"},"popup":{"mentioned":"{{username}} mencionou você em \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mencionou você em \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citou você em \"{{topic}}\" - {{site_title}}","replied":"{{username}} respondeu para você em \"{{topic}}\" - {{site_title}}","posted":"{{username}} postou em \"{{topic}}\" - {{site_title}}","private_message":"{{username}} enviou uma mensagem particular para você em \"{{topic}}\" - {{site_title}}","linked":"{{username}} linkou o seu post de \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Adicionar uma imagem","title_with_attachments":"Adicionar uma imagem ou arquivo","from_my_computer":"Do meu dispositivo","from_the_web":"Da internet","remote_tip":"link da imagem","remote_tip_with_attachments":"link para imagem ou arquivo {{authorized_extensions}}","local_tip":"selecione imagens a partir do seu dispositivo","local_tip_with_attachments":"selecione imagens ou arquivos do seu dispositivo {{authorized_extensions}}","hint":"(Você também pode arrastar e soltar para o editor para carregá-las)","hint_for_supported_browsers":"Você pode também arrastar e soltar ou copiar imagens no editor","uploading":"Enviando","select_file":"Selecionar Arquivo","image_link":"link da sua imagem"},"search":{"sort_by":"Ordenar por","relevance":"Relevância","latest_post":"Última Mensagem","most_viewed":"Mais Visto","most_liked":"Mais Curtido","select_all":"Selecionar Todos","clear_all":"Limpar Todos","too_short":"Seu termo de pesquisa é muito curto.","result_count":{"one":"1 resultado para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} resultados para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"procurar em tópicos, respostas, usuários ou categorias","no_results":"Nenhum resultado encontrado.","no_more_results":"Sem mais resultados encontrados.","search_help":"Ajuda na busca","searching":"Procurando...","post_format":"#{{post_number}} por {{username}}","context":{"user":"Procurar respostas de @{{username}}","category":"Procurar a categoria #{{category}}","topic":"Procurar nesse tópico","private_messages":"Procurar mensagens"}},"hamburger_menu":"ir para outra listagem de tópicos ou categoria","new_item":"novo","go_back":"voltar","not_logged_in_user":"página do usuário com resumo de atividades correntes e preferencias","current_user":"ir para a sua página de usuário","topics":{"bulk":{"unlist_topics":"Tópicos Não Listados","reset_read":"Redefinir Lido","delete":"Apagar Tópicos","dismiss":"Marcar como lida","dismiss_read":"Marcar todas como lida","dismiss_button":"Descartar...","dismiss_tooltip":"Descartar apenas novos posts ou parar de monitorar tópicos","also_dismiss_topics":"Parar de monitorar esses tópicos para que eles deixem de aparecer como não lidos para mim","dismiss_new":"Dispensar Nova","toggle":"alternar a seleção em massa de tópicos","actions":"Ações em Massa","change_category":"Mudar Categoria","close_topics":"Fechar Tópicos","archive_topics":"Arquivar Tópicos","notification_level":"Modificar Nível de Notificação","choose_new_category":"Escolha a nova categoria para os tópicos:","selected":{"one":"Você selecionou \u003cb\u003e1\u003c/b\u003e tópico.","other":"Você selecionou \u003cb\u003e{{count}}\u003c/b\u003e tópicos."},"change_tags":"Mudar Etiquetas","choose_new_tags":"Escolha novas tags para esses tópicos:","changed_tags":"As tags para esses tópicos foram alteradas."},"none":{"unread":"Não há nenhum tópico não lido.","new":"Não há tópicos novos.","read":"Você ainda não leu nenhum tópico.","posted":"Você ainda não postou nenhum tópico.","latest":"Não há tópicos recentes. Isso é triste.","hot":"Não há tópicos quentes.","bookmarks":"Você ainda não tem tópicos nos favoritos.","category":"Não há tópicos na categoria {{category}}.","top":"Não há tópicos em alta.","search":"Não foram encontrados resultados.","educate":{"new":"\u003cp\u003eSeus novos tópicos aparecem aqui.\u003c/p\u003e\u003cp\u003ePor padrão, tópicos são considerados novos e mostrarão um indicador \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enovo\u003c/span\u003e se foram criados nos últimos 2 dias.\u003c/p\u003e\u003cp\u003eVisite as suas \u003ca href=\"%{userPrefsUrl}\"\u003epreferências\u003c/a\u003e para mudar isto.\u003c/p\u003e","unread":"\u003cp\u003eSeus tópicos não lidos aparecem aqui.\u003c/p\u003e\u003cp\u003ePor padrão, tópicos são considerados como não lidos e irão mostrar contadores \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e se você:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCriou o tópico\u003c/li\u003e\u003cli\u003eRespondeu ao tópico\u003c/li\u003e\u003cli\u003eLeu o tópico por mais de 4 minutos\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOu se você explicitamente colocou o tópico como Monitorado ou Observado através do controle de notificações que fica na parte inferior de cada tópico.\u003c/p\u003e\u003cp\u003eDê uma passada nas suas \u003ca href=\"%{userPrefsUrl}\"\u003epreferências\u003c/a\u003e para mudar isso.\u003c/p\u003e"}},"bottom":{"latest":"Não há mais tópicos recentes.","hot":"Não mais tópicos quentes.","posted":"Não há mais tópicos postados.","read":"Não há mais tópicos lidos.","new":"Não há mais tópicos novos.","unread":"Não há mais tópicos não lidos.","category":"Não há mais tópicos na categoria {{category}}.","top":"Não há mais tópicos em alta.","bookmarks":"Não há mais tópicos nos favoritos.","search":"Não existem mais resultados."}},"topic":{"unsubscribe":{"stop_notifications":"Você agora vai receber menos notificações de \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Seu estado de notificação atual é"},"create":"Novo tópico","create_long":"Criar um novo tópico","private_message":"Iniciar uma mensagem","archive_message":{"help":"Mover mensagens para o seu arquivo","title":"Arquivar"},"move_to_inbox":{"title":"Mover para caixa de entrada","help":"Mover mensagem para Caixa de Entrada"},"list":"Tópicos","new":"novo tópico","unread":"não lido","new_topics":{"one":"1 tópico novo","other":"{{count}} novos tópicos"},"unread_topics":{"one":"1 tópico não lido","other":"{{count}} tópicos não lidos"},"title":"Tópico","invalid_access":{"title":"Tópico é particular","description":"Desculpe, você não tem acesso a esse tópico!","login_required":"Você precisa de logar para ver este tópico."},"server_error":{"title":"Falha ao carregar o tópico","description":"Desculpe, nós não conseguimos carregar este tópico, possivelmente devido a um problema na conexão. Por favor teste novamente. Se o problema persistir, contate-nos."},"not_found":{"title":"Tópico não encontrado","description":"Desculpe, não foi possível encontrar esse tópico. Talvez ele tenha sido apagado?"},"total_unread_posts":{"one":"você tem {{count}} post não lido neste tópico","other":"você tem {{count}} posts não lidos neste tópico"},"unread_posts":{"one":"você possui 1 resposta antiga que não foi lida neste tópico","other":"você possui {{count}} respostas antigas que não foram lidas neste tópico"},"new_posts":{"one":"há 1 nova resposta neste tópico desde a sua última leitura","other":"há {{count}} novas respostas neste tópico desde a sua última leitura"},"likes":{"one":"há 1 curtida neste tópico","other":"há {{count}} curtidas neste tópico"},"back_to_list":"Voltar a lista dos tópicos","options":"Opções do tópico","show_links":"mostrar links dentro desse tópico","toggle_information":"alternar detalhes do tópico","read_more_in_category":"Quer ler mais? Procure outros tópicos em {{catLink}} ou {{latestLink}}.","read_more":"Quer ler mais? {{catLink}} ou {{latestLink}}.","browse_all_categories":"Procurar em todas as categorias","view_latest_topics":"ver tópicos mais recentes","suggest_create_topic":"Que tal criar um tópico?","jump_reply_up":"pular para a resposta mais recente","jump_reply_down":"pular para a resposta mais antiga","deleted":"Este tópico foi apagado","auto_close_notice":"Este tópico vai ser automaticamente fechado em %{timeLeft}.","auto_close_notice_based_on_last_post":"Este tópico fechará %{duration} depois da última resposta.","auto_close_title":"Configurações para fechar automaticamente","auto_close_save":"Salvar","auto_close_remove":"Não fechar automaticamente este tópico","timeline":{"back":"Voltar","back_description":"Volte para a sua última postagem não lida","replies_short":"%{current} / %{total}"},"progress":{"title":"progresso do tópico","go_top":"topo","go_bottom":"último","go":"ir","jump_bottom":"ir para a última mensagem","jump_prompt":"ir para a mensagem","jump_prompt_long":"Gostaria de ir para qual mensagem?","jump_bottom_with_number":"ir para a mensagem %{post_number}","total":"total de mensagens","current":"resposta atual"},"notifications":{"title":"altere a frequência de notificações deste tópico","reasons":{"mailing_list_mode":"Você está com o modo de lista de discussão ativado, portanto será notificado sobre as respostas deste tópico por email.","3_10":"Você receberá notificações porque está acompanhando uma etiqueta neste tópico.","3_6":"Você receberá notificações porque você está observando esta categoria.","3_5":"Você receberá notificações porque começou a observar este tópico automaticamente.","3_2":"Você receberá notificações porque está observando este tópico.","3_1":"Você receberá notificações porque criou este tópico.","3":"Você receberá notificações porque você está observando este tópico.","2_8":"Você receberá notificações porque você está monitorando essa categoria.","2_4":"Você receberá notificações porque postou uma resposta neste tópico.","2_2":"Você receberá notificações porque está monitorando este tópico.","2":"Você receberá notificações porque você \u003ca href=\"/users/{{username}}/preferences\"\u003eleu este tópico\u003c/a\u003e.","1_2":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem.","1":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem.","0_7":"Você está ignorando todas as notificações nessa categoria.","0_2":"Você está ignorando todas as notificações deste tópico.","0":"Você está ignorando todas as notificações deste tópico."},"watching_pm":{"title":"Observando","description":"Você será notificado de cada mensagem nova neste tópico. Um contador de mensagens novas e não lidas também aparecerá próximo ao tópico."},"watching":{"title":"Observar","description":"Você será notificado de cada mensagem nova neste tópico. Um contador de mensagens novas e não lidas também aparecerá próximo ao tópico."},"tracking_pm":{"title":"Monitorando","description":"Um contador de novas respostas será mostrado para esta mensagem. Você será notificado se alguém mencionar seu @nome ou responder à sua mensagem."},"tracking":{"title":"Monitorar","description":"Um contador de novas respostas será mostrado para este tópico. Você será notificado se alguém mencionar seu @nome ou responder à sua mensagem."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"regular_pm":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"muted_pm":{"title":"Silenciado","description":"Você nunca será notificado de qualquer coisa sobre essa mensagem privada."},"muted":{"title":"Silenciar","description":"Você nunca será notificado sobre esse tópico e ele não aparecerá nos tópicos recentes."}},"actions":{"recover":"Recuperar Tópico","delete":"Apagar tópico","open":"Abrir tópico","close":"Fechar tópico","multi_select":"Selecionar Mensagens...","auto_close":"Fechar automaticamente...","pin":"Fixar Tópico...","unpin":"Desafixar Tópico...","unarchive":"Desarquivar tópico","archive":"Arquivar tópico","invisible":"Tornar Invisível","visible":"Tornar Visível","reset_read":"Repor data de leitura","make_public":"Transformar em Tópico Público","make_private":"Transformar em Mensagem Privada"},"feature":{"pin":"Fixar Tópico","unpin":"Desafixar Tópico","pin_globally":"Fixar Tópico Globalmente","make_banner":"Banner Tópico","remove_banner":"Remover Banner Tópico"},"reply":{"title":"Responder","help":"comece a compor uma resposta a este tópico"},"clear_pin":{"title":"Remover destaque","help":"Retirar destaque deste tópico para que ele não apareça mais no topo da sua lista de tópicos"},"share":{"title":"Compartilhar","help":"compartilhar um link deste tópico"},"flag_topic":{"title":"Sinalizar","help":"sinaliza privativamente este tópico para chamar atenção ou notificar privativamente sobre isso","success_message":"Você sinalizou com sucesso este tópico."},"feature_topic":{"title":"Destacar este tópico","pin":"Fazer que este tópico apareça no topo da categoria  {{categoryLink}} até","confirm_pin":"Você já tem {{count}} tópicos fixos. Muitos tópicos fixados podem atrapalhar usuários novos e anônimos. Tem certeza que quer fixar outro tópico nesta categoria?","unpin":"Remover este tópico do inicio da {{categoryLink}} categoria.","unpin_until":"Remover este tópico do topo da categoria {{categoryLink}} ou esperar até \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Usuários podem desafixar o tópico individualmente para si.","pin_validation":"Uma data é necessária para fixar este tópico.","not_pinned":"Não existem tópicos fixados em {{categoryLink}}.","already_pinned":{"one":"Tópicos fixados em {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Tópicos fixados em {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Fazer com que este tópico apareça no topo de todas listas de tópicos até","confirm_pin_globally":"Você já tem {{count}} tópicos fixados globalmente. Muitos tópicos fixados podem prejudicar usuários novos e anônimos. Tem certeza que quer fixar outro tópico globalmente?","unpin_globally":"Remover este tópico do inicio de todas as listas de tópicos.","unpin_globally_until":"Remover este tópico do topo de todas listagens de tópicos ou esperar até \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Usuários podem desafixar o tópico individualmente para si.","not_pinned_globally":"Não existem tópicos fixados globalmente.","already_pinned_globally":{"one":"Tópicos atualmente fixados globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e.","other":"Tópicos atualmente fixados globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Tornar este tópico em um banner que apareça no inicio de todas as páginas.","remove_banner":"Remover o banner que aparece no inicio de todas as páginas.","banner_note":"Usuários podem dispensar o banner fechando-o. Apenas um tópico pode ser colocado como banner a cada momento.","no_banner_exists":"Não existe tópico banner.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eExiste\u003c/strong\u003e atualmente um tópico banner."},"inviting":"Convidando...","automatically_add_to_groups":"Este convite também inclui acesso para esses grupos:","invite_private":{"title":"Convidar para Conversa Privada","email_or_username":"Email ou Nome de Usuário do convidado","email_or_username_placeholder":"email ou Nome de Usuário","action":"Convite","success":"Nós convidamos aquele usuário para participar desta mensagem privada.","success_group":"Nós convidamos aquele grupo para participar desta mensagem.","error":"Desculpe, houve um erro ao convidar esse usuário.","group_name":"nome do grupo"},"controls":"Controles do Tópico","invite_reply":{"title":"Convite","username_placeholder":"nome de usuário","action":"Enviar Convites","help":"Convidar outros para este tópico por email ou notificação","to_forum":"Nós vamos mandar um email curto permitindo seu amigo a entrar e responder a esse tópico clicando em um link, sem necessidade de entrar.","sso_enabled":"Entrar o nome de usuário da pessoa que você gostaria de convidar para este tópico.","to_topic_blank":"Entrar o nome de usuário ou endereço de email da pessoa que você gostaria de convidar para este tópico.","to_topic_email":"Você digitou um endereço de email. Nós enviaremos um convite por email que permite seu amigo responder imediatamente a este tópico.","to_topic_username":"Você inseriu um nome de usuário. Nós vamos enviar uma notificação com um link convidando-o para este tópico.","to_username":"Insira o nome de usuário da pessoa que você gostaria de convidas. Nós vamos enviar uma notificação com um link convidando-o para este tópico.","email_placeholder":"nome@exemplo.com","success_email":"Enviamos um convite para \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Nós notificaremos você quando este convite for resgatado. Verifique a aba de convites na página de seu usuário para acompanhar seus convites.","success_username":"Nós convidamos o usuário para participar neste tópico.","error":"Desculpe, nós não pudemos convidar esta pessoa. Talvez já seja usuário? (convites têm taxa limitada)"},"login_reply":"Logar para Responder","filters":{"n_posts":{"one":"1 mensagem","other":"{{count}} mensagens"},"cancel":"Remover filtro"},"split_topic":{"title":"Mover para novo tópico","action":"mover para novo tópico","topic_name":"Nome do tópico novo","error":"Houve um erro ao mover as mensagens para o novo tópico.","instructions":{"one":"Você está prestes a criar um novo tópico e populá-lo com a resposta que você selecionou.","other":"Você está prestes a criar um novo tópico e populá-lo com as \u003cb\u003e{{count}}\u003c/b\u003e respostas que você selecionou."}},"merge_topic":{"title":"Mover para tópico já existente","action":"mover para tópico já existente","error":"Houve um erro ao mover as mensagens para aquele tópico.","instructions":{"one":"Por favor selecione o tópico para o qual você gostaria de mover esta resposta.","other":"Por favor selecione o tópico para o qual você gostaria de mover estas \u003cb\u003e{{count}}\u003c/b\u003e respostas."}},"merge_posts":{"title":"Unificar as Mensagens Selecionadas","action":"unificar as mensagens selecionadas","error":"Houve um erro ao unificar as mensagens selecionadas."},"change_owner":{"title":"Trocar Autor das Mensagens","action":"trocar autor","error":"Houve um erro ao alterar o autor dessas mensagens.","label":"Novo Autor das Mensagens","placeholder":"novo autor","instructions":{"one":"Por favor, escolha o novo dono do post por  \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Por favor, escolha o novo autor dessas {{count}} mensagens que eram de \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Note que qualquer notificação sobre esta mensagem não irá ser transferida para o novo usuário retroativamente.\u003cbr\u003eAlerta: Atualmente, nenhum dado dependente da mensagem será transferido para o novo usuário. Use com cuidado."},"change_timestamp":{"title":"Alterar Horário","action":"alterar horário","invalid_timestamp":"Horário não pode ser no futuro.","error":"Ocorreu um erro alterando o horário do tópico.","instructions":"Por favor selecione um novo horário para o tópico. Mensagens no tópico serão atualizadas para manter a mesma diferença de tempo."},"multi_select":{"select":"selecionar","selected":"({{count}}) selecionados","select_replies":"selecione +respostas","delete":"apagar selecionados","cancel":"cancelar seleção","select_all":"selecionar tudo","deselect_all":"deselecionar tudo","description":{"one":"\u003cb\u003e1\u003c/b\u003e resposta selecionada.","other":"\u003cb\u003e{{count}}\u003c/b\u003e respostas selecionadas."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citar resposta","edit":"Em resposta a {{link}} por {{replyAvatar}} {{username}}","edit_reason":"Motivo:","post_number":"resposta {{number}}","last_edited_on":"resposta editada pela última vez em","reply_as_new_topic":"Responder como um Tópico linkado","continue_discussion":"Continuando a discussão do {{postLink}}:","follow_quote":"ir para a resposta citada","show_full":"Exibir mensagem completa","show_hidden":"Ver conteúdo escondido","deleted_by_author":{"one":"(respostas abandonadas pelo autor, serão removidas automaticamente em %{count} hora a exceto se forem sinalizadas)","other":"(respostas abandonadas pelo autor, serão removidas automaticamente em %{count} horas a exceto se forem sinalizadas)"},"expand_collapse":"expandir/encolher","gap":{"one":"ver 1 resposta oculta","other":"ver {{count}} respostas ocultas"},"unread":"Resposta não lida","has_replies":{"one":"{{count}} Resposta","other":"{{count}} Respostas"},"has_likes":{"one":"{{count}} Curtida","other":"{{count}} Curtidas"},"has_likes_title":{"one":"{{count}} pessoa curtiu esta mensagem","other":"{{count}} pessoas curtiram esta mensagem"},"has_likes_title_only_you":"você curtiu esta postagem","has_likes_title_you":{"one":"você e mais 1 pessoa gostaram dessa postagem","other":"você e mais {{count}} outras pessoas gostaram dessa postagem"},"errors":{"create":"Desculpe, houve um erro ao criar sua resposta. Por favor, tente outra vez.","edit":"Desculpe, houve um erro ao editar sua resposta. Por favor, tente outra vez.","upload":"Desculpe, houve um erro ao enviar esse arquivo. Por favor, tente outra vez.","file_too_large":"Desculpe, o arquivo que você está tentando enviar é muito grande (o tamanho máximo permitido é {{max_size_kb}}kb). Que tal enviar o seu arquivo grande para um serviço de hospedagem na nuvem e depois compartilhar o link?","too_many_uploads":"Desculpe, você pode enviar apenas um arquivos por vez.","too_many_dragged_and_dropped_files":"Desculpe, você só pode subir até 10 arquivos de cada vez.","upload_not_authorized":"Desculpe, o tipo de arquivo que você está tentando enviar não está autorizado (extensões autorizadas: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Desculpe, novos usuário não podem enviar imagens.","attachment_upload_not_allowed_for_new_user":"Desculpe, usuários novos não podem enviar anexos.","attachment_download_requires_login":"Desculpe, você precisa estar logado para baixar arquivos anexos."},"abandon":{"confirm":"Tem certeza que quer abandonar a sua mensagem?","no_value":"Não, manter","yes_value":"Sim, abandone"},"via_email":"post recebido via email","via_auto_generated_email":"essa mensagem chegou através de um email gerado automaticamente","whisper":"esta mensagem é um sussuro privado para moderadores","wiki":{"about":"esta postagem é uma wiki"},"archetypes":{"save":"Salvar as opções"},"few_likes_left":"Obrigado por compartilhar o amor! Restam apenas algumas poucas curtidas sobrando para você usar hoje.","controls":{"reply":"comece a compor uma resposta para este tópico","like":"curtir esta resposta","has_liked":"você curtiu essa resposta","undo_like":"desfazer curtida","edit":"editar esta resposta","edit_anonymous":"Você precisa estar conectado para editar essa resposta.","flag":"sinalize privativamente esta resposta para chamar atenção ou enviar uma notificação privada sobre ela","delete":"apagar esta resposta","undelete":"recuperar esta resposta","share":"compartilhar o link desta resposta","more":"Mais","delete_replies":{"confirm":{"one":"Você também quer remover a resposta direta a esta resposta?","other":"Você também quer remover as {{count}} respostas diretas a esta resposta?"},"yes_value":"Sim, remover as respostas também","no_value":"Não, somente esta resposta"},"admin":"ações de mensagens do admin","wiki":"Tornar Wiki","unwiki":"Remover Wiki","convert_to_moderator":"Converter para Moderação","revert_to_regular":"Remover da Moderação","rebake":"Reconstruir HTML","unhide":"Revelar","change_owner":"Trocar autor"},"actions":{"flag":"Sinalização","defer_flags":{"one":"Delegar denuncia","other":"Delegar denúncias"},"undo":{"off_topic":"Desfazer sinalização","spam":"Desfazer sinalização","inappropriate":"Desfazer sinalização","bookmark":"Remover favorito","like":"Descurtir","vote":"Desfazer voto"},"people":{"off_topic":"marcado como off-topic","spam":"marcado como spam","inappropriate":"marcado como inapropriado","notify_moderators":"notificaram os moderadores","notify_user":"enviou uma mensagem","bookmark":"favoritaram isto","like":"curtiu isto","vote":"votaram nisto"},"by_you":{"off_topic":"Você sinalizou isto como off-topic","spam":"Você sinalizou isto como spam","inappropriate":"Você sinalizou isto como inapropriado","notify_moderators":"Você sinalizou isto para a moderação","notify_user":"Você enviou uma mensagem particular para este usuário","bookmark":"Você favoritou esta resposta","like":"Você curtiu","vote":"Você votou nesta resposta"},"by_you_and_others":{"off_topic":{"one":"Você e mais 1 pessoa sinalizaram isto como off-topic","other":"Você e mais {{count}} pessoas sinalizaram isto como off-topic"},"spam":{"one":"Você e mais 1 pessoa sinalizaram isto como spam","other":"Você e mais {{count}} pessoas sinalizaram isto como spam"},"inappropriate":{"one":"Você e mais 1 pessoa sinalizaram isto como inapropriado","other":"Você e mais {{count}} pessoas sinalizaram isto como inapropriado"},"notify_moderators":{"one":"Você e mais 1 pessoa sinalizaram isto para moderação","other":"Você e mais {{count}} pessoas sinalizaram isto para moderação"},"notify_user":{"one":"Você e 1 outro usuário enviaram mensagens particulares para este usuário","other":"Você e mais {{count}} usuários enviaram mensagens particulares para este usuário"},"bookmark":{"one":"Você e mais 1 pessoa favoritaram esta resposta","other":"Você e mais {{count}} favoritaram esta resposta"},"like":{"one":"Você e mais 1 pessoa curtiu isto","other":"Você e mais {{count}} pessoas curtiram isto"},"vote":{"one":"Você e mais 1 pessoa votaram nesta resposta","other":"Você e mais {{count}} pessoas votaram nesta resposta"}},"by_others":{"off_topic":{"one":"1 pessoa sinalizou isto como off-topic","other":"{{count}} pessoas sinalizaram isto como off-topic"},"spam":{"one":"1 pessoa sinalizou isto como spam","other":"{{count}} pessoas sinalizaram isto como spam"},"inappropriate":{"one":"1 pessoa sinalizou isto como inapropriado","other":"{{count}} pessoas sinalizaram isto como inapropriado"},"notify_moderators":{"one":"1 pessoa sinalizou isto para moderação","other":"{{count}} pessoas sinalizaram isto para moderação"},"notify_user":{"one":"1 usuário enviou mensagem particular para este usuário","other":"{{count}} enviaram mensagem particular para este usuário"},"bookmark":{"one":"1 pessoa favoritou esta resposta","other":"{{count}} pessoas favoritaram esta resposta"},"like":{"one":"1 pessoa curtiu","other":"{{count}} pessoas curtiram"},"vote":{"one":"1 pessoa votou nesta resposta","other":"{{count}} pessoas votaram nesta resposta"}}},"delete":{"confirm":{"one":"Tem certeza que quer apagar esta resposta?","other":"Tem certeza que quer apagar todos essas respostas?"}},"merge":{"confirm":{"one":"Você tem certeza que quer fundir essas postagens?","other":"Você tem certeza que quer fundir essas {{count}} postagens?"}},"revisions":{"controls":{"first":"Primeira revisão","previous":"Revisão anterior","next":"Próxima revisão","last":"Última revisão","hide":"Esconder revisão","show":"Exibir revisão","revert":"Reverter para esta revisão","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Exibir a saída renderizada com adições e remoções em linha","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Exibir as diferentes saídas renderizadas lado a lado","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Mostrar a diferença da fonte crua lado-a-lado","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Cru"}}}},"category":{"can":"pode\u0026hellip; ","none":"(sem categoria)","all":"Todas as categorias","choose":"Selecionar categoria\u0026hellip;","edit":"editar","edit_long":"Editar","view":"Ver tópicos na categoria","general":"Geral","settings":"Configurações","topic_template":"Modelo de Tópico","tags":"Etiquetas","tags_allowed_tags":"Etiquetas que só podem ser usadas nesta categoria:","tags_allowed_tag_groups":"Grupos de etiquetas que só podem ser usados nesta categoria:","tags_placeholder":"(Opcional) lista de etiquetas permitidas","tag_groups_placeholder":"(Opcional) lista de grupos de etiquetas permitidos","delete":"Apagar categoria","create":"Nova categoria","create_long":"Criar uma nova categoria","save":"Salvar categoria","slug":"Slug da Categoria","slug_placeholder":"(Opcional) palavras hifenizadas para url","creation_error":"Houve um erro durante a criação da categoria.","save_error":"Houve um erro ao salvar a categoria.","name":"Nome da Categoria","description":"Descrição","topic":"tópico da categoria","logo":"Imagem do logo da categoria","background_image":"Imagem de fundo da categoria","badge_colors":"Cores do emblema","background_color":"Background color","foreground_color":"Foreground color","name_placeholder":"máximo de uma ou duas palavras","color_placeholder":"Qualquer cor web","delete_confirm":"Tem certeza que quer apagar esta categoria?","delete_error":"Houve um erro ao apagar a categoria.","list":"Lista de categorias","no_description":"Adicione uma descrição para essa categoria.","change_in_category_topic":"Editar Descrição","already_used":"Esta cor já foi usada para outra categoria","security":"Segurança","special_warning":"Atenção: Esta categoria é uma categoria padrão e as configurações de segurança e não podem ser editadas. Se você não quer usar esta categoria, apague-a ao invés de reaproveitá-la.","images":"Imagens","auto_close_label":"Fechar automaticamente tópicos depois de:","auto_close_units":"horas","email_in":"Endereço de e-mail personalizado de entrada:","email_in_allow_strangers":"Aceitar emails de usuários anônimos sem cont","email_in_disabled":"Postar novos tópicos via email está desabilitado nas Configurações do Site. Para habilitar respostas em novos tópicos via email,","email_in_disabled_click":"habilitar a configuração de \"email em\".","suppress_from_homepage":"Suprimir esta categoria da página inicial.","allow_badges_label":"Permitir a concessão de emblemas nessa categoria","edit_permissions":"Editar Permissões","add_permission":"Adicionar Permissões","this_year":"este ano","position":"posição","default_position":"Posição Padrão","position_disabled":"Categorias serão mostradas em ordem de atividade. Para controlar a ordem das categorias em listas,","position_disabled_click":"habilitar a configuração de \"posição de categoria fixa\".","parent":"Categoria Principal","notifications":{"watching":{"title":"Observar","description":"Você vai observar automaticamente todos os tópicos dessas categorias. Você será notificado de todas as novas mensagens em todos os tópicos.  Além disso, a contagem de novas respostas também será exibida."},"watching_first_post":{"title":"Observando o primeiro post","description":"Você somente será notificado sobre a primeira postagem em cada novo tópico destas categorias."},"tracking":{"title":"Monitorar","description":"Você vai monitorar automaticamente todos os tópicos dessas categorias. Você será notificado se alguém mencionar o seu @nome ou responder para você.  Além disso, a contagem de novas respostas também será exibida."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"muted":{"title":"Silenciar","description":"Você nunca será notificado sobre novos tópicos nessas categorias, e não aparecerão no Recentes."}}},"flagging":{"title":"Obrigado por ajudar a manter a civilidade da nossa comunidade!","action":"Sinalizar resposta","take_action":"Tomar Atitude","notify_action":"Mensagem","official_warning":"Aviso Oficial","delete_spammer":"Apagar Spammer","yes_delete_spammer":"Sim, Apagar Spammer","ip_address_missing":"(N/D)","hidden_email_address":"(escondido)","submit_tooltip":"Enviar uma sinalização privada","take_action_tooltip":"Atingir o limiar de denuncias imediatamente, ao invés de esperar para mais denuncias da comunidade","cant":"Desculpe, não é possível colocar uma sinalização neste momento.","notify_staff":"Avisar a equipe privadamente","formatted_name":{"off_topic":"É Off-Tópico","inappropriate":"É inapropriado","spam":"É spam"},"custom_placeholder_notify_user":"Seja específico, construtivo e sempre seja gentil.","custom_placeholder_notify_moderators":"Deixe-nos saber especificamente com o que você está preocupado, e nos forneça links relevantes e exemplos quando possível."},"flagging_topic":{"title":"Obrigado por ajudar a manter a civilidade da nossa comunidade!","action":"Sinalizar Tópico","notify_action":"Mensagem"},"topic_map":{"title":"Resumo do Tópico","participants_title":"Principais Participantes","links_title":"Links Populares","links_shown":"mostrar mais links...","clicks":{"one":"1 clique","other":"%{count} cliques"}},"post_links":{"about":"expandir mais links para esta mensagem","title":{"one":"mais 1","other":"mais %{count}"}},"topic_statuses":{"warning":{"help":"Este é um aviso oficial."},"bookmarked":{"help":"Você adicionou este tópico aos favoritos"},"locked":{"help":"Este tópico está fechado; não serão aceitas mais respostas"},"archived":{"help":"Este tópico está arquivado; está congelado e não pode ser alterado"},"locked_and_archived":{"help":"Este tópico está fechado e arquivado; ele não aceita novas respostas e não pode ser alterado."},"unpinned":{"title":"Não fixo","help":"Este tópico está desfixado para você; ele será mostrado em ordem normal"},"pinned_globally":{"title":"Fixo Globalmente","help":"Este tópico está fixado globalmente; ele será exibido no topo da aba Recentes e no topo da sua categoria"},"pinned":{"title":"Fixo","help":"Este tópico está fixado para você; ele será mostrado no topo de sua categoria"},"invisible":{"help":"Este tópico está invisível; não aparecerá na listagem dos tópicos, e pode apenas ser acessado por link direto"}},"posts":"Postagens","posts_long":"há {{number}} mensagens neste tópico","original_post":"Resposta original","views":"Visualizações","views_lowercase":{"one":"visualizar","other":"visualizações"},"replies":"Respostas","views_long":"este tópico foi visto {{number}} vezes","activity":"Atividade","likes":"Curtidas","likes_lowercase":{"one":"like","other":"likes"},"likes_long":"há {{number}} curtidas neste tópico","users":"Usuários","users_lowercase":{"one":"usuário","other":"usuários"},"category_title":"Categoria","history":"Histórico","changed_by":"por {{author}}","raw_email":{"title":"Email Raw","not_available":"Não disponível!"},"categories_list":"Lista de categorias","filters":{"with_topics":"%{filter} tópicos","with_category":"%{filter} %{category} tópicos","latest":{"title":"Recente","title_with_count":{"one":"Recente (1)","other":"Recentes ({{count}})"},"help":"tópicos com mensagens recentes"},"hot":{"title":"Quente","help":"uma seleção dos tópicos mais quentes"},"read":{"title":"Lido","help":"tópicos que você leu"},"search":{"title":"Pesquisar","help":"procurar todos tópicos"},"categories":{"title":"Categorias","title_in":"Categoria - {{categoryName}}","help":"todos os tópicos agrupados por categoria"},"unread":{"title":"Não lidas","title_with_count":{"one":"Não lido (1)","other":"Não lidos ({{count}})"},"help":"tópicos que você está observando ou monitorando com mensagens não lidas","lower_title_with_count":{"one":"1 não lido","other":"{{count}} não lidos"}},"new":{"lower_title_with_count":{"one":"1 nova","other":"{{count}} novas"},"lower_title":"nova","title":"Novo","title_with_count":{"one":"Novo (1)","other":"Novos ({{count}})"},"help":"tópicos criados nos últimos dias"},"posted":{"title":"Minhas mensagens","help":"tópicos nos quais você postou"},"bookmarks":{"title":"Favoritos","help":"tópicos que você adicionou aos favoritos"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"tópicos recentes na categoria {{categoryName}}"},"top":{"title":"Melhores","help":"os tópicos mais ativos no último ano, mês, semana ou dia","all":{"title":"Tempo Todo"},"yearly":{"title":"Anualmente"},"quarterly":{"title":"Trimestralmente"},"monthly":{"title":"Mensalmente"},"weekly":{"title":"Semanalmente"},"daily":{"title":"Diariamente"},"all_time":"Tempo Todo","this_year":"Ano","this_quarter":"Trimestre","this_month":"Mês","this_week":"Semana","today":"Hoje","other_periods":"Veja o topo"}},"browser_update":"Infelizmente, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eseu navegador é muito antigo para ser utilizado neste site\u003c/a\u003e. Por favor \u003ca href=\"http://browsehappy.com\"\u003eatualize seu navegador\u003c/a\u003e.","permission_types":{"full":"Criar / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"lightbox":{"download":"download"},"search_help":{"title":"Ajuda na pesquisa"},"keyboard_shortcuts_help":{"title":"Atalhos de teclado","jump_to":{"title":"Ir Para","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Início","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Mais recentes","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Novos","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Não Lidos","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categorias","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Topo","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Favoritos","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Perfil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mensagens"},"navigation":{"title":"Navegação","jump":"\u003cb\u003e#\u003c/b\u003e Ir para a mensagem #","back":"\u003cb\u003eu\u003c/b\u003e Voltar","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move seleção \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e ou \u003cb\u003eEnter\u003c/b\u003e Abre tópico selecionado","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Pŕoxima seção/seção anterior"},"application":{"title":"Aplicação","create":"\u003cb\u003ec\u003c/b\u003e Criar um tópico novo","notifications":"\u003cb\u003en\u003c/b\u003e Abre notificações","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Abrir o menu hambúrguer","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Abrir menu do usuário","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Exibir tópicos atualizados","search":"\u003cb\u003e/\u003c/b\u003e Pesquisa","help":"\u003cb\u003e?\u003c/b\u003e Abrir ajuda de teclado","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Descartar Novas Postagens","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Descartar Tópicos","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Deslogar"},"actions":{"title":"Ações","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Favoritar o tópico","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Fixar/Desfixar tópico","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Compartilhar tópico","share_post":"\u003cb\u003es\u003c/b\u003e Compartilhar mensagem","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Responder como tópico linkado","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Responder ao tópico","reply_post":"\u003cb\u003er\u003c/b\u003e Responder a mensagem","quote_post":"\u003cb\u003eq\u003c/b\u003e Citar resposta","like":"\u003cb\u003el\u003c/b\u003e Curtir a mensagem","flag":"\u003cb\u003e!\u003c/b\u003e Sinalizar mensagem","bookmark":"\u003cb\u003eb\u003c/b\u003e Favoritar mensagem","edit":"\u003cb\u003ee\u003c/b\u003e Editar mensagem","delete":"\u003cb\u003ed\u003c/b\u003e Excluir mensagem","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Silenciar tópico","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Tópico regular (padrão)","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Monitorar o tópico","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Observar o tópico"}},"badges":{"earned_n_times":{"one":"Emblema adquirido 1 vez","other":"Emblema adquirido %{count} vezes"},"granted_on":"Concedido em %{date}","others_count":"Outros com esse emblema (%{count})","title":"Emblemas","allow_title":"título disponível","multiple_grant":"concedido várias vezes","badge_count":{"one":"1 Emblema","other":"%{count} Emblemas"},"more_badges":{"one":"+1 Mais","other":"+%{count} Mais"},"granted":{"one":"1 concedido","other":"%{count} concedidos"},"select_badge_for_title":"Selecione um emblema para usar como o seu título","none":"\u003cnenhum\u003e","badge_grouping":{"getting_started":{"name":"Primeiros Passos"},"community":{"name":"Comunidade"},"trust_level":{"name":"Nível de Confiança"},"other":{"name":"Outros"},"posting":{"name":"Publicando"}}},"google_search":"\u003ch3\u003eProcurar com o Google\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Todas as Etiquetas","selector_all_tags":"todas as etiquetas","selector_no_tags":"sem etiquetas","changed":"etiquetas alteradas:","tags":"Etiquetas","choose_for_topic":"Escolha marcadores opcionais para este tópico","delete_tag":"Apagar marcação","delete_confirm":"Você tem certeza que deseja apagar essa marcação?","rename_tag":"Renomear marcador","rename_instructions":"Escolha um novo nome para o marcador","sort_by":"Ordenar por","sort_by_count":"quantidade","sort_by_name":"nome","manage_groups":"Gerenciar grupos de marcadores","manage_groups_description":"Definir grupos para organizar marcadores","filters":{"without_category":"%{filter} %{category} Tópicos","with_category":"%{filter} %{tag} tópicos em %{category}","untagged_without_category":"%{filter} tópicos não etiquetados","untagged_with_category":"%{filter} tópicos não etiquetados em %{category}"},"notifications":{"watching":{"title":"Observando","description":"Você vai observar automaticamente todos os tópicos com esta etriqueta. Você será notificado de todas as novas mensagens e tópicos.  Além disso, a contagem de mensagens não lidas e novas também aparecerá ao lado do tópico."},"watching_first_post":{"title":"Observando o primeiro post","description":"Você somente será notificado sobre a primeira postagem em cada novo tópico com esta etiqueta."},"tracking":{"title":"Monitorando","description":"Automaticamente monitora todos tópicos com essa etiqueta. Uma contagem de posts não lidos e novos aparecerá próximo ao tópico."},"regular":{"title":"Normal","description":"Você será notificado se alguém mencionar o seu @nome ou responder à sua mensagem."},"muted":{"title":"Silenciado","description":"Você não será notificado sobre novos tópicos com essa etiqueta e eles não vão aparecer na guia de mensagens não lidas."}},"groups":{"title":"Grupos de Etiquetas","about":"Adicione marcadores aos grupos para gerenciá-los mais facilmente","new":"Novo grupo","tags_label":"Marcadores neste grupo","parent_tag_label":"Categoria Principal","parent_tag_placeholder":"Opcional","parent_tag_description":"Etiquetas deste grupo não podem ser usadas a menos que a etiqueta principal esteja presente.","one_per_topic_label":"Limite uma etiqueta por tópico deste grupo","new_name":"Novo Grupo de Etiquetas","save":"Salvar","delete":"Apagar","confirm_delete":"Tem certeza de que deseja remover este grupo de etiquetas?"},"topics":{"none":{"unread":"Não há nenhum tópico não lido.","new":"Você tem tópicos novos","read":"Você ainda não leu nenhum tópico.","posted":"Você ainda não escreveu em nenhum tópico.","latest":"Não há tópicos recentes.","hot":"Não há tópicos quentes.","bookmarks":"Você ainda não tem tópicos nos favoritos.","top":"Não há tópicos em alta.","search":"Não foram encontrados resultados."},"bottom":{"latest":"Não há mais tópicos recentes.","hot":"Não há mais tópicos quentes.","posted":"Não há mais tópicos postados.","read":"Não há mais tópicos lidos.","new":"Não há mais tópicos novos.","unread":"Não há mais tópicos não lidos.","top":"Não há mais tópicos em alta.","bookmarks":"Não há mais tópicos nos favoritos.","search":"Não existem mais resultados."}}},"invite":{"custom_message":"Faça seu convite um pouco mais pessoal escrevendo um","custom_message_link":"mensagem personalizada","custom_message_placeholder":"Insira a sua mensagem personalizada","custom_message_template_forum":"Ei, você devia entrar neste fórum!","custom_message_template_topic":"Ei, eu acho que você vai gostar deste tópico!"},"poll":{"voters":{"one":"votante","other":"votantes"},"total_votes":{"one":"voto total","other":"votos totais"},"average_rating":"Resultado médio: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"A votação é pública."},"multiple":{"help":{"at_least_min_options":{"one":"Você deve escolher pelo menos \u003cstrong\u003e%{count}\u003c/strong\u003e opções.","other":"Você deve escolher pelo menos \u003cstrong\u003e%{count}\u003c/strong\u003e opções."},"up_to_max_options":{"one":"Você deve escolher até \u003cstrong\u003e%{count}\u003c/strong\u003e opções.","other":"Você deve escolher até \u003cstrong\u003e%{count}\u003c/strong\u003e opções."},"x_options":{"one":"Você deve escolher \u003cstrong\u003e%{count}\u003c/strong\u003e opções.","other":"Você deve escolher \u003cstrong\u003e%{count}\u003c/strong\u003e opções."},"between_min_and_max_options":"Você pode escolher entre \u003cstrong\u003e%{min}\u003c/strong\u003e e \u003cstrong\u003e%{max}\u003c/strong\u003e opções"}},"cast-votes":{"title":"Seus votos","label":"Votar agora!"},"show-results":{"title":"Mostrar o resultado da enquete","label":"Mostrar resultados"},"hide-results":{"title":"Voltar para os seus votos","label":"Esconder resultados"},"open":{"title":"Abrir a enquete","label":"Abrir","confirm":"Você tem certeza que deseja abrir essa enquete?"},"close":{"title":"Fechar a enquete","label":"Fechar","confirm":"Você tem certeza que deseja fechar essa enquete?"},"error_while_toggling_status":"Desculpe, houve um erro ao mudar a situação da enquete..","error_while_casting_votes":"Desculpe, houve um erro ao votar.","error_while_fetching_voters":"Desculpe, houve um erro ao mostrar os votantes.","ui_builder":{"title":"Criar Enquete","insert":"Inserir resposta","help":{"options_count":"Enquetes devem ter no mínimo 2 opções"},"poll_type":{"label":"Tipo","regular":"Única escolha","multiple":"Múltipla escolha","number":"Classificação numérica"},"poll_config":{"max":"Máx","min":"Mín","step":"Etapa"},"poll_public":{"label":"Exibir votantes"},"poll_options":{"label":"Insira uma resposta por linha"}}},"type_to_filter":"escreva para filtrar...","admin":{"title":"Discourse Admin","moderator":"Moderador","dashboard":{"title":"Painel Administrativo","last_updated":"Painel atualizado em:","version":"Versão","up_to_date":"Você está atualizado!","critical_available":"Uma atualização crítica está disponível.","updates_available":"Atualizações estão disponíveis.","please_upgrade":"Por favor, atualize!","no_check_performed":"Não foi feita verificação por atualizações. Certifique-se de sidekiq esta em execucao.","stale_data":"Não foi feita verificação por atualizações ultimamente. Certifique-se de sidekiq esta em execucao.","version_check_pending":"Parece que você atualizou recentemente. Fantástico!","installed_version":"Instalado","latest_version":"Última versão","problems_found":"Alguns problemas foram encontrados na sua instalação do Discourse:","last_checked":"Última verificação","refresh_problems":"Atualizar","no_problems":"Nenhum problema encontrado.","moderators":"Moderadores:","admins":"Admins:","blocked":"Bloqueado:","suspended":"Suspenso:","private_messages_short":"Msgs","private_messages_title":"Mensagens","mobile_title":"Mobile","space_free":"{{size}} livre","uploads":"uploads","backups":"backups","traffic_short":"Tráfego","traffic":"Solicitações do aplicativo pela web","page_views":"Solicitações de API","page_views_short":"Solicitações de API","show_traffic_report":"Mostrar Relatório de Tráfego Detalhado","reports":{"today":"Hoje","yesterday":"Ontem","last_7_days":"Últimos 7 Dias","last_30_days":"Últimos 30 Dias","all_time":"Todo Tempo","7_days_ago":"7 Dias Atrás","30_days_ago":"30 Dias Atrás","all":"Tudo","view_table":"tabela","view_graph":"gráfico","refresh_report":"Atualizar Relatório","start_date":"Data de Início","end_date":"Data do Final","groups":"Todos os grupos"}},"commits":{"latest_changes":"Últimas atualizações: atualize com frequência!","by":"por"},"flags":{"title":"Sinalizações","old":"Antigo","active":"Ativo","agree":"Concordo","agree_title":"Confirmar esta marcação como válida e correta","agree_flag_modal_title":"Concordar e...","agree_flag_hide_post":"Aceitar (esconder post + enviar MP)","agree_flag_hide_post_title":"Esconder este post e enviar automaticamente uma mensagem particular para o usuário solicitando que ele edite este post urgentemente","agree_flag_restore_post":"Concordar (restaurar post)","agree_flag_restore_post_title":"Restaurar este post","agree_flag":"Concordar com a marcação","agree_flag_title":"Concordar com a marcação e manter o post inalterado","defer_flag":"Delegar","defer_flag_title":"Remover esta marcação; ela não requer nenhuma ação neste momento.","delete":"Apagar","delete_title":"Apagar o post ao qual a marcação se refere.","delete_post_defer_flag":"Apagar o post e postergar a marcação","delete_post_defer_flag_title":"Apaga a resposta; se for a primeira, apagar o tópico","delete_post_agree_flag":"Deletar o post e Concordar com a marcação","delete_post_agree_flag_title":"Apagar resposta; se for a primeira, deletar o tópico","delete_flag_modal_title":"Apagar e ...","delete_spammer":"Deletar Spammer","delete_spammer_title":"Remover o usuário e todas as suas respostas e tópicos.","disagree_flag_unhide_post":"Discordar (reexibir resposta)","disagree_flag_unhide_post_title":"Remover qualquer denúncia dessa resposta e fazer ela visível de novo","disagree_flag":"Discordar","disagree_flag_title":"Negar a marcação como inválida ou incorreta","clear_topic_flags":"Concluído","clear_topic_flags_title":"O tópico foi investigado e as questões foram resolvidas. Clique em Concluído para remover as sinalizações.","more":"(mais respostas...)","dispositions":{"agreed":"concordar","disagreed":"discordar","deferred":"deferida"},"flagged_by":"Sinalizado por","resolved_by":"Resolvido por","took_action":"Tomar ação","system":"Sistema","error":"Algo deu errado","reply_message":"Responder","no_results":"Não há sinalizações.","topic_flagged":"Este \u003cstrong\u003etópico\u003c/strong\u003e foi sinalizado.","visit_topic":"Visitar o tópico para tomar ações","was_edited":"Resposta foi editada após uma primeira sinalização","previous_flags_count":"Este post já foi marcado {{count}} vezes.","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"inapropriado","other":"inapropriado x{{count}}"},"action_type_6":{"one":"customizado","other":"customizados x{{count}}"},"action_type_7":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Grupo Primário","no_primary":"(sem grupo primário)","title":"Grupos","edit":"Editar Grupos","refresh":"Atualizar","new":"Novo","selector_placeholder":"digite o nome de usuário","name_placeholder":"Nome do grupo, sem espaços, regras iguais ao nome de usuário","about":"Editar participação no grupo e nomes aqui","group_members":"Membros do grupo","delete":"Apagar","delete_confirm":"Apagar este grupos?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed.","delete_member_confirm":"Remover '%{username}' do grupo '%{group}'?","delete_owner_confirm":"Remover privilégio de proprietário de '%{username}'?","name":"Nome","add":"Adicionar","add_members":"Adicionar membros","custom":"Definidos","bulk_complete":"Os usuários foram adicionados ao grupo.","bulk":"Adição em Massa ao Grupo","bulk_paste":"Cole uma lista de usernames ou emails, um por linha:","bulk_select":"(selecione um grupo)","automatic":"Automático","automatic_membership_email_domains":"Usuários que se registram com um domínio de email que confere precisamente com algum desta lista serão automaticamente adicionados a este grupo:","automatic_membership_retroactive":"Aplicar a mesma regra de domínio de email para adicionar usuários registrados","default_title":"Título padrão para todos usuários nesse grupo","primary_group":"Configurar automaticamente como grupo primário","group_owners":"Prorietários","add_owners":"Adicionar proprietários","incoming_email":"Endereço de email de entrada personalizado","incoming_email_placeholder":"Insira um endereço de email"},"api":{"generate_master":"Gerar chave Mestra de API","none":"Não existem chaves API ativas no momento.","user":"Usuário","title":"API","key":"Chave API","generate":"Gerar","regenerate":"Regenerar","revoke":"Revogar","confirm_regen":"Tem a certeza que quer substituir esta chave API por uma nova?","confirm_revoke":"Tem a certeza que quer revogar essa chave?","info_html":"Sua chave de API permitirá a criação e edição de tópicos usando requests JSON.","all_users":"Todos os Usuários","note_html":"Guarde esta chave \u003cstrong\u003esecretamente\u003c/strong\u003e, todos usuários que tiverem acesso a ela poderão criar posts arbritários no forum como qualquer usuário."},"plugins":{"title":"Plugins","installed":"Plugins Instalados","name":"Nome","none_installed":"Você não tem quaisquer plugins instalados.","version":"Versão","enabled":"Habilitado?","is_enabled":"S","not_enabled":"N","change_settings":"Alterar Configurações","change_settings_short":"Configurações","howto":"Como eu instalo plugins?"},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Registros"},"none":"Nenhum backup disponível.","read_only":{"enable":{"title":"Ativar o modo somente-leitura","label":"Ativar somente leitura","confirm":"Tem certeza que quer habilitar modo somente leitura?"},"disable":{"title":"Desativar o modo somente-leitura","label":"Desativar somente leitura"}},"logs":{"none":"Nenhum registro ainda..."},"columns":{"filename":"Nome do arquivo","size":"Tamanho"},"upload":{"label":"Enviar","title":"Carregar um backup para esta instância","uploading":"Subindo...","success":"'{{filename}}' foi carregado com sucesso.","error":"Houve um erro ao carregar '{{filename}}': {{message}}"},"operations":{"is_running":"Uma operação está sendo executada...","failed":"A {{operação}} falhou. Por favor, cheque os registros.","cancel":{"label":"Cancelar","title":"Cancelar a operação atual","confirm":"Tem certeza de que deseja cancelar a operação atual?"},"backup":{"label":"Backup","title":"Cria um backup","confirm":"Você quer iniciar um novo backup?","without_uploads":"Sim (não inclua arquivos)"},"download":{"label":"Download","title":"Download do backup"},"destroy":{"title":"Remove o backup","confirm":"Tem certeza de que quer destruir este backup?"},"restore":{"is_disabled":"Restaurar está desativado nas configurações do site.","label":"Restaurar","title":"Restaurar o backup","confirm":"Tem certeza de que deseja restaurar este backup?"},"rollback":{"label":"Reverter","title":"Reverter o banco de dados para seu estado anterior","confirm":"Tem certeza que deseja reverter o banco de dados para seu estado anterior?"}}},"export_csv":{"user_archive_confirm":"Tem certeza que você quer baixar os seus tópicos?","success":"Exportação iniciada, você será notificado por mensagem particular quando o processo estiver completo.","failed":"Falha na exportação. Por favor verifique os logs.","rate_limit_error":"O download de posts pode ser feito apenas uma vez por dia, por favor, tente novamente amanhã.","button_text":"Exportar","button_title":{"user":"Exportar lista de usuários completa em formato CSV.","staff_action":"Exportar log completo de atividades da staff em formato CSV.","screened_email":"Exportar lista completa de emails filtrados em formato CSV.","screened_ip":"Exportar lista completa de IPs filtrados em formato CSV.","screened_url":"Exportar lista completa de URLs filtradas em formato CSV."}},"export_json":{"button_text":"Exportar"},"invite":{"button_text":"Enviar Convites","button_title":"Enviar Convites"},"customize":{"title":"Personalizar","long_title":"Personalizações do Site","css":"CSS","header":"Cabeçalho","top":"Superior","footer":"Rodapé","embedded_css":"CSS Incorporada","head_tag":{"text":"\u003c/head\u003e","title":"HTML que será inserido antes da tag \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML que será inserido antes da tag \u003c/body\u003e"},"override_default":"Sobrepor padrão?","enabled":"Habilitado?","preview":"pré-visualização","undo_preview":"remover preview","rescue_preview":"estilo padrão","explain_preview":"Ver o site com o estilo personalizado","explain_undo_preview":"Voltar para o estilo personalizado atual","explain_rescue_preview":"Ver o site com o estilo padrão","save":"Guardar","new":"Novo","new_style":"Novo Estilo","import":"Importar","import_title":"Selecione um arquivo ou cole texto","delete":"Apagar","delete_confirm":"Apagar esta personalização?","about":"Modificar o CSS e HTML do cabeçalho do site. Adicione uma customização para começar.","color":"Cor","opacity":"Opacidade","copy":"Copiar","email_templates":{"title":"Modelos de E-mail","subject":"Assunto","multiple_subjects":"Este modelo de email tem vários assuntos.","body":"Corpo","none_selected":"Selecione um modelo de e-mail para iniciar a edição.","revert":"Reverter Alterações","revert_confirm":"Tem certeza de que deseja reverter as alterações?"},"css_html":{"title":"CSS/HTML","long_title":"Customizações CSS e HTML"},"colors":{"title":"Cores","long_title":"Esquema de Cores","about":"Modifique as cores usadas no site sem escrever CSS. Adicione um esquema para começar.","new_name":"Novo Esquema de Cor","copy_name_prefix":"Copiar de","delete_confirm":"Apagar esse esquema de cor?","undo":"desfazer","undo_title":"Desfazer suas mudanças para esta cor desde a última vez que foi salvo.","revert":"reverter","revert_title":"Apagar esta cor do projeto padrão de cores do Discourse.","primary":{"name":"primário","description":"Maioria dos textos, ícones e bordas."},"secondary":{"name":"secundário","description":"A cor de fundo principal e o texto de alguns botões."},"tertiary":{"name":"terciário","description":"Links, alguns botões, notificações e cor realçada."},"quaternary":{"name":"quaternário","description":"Links de navegação."},"header_background":{"name":"fundo do cabeçalho","description":"Cor de fundo do cabeçalho do site."},"header_primary":{"name":"cabeçalho: primário","description":"Texto e ícones no cabeçalho do site."},"highlight":{"name":"destaque","description":"A cor de fundo dos elementos em destaque na página, como mensagens e tópicos."},"danger":{"name":"perigo","description":"Cor de destaque para ações como remover mensagens e tópicos."},"success":{"name":"sucesso","description":"Usado para indicar que a ação foi bem sucedida."},"love":{"name":"curtir","description":"A cor do botão curtir."}}},"email":{"title":"Emails","settings":"Settings","templates":"Modelos","preview_digest":"Preview Digest","sending_test":"Enviando e-mail de teste...","error":"\u003cb\u003eERRO\u003c/b\u003e - %{server_error}","test_error":"Houve um problema ao enviar o email de teste. Por favor, verifique as configurações de email, se o seu provedor não está bloqueando conexões de email e tente novamente.","sent":"Enviados","skipped":"Ignorados","bounced":"Devolvido","received":"Recebido","rejected":"Rejeitado","sent_at":"Enviado para ","time":"Hora","user":"Usuário","email_type":"Tipo de Email","to_address":"Para (endereço)","test_email_address":"endereço de email para testar","send_test":"Enviar email de teste","sent_test":"enviado!","delivery_method":"Delivery Method","preview_digest_desc":"Pré-visualizar o conteúdo do e-mail de resumo enviado para usuários inativos.","refresh":"Atualizar","format":"Formato","html":"html","text":"texto","last_seen_user":"Último Usuário Visto:","reply_key":"Chave de Resposta","skipped_reason":"Ignorar Motivo","incoming_emails":{"from_address":"De","to_addresses":"Para","cc_addresses":"Cc","subject":"Assunto","error":"Erro","none":"Nenhum email recebido.","modal":{"title":"Detalhes dos Emails Recebidos","error":"Erro","headers":"Cabeçalhos","subject":"Assunto","body":"Corpo","rejection_message":"Email de Rejeição"},"filters":{"from_placeholder":"de@exemplo.com","to_placeholder":"para@exemplo.com","cc_placeholder":"cc@exemplo.com","subject_placeholder":"Assunto...","error_placeholder":"Erro"}},"logs":{"none":"Nenhum registro encontrado.","filters":{"title":"Filtro","user_placeholder":"Nome de usuário","address_placeholder":"nome@exemplo.com","type_placeholder":"resenha, cadastro...","reply_key_placeholder":"tecla de resposta","skipped_reason_placeholder":"motivo"}}},"logs":{"title":"Logs","action":"Ação","created_at":"Criado","last_match_at":"Última Correspondência","match_count":"Resultados","ip_address":"IP","topic_id":"ID do Tópico","post_id":"ID Mensagem","category_id":"ID da Categoria","delete":"Excluir","edit":"Editar","save":"Salvar","screened_actions":{"block":"bloquear","do_nothing":"não fazer nada"},"staff_actions":{"title":"Ações do Staff","instructions":"Clique nos nomes de usuário e ações para filtrar a lista. Clique nas imagens de perfil para ir para as páginas de usuário.","clear_filters":"Mostrar Tudo","staff_user":"Usuário do Staff","target_user":"Usuário Destino","subject":"Assunto","when":"Quando","context":"Contexto","details":"Detalhes","previous_value":"Anterior","new_value":"Nova","diff":"Diferenças","show":"Exibir","modal_title":"Detalhes","no_previous":"Não há valor anterior.","deleted":"Não há valor novo. O registro foi removido.","actions":{"delete_user":"removeu usuário","change_trust_level":"modificou nível de confiança","change_username":"mudar nome de usuário","change_site_setting":"alterar configurações do site","change_site_customization":"alterar personalização do site","delete_site_customization":"remover personalização do site","change_site_text":"alterar texto do site","suspend_user":"suspender usuário","unsuspend_user":"readmitir usuário","grant_badge":"conceder emblema","revoke_badge":"revogar emblema","check_email":"checar email","delete_topic":"apagar tópico","delete_post":"apagar mensagem","impersonate":"personificar","anonymize_user":"tornar usuário anônimo","roll_up":"Agrupar bloco de IP","change_category_settings":"mudas configurações da categoria","delete_category":"apagar a categoria","create_category":"criar uma categoria","block_user":"bloquear usuário","unblock_user":"desbloquear usuário","grant_admin":"conceder admin","revoke_admin":"revogar admin","grant_moderation":"conceder moderação","revoke_moderation":"revogar moderação","backup_operation":"operação de backup","deleted_tag":"etiqueta removida","renamed_tag":"etiqueta renomeada","revoke_email":"revogar email"}},"screened_emails":{"title":"Emails Filtrados","description":"Quando alguém tenta cria uma nova conta, os seguintes endereços de email serão verificados e o registro será bloqueado, ou outra ação será executada.","email":"Endereço de Email","actions":{"allow":"Permitido"}},"screened_urls":{"title":"URLs Filtradas","description":"As URLs listadas aqui foram usadas em mensagens de usuários que foram identificados como spammers.","url":"URL","domain":"Domínio"},"screened_ips":{"title":"IPs Filtrados","description":"Endereços IP que estão sendo observados. Use \"Permitir\" para confiar em endereços IP.","delete_confirm":"Tem certeza que deseja remover a regra para %{ip_address}?","roll_up_confirm":"Tem certeza que deseja combinar endereços IP filtrados comuns em subnets?","rolled_up_some_subnets":"Entradas de IP banidos combinadas nestas subnets: %{subnets}.","rolled_up_no_subnet":"Não havia nada a combinar.","actions":{"block":"Bloquear","do_nothing":"Permitido","allow_admin":"Permitir Admin"},"form":{"label":"Novo:","ip_address":"Endereço IP","add":"Adicionar","filter":"Pesquisar"},"roll_up":{"text":"Combinar","title":"Cria novas entradas de banimento por subnet caso existam no mínimo 'min_ban_entries_for_roll_up' entradas."}},"logster":{"title":"Registro de erros"}},"impersonate":{"title":"Personificar","help":"Utilize esta ferramenta para personificar uma conta de usuário para efeitos de depuração. Você terá que sair dela assim que terminar.","not_found":"Esse usuário não pode ser encontrado.","invalid":"Desculpe, não é possível personificar esse usuário."},"users":{"title":"Usuários","create":"Adicionar Usuário Admin","last_emailed":"Último email enviado","not_found":"Desculpe, esse nome de usuário não existe no nosso sistema.","id_not_found":"Desculpe, esse nome de usuário não existe no nosso sistema.","active":"Ativo","show_emails":"Mostrar Emails","nav":{"new":"Novos","active":"Ativos","pending":"Pendentes","staff":"Equipe","suspended":"Suspenso","blocked":"Bloqueados","suspect":"Suspeito"},"approved":"Aprovado?","approved_selected":{"one":"aprovar usuário","other":"aprovar usuários ({{count}})"},"reject_selected":{"one":"rejeitar usuário","other":"rejeitar usuários ({{count}})"},"titles":{"active":"Usuários Ativos","new":"Usuários Novos","pending":"Usuários com Confirmação Pendente","newuser":"Usuários no Nível de Confiança 0 (Usuário Novo)","basic":"Usuários no Nível de Confiança 1 (Usuário Básico)","member":"Usuário em Nível de Confiança 2 (Membro)","regular":"Usuário em Nível de Confiança 3 (Habitual)","leader":"Usuário em Nível de Confiança 4 (Líder)","staff":"Equipe de apoio","admins":"Usuários Administradores","moderators":"Moderadores","blocked":"Usuários Boqueados","suspended":"Usuários Suspensos","suspect":"Usuários suspeitos"},"reject_successful":{"one":"1 usuário foi rejeitado com sucesso.","other":"%{count} usuários foram rejeitados com sucesso."},"reject_failures":{"one":"Falha ao rejeitar 1 usuário.","other":"Falha ao rejeitar %{count} usuários."},"not_verified":"Não verificado","check_email":{"title":"Mostrar endereço de email deste usuário","text":"Mostrar"}},"user":{"suspend_failed":"Algo deu errado suspendendo este usuário {{error}}","unsuspend_failed":"Algo deu errado reativando este usuário {{error}}","suspend_duration":"Por quanto tempo o usuário deverá ser suspenso?","suspend_duration_units":"(dias)","suspend_reason_label":"Por que você está suspendendo? Esse texto \u003cb\u003eserá visível para todos\u003c/b\u003e na página de perfil desse usuário, e será mostrado ao usuário quando ele tentar se logar. Seja breve.","suspend_reason":"Motivo","suspended_by":"Suspenso por","delete_all_posts":"Apagar todas mensagens","suspend":"Suspender","unsuspend":"Readmitir","suspended":"Suspenso?","moderator":"Moderador?","admin":"Admin?","blocked":"Bloqueado?","staged":"Testado?","show_admin_profile":"Admin","edit_title":"Editar Título","save_title":"Salvar Título","refresh_browsers":"Forçar atualização da página no browser","refresh_browsers_message":"Mensagem enviada para todos os clientes!","show_public_profile":"Mostrar Perfil Público","impersonate":"Personificar","ip_lookup":"Pesquisa do IP","log_out":"Log Out","logged_out":"Usuário foi desconectado em todos os dipositivos","revoke_admin":"Revogar Admin","grant_admin":"Conceder Admin","revoke_moderation":"Revogar Moderação","grant_moderation":"Conceder Moderação","unblock":"Desbloquear","block":"Bloquear","reputation":"Reputação","permissions":"Permissões","activity":"Atividade","like_count":"Curtidas dados / recebidos","last_100_days":"nos últimos 100 dias","private_topics_count":"Tópicos Privados","posts_read_count":"Mensagens lidas","post_count":"Mensagens criadas","topics_entered":"Tópicos Vistos","flags_given_count":"Sinalizações dadas","flags_received_count":"Sinalizações recebidas","warnings_received_count":"Avisos Recebidos","flags_given_received_count":"Sinalizações dados / recebidos","approve":"Aprovar","approved_by":"aprovado por","approve_success":"Usuário aprovado e email enviado com instruções de ativação.","approve_bulk_success":"Sucesso! Todos os usuários selecionados foram aprovados e notificados.","time_read":"Tempo de leitura","anonymize":"Tornar usuário anônimo","anonymize_confirm":"Você TEM CERTEZA que gostaria de tornar esta conta anônima? Esta mudança irá alterar o nome de usuário e email, e resetar todas informações do perfil.","anonymize_yes":"Sim, tornar esta conta anônima","anonymize_failed":"Ocorreu um problema ao tornar a conta anônima.","delete":"Apagar Usuário","delete_forbidden_because_staff":"Administradores e moderadores não podem ser excluidos.","delete_posts_forbidden_because_staff":"Não posso deletar todas as mensagens de administradores e moderadores.","delete_forbidden":{"one":"Usuários não podem ser excluídos se eles têm mensagens. Excluir todas as mensagens antes de tentar excluir um usuário. (Mensagens mais antigas que %{count} dia não podem ser excluídas.)","other":"Usuários não podem ser excluídos se eles têm mensagens. Remova todas as mensagens antes de tentar excluir um usuário. (Mensagens mais antigas que %{count} dias não podem ser excluídas.)"},"cant_delete_all_posts":{"one":"Não é possível excluir todas as mensagens. Algumas mensagens são mais antigas do que %{count} dia. (Configuração delete_user_max_post_age.)","other":"Não é possível remover todas as mensagens. Algumas mensagens são mais antigas do que %{count} dias. (Configuração delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Não pode remover porque o usuário tem mais de uma mensagem (delete_all_posts_max)","other":"Não pode remover porque o usuário tem mais de %{count} mensagens. (delete_all_posts_max)"},"delete_confirm":"Você tem CERTEZA de que quer deletar este usuário? Isto é permanente!","delete_and_block":"Deletar e \u003cb\u003ebloquear\u003c/b\u003e este email e endereço IP","delete_dont_block":"Apagar apenas","deleted":"O usuário foi apagado.","delete_failed":"Houve um erro ao apagar o usuário. Certifique-se de que todas mensagens dele foram apagadas antes de tentar apagá-lo.","send_activation_email":"Enviar Email de Ativação","activation_email_sent":"Um email de ativação foi enviado.","send_activation_email_failed":"Houve um problema ao enviar um novo email de ativação. %{error}","activate":"Ativar Conta","activate_failed":"Houve um problema ao tornar o usuário ativo.","deactivate_account":"Desativar Conta","deactivate_failed":"Houve um problema ao desativar o usuário.","unblock_failed":"Houve um problema ao desbloquear o usuário.","block_failed":"Houve um problema ao bloquear o usuário.","block_confirm":"Você tem certeza que quer bloquear este usuário? Ele não vai poder criar nenhum tópico ou postagem nova.","block_accept":"Sim, bloquear este usuário","bounce_score":"Pontuação de Devolução","reset_bounce_score":{"label":"Redefinir","title":"Redefinir pontuação de devolução para 0"},"deactivate_explanation":"Um usuário desativado deve revalidar seu email.","suspended_explanation":"Um usuário suspenso não pode entrar.","block_explanation":"Um usuário bloqueado não pode postar ou iniciar tópicos.","staged_explanation":"Um usuário de teste só pode postar por email em tópicos específicos.","bounce_score_explanation":{"none":"Nenhuma devolução foi recebida recentemente daquele email.","some":"Algumas devoluções foram recebidas recentemente daquele email.","threshold_reached":"Muitas devoluções daquele email foram recebidas."},"trust_level_change_failed":"Houve um problema ao trocar o nível de confiança do usuário.","suspend_modal_title":"Usuário Suspenso","trust_level_2_users":"Usuários de Nível de Confiança 2","trust_level_3_requirements":"Requisitos do Nível de Confiança 3","trust_level_locked_tip":"nível de confiança está travado, sistema não irá promover ou demover o usuário","trust_level_unlocked_tip":"nível de confiança está destravado, sistema poderá promover ou demover o usuário","lock_trust_level":"Travar Nível de Confiança","unlock_trust_level":"Destravar Nível de Confiança","tl3_requirements":{"title":"Requisitos para o Nível de Confiança 3","value_heading":"Valor","requirement_heading":"Requisito","visits":"Visitas","days":"dias","topics_replied_to":"Tópicos Respondidos","topics_viewed":"Tópicos Visualizados","topics_viewed_all_time":"Tópicos vistos (todos os tempos)","posts_read":"Posts Lidos","posts_read_all_time":"Posts Lidos (todo o período)","flagged_posts":"Mensagens Sinalizadas","flagged_by_users":"Usuários que foram denunciados","likes_given":"Curtidas dados","likes_received":"Curtidas recebidos","likes_received_days":"Curtidas recebidas: dias únicos","likes_received_users":"Curtidas recebidas: usuários únicos","qualifies":"Qualificado para o nível 3 de confiança.","does_not_qualify":"Não qualificado para o nível 3 de confiança.","will_be_promoted":"Será promovido em breve.","will_be_demoted":"Será demovido em breve.","on_grace_period":"Atualmente em período de aprovação da promoção, não será demovido.","locked_will_not_be_promoted":"Nível de confiança travado. Nunca será promovido.","locked_will_not_be_demoted":"Nível de confiança travado. Nunca será demovido."},"sso":{"title":"Único Login","external_id":"ID Externo","external_username":"Usuário","external_name":"Nome","external_email":"Email","external_avatar_url":"URL da Imagem de Perfil"}},"user_fields":{"title":"Campos de Usuários","help":"Adicionar campos que seus usuários podem preencher.","create":"Criar Campo de Usuário","untitled":"Sem título","name":"Nome do Campo","type":"Tipo do Campo","description":"Descrição do Campo","save":"Salvar","edit":"Editar","delete":"Apagar","cancel":"Cancelar","delete_confirm":"Tem certeza que quer apagar este campo de usuário?","options":"Opções","required":{"title":"Necessário para cadastro?","enabled":"necessário","disabled":"não necessário"},"editable":{"title":"Editável após criar conta?","enabled":"editável","disabled":"não editável"},"show_on_profile":{"title":"Mostrar no perfil público?","enabled":"mostrado no perfil","disabled":"não mostrado no perfil"},"show_on_user_card":{"title":"Exibir no cartão de usuário?","enabled":"exibir no cartão de usuário","disabled":"não exibido no cartão de usuário"},"field_types":{"text":"Campo Texto","confirm":"Confirmação","dropdown":"Caixa de seleção"}},"site_text":{"description":"Você pode personalizar qualquer parte do texto em seu fórum. Por favor, comece pesquisando abaixo:","search":"Procure peloo texto que você gostaria de editar","title":"Conteúdo do Texto","edit":"editar","revert":"Reverter alterações","revert_confirm":"Tem certeza que deseja reverter as alterações?","go_back":"Voltar para pesquisa","recommended":"Recomendamos a personalização do seguinte texto para se adequar as suas necessidades:","show_overriden":"Apenas mostrar valores alterados"},"site_settings":{"show_overriden":"Exibir apenas valores alterados","title":"Configurações","reset":"apagar","none":"nenhum","no_results":"Nenhum resultado encontrado.","clear_filter":"Limpar","add_url":"adicionar URL","add_host":"adicionar host","categories":{"all_results":"Todas","required":"Requerido","basic":"Configuração Básica","users":"Usuários","posting":"Publicando","email":"E-mail","files":"Arquivos","trust":"Níveis de Confiança","security":"Segurança","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Taxa de Limites","developer":"Desenvolvedor","embedding":"Incorporação","legal":"Jurídico","uncategorized":"Outros","backups":"Backups","login":"Entrar","plugins":"Plugins","user_preferences":"Preferências de Usuário","tags":"Marcações"}},"badges":{"title":"Emblemas","new_badge":"Novo Emblema","new":"Novo","name":"Nome","badge":"Emblema","display_name":"Nome de Exibição","description":"Descrição","long_description":"Descrição Longa","badge_type":"Tipo de Emblema","badge_grouping":"Grupo","badge_groupings":{"modal_title":"Agrupamentos de emblemas"},"granted_by":"Concedido Por","granted_at":"Concedido Em","reason_help":"(Um link para uma mensagem ou tópico)","save":"Salvar","delete":"Remover","delete_confirm":"Tem certeza de que deseja remover este emblema?","revoke":"Revogar","reason":"Motivo","expand":"Expandir \u0026hellip;","revoke_confirm":"Tem certeza de que deseja revogar este emblema?","edit_badges":"Editar Emblemas","grant_badge":"Conceder Emblema","granted_badges":"Emblemas Concedidos","grant":"Conceder","no_user_badges":"%{name} não teve nenhum emblema concedido.","no_badges":"Não há emblemas que possam ser concedidos.","none_selected":"Selecione um emblema para começar","allow_title":"Permitir que o emblema seja usado como título","multiple_grant":"Pode ser concedido várias vezes","listable":"Mostrar emblema na página pública de emblemas","enabled":"Habilitar emblema","icon":"Ícone","image":"Imagem","icon_help":"Use uma classe do Font Awesome ou uma URL de uma imagem","query":"Badge Query (SQL)","target_posts":"Consultar respostas selecionadas","auto_revoke":"Rodar revocation query todo dia","show_posts":"Mostrar as concessões de emblemas na página de emblemas","trigger":"Trigger","trigger_type":{"none":"Atualizado diariamente","post_action":"Quando um usuário age em uma resposta","post_revision":"Quando um usuário edita ou cria uma resposta","trust_level_change":"Quando um usuário muda seu nível de confiança","user_change":"Quando um usuário é editado ou criado","post_processed":"Após o processamento da mensagem"},"preview":{"link_text":"Pré-visualizar emblemas concedidos","plan_text":"Prever com plano de busca","modal_title":"Preview da Busca de Medalhas","sql_error_header":"Houve um erro com a busca.","error_help":"Veja os seguintes links para ajuda com consulta de emblemas.","bad_count_warning":{"header":"CUIDADO!","text":"Faltam amostras de concessão. Isso acontece quando a consulta de emblemas retorna IDs de usuários ou IDs de postagens que não existem. Isso pode causar resultados inesperados futuramente - por favor verifique novamente a sua consulta."},"no_grant_count":"Sem emblemas para serem atribuídos.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e emblema para ser atribuído.","other":"\u003cb\u003e%{count}\u003c/b\u003e emblemas para serem atribuídos."},"sample":"Exemplo:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e por postar em %{link} às \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e às \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Adicionar novo emoji que estará disponível para todos. (DICA: arraste \u0026 solte diversos arquivos de uma vez)","add":"Adicionar Novo Emoji","name":"Nome","image":"Imagem","delete_confirm":"Tem certeza que deseja excluir o emoji :%{name}: ?"},"embedding":{"get_started":"Se você deseja incorporar Discourse em outro site, começe adicionando seu host.","confirm_delete":"Você tem certeza que deseja apagar este host?","sample":"Use o seguinte código HTML no seu site para criar e incorporar tópicos do Discourse. Troque \u003cb\u003eREPLACE_ME\u003c/b\u003e com a URL canônica da página na qual você está incorporando.","title":"Incorporar","host":"Hosts Permitidos","edit":"editar","category":"Postar na Categoria","add_host":"Adicionar Host","settings":"Configurações de Incorporação","feed_settings":"Configurações de Feed","feed_description":"Prover um feed de RSS/ATOM de seu site pode melhorar a habilidade do Discourse para importar seu conteúdo.","crawling_settings":"Configurações de Crawler","crawling_description":"Quando Discourse cria tópicos para suas postagens, se nenhum feed RSS/ATOM estiver presente ele tentar recuperar o conteúdo do seu HTML. Algumas vezes isso pode sem um desafio, então provemos a habilidade de prover as regras específicas de CSS para fazer a extração mais fácil.","embed_by_username":"Nome de usuário para criação do tópico","embed_post_limit":"Número máximo de postagens para incorporar","embed_username_key_from_feed":"Chave para obter o nome de usuário no discourse do feed","embed_truncate":"Truncar as postagens incorporadas","embed_whitelist_selector":"Seletor de CSS para elementos que são permitidos na incorporação","embed_blacklist_selector":"Seletor de CSS para elementos que são removidos da incorporação","embed_classname_whitelist":"Nomes de classes CSS permitidas","feed_polling_enabled":"Importar postagens via RSS/ATOM","feed_polling_url":"URL do feed RSS/ATOM para pesquisar","save":"Salvar Configurações de Incorporação"},"permalink":{"title":"Links permanentes","url":"URL","topic_id":"ID do Tópico","topic_title":"Tópico","post_id":"ID da Mensagem","post_title":"Mensagem","category_id":"ID da Categoria","category_title":"Categoria","external_url":"URL externa","delete_confirm":"Você tem certeza que quer apagar esse link permanente?","form":{"label":"Novo:","add":"Adicionar","filter":"Busca (URL ou URL Externa)"}}}}},"en":{"js":{"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'pt_BR';
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
//! locale : brazilian portuguese (pt-br)
//! author : Caio Ribeiro Pereira : https://github.com/caio-ribeiro-pereira

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var pt_br = moment.defineLocale('pt-br', {
        months : 'Janeiro_Fevereiro_Março_Abril_Maio_Junho_Julho_Agosto_Setembro_Outubro_Novembro_Dezembro'.split('_'),
        monthsShort : 'Jan_Fev_Mar_Abr_Mai_Jun_Jul_Ago_Set_Out_Nov_Dez'.split('_'),
        weekdays : 'Domingo_Segunda-feira_Terça-feira_Quarta-feira_Quinta-feira_Sexta-feira_Sábado'.split('_'),
        weekdaysShort : 'Dom_Seg_Ter_Qua_Qui_Sex_Sáb'.split('_'),
        weekdaysMin : 'Dom_2ª_3ª_4ª_5ª_6ª_Sáb'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D [de] MMMM [de] YYYY',
            LLL : 'D [de] MMMM [de] YYYY [às] HH:mm',
            LLLL : 'dddd, D [de] MMMM [de] YYYY [às] HH:mm'
        },
        calendar : {
            sameDay: '[Hoje às] LT',
            nextDay: '[Amanhã às] LT',
            nextWeek: 'dddd [às] LT',
            lastDay: '[Ontem às] LT',
            lastWeek: function () {
                return (this.day() === 0 || this.day() === 6) ?
                    '[Último] dddd [às] LT' : // Saturday + Sunday
                    '[Última] dddd [às] LT'; // Monday - Friday
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'em %s',
            past : '%s atrás',
            s : 'poucos segundos',
            m : 'um minuto',
            mm : '%d minutos',
            h : 'uma hora',
            hh : '%d horas',
            d : 'um dia',
            dd : '%d dias',
            M : 'um mês',
            MM : '%d meses',
            y : 'um ano',
            yy : '%d anos'
        },
        ordinalParse: /\d{1,2}º/,
        ordinal : '%dº'
    });

    return pt_br;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D de MMMM de YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
