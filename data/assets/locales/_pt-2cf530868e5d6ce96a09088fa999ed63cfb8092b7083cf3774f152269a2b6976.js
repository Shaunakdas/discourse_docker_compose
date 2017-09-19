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
r += "Existe <a href='/unread'>1 não lido </a> ";
return r;
},
"other" : function(d){
var r = "";
r += "Existem <a href='/unread'>" + (function(){ var x = k_1 - off_0;
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
r += (pf_0[ MessageFormat.locale["pt"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "existe ";
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
r += "existem ";
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
r += (pf_0[ MessageFormat.locale["pt"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "pesquise outros tópicos em ";
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
}, "posts_likes_MF" : function(){ return "Invalid Format: Error: No 'other' form found in selectFormatPattern 0/nError: No 'other' form found in selectFormatPattern 0";}};

MessageFormat.locale.pt = function ( n ) {
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
I18n.translations = {"pt":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"hh:mm","timeline_date":"MMM YYYY","long_no_year":"DD MMM hh:mm","long_no_year_no_time":"DD MMM","full_no_year_no_time":"Do MMMM","long_with_year":"DD MMM YYYY hh:mm","long_with_year_no_time":"DD MMM YYYY","full_with_year_no_time":"Do MMMM, YYYY","long_date_with_year":"DD MMM, 'YY LT","long_date_without_year":"DD MMM, LT","long_date_with_year_without_time":"DD MMM, 'YY","long_date_without_year_with_linebreak":"DD MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"DD MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} atrás","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"DD MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuto","other":"%{count} minutos"},"x_hours":{"one":"1 hora","other":"%{count} horas"},"x_days":{"one":"1 dia","other":"%{count} dias"},"date_year":"DD MMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 minuto atrás","other":"%{count} minutos atrás"},"x_hours":{"one":"1 hora atrás","other":"%{count} horas atrás"},"x_days":{"one":"1 dia atrás","other":"%{count} dias atrás"}},"later":{"x_days":{"one":"1 dia mais tarde","other":"%{count} dias mais tarde"},"x_months":{"one":"1 mês mais tarde","other":"%{count} meses mais tarde"},"x_years":{"one":"1 ano mais tarde","other":"%{count} anos mais tarde"}},"previous_month":"Mês Anterior","next_month":"Mês Seguinte"},"share":{"topic":"partilhar uma hiperligação para este tópico","post":"Mensagem #%{postNumber}","close":"fechar","twitter":"partilhar esta hiperligação no Twitter","facebook":"partilhar esta hiperligação no Facebook","google+":"partilhar esta hiperligação no Google+","email":"enviar esta hiperligação por email"},"action_codes":{"public_topic":"tornei este tópico publico %{when}","private_topic":"tornei este tópico privado %{when}","split_topic":"dividir este tópico %{when}","invited_user":"Convidou %{who} %{when}","invited_group":"convidou %{who} %{when}","removed_user":"Removeu %{who} %{when}","removed_group":"removeu %{who} %{when}","autoclosed":{"enabled":"fechado %{when}","disabled":"aberto %{when}"},"closed":{"enabled":"fechado %{when}","disabled":"aberto %{when}"},"archived":{"enabled":"arquivado %{when}","disabled":"removido do arquivo %{when}"},"pinned":{"enabled":"fixado %{when}","disabled":"desafixado %{when}"},"pinned_globally":{"enabled":"fixado globalmente %{when}","disabled":"desafixado %{when}"},"visible":{"enabled":"listado %{when}","disabled":"removido da lista %{when}"}},"topic_admin_menu":"Ações administrativas dos Tópicos","emails_are_disabled":"Todos os envios de e-mail foram globalmente desativados por um administrador. Nenhum e-mail de notificação será enviado.","bootstrap_mode_enabled":"Para facilitar o lançamento do seu novo sítio mais fácil, encontra-se agora em modo de inicialização. Qualquer utilizador novo terá nível de confiança 1 e resumos de email diários ligados. Este modo será automaticamente desligado quando o número total de utilizadores ultrapassar %{min_users}.","bootstrap_mode_disabled":"Modo de inicialização será desligado dentro das próximas 24 horas.","s3":{"regions":{"us_east_1":"Este dos E.U.A. (Virgínia do Norte)","us_west_1":"Oeste dos E.U.A. (California do Norte)","us_west_2":"Oeste dos E.U.A. (Óregon)","us_gov_west_1":"AWS GovCloud (E.U.A.)","eu_west_1":"U.E. (Irlanda)","eu_central_1":"U.E. (Francoforte)","ap_southeast_1":"Ásia-Pacífico (Singapura)","ap_southeast_2":"Ásia-Pacífico (Sydney)","ap_south_1":"Ásia Pacifico (Bombaim)","ap_northeast_1":"Ásia-Pacífico (Tóquio)","ap_northeast_2":"Ásia-Pacífico (Seoul)","sa_east_1":"América do Sul (São Paulo)","cn_north_1":"China (Beijing)"}},"edit":"editar o título e a categoria deste tópico","not_implemented":"Essa funcionalidade ainda não foi implementada, pedimos desculpa!","no_value":"Não","yes_value":"Sim","generic_error":"Pedimos desculpa, ocorreu um erro.","generic_error_with_reason":"Ocorreu um erro: %{error}","sign_up":"Inscrever-se","log_in":"Entrar","age":"Idade","joined":"Juntou-se","admin_title":"Administração","flags_title":"Sinalizações","show_more":"mostrar mais","show_help":"opções","links":"Hiperligações","links_lowercase":{"one":"hiperligação","other":"hiperligações"},"faq":"FAQ","guidelines":"Diretrizes","privacy_policy":"Política de Privacidade","privacy":"Privacidade","terms_of_service":"Termos de Serviço","mobile_view":"Visualização Mobile","desktop_view":"Visualização Desktop","you":"Você","or":"ou","now":"ainda agora","read_more":"ler mais","more":"Mais","less":"Menos","never":"nunca","every_30_minutes":"a cada 30 minutos","every_hour":"a cada hora","daily":"diário","weekly":"semanal","every_two_weeks":"a cada duas semanas","every_three_days":"a cada três dias","max_of_count":"máximo de {{count}}","alternation":"ou","character_count":{"one":"{{count}} caracter","other":"{{count}} caracteres"},"suggested_topics":{"title":"Tópicos Sugeridos","pm_title":"Mensagens Sugeridas"},"about":{"simple_title":"Acerca","title":"Acerca de %{title}","stats":"Estatísticas do sítio","our_admins":"Os Nossos Administradores","our_moderators":"Os Nossos Moderadores","stat":{"all_time":"Sempre","last_7_days":"Últimos 7 Dias","last_30_days":"Últimos 30 Dias"},"like_count":"Gostos","topic_count":"Tópicos","post_count":"Mensagens","user_count":"Novos Utilizadores","active_user_count":"Utilizadores Activos","contact":"Contacte-nos","contact_info":"No caso de um problema crítico ou de algum assunto urgente que afecte este sítio, por favor contacte-nos em %{contact_info}."},"bookmarked":{"title":"Adicionar Marcador","clear_bookmarks":"Remover Marcadores","help":{"bookmark":"Clique para adicionar um marcador à primeira mensagem deste tópico","unbookmark":"Clique para remover todos os marcadores deste tópico"}},"bookmarks":{"not_logged_in":"Pedimos desculpa, é necessário ter sessão iniciada para marcar mensagens","created":"adicionou esta mensagem aos marcadores","not_bookmarked":"leu esta mensagem; clique para adicioná-la aos marcadores","last_read":"esta foi a última mensagem que leu; clique para adicioná-la aos marcadores","remove":"Remover Marcador","confirm_clear":"Tem a certeza que pretende eliminar todos os marcadores deste tópico?"},"topic_count_latest":{"one":"{{count}} tópico novo ou atualizado.","other":"{{count}} tópicos novos ou atualizados."},"topic_count_unread":{"one":"{{count}} tópico não lido.","other":"{{count}} tópicos não lidos."},"topic_count_new":{"one":"{{count}} novo tópico.","other":"{{count}} novos tópicos."},"click_to_show":"Clique para mostrar.","preview":"pré-visualizar","cancel":"cancelar","save":"Guardar alterações","saving":"A guardar...","saved":"Guardado!","upload":"Carregar","uploading":"A carregar…","uploading_filename":"A carregar {{filename}}...","uploaded":"Carregado!","enable":"Ativar ","disable":"Desativar","undo":"Desfazer","revert":"Reverter","failed":"Falhou","switch_to_anon":"Entrar em modo Anónimo","switch_from_anon":"Sair de modo Anónimo","banner":{"close":"Destituir esta faixa.","edit":"Editar esta faixa \u003e\u003e"},"choose_topic":{"none_found":"Nenhum tópico encontrado.","title":{"search":"Procurar Tópico por nome, URL ou id:","placeholder":"digite o título do tópico aqui"}},"queue":{"topic":"Tópico:","approve":"Aprovar","reject":"Rejeitar","delete_user":"Eliminar Utilizador","title":"Necessita de Aprovação","none":"Não há mensagens para rever.","edit":"Editar","cancel":"Cancelar","view_pending":"ver mensagens pendentes","has_pending_posts":{"one":"Este tópico tem \u003cb\u003e1\u003c/b\u003e mensagem à espera de aprovação","other":"Este tópico tem \u003cb\u003e{{count}}\u003c/b\u003e mensagens à espera de aprovação"},"confirm":"Guardar Alterações","delete_prompt":"Tem a certeza que deseja eliminar \u003cb\u003e%{username}\u003c/b\u003e? Isto irá remover todas as suas mensagens e bloquear os seus emails e endereços ip.","approval":{"title":"A Mensagem Necessita de Aprovação","description":"Recebemos a sua nova mensagem mas necessita de ser aprovada pelo moderador antes de aparecer. Por favor seja paciente.","pending_posts":{"one":"Tem \u003cstrong\u003e1\u003c/strong\u003e mensagem pendente.","other":"Tem \u003cstrong\u003e{{count}}\u003c/strong\u003e mensagens pendentes."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e publicou \u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003e\u003c/a\u003e publicou\u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003e\u003c/a\u003e respondeu a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e\u003ca href='{{user2Url}}'\u003e mencionou-o\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003e\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Publicado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Publicado por \u003ca href='{{userUrl}}'\u003esi\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003esi\u003c/a\u003e"},"directory":{"filter_name":"filtrar por nome de utilizador","title":"Utilizadores","likes_given":"Dado","likes_received":"Recebido","topics_entered":"Visto","topics_entered_long":"Tópicos Visualizados","time_read":"Tempo Lido","topic_count":"Tópicos","topic_count_long":"Tópicos Criados","post_count":"Respostas","post_count_long":"Respostas Publicadas","no_results":"Não foram encontrados resultados.","days_visited":"Visitas","days_visited_long":"Dias Visitados","posts_read":"Ler","posts_read_long":"Mensagens Lidas","total_rows":{"one":"1 utilizador","other":"%{count} utilizadores"}},"groups":{"empty":{"posts":"Não há nenhuma publicação feita por membros deste grupo.","members":"Não há nenhum membro neste grupo.","mentions":"Não há nenhuma menção deste grupo.","messages":"Não há nenhuma mensagem para este grupo.","topics":"Não há nenhum tópico feito por membros deste grupo."},"add":"Adicionar","selector_placeholder":"Adicionar membros","owner":"proprietário","visible":"O grupo é visível para todos os utilizadores","index":"Grupos","title":{"one":"grupo","other":"grupos"},"members":"Membros","topics":"Tópicos","posts":"Mensagens","mentions":"Menções","messages":"Mensagens","alias_levels":{"title":"Quem pode mandar mensagens e @mencionar este grupo?","nobody":"Ninguém","only_admins":"Apenas administradores","mods_and_admins":"Apenas moderadores e Administradores","members_mods_and_admins":"Apenas membros do grupo, moderadores e administradores","everyone":"Todos"},"trust_levels":{"title":"Nível de confiança concedido automaticamente a membros quando são adicionados:","none":"Nenhum"},"notifications":{"watching":{"title":"A vigiar","description":"Será notificado de cada nova publicação em todas as mensagens, e uma contagem de novas respostas será exibida."},"watching_first_post":{"title":"A vigiar a primeira entrada","description":"Será apenas notificado acerca da primeira entrada em cada tópico deste grupo."},"tracking":{"title":"A Acompanhar","description":"Será notificado se alguém mencionar o seu @nome ou lhe responder, e uma contagem de novas respostas será exibida."},"regular":{"title":"Habitual","description":"Será notificado se alguém mencionar o seu @nome ou responder-lhe."},"muted":{"title":"Mudo","description":"Não será notificado de nada relacionado com novos tópicos neste grupo."}}},"user_action_groups":{"1":"Gostos Dados","2":"Gostos Recebidos","3":"Marcadores","4":"Tópicos","5":"Respostas","6":"Respostas","7":"Menções","9":"Citações","11":"Edições","12":"Itens Enviados","13":"Caixa de Entrada","14":"Pendente"},"categories":{"all":"todas as categorias","all_subcategories":"todas","no_subcategory":"nenhuma","category":"Categoria","category_list":"Exibir lista de categorias","reorder":{"title":"Re-organizar Categorias","title_long":"Re-organizar a lista de categorias","fix_order":"Fixar Posições","fix_order_tooltip":"Nem todas as categorias têm um número único de posição, o que pode causar resultados inesperados.","save":"Guardar Ordem","apply_all":"Aplicar","position":"Posição"},"posts":"Mensagens","topics":"Tópicos","latest":"Recentes","latest_by":"recentes por","toggle_ordering":"alternar o controlo de ordenação","subcategories":"Subcategorias","topic_stat_sentence":{"one":"%{count} novo tópico no passado %{unit}.","other":"%{count} novos tópicos no passado %{unit}."}},"ip_lookup":{"title":"Pesquisa de Endereço IP","hostname":"Nome do Servidor","location":"Localização","location_not_found":"(desconhecido)","organisation":"Organização","phone":"Telefone","other_accounts":"Outras contas com este endereço IP:","delete_other_accounts":"Apagar %{count}","username":"nome de utilizador","trust_level":"TL","read_time":"tempo de leitura","topics_entered":"tópicos inseridos","post_count":"# mensagens","confirm_delete_other_accounts":"Tem a certeza que quer apagar estas contas?"},"user_fields":{"none":"(selecione uma opção)"},"user":{"said":"{{username}}:","profile":"Perfil","mute":"Silenciar","edit":"Editar Preferências","download_archive":"Descarregar As Minhas Mensagens","new_private_message":"Nova Mensagem","private_message":"Mensagem","private_messages":"Mensagens","activity_stream":"Atividade","preferences":"Preferências","expand_profile":"Expandir","bookmarks":"Marcadores","bio":"Sobre mim","invited_by":"Convidado Por","trust_level":"Nível de Confiança","notifications":"Notificações","statistics":"Estatísticas","desktop_notifications":{"label":"Notificações de Desktop","not_supported":"Não são suportadas notificações neste navegador. Desculpe.","perm_default":"Ligar Notificações","perm_denied_btn":"Permissão Negada","perm_denied_expl":"Negou a permissão para as notificações. Autorize as notificações através das configurações do seu navegador.","disable":"Desativar Notificações","enable":"Ativar Notificações","each_browser_note":"Nota: Tem que alterar esta configuração em todos os navegadores de internet que utiliza."},"dismiss_notifications":"Dispensar tudo","dismiss_notifications_tooltip":"Marcar como lidas todas as notificações por ler","disable_jump_reply":"Não voltar para a minha mensagem após ter respondido","dynamic_favicon":"Mostrar contagem de tópicos novos / atualizados no ícone do browser.","external_links_in_new_tab":"Abrir todas as hiperligações externas num novo separador","enable_quoting":"Ativar resposta usando citação de texto destacado","change":"alterar","moderator":"{{user}} é um moderador","admin":"{{user}} é um administrador","moderator_tooltip":"Este utilizador é um moderador","admin_tooltip":"Este utilizador é um administrador","blocked_tooltip":"Este utilizador está bloqueado","suspended_notice":"Este utilizador está suspenso até {{date}}.","suspended_reason":"Motivo: ","github_profile":"Github","email_activity_summary":"Sumário de actividade","mailing_list_mode":{"label":"Modo de lista de distribuição","enabled":"Ativar modo de lista de distribuição","instructions":"Esta configuração sobrepõe o sumário de actividade.\u003cbr /\u003e\nTópicos e categorias mudos não são incluídos nestes correios electrónicos.\n","daily":"Enviar actualizações diárias","individual":"Enviar um correio electrónico por cada nova mensage"},"tag_settings":"Etiquetas","watched_tags":"Visto","tracked_tags":"Vigiado","muted_tags":"Silenciado","watched_categories":"Vigiado","tracked_categories":"Acompanhado","watched_first_post_categories":"A ver a primeira mensage","muted_categories":"Silenciado","muted_categories_instructions":"Não será notificado de nada acerca de novos tópicos nestas categorias, e estes não irão aparecer nos recentes.","delete_account":"Eliminar A Minha Conta","delete_account_confirm":"Tem a certeza que pretende eliminar a sua conta de forma permanente? Esta ação não pode ser desfeita!","deleted_yourself":"A sua conta foi eliminada com sucesso.","delete_yourself_not_allowed":"Neste momento não pode eliminar a sua conta. Contacte um administrador para que este elimine a sua conta por si.","unread_message_count":"Mensagens","admin_delete":"Apagar","users":"Utilizadores","muted_users":"Mudo","muted_users_instructions":"Suprimir todas as notificações destes utilizadores.","muted_topics_link":"Mostrar tópicos mudos","automatically_unpin_topics":"Desafixar tópicos automaticamente quando eu chegar ao final.","staff_counters":{"flags_given":"sinalizações úteis","flagged_posts":"mensagens sinalizadas","deleted_posts":"mensagens eliminadas","suspensions":"suspensões","warnings_received":"avisos"},"messages":{"all":"Todas","inbox":"Caixa de Entrada","sent":"Enviado","archive":"Arquivo","groups":"Os Meus Grupos","bulk_select":"Selecionar mensagens","move_to_inbox":"Mover para Caixa de Entrada","move_to_archive":"Arquivo","failed_to_move":"Falha ao mover as mensagens selecionadas (talvez a sua rede esteja em baixo)","select_all":"Selecionar Tudo"},"change_password":{"success":"(email enviado)","in_progress":"(a enviar email)","error":"(erro)","action":"Enviar email de recuperação de palavra-passe","set_password":"Definir Palavra-passe"},"change_about":{"title":"Modificar Sobre Mim","error":"Ocorreu um erro ao modificar este valor."},"change_username":{"title":"Alterar Nome de Utilizador","taken":"Pedimos desculpa, esse nome de utilizador já está a ser utilizado.","error":"Ocorreu um erro ao alterar o seu nome de utilizador.","invalid":"Esse nome de utilizador é inválido. Deve conter apenas números e letras."},"change_email":{"title":"Alterar Email","taken":"Pedimos desculpa, esse email não está disponível.","error":"Ocorreu um erro ao alterar o email. Talvez esse endereço já esteja a ser utilizado neste fórum?","success":"Enviámos um email para esse endereço. Por favor siga as instruções de confirmação."},"change_avatar":{"title":"Alterar a sua imagem de perfil","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baseado em","gravatar_title":"Mude o seu avatar no sítio Gravatar","refresh_gravatar_title":"Atualize o seu Gravatar","letter_based":"Imagem de perfil atribuída pelo sistema","uploaded_avatar":"Foto personalizada","uploaded_avatar_empty":"Adicionar foto personalizada","upload_title":"Carregar a sua foto","upload_picture":"Carregar Imagem","image_is_not_a_square":"Alerta: cortámos a sua imagem; o comprimento e a altura não eram iguais.","cache_notice":"Alterou a sua fotografia de perfil com sucesso mas poderá demorar algum tempo até esta aparecer devido à cache do navegador de internet."},"change_profile_background":{"title":"Fundo de Perfil","instructions":"O fundo do perfil será centrado e terá por defeito uma largura de 850px."},"change_card_background":{"title":"Fundo do cartão de utilizador","instructions":"As imagens de fundo serão centradas e terão por defeito uma largura de 590px."},"email":{"title":"Email","instructions":"Nunca mostrado ao público","ok":"Enviar-lhe-emos um email para confirmar","invalid":"Por favor introduza um endereço de email válido","authenticated":"O seu email foi autenticado por {{provider}}","frequency_immediately":"Enviar-lhe-emos um email imediatamente caso não leia o que lhe estamos a enviar.","frequency":{"one":"Só iremos enviar-lhe um email se não o tivermos visto no último minuto.","other":"Só iremos enviar-lhe um email se não o tivermos visto nos últimos {{count}} minutos."}},"name":{"title":"Nome","instructions":"O seu nome completo (opcional)","instructions_required":"O seu nome completo","too_short":"O seu nome é demasiado curto","ok":"O seu nome parece adequado"},"username":{"title":"Nome de Utilizador","instructions":"Único, sem espaços, curto","short_instructions":"Podem mencioná-lo como @{{username}}","available":"O seu nome de utilizador está disponível","global_match":"O email coincide com o nome de utilizador no registo","global_mismatch":"Já está registado. Tente {{suggestion}}?","not_available":"Não está disponível. Tente {{suggestion}}?","too_short":"O seu nome de utilizador é demasiado curto","too_long":"O seu nome de utilizador é demasiado longo","checking":"A verificar a disponibilidade do nome de utilizador...","enter_email":"Nome de utilizador encontrado, introduza o email correspondente","prefilled":"Email corresponde com o nome de utilizador registado"},"locale":{"title":"Idioma da Interface","instructions":"Idioma da interface de utilizador. Será alterado quando atualizar a página.","default":"(pré-definido)"},"password_confirmation":{"title":"Palavra-passe Novamente"},"last_posted":"Última Publicação","last_emailed":"Último Email","last_seen":"Visto","created":"Juntou-se","log_out":"Terminar sessão","location":"Localização","card_badge":{"title":"Medalha de cartão de utilizador"},"website":"Sítio da Internet","email_settings":"Email","like_notification_frequency":{"title":"Notificar quando alguém gostar","always":"Sempre","first_time_and_daily":"Na primeira vez que mensagem é gostada e diariamente","first_time":"A primeira vez que uma mensagem é gostada.","never":"Nunca"},"email_previous_replies":{"title":"Incluir respostas prévias no fundo do email.","unless_emailed":"a não ser quê previamente enviado","always":"sempre","never":"nunca"},"email_digests":{"every_30_minutes":"a cada 30 minutos","every_hour":"A cada hora","daily":"diariamente","every_three_days":"a cada três dias","weekly":"semanalmente","every_two_weeks":"a cada duas semanas"},"email_in_reply_to":"Incluir um excerto do mensagem respondida nos emails","email_direct":"Enviar-me um email quando alguém me citar, responder às minhas mensagens, mencionar o meu @nomedeutilizador, ou convidar-me para um tópico","email_private_messages":"Enviar-me um email quando alguém me envia uma mensagem","email_always":"Enviar-me notificações de email mesmo quando estou ativo no sítio","other_settings":"Outros","categories_settings":"Categorias","new_topic_duration":{"label":"Considerar tópicos como novos quando","not_viewed":"Ainda não os vi","last_here":"criado desde a última vez que aqui estive","after_1_day":"criado no último dia","after_2_days":"criado nos últimos 2 dias","after_1_week":"criado na última semana","after_2_weeks":"criado nas últimas 2 semanas"},"auto_track_topics":"Acompanhar automaticamente os tópicos em que eu entro","auto_track_options":{"never":"nunca","immediately":"imediatamente","after_30_seconds":"após 30 segundos","after_1_minute":"após 1 minuto","after_2_minutes":"após 2 minutos","after_3_minutes":"após 3 minutos","after_4_minutes":"após 4 minutos","after_5_minutes":"após 5 minutos","after_10_minutes":"após 10 minutos"},"invited":{"search":"digite para procurar convites...","title":"Convites","user":"Utilizadores Convidados","sent":"Enviado","none":"Não há convites pendentes para mostrar.","truncated":{"one":"A exibir o primeiro convite.","other":"A exibir os primeiros {{count}} convites."},"redeemed":"Convites Resgatados","redeemed_tab":"Resgatado","redeemed_tab_with_count":"Resgatados ({{count}})","redeemed_at":"Resgatado","pending":"Convites Pendentes","pending_tab":"Pendente","pending_tab_with_count":"Pendentes ({{count}})","topics_entered":"Tópicos Visualizados","posts_read_count":"Mensagens Lidas","expired":"Este convite expirou.","rescind":"Remover","rescinded":"Convite Removido","reinvite":"Reenviar convite","reinvited":"Convite reenviado","time_read":"Tempo de Leitura","days_visited":"Dias Visitados","account_age_days":"Idade da conta, em dias","create":"Enviar um Convite","generate_link":"Copiar Hiperligação do Convite","generated_link_message":"\u003cp\u003eHiperligação do Convite gerada corretamente!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eA hiperligação do convite é válida apenas para este endereço de email: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Ainda não convidou ninguém. Pode enviar convites individuais, ou convidar um grupo de pessoas de uma única vez \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e carregando um ficheiro com convites em massa.","text":"Convite em massa a partir de ficheiro","uploading":"A carregar…","success":"Ficheiro carregado corretamente, será notificado via mensagem assim que o processo esteja concluído.","error":"Erro de carregamento '{{filename}}': {{message}}"}},"password":{"title":"Palavra-passe","too_short":"A sua palavra-passe é muito curta.","common":"Essa palavra-passe é demasiado comum.","same_as_username":"A sua palavra-passe é a mesma que o seu nome de utilizador.","same_as_email":"A sua palavra-passe é a mesma que o seu email.","ok":"A sua palavra-passe parece correta.","instructions":"Pelo menos %{count} caracteres."},"summary":{"title":"Sumário","stats":"Estatísticas","time_read":"Tempo de leitura","topic_count":{"one":"Tópico criado","other":"Tópicos criados"},"post_count":{"one":"mensagem criada","other":"mensagens criadas"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dado","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dados"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e recebido","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e recebidos"},"days_visited":{"one":"dia visitado","other":"dias visitados"},"posts_read":{"one":"mensagem lida","other":"mensagens lidas"},"bookmark_count":{"one":"marcador","other":"marcadores"},"top_replies":"Respostas","no_replies":"Nenhuma resposta ainda.","more_replies":"Mais Respostas","top_topics":"Melhores Tópicos","no_topics":"Nenhum tópico ainda.","more_topics":"Mais Tópicos","top_badges":"Melhores Medalhas","no_badges":"Nenhuma medalha ainda.","more_badges":"Mais Medalhas","top_links":"Melhores hiperligações","no_links":"Não há nenhuma hiperligação ainda.","most_liked_by":"Por mais apreciados","no_likes":"Nenhum gostos ainda."},"associated_accounts":"Contas associadas","ip_address":{"title":"Último endereço IP"},"registration_ip_address":{"title":"Endereço IP de registo"},"avatar":{"title":"Imagem de Perfil","header_title":"perfil, mensagens, marcadores e preferências"},"title":{"title":"Título"},"filters":{"all":"Todos"},"stream":{"posted_by":"Publicado por","sent_by":"Enviado por","private_message":"mensagem","the_topic":"o tópico"}},"loading":"A carregar...","errors":{"prev_page":"enquanto tenta carregar","reasons":{"network":"Erro de Rede","server":"Erro de Servidor","forbidden":"Acesso Negado","unknown":"Erro","not_found":"Página Não Encontrada"},"desc":{"network":"Por favor verifique a sua ligação.","network_fixed":"Parece que está de volta.","server":"Código de Erro: {{status}}","forbidden":"Não tem permissão para visualizar isso.","not_found":"Oops, a aplicação tentou carregar um URL que não existe.","unknown":"Algo correu mal."},"buttons":{"back":"Voltar Atrás","again":"Tentar Novamente","fixed":"Carregar Página"}},"close":"Fechar","assets_changed_confirm":"Este sítio foi atualizado. Recarregar agora para a versão mais recente?","logout":"A sua sessão estava encerrada.","refresh":"Atualizar","read_only_mode":{"enabled":"Este sítio encontra-se no modo só de leitura. Por favor continue a navegar mas responder, dar gostos e outras acções estão de momento  desativadas.","login_disabled":"A função de início de sessão está desativada enquanto o sítio se encontrar no modo só de leitura.","logout_disabled":"A função de término de sessão está desativada enquanto o sítio se encontrar no modo só de leitura."},"too_few_topics_and_posts_notice":"Vamos \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ecomeçar esta discussão!\u003c/a\u003e Atualmente existem \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tópicos e \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e mensagens. Novos visitantes precisam de conversações para ler e responder a.","too_few_topics_notice":"Vamos \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ecomeçar esta discussão!\u003c/a\u003e Atualmente existem \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tópios. Novos visitantes precisam de algumas conversações para ler e responder a.","too_few_posts_notice":"Vamos \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ecomeçar esta discussão!\u003c/a\u003e Atualmente existem \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e mensagens. Novos visitantes precisam de algumas conversações para ler e responder a.","logs_error_rate_notice":{"rate":{"one":"1 erro/%{duration}","other":"%{count} erros/%{duration}"}},"learn_more":"saber mais...","year":"ano","year_desc":"tópicos criados nos últimos 365 dias","month":"mês","month_desc":"tópicos criados nos últimos 30 dias","week":"semana","week_desc":"tópicos criados nos últimos 7 dias","day":"dia","first_post":"Primeira mensagem","mute":"Silenciar","unmute":"Reativar","last_post":"Última mensagem","last_reply_lowercase":"última resposta","replies_lowercase":{"one":"resposta","other":"respostas"},"signup_cta":{"sign_up":"Inscrever-se","hide_session":"Lembrar-me amanhã","hide_forever":"não obrigado","hidden_for_session":"OK, Irei perguntar-lhe amanhã. Pode sempre usar 'Iniciar Sessão' para criar uma conta, também.","intro":"Olá! :heart_eyes: Parece que está a gostar da discussão, mas não está inscrito para uma conta.","value_prop":"Quando cria uma conta, nós lembramo-nos exatamente do que leu, por isso volta sempre ao sítio onde ficou. Também recebe notificações, aqui ou por email, sempre que novas mensagens são feitas. E pode gostar de mensagens para partilhar o amor. :heartbeat:"},"summary":{"enabled_description":"Está a ver um resumo deste tópico: as mensagens mais interessantes são determinados pela comunidade.","description":"Existem \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas.","description_time":"Existem \u003cb\u003e{{replyCount}}\u003c/b\u003e respostas com um tempo de leitura estimado de \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Resumir Este Tópico","disable":"Mostrar Todas As Mensagens"},"deleted_filter":{"enabled_description":"Este tópico contém mensagens eliminadas, as quais foram ocultas.","disabled_description":"Mensagens eliminadas no tópico são exibidas.","enable":"Ocultar mensagens eliminadas","disable":"Exibir mensagens eliminadas"},"private_message_info":{"title":"Mensagem","invite":"Convidar Outros...","remove_allowed_user":"Deseja mesmo remover {{name}} desta mensagem?"},"email":"Email","username":"Nome de utilizador","last_seen":"Visto","created":"Criado","created_lowercase":"criado","trust_level":"Nível de Confiança","search_hint":"nome de utilizador, email ou endereço de IP","create_account":{"title":"Criar Nova Conta","failed":"Ocorreu um erro, talvez este email já esteja registado, tente usar a hiperligação \"Esqueci-me da Palavra-passe\"."},"forgot_password":{"title":"Repor Palavra-Passe","action":"Esqueci-me da minha palavra-passe","invite":"Insira o seu nome de utilizador ou endereço de email, e enviar-lhe-emos um email para refazer a sua palavra-passe.","reset":"Repor Palavra-passe","complete_username":"Se uma conta corresponder ao nome de utilizador \u003cb\u003e%{username}\u003c/b\u003e, deverá receber em pouco tempo um email com instruções para repor a sua palavra-passe.","complete_email":"Se uma conta corresponder \u003cb\u003e%{email}\u003c/b\u003e, deverá receber em pouco tempo um email com instruções para repor a sua palavra-passe.","complete_username_found":"Encontrámos uma conta correspondente ao nome de utilizador \u003cb\u003e%{username}\u003c/b\u003e, deverá receber em pouco tempo um email com instruções para repor a sua palavra-passe.","complete_email_found":"Encontrámos uma conta correspondente a \u003cb\u003e%{email}\u003c/b\u003e, deverá receber em breve um email com instruções para repor a sua palavra-passe.","complete_username_not_found":"Não existe nenhuma conta correspondente ao nome de utilizador \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Não existe nenhuma conta correspondente a \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Entrar","username":"Utilizador","password":"Palavra-passe","email_placeholder":"email ou nome de utilizador","caps_lock_warning":"Caps Lock está ligado","error":"Erro desconhecido","rate_limit":"Por favor espere antes de tentar iniciar sessão novamente.","blank_username_or_password":"Por favor insira o seu email ou nome de utilizador, e palavra-passe.","reset_password":"Repor Palavra-passe","logging_in":"A iniciar sessão...","or":"Ou","authenticating":"A autenticar...","awaiting_confirmation":"A sua conta está a aguardar ativação. Utilize a hiperligação \"Esqueci a Palavra-passe\" para pedir um novo email de ativação.","awaiting_approval":"A sua conta ainda não foi aprovada por um membro do pessoal. Receberá um email quando a sua conta for aprovada.","requires_invite":"Pedimos desculpa, o acesso a este fórum é permitido somente por convite de outro membro.","not_activated":"Ainda não pode iniciar sessão. Enviámos anteriormente um email de ativação para o endereço \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor siga as instruções contidas nesse email para ativar a sua conta.","not_allowed_from_ip_address":"Não pode iniciar sessão a partir desse endereço IP.","admin_not_allowed_from_ip_address":"Não pode iniciar sessão como administrador a partir desse endereço IP.","resend_activation_email":"Clique aqui para enviar o email de ativação novamente.","sent_activation_email_again":"Enviámos mais um email de ativação para o endereço \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Pode ser que demore alguns minutos; certifique-se que verifica a sua pasta de spam ou lixo.","to_continue":"Por favor Inicie Sessão","preferences":"Necessita de ter sessão iniciada para alterar as suas preferências de utilizador.","forgot":"Não me recordo dos detalhes da minha conta","google":{"title":"com Google","message":"A autenticar com Google (certifique-se de que os bloqueadores de popup estão desativados)"},"google_oauth2":{"title":"com Google","message":"A autenticar com Google (certifique-se de que os bloqueadores de popup estão desativados)"},"twitter":{"title":"com Twitter","message":"A autenticar com Twitter (certifique-se de que os bloqueadores de popup estão desativados)"},"instagram":{"title":"com Instagram","message":"A autenticar com Instagram (certifique-se de que os bloqueadores de popup estão desativados)"},"facebook":{"title":"com Facebook","message":"A autenticar com o Facebook (certifique-se de que os bloqueadores de popup estão desativados)"},"yahoo":{"title":"com Yahoo","message":"A autenticar com Yahoo (certifique-se de que os bloqueadores de popup estão desativados)"},"github":{"title":"com GitHub","message":"A autenticar com GitHub (certifique-se de que os bloqueadores de popup estão desativados)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"mais...","options":"Opções","whisper":"susurro","add_warning":"Este é um aviso oficial.","toggle_whisper":"Alternar Sussuro","posting_not_on_topic":"A que tópico quer responder?","saving_draft_tip":"a guardar...","saved_draft_tip":"guardado","saved_local_draft_tip":"guardado localmente","similar_topics":"O seu tópico é similar a...","drafts_offline":"rascunhos offline","error":{"title_missing":"O título é obrigatório","title_too_short":"O título tem que ter pelo menos {{min}} caracteres.","title_too_long":"O tíítulo não pode conter mais do que {{max}} caracteres.","post_missing":"A mensagem não pode estar vazia","post_length":"A mensagem tem que ter pelo menos {{min}} caracteres.","try_like":"Já tentou o botão \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Tem que escolher uma categoria"},"save_edit":"Guardar alterações","reply_original":"Responder no Tópico Original","reply_here":"Responda Aqui","reply":"Responder","cancel":"Cancelar","create_topic":"Criar Tópico","create_pm":"Mensagem","title":"Ou prima Ctrl+Enter","users_placeholder":"Adicionar um utilizador","title_placeholder":"Numa breve frase, de que se trata esta discussão?","edit_reason_placeholder":"Porque está a editar?","show_edit_reason":"(adicione a razão para a edição)","reply_placeholder":"Digite aqui. Utilize Markdown, BBCode, ou HTML para formatar. Arraste ou cole imagens.","view_new_post":"Ver a sua nova mensagem.","saving":"A Guardar","saved":"Guardado!","saved_draft":"Rascunho da mensagem em progresso. Selecione para continuar.","uploading":"A carregar…","show_preview":"mostrar pré-visualização \u0026raquo;","hide_preview":"\u0026laquo; esconder pré-visualização","quote_post_title":"Citar mensagem inteira","bold_title":"Negrito","bold_text":"texto em negrito","italic_title":"Itálico","italic_text":"texto em itálico","link_title":"Hiperligação","link_description":"digite a descrição da hiperligação aqui","link_dialog_title":"Inserir Hiperligação","link_optional_text":"título opcional","link_url_placeholder":"http://example.com","quote_title":"Bloco de Citação","quote_text":"Bloco de Citação","code_title":"Texto pré-formatado","code_text":"identar texto pré-formatado até 4 espaços","upload_title":"Carregar","upload_description":"digite aqui a descrição do ficheiro carregado","olist_title":"Lista numerada","ulist_title":"Lista de items","list_item":"Item da Lista","heading_title":"Título","heading_text":"Título","hr_title":"Barra horizontal","help":"Ajuda de Edição Markdown","toggler":"esconder ou exibir o painel de composição","modal_ok":"OK","modal_cancel":"Cancelar","cant_send_pm":"Desculpe, não pode enviar uma mensagem para %{username}.","admin_options_title":"Configurações opcionais do pessoal para este tópico","auto_close":{"label":"Tempo de fecho automático do tópico:","error":"Por favor introduza um valor válido.","based_on_last_post":"Não feche até que a última mensagem do tópico tenha pelo menos este tempo.","all":{"examples":"Insira o número de horas (24), tempo absoluto (17:30) ou um selo temporal (2013-11-22 14:00)."},"limited":{"units":"(# de horas)","examples":"Introduza o número de horas (24)."}}},"notifications":{"title":"notificações de menções de @nome, respostas às suas publicações e tópicos, mensagens, etc","none":"Impossível de carregar as notificações neste momento.","more":"ver notificações antigas","total_flagged":"total de mensagens sinalizadas","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} e 1 outro\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} e {{count}} outros\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e aceitou o seu convite\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moveu {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eGanhou '{{description}}'\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensagem na caixa de entrada do seu grupo {{group_name}}\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mensagens na caixa de entrada do seu grupo {{group_name}}\u003c/p\u003e"},"alt":{"mentioned":"Mencionado por","quoted":"Citado por","replied":"Respondido","posted":"Publicado por","edited":"Edição da sua mensagem por","liked":"Gostou da sua mensagem","private_message":"Mensagem privada de","invited_to_private_message":"Convidado para uma mensagem privada de","invited_to_topic":"Convidado para um tópico de","invitee_accepted":"Convite aceite por","moved_post":"A sua mensagem foi movida por","linked":"Hiperligação para a sua mensagem","granted_badge":"Distintivo concedido","group_message_summary":"Mensagens na caixa de entrada do seu grupo"},"popup":{"mentioned":"{{username}} mencionou-o em \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mencionou-o em \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citou-o em \"{{topic}}\" - {{site_title}}","replied":"{{username}} respondeu-lhe em \"{{topic}}\" - {{site_title}}","posted":"{{username}} publicou em \"{{topic}}\" - {{site_title}}","private_message":"{{username}} enviou-lhe uma mensagem privada em \"{{topic}}\" - {{site_title}}","linked":"{{username}} ligou-se à sua mensagem a partir de \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Adicionar uma imagem","title_with_attachments":"Adicionar uma imagem ou um ficheiro","from_my_computer":"Do meu dispositivo ","from_the_web":"Da internet","remote_tip":"hiperligação para imagem","remote_tip_with_attachments":"hiperligação para imagem ou ficheiro {{authorized_extensions}}","local_tip":"selecionar imagens do seu dispositivo","local_tip_with_attachments":"selecionar imagens ou ficheiros a partir do seu dispositivo {{authorized_extensions}}","hint":"(pode também arrastar o ficheiro para o editor para fazer o carregamento)","hint_for_supported_browsers":"pode também arrastar e largar ou colar imagens no editor","uploading":"A carregar","select_file":"Selecionar Ficheiro","image_link":"hiperligação da imagem irá apontar para"},"search":{"sort_by":"Ordenar por","relevance":"Relevância","latest_post":"Última Mensagem","most_viewed":"Mais Visto","most_liked":"Mais Gostos","select_all":"Selecionar Tudo","clear_all":"Limpar Tudo","result_count":{"one":"1 resultado para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} resultados para \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"pesquisar tópicos, mensagens, utilizadores, ou categorias","no_results":"Não foi encontrado nenhum resultado.","no_more_results":"Mais nenhum resultado encontrado.","search_help":"Procurar ajuda","searching":"A procurar...","post_format":"#{{post_number}} de {{username}}","context":{"user":"Procurar mensagens de @{{username}}","topic":"Pesquisar este tópico","private_messages":"Pesquisar mensagens"}},"hamburger_menu":"ir para outra lista de tópicos ou categorias","new_item":"novo","go_back":"voltar atrás","not_logged_in_user":"página de utilizador com resumo da atividade atual e preferências  ","current_user":"ir para a sua página de utilizador","topics":{"bulk":{"unlist_topics":"Remover Tópicos da Lista","reset_read":"Repor Leitura","delete":"Eliminar Tópicos","dismiss":"Destituir","dismiss_read":"Destituir todos os não lidos","dismiss_button":"Destituir...","dismiss_tooltip":"Destituir apenas novas mensagens ou parar o acompanhamento de tópicos","also_dismiss_topics":"Parar de acompanhar estes tópicos para que estes nunca me apareçam como não lidos novamente","dismiss_new":"Destituir Novo","toggle":"ativar seleção em massa de tópicos","actions":"Ações em Massa","change_category":"Mudar Categoria","close_topics":"Fechar Tópicos","archive_topics":"Arquivar tópicos","notification_level":"Mudar Nível de Notificação","choose_new_category":"Escolha a nova categoria para os tópicos:","selected":{"one":"Selecionou  \u003cb\u003e1\u003c/b\u003e tópico.","other":"Selecionou \u003cb\u003e{{count}}\u003c/b\u003e tópicos."},"change_tags":"Mudar Etiquetas","choose_new_tags":"Escolha novas etiquetas para estes tópicos:","changed_tags":"As etiquetas para esses tópicos foram mudadas."},"none":{"unread":"Tem tópicos não lidos.","new":"Não tem novos tópicos.","read":"Ainda não leu nenhum tópico.","posted":"Ainda não publicou nenhum tópico.","latest":"Não há tópicos recentes.","hot":"Não há tópicos quentes.","bookmarks":"Ainda não marcou nenhum tópico.","category":"Não há tópicos na categoria {{category}}.","top":"Não existem tópicos recentes.","search":"Não há resultados na pesquisa.","educate":{"new":"\u003cp\u003eOs seus novos tópicos aparecem aqui.\u003c/p\u003e\u003cp\u003ePor defeito, os tópicos são considerados novos e mostrarão o indicador \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enovo\u003c/span\u003e caso tenham sido criados nos últimos 2 dias.\u003c/p\u003e\u003cp\u003ePode alterar isto nas suas \u003ca href=\"%{userPrefsUrl}\"\u003e preferências\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eOs seus tópicos não lidos aparecem aqui.\u003c/p\u003e\u003cp\u003ePor defeito, os tópicos são considerados não lidos e aparecem nas contagens de não lidos \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e Se:\u0026lt;/p\u003e\u003cul\u003e\u003cli\u003eCriou o tópico\u003c/li\u003e\u003cli\u003eRespondeu ao tópico\u003c/li\u003e\u003cli\u003eLeu o tópico por mais de 4 minutos\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOu, se definiu explicitamente o tópico para acompanhar ou vigiar através do controlo de notificações que se encontra na parte inferior de cada tópico.\u003c/p\u003e\u003cp\u003eVisite as \u003ca href=\"%{userPrefsUrl}\"\u003epreferências\u003c/a\u003e para alterar isto.\u003c/p\u003e"}},"bottom":{"latest":"Não existem mais tópicos recentes.","hot":"Não existem mais tópicos quentes.","posted":"Não existem mais tópicos publicados.","read":"Não existem mais tópicos lidos.","new":"Não existem mais tópicos novos.","unread":"Não existem mais tópicos não lidos.","category":"Não existem mais tópicos na categoria {{category}}.","top":"Não existem mais tópicos recentes.","bookmarks":"Não há mais tópicos marcados.","search":"Não há mais resultados na pesquisa."}},"topic":{"unsubscribe":{"stop_notifications":"Irá passar a receber menos notificações para \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"O seu estado de notificação atual é"},"create":"Novo Tópico","create_long":"Criar um novo Tópico","private_message":"Iniciar uma mensagem","archive_message":{"help":"Mover mensagem para o seu arquivo","title":"Arquivo"},"move_to_inbox":{"title":"Mover para Caixa de Entrada","help":"Mover mensagem de volta para a Caixa de Entrada"},"list":"Tópicos","new":"novo tópico","unread":"não lido","new_topics":{"one":"1 novo tópico","other":"{{count}} novos tópicos."},"unread_topics":{"one":"1 tópico não lido","other":"{{count}} tópicos não lidos"},"title":"Tópico","invalid_access":{"title":"O tópico é privado","description":"Pedimos desculpa, mas não tem acesso a esse tópico!","login_required":"Necessita de iniciar sessão para ver este tópico."},"server_error":{"title":"Falha ao carregar tópico","description":"Pedimos desculpa, não conseguimos carregar esse tópico, possivelmente devido a um problema na conexão. Por favor teste novamente. Se o problema persistir, avise-nos."},"not_found":{"title":"Tópico não encontrado","description":"Pedimos desculpa, não foi possível encontrar esse tópico. Talvez tenha sido removido por um moderador?"},"total_unread_posts":{"one":"tem 1 mensagem não lido neste tópico","other":"tem {{count}} mensagens não lidas neste tópico"},"unread_posts":{"one":"tem 1 mensagem antiga não lida neste tópico","other":"tem {{count}} mensagens antigas não lidas neste tópico"},"new_posts":{"one":"existe 1 nova mensagem neste tópico desde a sua última leitura","other":"existem {{count}} novas mensagens neste tópico desde a sua última leitura"},"likes":{"one":"existe 1 gosto neste tópico","other":"existem {{count}} gostos neste tópico"},"back_to_list":"Voltar à lista de Tópicos","options":"Opções do Tópico","show_links":"mostrar hiperligações dentro deste tópico","toggle_information":"alternar detalhes do tópico","read_more_in_category":"Pretende ler mais? Procure outros tópicos em {{catLink}} ou {{latestLink}}.","read_more":"Pretende ler mais? {{catLink}} ou {{latestLink}}.","browse_all_categories":"Pesquisar em todas as categorias","view_latest_topics":"ver os tópicos mais recentes","suggest_create_topic":"Porque não começar um tópico?","jump_reply_up":"avançar para resposta mais recente","jump_reply_down":"avançar para resposta mais antiga","deleted":"Este tópico foi eliminado","auto_close_notice":"Este tópico vai ser automaticamente encerrado em %{timeLeft}.","auto_close_notice_based_on_last_post":"Este tópico será encerrado %{duration} depois da última resposta","auto_close_title":"Configurações para Fechar Automaticamente","auto_close_save":"Guardar","auto_close_remove":"Não Fechar Este Tópico Automaticamente","progress":{"title":"progresso do tópico","go_top":"topo","go_bottom":"fim","go":"ir","jump_bottom":"saltar para a última mensagem","jump_bottom_with_number":"avançar para a mensagem %{post_number}","total":"total de mensagens","current":"mensagem atual"},"notifications":{"reasons":{"3_6":"Receberá notificações porque está a vigiar esta categoria.","3_5":"Receberá notificações porque começou a vigiar automaticamente este tópico.","3_2":"Receberá notificações porque está a vigiar este tópico.","3_1":"Receberá notificações porque criou este tópico.","3":"Receberá notificações porque está a vigiar este tópico.","2_8":"Receberá notificações porque está a acompanhar esta categoria.","2_4":"Receberá notificações porque publicou uma resposta a este tópico.","2_2":"Receberá notificações porque está a acompanhar este tópico.","2":"Receberá notificações porque \u003ca href=\"/users/{{username}}/preferences\"\u003eleu este tópico\u003c/a\u003e.","1_2":"Será notificado se alguém mencionar o seu @nome ou responder-lhe.","1":"Será notificado se alguém mencionar o seu @nome ou responder-lhe.","0_7":"Está a ignorar todas as notificações nesta categoria.","0_2":"Está a ignorar todas as notificações para este tópico.","0":"Está a ignorar todas as notificações para este tópico."},"watching_pm":{"title":"A vigiar","description":"Será notificado de cada nova resposta nesta mensagem, e uma contagem de novas respostas será exibida."},"watching":{"title":"A vigiar","description":"Será notificado de cada nova resposta neste tópico, e uma contagem de novas respostas será exibida."},"tracking_pm":{"title":"Acompanhar","description":"Uma contagem de novas respostas será exibida para esta mensagem. Será notificado se alguém mencionar o seu @nome ou responder-lhe."},"tracking":{"title":"Acompanhar","description":"Uma contagem de novas respostas será exibida para este tópico. Será notificado se alguém mencionar o seu @nome ou responder-lhe."},"regular":{"title":"Habitual","description":"Será notificado se alguém mencionar o seu @nome ou responder-lhe."},"regular_pm":{"title":"Habitual","description":"Será notificado se alguém mencionar o seu @nome ou responder-lhe."},"muted_pm":{"title":"Silenciado","description":"Não será notificado de nada relacionado com esta mensagem."},"muted":{"title":"Silenciado","description":"Nunca será notificado de nada acerca deste tópico, e este não irá aparecer nos recentes."}},"actions":{"recover":"Recuperar Tópico","delete":"Eliminar Tópico","open":"Abrir Tópico","close":"Fechar Tópico","multi_select":"Selecionar Mensagens...","auto_close":"Fechar Automaticamente...","pin":"Fixar Tópico...","unpin":"Desafixar Tópico...","unarchive":"Desarquivar Tópico","archive":"Arquivar Tópico","invisible":"Tornar Não Listado","visible":"Tornar Listado","reset_read":"Repor Data de Leitura","make_public":"Criar tópico publico","make_private":"Criar mensagem privada"},"feature":{"pin":"Fixar Tópico","unpin":"Desafixar Tópico","pin_globally":"Fixar Tópico Globalmente","make_banner":"Tópico de Faixa","remove_banner":"Remover Tópico de Faixa"},"reply":{"title":"Responder","help":"começa a compor uma resposta a este tópico"},"clear_pin":{"title":"Remover destaque","help":"Remover destaque deste tópico para que o mesmo deixe de aparecer no topo da sua lista de tópicos"},"share":{"title":"Partilhar","help":"Partilhar uma hiperligação para este tópico"},"flag_topic":{"title":"Sinalizar","help":"sinalizar privadamente este tópico para consideração ou enviar uma notificação privada sobre o mesmo","success_message":"Sinalizou este tópico com sucesso."},"feature_topic":{"title":"Destacar este tópico","pin":"Fazer este tópico aparecer no topo da categoria {{categoryLink}} até","confirm_pin":"Já tem {{count}} tópicos fixados. Demasiados tópicos fixados podem ser um fardo para utilizadores novos e anónimos. Tem a certeza que deseja fixar outro tópico nesta categoria?","unpin":"Remover este tópico do topo da categoria {{categoryLink}}.","unpin_until":"Remover este tópico do topo da categoria {{categoryLink}} ou espere até \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Os utilizadores podem desafixar individualmente o tópico por si próprios.","pin_validation":"É necessária uma data para fixar este tópico.","not_pinned":"Não há tópicos fixados em {{categoryLink}}.","already_pinned":{"one":"Tópicos atualmente fixados em {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Tópicos atualmente fixados em {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Fazer com que este tópico apareça no topo da lista de todos os tópicos até","confirm_pin_globally":"Já tem {{count}} tópicos fixados globalmente. Demasiados tópicos fixados podem ser um fardo para utilizadores novos e anónimos. Tem a certeza que deseja fixar outro tópico globalmente?","unpin_globally":"Remover este tópico do topo de todas as listas de tópicos.","unpin_globally_until":"Remover este tópico do topo da lista de todos os tópicos ou espere até \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Os utilizadores podem desafixar individualmente o tópico por si próprios.","not_pinned_globally":"Não existem tópicos fixados globalmente.","already_pinned_globally":{"one":"Tópicos atualmente fixados globalmente: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Tópicos atualmente fixados globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Tornar este tópico numa faixa que apareça no topo de todas as páginas.","remove_banner":"Remover a faixa que aparece no topo de todas as páginas.","banner_note":"Os utilizadores podem destituir a faixa ao fecharem-na. Apenas um tópico pode ser considerado uma faixa em qualquer momento.","no_banner_exists":"Não existe tópico de faixa.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eExiste\u003c/strong\u003e atualmente um tópico de faixa."},"inviting":"A Convidar...","invite_private":{"title":"Convidar para Mensagem","email_or_username":"Email ou Nome de Utilizador do Convidado","email_or_username_placeholder":"endereço de email ou nome de utilizador","action":"Convidar","success":"Convidámos esse utilizador para participar nesta mensagem.","error":"Pedimos desculpa, ocorreu um erro ao convidar esse utilizador.","group_name":"nome do grupo"},"controls":"Controlos de Tópico","invite_reply":{"title":"Convidar","username_placeholder":"nome de utilizador","action":"Enviar Convite","help":"convidar outros para este tópico via email ou notificações","to_forum":"Enviaremos um breve email que permitirá ao seu amigo juntar-se imediatamente clicando numa hiperligação, não sendo necessário ter sessão iniciada.","sso_enabled":"Introduza o nome de utilizador da pessoa que gostaria de convidar para este tópico.","to_topic_blank":"Introduza o nome de utilizador ou endereço de email da pessoa que gostaria de convidar para este tópico.","to_topic_email":"Introduziu um endereço de email. Iremos enviar um email com um convite que permite aos seus amigos responderem a este tópico imediatamente.","to_topic_username":"Introduziu um nome de utilizador. Iremos enviar-lhe uma notificação com uma hiperligação convidando-o para este tópico.","to_username":"Introduza o nome de utilizador da pessoa que deseja convidar. Iremos enviar-lhe uma notificação com uma hiperligação convidando-o para este tópico.","email_placeholder":"nome@exemplo.com","success_email":"Enviámos por email um convite para \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Iremos notificá-lo quando o convite for utilizado. Verifique o separador de convites na sua página de utilizador para acompanhar os seus convites.","success_username":"Convidámos esse utilizador para participar neste tópico.","error":"Pedimos desculpa, não conseguimos convidar essa pessoa. Talvez já tenha sido convidado? (Os convites são limitados)"},"login_reply":"Iniciar sessão para Responder","filters":{"n_posts":{"one":"1 mensagem","other":"{{count}} mensagens"},"cancel":"Remover filtro"},"split_topic":{"title":"Mover para um Novo Tópico","action":"mover para um novo tópico","topic_name":"Nome do Novo Tópico","error":"Ocorreu um erro ao mover as mensagens para um novo tópico.","instructions":{"one":"Está prestes a criar um novo tópico e populá-lo com a mensagem que selecionou.","other":"Está prestes a criar um novo tópico e populá-lo com as \u003cb\u003e{{count}}\u003c/b\u003e mensagens que selecionou."}},"merge_topic":{"title":"Mover para Tópico Existente","action":"mover para tópico existente","error":"Ocorreu um erro ao mover as mensagens para esse tópico.","instructions":{"one":"Por favor selecione o tópico para o qual gostaria de mover esta mensagem.","other":"Por favor selecione o tópico para o qual gostaria de mover estas \u003cb\u003e{{count}}\u003c/b\u003e mensagens."}},"change_owner":{"title":"Mudar Proprietário das Mensagens","action":"mudar titularidade","error":"Ocorreu um erro na mudança de titularidade das mensagens.","label":"Novo Proprietário das Mensagens","placeholder":"nome de utilizador do novo proprietário","instructions":{"one":"Por favor seleccione o novo titular da mensagem de \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Por favor selecione o novo titular das {{count}} mensagens de \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Note que quaisquer notificações relacionadas com esta mensagem serão transferidas retroativamente para o novo utilizador. \u003cbr\u003eAviso: Atualmente nenhum dado dependente da mensagem é transferido para o novo utilizador. Usar com cautela."},"change_timestamp":{"title":"Alterar Selo Temporal","action":"alterar selo temporal","invalid_timestamp":"O selo temporal não pode ser no futuro.","error":"Ocorreu um erro ao alterar o selo temporal do tópico.","instructions":"Por favor selecione o novo selo temporal do tópico. Mensagens no tópico serão atualizadas para terem a mesma diferença temporal."},"multi_select":{"select":"selecionar","selected":"({{count}}) selecionados","select_replies":"selecione +respostas","delete":"eliminar selecionados","cancel":"cancelar seleção","select_all":"selecionar tudo ","deselect_all":"desmarcar tudo","description":{"one":"Selecionou \u003cb\u003e1\u003c/b\u003e mensagem.","other":"Selecionou \u003cb\u003e{{count}}\u003c/b\u003e mensagens."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citar resposta","edit":"Editar {{link}} {{replyAvatar}} {{username}}","edit_reason":"Motivo:","post_number":"mensagem {{number}}","last_edited_on":"mensagem editada pela última vez em","reply_as_new_topic":"Responder com novo Tópico","continue_discussion":"Continuar a discussão desde {{postLink}}:","follow_quote":"avançar para a mensagem citada","show_full":"Mostrar Mensagem Completa","show_hidden":"Ver conteúdo ocultado.","deleted_by_author":{"one":"(mensagens abandonadas pelo autor serão removidas automaticamente em %{count} hora a não ser que estejam sinalizadas)","other":"(mensagens abandonadas pelo autor serão eliminadas automaticamente em %{count} horas a não ser que estejam sinalizadas)"},"expand_collapse":"expandir/colapsar","gap":{"one":"ver 1 resposta oculta","other":"ver {{count}} respostas ocultas"},"unread":"Mensagem não lida","has_replies":{"one":"{{count}} Resposta","other":"{{count}} Respostas"},"has_likes":{"one":"{{count}} Gosto","other":"{{count}} Gostos"},"has_likes_title":{"one":"1 pessoa gostou desta mensagem","other":"{{count}} pessoas gostaram desta mensagem"},"has_likes_title_only_you":"você gostou desta mensagem","has_likes_title_you":{"one":"você e 1 outra pessoa gostaram desta mensagem","other":"você e {{count}} outras pessoas gostaram desta mensagem"},"errors":{"create":"Pedimos desculpa, ocorreu um erro ao criar a sua mensagem. Por favor, tente novamente.","edit":"Pedimos desculpa, ocorreu um erro ao editar a sua mensagem. Por favor, tente novamente.","upload":"Pedimos desculpa, ocorreu um erro ao carregar esse ficheiro. Por favor, tente novamente.","file_too_large":"Lamentamos mas esse ficheiro é demasiado grande (o tamanho máximo é de {{max_size_kb}}kb). Porque não carregar o seu ficheiro grande para um serviço de partilha na nuvem e depois partilhar o link?","too_many_uploads":"Pedimos desculpa, só pode carregar um ficheiro de cada vez.","too_many_dragged_and_dropped_files":"Lamentamos mas só pode carregar 10 ficheiros de cada vez.","upload_not_authorized":"Pedimos desculpa, o tipo de ficheiro que está a carregar não está autorizado (extensões autorizadas: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Pedimos desculpa, os novos utilizadores não podem carregar imagens.","attachment_upload_not_allowed_for_new_user":"Pedimos desculpa, os novos utilizadores não podem carregar anexos.","attachment_download_requires_login":"Pedimos desculpa, os novos utilizadores não podem carregar anexos."},"abandon":{"confirm":"Tem a certeza que deseja abandonar a sua mensagem?","no_value":"Não, manter","yes_value":"Sim, abandonar"},"via_email":"esta mensagem chegou por email","via_auto_generated_email":"esta mensagem chegou via um email gerado automaticamente","whisper":"esta mensagem é um susurro privado para os moderadores","wiki":{"about":"esta mensagem é uma wiki"},"archetypes":{"save":"Guardar as Opções"},"few_likes_left":"Obrigado por partilhar o amor! Restam-lhe apenas um gostos para hoje.","controls":{"reply":"começar a compor uma resposta a este tópico","like":"gostar deste tópico","has_liked":"gostou desta mensagem","undo_like":"desfazer gosto","edit":"editar este tópico","edit_anonymous":"Pedimos desculpa, mas necessita de ter sessão iniciada para editar esta mensagem.","flag":"sinalizar privadamente este tópico para consideração ou enviar uma notificação privada sobre o mesmo","delete":"eliminar esta mensagem","undelete":"repor esta mensagem","share":"partilhar uma hiperligação para esta mensagem","more":"Mais","delete_replies":{"confirm":{"one":"Também quer eliminar a {{count}} resposta direta a esta mensagem?","other":"Também quer eliminar as {{count}} respostas diretas a esta mensagem?"},"yes_value":"Sim, eliminar as respostas também","no_value":"Não, somente esta mensagem"},"admin":"ações administrativas de mensagens","wiki":"Fazer Wiki","unwiki":"Remover Wiki","convert_to_moderator":"Adicionar Cor do Pessoal","revert_to_regular":"Remover Cor do Pessoal","rebake":"Reconstruir HTML","unhide":"Mostrar","change_owner":"Mudar Titularidade"},"actions":{"flag":"Sinalizar","defer_flags":{"one":"Diferir sinalização","other":"Diferir sinalizações"},"undo":{"off_topic":"Retirar sinalização","spam":"Retirar sinalização","inappropriate":"Retirar sinalização","bookmark":"Remover marcador","like":"Retirar gosto","vote":"Retirar voto"},"people":{"off_topic":"sinalizou isto como fora de contexto","spam":"sinalizou isto como spam","inappropriate":"sinalizou isto como inapropriado","notify_moderators":"moderadores notificados","notify_user":"enviou uma mensagem","bookmark":"adicionou um marcador disto","like":"gostou disto","vote":"votou nisto"},"by_you":{"off_topic":"Sinalizou isto como fora de contexto","spam":"Sinalizou isto como spam","inappropriate":"Sinalizou isto como inapropriado","notify_moderators":"Sinalizou isto para moderação","notify_user":"Enviou uma mensagem a este utilizador","bookmark":"Adicionou um marcador a esta mensagem","like":"Gostou disto","vote":"Votou nesta mensagem"},"by_you_and_others":{"off_topic":{"one":"Para além de si, 1 pessoa sinalizou isto como fora de contexto","other":"Para além de si, {{count}} pessoas sinalizaram isto como fora de contexto"},"spam":{"one":"Para além de si, 1 pessoa sinalizou isto como spam","other":"Para além de si, {{count}} pessoas sinalizaram isto como spam"},"inappropriate":{"one":"Para além de si, 1 pessoa sinalizou isto como inapropriado","other":"Para além de si, {{count}} pessoas sinalizaram isto como inapropriado"},"notify_moderators":{"one":"Para além de si, 1 pessoa sinalizaram isto para moderação","other":"Para além de si, {{count}} pessoas sinalizaram isto para moderação"},"notify_user":{"one":"Para além de si, 1 outro utilizador enviaram uma mensagem a este utilizador","other":"Para além de si, {{count}} outros utilizadores enviaram uma mensagem a este utilizador"},"bookmark":{"one":"Para além de si, 1 pessoa adicionou um marcador a esta mensagem","other":"Para além de si, {{count}} adicionaram um marcador a esta mensagem"},"like":{"one":"Para além de si, 1 pessoa gostou disto","other":"Para além de si, {{count}} pessoas gostaram disto"},"vote":{"one":"Para além de si, 1 pessoa votou nesta mensagem","other":"Para além de si, {{count}} pessoas votaram nesta mensagem"}},"by_others":{"off_topic":{"one":"1 pessoa sinalizou isto como fora de contexto","other":"{{count}} pessoas sinalizaram isto como fora de contexto"},"spam":{"one":"1 pessoa sinalizou isto como spam","other":"{{count}} pessoas sinalizaram isto como spam"},"inappropriate":{"one":"1 pessoa sinalizou isto como impróprio","other":"{{count}} pessoas sinalizaram isto como inapropriado"},"notify_moderators":{"one":"1 pessoa sinalizou isto para moderação","other":"{{count}} pessoas sinalizaram isto para moderação"},"notify_user":{"one":"1 pessoa enviou uma mensagem a este utilizador","other":"{{count}} enviaram uma mensagem a este utilizador"},"bookmark":{"one":"1 pessoa adicionou um marcador a esta mensagem","other":"{{count}} pessoas adicionaram um marcador a esta mensagem"},"like":{"one":"1 pessoa gostou disto","other":"{{count}} pessoas gostaram disto"},"vote":{"one":"1 pessoa votou nesta mensagem","other":"{{count}} pessoas votaram nesta mensagem"}}},"delete":{"confirm":{"one":"Tem a certeza que quer eliminar essa mensagem?","other":"Tem a certeza que quer eliminar todas essas mensagens?"}},"revisions":{"controls":{"first":"Primeira revisão","previous":"Revisão anterior","next":"Próxima revisão","last":"Última revisão","hide":"Esconder revisão","show":"Mostrar revisão","revert":"Reverter para esta revisão","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Mostrar o resultado renderizado com inserções e remoções em-linha.","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Mostrar o resultado renderizado das diferenças lado-a-lado","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Mostrar em bruto a fonte das diferenças lado-a-lado","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Em bruto"}}}},"category":{"can":"pode\u0026hellip; ","none":"(sem categoria)","all":"Todas as categorias","choose":"Selecione uma category\u0026hellip;","edit":"editar","edit_long":"Editar","view":"Visualizar Tópicos na Categoria","general":"Geral","settings":"Configurações","topic_template":"Modelo do Tópico","delete":"Eliminar Categoria","create":"Nova Categoria","create_long":"Criar uma nova categoria","save":"Guardar Categoria","slug":"Título da Categoria","slug_placeholder":"(Opcional) palavras com travessão no URL","creation_error":"Ocorreu um erro durante a criação da categoria.","save_error":"Ocorreu um erro ao guardar a categoria.","name":"Nome da Categoria","description":"Descrição","topic":"tópico da categoria","logo":"Logótipo da Categoria","background_image":"Imagem de Fundo da Categoria","badge_colors":"Cores do distintivo","background_color":"Cor de fundo","foreground_color":"Cor frontal","name_placeholder":"Máximo de uma ou duas palavras","color_placeholder":"Qualquer cor da internet","delete_confirm":"Tem a certeza que deseja eliminar esta categoria?","delete_error":"Ocorreu um erro ao eliminar a categoria.","list":"Lista de Categorias","no_description":"Por favor adicione uma descrição para esta categoria.","change_in_category_topic":"Editar Descrição","already_used":"Esta cor já foi usada para outra categoria","security":"Segurança","special_warning":"Aviso: Esta categoria é uma categoria pré-preenchida e as configurações de segurança não podem ser editadas. Se não deseja utilizar esta categoria, elimine-a em vez de lhe dar um novo propósito.","images":"Imagens","auto_close_label":"Fechar tópicos automaticamente depois de:","auto_close_units":"horas","email_in":"Endereço de email personalizado para emails recebidos:","email_in_allow_strangers":"Aceitar emails de utilizadores anónimos sem conta","email_in_disabled":"Publicar novos tópicos através do email está desactivado nas Configurações do Sítio. Para permitir a publicação de novos tópicos através do email,","email_in_disabled_click":"ative a definição \"email em\".","suppress_from_homepage":"Suprimir esta categoria da página principal.","allow_badges_label":"Permitir a atribuição de distintivos nesta categoria","edit_permissions":"Editar Permissões","add_permission":"Adicionar Permissões","this_year":"este ano","position":"posição","default_position":"Posição Padrão","position_disabled":"As categorias serão exibidas por ordem de actividade. Para controlar a ordenação das categorias nas listas,","position_disabled_click":"ative a definição \"categoria em posição fixa\".","parent":"Categoria Principal","notifications":{"watching":{"title":"A vigiar"},"tracking":{"title":"Acompanhar"},"regular":{"title":"Normal","description":"Será notificado se alguém mencionar o seu @nome ou responder-lhe."},"muted":{"title":"Silenciado","description":"Nunca será notificado de nada acerca de novos tópicos nestas categorias, e estes não irão aparecer nos recentes."}}},"flagging":{"title":"Obrigado por ajudar a manter a nossa comunidade cívica!","action":"Sinalizar Mensagem","take_action":"Acionar","notify_action":"Mensagem","official_warning":"Aviso Oficial","delete_spammer":"Eliminar Spammer","yes_delete_spammer":"Sim, Eliminar Spammer","ip_address_missing":"(N/A)","hidden_email_address":"(escondido)","submit_tooltip":"Submeter a sinalização privada","take_action_tooltip":"Atingir imediatamente o limite de sinalizações, em vez de esperar por mais denúncias da comunidade","cant":"Pedimos desculpa, não é possível colocar uma sinalização nesta mensagem neste momento.","notify_staff":"Notificar o pessoal privadamente","formatted_name":{"off_topic":"Está fora do contexto","inappropriate":"É inapropriado","spam":"É Spam"},"custom_placeholder_notify_user":"Seja específico, seja construtivo e seja sempre amável.","custom_placeholder_notify_moderators":"Diga-nos especificamente quais são as suas preocupações, e forneça-nos hiperligações relevantes e exemplo se possível."},"flagging_topic":{"title":"Obrigado por ajudar a manter a nossa comunidade cívica!","action":"Sinalizar Tópico","notify_action":"Mensagem"},"topic_map":{"title":"Sumário do Tópico","participants_title":"Autores Frequentes","links_title":"Hiperligações Populares","clicks":{"one":"1 clique","other":"%{count} cliques"}},"topic_statuses":{"warning":{"help":"Este é um aviso oficial."},"bookmarked":{"help":"Adicionou este tópico aos marcadores"},"locked":{"help":"Este tópico está fechado; já não são aceites novas respostas"},"archived":{"help":"Este tópico está arquivado; está congelado e não pode ser alterado"},"locked_and_archived":{"help":"Este tópico está fechado e arquivado; já não aceita novas respostas e não pode ser modificado"},"unpinned":{"title":"Desafixado","help":"Este tópico foi desafixado por si; será mostrado na ordem habitual"},"pinned_globally":{"title":"Fixado Globalmente","help":"Este tópico está fixado globalmente; será exibido no topo dos recentes e da sua categoria"},"pinned":{"title":"Fixado","help":"Este tópico foi fixado por si; será mostrado no topo da sua categoria"},"invisible":{"help":"Este tópico não está listado; não será apresentado na lista de tópicos e poderá ser acedido apenas através de uma hiperligação direta"}},"posts":"Mensagens","posts_long":"existem {{number}} mensagens neste tópico","original_post":"Mensagem Original","views":"Visualizações","views_lowercase":{"one":"visualização","other":"visualizações"},"replies":"Respostas","views_long":"este tópico foi visto {{number}} vezes","activity":"Atividade","likes":"Gostos","likes_lowercase":{"one":"gosto","other":"gostos"},"likes_long":"existem {{number}} gostos neste tópico","users":"Utilizadores","users_lowercase":{"one":"utilizador","other":"utilizadores"},"category_title":"Categoria","history":"Histórico","changed_by":"por {{author}}","raw_email":{"title":"Email em bruto","not_available":"Indisponível!"},"categories_list":"Lista de Categorias","filters":{"with_topics":"%{filter} tópicos","with_category":"%{filter} %{category} tópicos","latest":{"title":"Recente","title_with_count":{"one":"Recente (1)","other":"Recentes ({{count}})"},"help":"tópicos com mensagens recentes"},"hot":{"title":"Quente","help":"uma seleção dos tópicos mais quentes"},"read":{"title":"Lido","help":"tópicos que leu, na ordem que os leu"},"search":{"title":"Pesquisar","help":"pesquisar todos os tópicos"},"categories":{"title":"Categorias","title_in":"Categoria - {{categoryName}}","help":"todos os tópicos agrupados por categoria"},"unread":{"title":"Não Lido","title_with_count":{"one":"Não Lido (1)","other":"Não Lidos ({{count}})"},"help":"tópicos que está atualmente a vigiar ou a acompanhar com mensagens não lidas","lower_title_with_count":{"one":"1 não lido","other":"{{count}} não lidos"}},"new":{"lower_title_with_count":{"one":"1 novo","other":"{{count}} novos"},"lower_title":"novo","title":"Novo","title_with_count":{"one":"Novo (1)","other":"Novos ({{count}})"},"help":"tópicos criados nos últimos dias"},"posted":{"title":"As Minhas mensagens","help":"tópicos nos quais publicou uma mensagem"},"bookmarks":{"title":"Marcadores","help":"tópicos que marcou"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"tópicos recentes na categoria {{categoryName}}"},"top":{"title":"Os Melhores","help":"os tópicos mais ativos no último ano, mês, semana ou dia","all":{"title":"Em Qualquer Altura"},"yearly":{"title":"Anual"},"quarterly":{"title":"Trimestral"},"monthly":{"title":"Mensal"},"weekly":{"title":"Semanal"},"daily":{"title":"Diário"},"all_time":"Em Qualquer Altura","this_year":"Ano","this_quarter":"Trimestre","this_month":"Mês","this_week":"Semana","today":"Hoje","other_periods":"ver topo"}},"browser_update":"Infelizmente, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eo seu navegador é demasiado antigo para funcionar com este sítio\u003c/a\u003e. Por favor \u003ca href=\"http://browsehappy.com\"\u003eatualize o seu navegador\u003c/a\u003e.","permission_types":{"full":"Criar / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"poll":{"voters":{"one":"eleitor","other":"eleitores"},"total_votes":{"one":"total da votação","other":"total de votos"},"average_rating":"Classificação média: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Votos são públicos"},"multiple":{"help":{"between_min_and_max_options":"Escolha entre \u003cstrong\u003e%{min}\u003c/strong\u003e e \u003cstrong\u003e%{max}\u003c/strong\u003e opções"}},"cast-votes":{"title":"Votar","label":"Vote agora!"},"show-results":{"title":"Exibir resultados da votação","label":"Mostrar resultados"},"hide-results":{"title":"Voltar aos meus votos","label":"Ocultar resultados"},"open":{"title":"Abrir a votação","label":"Abrir","confirm":"Tem a certeza que quer abrir esta votação?"},"close":{"title":"Fechar a votação","label":"Fechar","confirm":"Tem a certeza que quer fechar esta votação?"},"error_while_toggling_status":"Pedimos desculpa, ocorreu um erro ao mudar o estado deste inquérito.","error_while_casting_votes":"Pedimos desculpa, ocorreu um erro ao submeter os seus votos.","error_while_fetching_voters":"Pedimos desculpa, ocorreu um erro ao apresentar os eleitores.","ui_builder":{"title":"Criar Votação","insert":"Inserir votação","help":{"options_count":"Indique pelo menos 2 opções"},"poll_type":{"label":"Tipo","regular":"Escolha Única","multiple":"Multipla escolha","number":"Cotação numérica"},"poll_config":{"max":"Máximo","min":"Mínimo","step":"Passo"},"poll_public":{"label":"Mostre quem votou"},"poll_options":{"label":"Escreva uma opção de votação por linha"}}},"type_to_filter":"digite para filtrar...","admin":{"title":"Administração Discourse","moderator":"Moderador","dashboard":{"title":"Painel de Administração","last_updated":"Painel atualizado em:","version":"Versão","up_to_date":"Está atualizado!","critical_available":"Uma atualização crítica está disponível.","updates_available":"Há atualizações disponíveis.","please_upgrade":"Por favor, atualize!","no_check_performed":"Não foi feita nenhuma verificação por atualizações. Certifique-se que o sidekiq está em execução.","stale_data":"Não foi feita verificação por atualizações ultimamente. Certifique-se de que o sidekiq está em execução.","version_check_pending":"Parece que atualizou recentemente. Fantástico!","installed_version":"Instalado","latest_version":"Recentes","problems_found":"Foram encontrados alguns problemas na sua instalação do Discourse:","last_checked":"Última verificação","refresh_problems":"Atualizar","no_problems":"Nenhum problema encontrado.","moderators":"Moderadores:","admins":"Administradores:","blocked":"Bloqueado:","suspended":"Suspenso: ","private_messages_short":"Msgs","private_messages_title":"Mensagens","mobile_title":"Móvel","space_free":"{{size}} livre","uploads":"carregamentos","backups":"fazer cópias de segurança","traffic_short":"Tráfego","traffic":"Pedidos de aplicação web","page_views":"Pedidos API","page_views_short":"Pedidos API","show_traffic_report":"Mostrar Relatório Detalhado do Tráfego","reports":{"today":"Hoje","yesterday":"Ontem","last_7_days":"Últimos 7 Dias","last_30_days":"Últimos 30 Dias","all_time":"Desde Sempre","7_days_ago":"7 Dias Atrás","30_days_ago":"30 Dias Atrás","all":"Tudo","view_table":"tabela","view_graph":"grafo","refresh_report":"Atualizar relatório","start_date":"Data de Início","end_date":"Data final","groups":"Todos os grupos"}},"commits":{"latest_changes":"Últimas alterações: atualize com frequência!","by":"por"},"flags":{"title":"Sinalizações","old":"Antigo","active":"Ativo","agree":"Aceitar","agree_title":"Confirmar esta sinalização como válida e correta","agree_flag_modal_title":"Aceitar e...","agree_flag_hide_post":"Aceitar (esconder mensagem + enviar MP)","agree_flag_hide_post_title":"Esconder esta publicação e enviar automaticamente uma mensagem ao utilizador solicitando a edição urgente da mesma","agree_flag_restore_post":"Concordar (restaurar mensagem)","agree_flag_restore_post_title":"Restaurar esta mensagem","agree_flag":"Concordar com a sinalização","agree_flag_title":"Concordar com a sinalização e manter a mensagem inalterada","defer_flag":"Diferir","defer_flag_title":"Remover esta sinalização; não requer qualquer ação de momento.","delete":"Eliminar","delete_title":"Eliminar a mensagem associada a esta sinalização.","delete_post_defer_flag":"Eliminar mensagem e diferir a sinalização.","delete_post_defer_flag_title":"Eliminar mensagem; se é a primeira do tópico então eliminar o tópico","delete_post_agree_flag":"Eliminar mensagem e Concordar com a sinalização","delete_post_agree_flag_title":"Eliminar mensagem; se é a primeira do tópico então eliminar o tópico","delete_flag_modal_title":"Eliminar e…","delete_spammer":"Eliminar Spammer","delete_spammer_title":"Remover utilizador e todos as mensagens e tópicos do mesmo.","disagree_flag_unhide_post":"Discordar (exibir mensagem)","disagree_flag_unhide_post_title":"Remover qualquer sinalização desta mensagem e torná-la visível novamente","disagree_flag":"Discordar","disagree_flag_title":"Negar esta sinalização como inválida ou incorreta","clear_topic_flags":"Concluído","clear_topic_flags_title":"Este tópico foi investigado e os problemas foram resolvidos. Clique em Concluído para remover as sinalizações.","more":"(mais respostas...)","dispositions":{"agreed":"concordado","disagreed":"discordado","deferred":"diferido"},"flagged_by":"Sinalizado por","resolved_by":"Resolvido por","took_action":"Realizou uma ação","system":"Sistema","error":"Aconteceu um erro","reply_message":"Responder","no_results":"Não há sinalizações.","topic_flagged":"Este \u003cstrong\u003etópico\u003c/strong\u003e foi sinalizado.","visit_topic":"Visitar tópico para acionar medidas","was_edited":"A mensagem foi editada após a primeira sinalização","previous_flags_count":"Esta mensagem já foi sinalizada {{count}} vezes.","summary":{"action_type_3":{"one":"fora do contexto","other":"fora do contexto x{{count}}"},"action_type_4":{"one":"inapropriado","other":"inapropriado x{{count}}"},"action_type_6":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_7":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Grupo Primário","no_primary":"(nenhum grupo primário)","title":"Grupos","edit":"Editar Grupos","refresh":"Atualizar","new":"Novo","selector_placeholder":"insira o nome de utilizador","name_placeholder":"Nome do grupo, sem espaços, com as mesmas regras do nome de utilizador","about":"Editar aqui a sua participação e nomes no grupo","group_members":"Membros do grupo","delete":"Eliminar","delete_confirm":"Eliminar este grupo?","delete_failed":"Impossível eliminar grupo. Se se trata de um grupo automático, não pode ser eliminado.","delete_member_confirm":"Remova o '%{username}' do grupo '%{group}'?","delete_owner_confirm":"Remover privilégios do proprietário para '%{username}'?","name":"Nome","add":"Adicionar","add_members":"Adicionar membros","custom":"Personalizar","bulk_complete":"Os utilizadores foram adicionados ao grupo.","bulk":"Adicionar ao Grupo em Massa","bulk_paste":"Colar uma lista de nomes de utilizador ou emails, um por linha:","bulk_select":"(selecionar um grupo)","automatic":"Automático","automatic_membership_email_domains":"Utilizadores que registem um domínio de email que corresponde exactamente a algum desta lista irão ser automaticamente adicionados a este grupo:","automatic_membership_retroactive":"Aplicar a mesma regra de domínio de email para adicionar utilizadores registados existentes","default_title":"Título padrão para todos os utilizadores neste grupo","primary_group":"Definir automaticamente como grupo primário","group_owners":"Proprietários","add_owners":"Adicionar proprietários","incoming_email":"Endereço de email de entrada personalizado","incoming_email_placeholder":"introduza o endereço de email"},"api":{"generate_master":"Gerar Chave Mestra API ","none":"Não existem chaves API ativas neste momento.","user":"Utilizador","title":"API","key":"Chave API","generate":"Gerar","regenerate":"Regenerar","revoke":"Revogar","confirm_regen":"Tem a certeza que quer substituir essa chave API por uma nova?","confirm_revoke":"Tem a certeza que quer revogar essa chave?","info_html":"A sua chave API permitirá a criação e edição de tópicos usando pedidos JSON.","all_users":"Todos os Utilizadores","note_html":"Manter esta chave \u003cstrong\u003esecreta\u003c/strong\u003e, todos os utilizadores que a tenham poderão criar mensagens arbitrárias como qualquer utilizador."},"plugins":{"title":"Plugins","installed":"Plugins Instalados","name":"Nome","none_installed":"Não tem nenhum plugin instalado.","version":"Versão","enabled":"Ativado?","is_enabled":"S","not_enabled":"N","change_settings":"Alterar Configurações","change_settings_short":"Configurações","howto":"Como instalo plugins?"},"backups":{"title":"Fazer Cópias de Segurança","menu":{"backups":"Fazer Cópias de Segurança","logs":"Logs"},"none":"Nenhuma cópia de segurança disponível.","read_only":{"enable":{"title":"Activar modo só de leitura","label":"Activar só de leitura","confirm":"Tem a certeza que quer activar o modo só de leitura?"},"disable":{"title":"Desactivar modo só de leitura","label":"Desactivar só para leitura"}},"logs":{"none":"Nenhuns logs ainda..."},"columns":{"filename":"Nome do ficheiro","size":"Tamanho"},"upload":{"label":"Carregar","title":"Carregar uma cópia de segurança para esta instância","uploading":"A carregar…","success":"'{{filename}}' foi carregado com sucesso.","error":"Verificou-se um erro no carregamento de '{{filename}}': {{message}}"},"operations":{"is_running":"Existe atualmente uma operação em execução...","failed":"A {{operation}} falhou. Por favor verifique o registo dos logs.","cancel":{"label":"Cancelar","title":"Cancelar a operação atual","confirm":"Tem a certeza que deseja cancelar a operação atual?"},"backup":{"label":"Fazer Cópia de segurança","title":"Criar uma cópia de segurança","confirm":"Deseja criar uma nova cópia de segurança?","without_uploads":"Sim (não incluir ficheiros)"},"download":{"label":"Descarregar","title":"Descarregar a cópia de segurança"},"destroy":{"title":"Remover a cópia de segurança","confirm":"Tem a certeza que deseja destruir esta cópia de segurança?"},"restore":{"is_disabled":"A opção de restauro encontra-se desativada nas configurações do sítio.","label":"Restaurar","title":"Restaurar a cópia de segurança","confirm":"Tem a certeza que deseja recuperar esta cópia de segurança?"},"rollback":{"label":"Reverter","title":"Reverter a base de dados para um estado anterior operacional","confirm":"Tem a certeza que pretende reverter a base de dados para o estado de funcionamento anterior?"}}},"export_csv":{"user_archive_confirm":"Tem a certeza que deseja descarregar as suas mensagens?","success":"Exportação iniciada, será notificado através de mensagem assim que o processo estiver concluído.","failed":"A exportação falhou. Por favor verifique os registos dos logs.","rate_limit_error":"As mensagens podem ser descarregadas uma vez por dia. Por favor, tente novamente amanhã.","button_text":"Exportar","button_title":{"user":"Exportar lista total de utilizadores em formato CSV.","staff_action":"Exportar registo total das acções de início de sessão do pessoal em formato CSV.","screened_email":"Exportar lista total de emails selecionados em formato CSV.","screened_ip":"Exportar lista total de IP selecionados em formato CSV.","screened_url":"Exportar lista total de URL selecionados em formato CSV."}},"export_json":{"button_text":"Exportar"},"invite":{"button_text":"Enviar Convites","button_title":"Enviar Convites"},"customize":{"title":"Personalizar","long_title":"Personalizações do Sítio","css":"CSS","header":"Cabeçalho","top":"Topo","footer":"Rodapé","embedded_css":"CSS incorporado","head_tag":{"text":"\u003c/head\u003e","title":"HTML que será introduzido antes da tag \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML que será introduzido antes da tag \u003c/body\u003e"},"override_default":"Não incluir a folha de estilo por defeito","enabled":"Ativado?","preview":"pré-visualização","undo_preview":"remover pré-visualização","rescue_preview":"estilo por defeito","explain_preview":"Ver o sítio com esta folha de estilo personalizada","explain_undo_preview":"Voltar atrás para a atual folha de estilo personalizada ativa","explain_rescue_preview":"Ver o sítio com a folha de estilo por defeito","save":"Guardar","new":"Novo","new_style":"Novo Estilo","import":"Importar","import_title":"Selecione um ficheiro ou cole texto","delete":"Eliminar","delete_confirm":"Remover esta personalização?","about":"Modificar folha de estilo CSS e cabeçalhos HTML no sítio. Adicionar personalização para iniciar.","color":"Cor","opacity":"Opacidade","copy":"Copiar","email_templates":{"title":"Modelos de Email","subject":"Assunto","multiple_subjects":"Este modelo de email tem múltiplos assuntos.","body":"Corpo","none_selected":"Selecione um modelo de email para começar a editar.","revert":"Reverter Alterações","revert_confirm":"Tem a certeza que quer reverter as suas alterações?"},"css_html":{"title":"CSS/HTML","long_title":"Personalizações CSS e HTML"},"colors":{"title":"Cores","long_title":"Esquemas de Cores","about":"Modificar as cores usadas no sítio sem escrever CSS. Adicionar um esquema para iniciar.","new_name":"Novo Esquema de Cores","copy_name_prefix":"Cópia de","delete_confirm":"Apagar este esquema de cor?","undo":"desfazer","undo_title":"Desfazer as alterações a esta cor desde a última gravação.","revert":"reverter","revert_title":"Repor esta cor para o esquema de cor padrão do Discourse.","primary":{"name":"primária","description":"A maioria do texto, ícones, e margens."},"secondary":{"name":"secundária","description":"A principal cor de fundo, e cor do texto de alguns botões."},"tertiary":{"name":"terciária","description":"Hiperligações, alguns botões, notificações, e cores acentuadas."},"quaternary":{"name":"quaternária","description":"Hiperligações de navegação."},"header_background":{"name":"fundo do cabeçalho","description":"Cor de fundo do cabeçalho do sítio."},"header_primary":{"name":"cabeçalho primário","description":"Texto e ícones no cabeçalho do sítio."},"highlight":{"name":"destaque","description":"A cor de fundo de elementos destacados na página, tais como mensagens e tópicos."},"danger":{"name":"perigo","description":"Cor de destaque para ações como apagar mensagens e tópicos."},"success":{"name":"sucesso","description":"Usado para indicar que uma ação foi bem sucedida."},"love":{"name":"amor","description":"A cor do botão 'gosto'."}}},"email":{"title":"Emails","settings":"Configurações","templates":"Templates","preview_digest":"Pré-visualizar Resumo","sending_test":"A enviar Email de teste...","error":"\u003cb\u003eERRO\u003c/b\u003e - %{server_error}","test_error":"Occorreu um problema no envio do email de teste. Por favor verifique novamente as suas definições de email, verifique se o seu host não está a bloquear conexões de email, e tente novamente.","sent":"Enviado","skipped":"Ignorado","bounced":"Devolvida","received":"Recebido","rejected":"Rejeitado","sent_at":"Enviado em","time":"Tempo","user":"Utilizador","email_type":"Tipo de Email","to_address":"Endereço Para","test_email_address":"endereço de email para testar","send_test":"Enviar Email de Teste","sent_test":"enviado!","delivery_method":"Método de Entrega","preview_digest_desc":"Pré-visualizar o conteúdo dos emails de resumo enviados aos utilizadores inativos.","refresh":"Atualizar","format":"Formato","html":"html","text":"texto","last_seen_user":"Último Utilizador Visto:","reply_key":"Chave de Resposta","skipped_reason":"Ignorar Motivo","incoming_emails":{"from_address":"De","to_addresses":"Para","cc_addresses":"Cc","subject":"Assunto","error":"Erro","none":"Nenhum email de entrada encontrado.","modal":{"title":"Detalhes de emails recebidos.","error":"Erro","headers":"Cabeçalhos","subject":"Assunto","body":"Corpo","rejection_message":"Correio de rejeição"},"filters":{"from_placeholder":"de@exemplo.com","to_placeholder":"para@exemplo.com","cc_placeholder":"cc@exemplo.com","subject_placeholder":"Assunto...","error_placeholder":"Erro"}},"logs":{"none":"Nenhuns logs encontrados.","filters":{"title":"Filtrar","user_placeholder":"nome de utilizador","address_placeholder":"nome@exemplo.com","type_placeholder":"resumo, subscrever...","reply_key_placeholder":"chave de resposta","skipped_reason_placeholder":"motivo"}}},"logs":{"title":"Logs","action":"Ação","created_at":"Criado","last_match_at":"Última Correspondência","match_count":"Correspondência","ip_address":"IP","topic_id":"ID do Tópico","post_id":"ID da Mensagem","category_id":"ID da Categoria","delete":"Eliminar","edit":"Editar","save":"Guardar","screened_actions":{"block":"bloquear","do_nothing":"não fazer nada"},"staff_actions":{"title":"Ações do Pessoal","instructions":"Clique nos nomes de utilizadores e nas ações para filtrar a lista. Clique nas fotografias de perfil para ir para as páginas dos utilizadores.","clear_filters":"Mostrar Tudo","staff_user":"Utilizador do Pessoal","target_user":"Utilizador Destino","subject":"Assunto","when":"Quando","context":"Contexto","details":"Detalhes","previous_value":"Anterior","new_value":"Novo","diff":"Diferenças","show":"Exibir","modal_title":"Detalhes","no_previous":"Não há valor anterior.","deleted":"Não há nenhum valor novo. O registo foi removido.","actions":{"delete_user":"remover utilizador","change_trust_level":"modificar Nível de Confiança","change_username":"alterar nome de utilizador","change_site_setting":"alterar configurações do sítio","change_site_customization":"alterar personalização do sítio","delete_site_customization":"remover personalização do sítio","change_site_text":"alterar texto do sítio","suspend_user":"utilizador suspenso","unsuspend_user":"utilizador não suspenso","grant_badge":"conceder distintivo","revoke_badge":"revogar distintivo","check_email":"verificar email","delete_topic":"eliminar tópico","delete_post":"eliminar mensagem","impersonate":"personificar","anonymize_user":"tornar utilizador anónimo","roll_up":"agregar blocos IP","change_category_settings":"alterar configurações de categoria","delete_category":"eliminar categoria","create_category":"criar categoria","block_user":"utilizador bloqueado","unblock_user":"Desbloquear utilizador","grant_admin":"conceder administração","revoke_admin":"revogar administração","grant_moderation":"conceder moderação","revoke_moderation":"revogar moderação","backup_operation":"operação de cópia de segurança","deleted_tag":"etiqueta removida","renamed_tag":"etiqueta renomeada"}},"screened_emails":{"title":"Emails Filtrados","description":"Quando alguém tenta criar uma nova conta, os seguintes endereços de email serão verificados e o registo será bloqueado, ou outra ação será executada.","email":"Endereço de Email","actions":{"allow":"Permitir"}},"screened_urls":{"title":"URLs Filtrados","description":"Os URLs listados aqui foram usados em mensagens de utilizadores que foram identificados como spammers.","url":"URL","domain":"Domínio"},"screened_ips":{"title":"IPs Filtrados","description":"Endereços IP que estão sob observação. Utilize \"Permitir\" para aprovar os endereços IP.","delete_confirm":"Tem a certeza que quer remover esta regra para %{ip_address}?","roll_up_confirm":"Tem a certeza que quer trazer os endereços IP frequentemente vistoriados para as sub-redes?","rolled_up_some_subnets":"Interdições das sub-redes %{subnets} inseridas com sucesso.","rolled_up_no_subnet":"Não há nada para atualizar.","actions":{"block":"Bloquear","do_nothing":"Permitir","allow_admin":"Permitir Administração"},"form":{"label":"Novo:","ip_address":"Endereço IP","add":"Adicionar","filter":"Pesquisar"},"roll_up":{"text":"Adicionar","title":"Cria interdições de sub-redes se existir pelo menos 'min_ban_entries_for_roll_up' entradas."}},"logster":{"title":"Registo de Erros em Logs"}},"impersonate":{"title":"Personificar","help":"Utilize este ferramenta de forma a personificar uma conta de utilizador para fins de depuração. Terá de encerrar a sessão assim que terminar.","not_found":"Esse utilizador não foi encontrado.","invalid":"Pedimos desculpa, não pode personificar esse utilizador."},"users":{"title":"Utilizadores","create":"Adicionar Utilizador da Admnistração","last_emailed":"Último email enviado","not_found":"Pedimos desculpa, esse nome de utilizador não existe no nosso sistema.","id_not_found":"Pedimos desculpa, esse id de utilizador não existe no nosso sistema.","active":"Ativo","show_emails":"Mostrar Emails","nav":{"new":"Novo","active":"Ativo","pending":"Pendente","staff":"Pessoal","suspended":"Suspenso","blocked":"Bloqueado","suspect":"Suspeito"},"approved":"Aprovado?","approved_selected":{"one":"aprovar utilizador","other":"aprovar utilizadores ({{count}})"},"reject_selected":{"one":"rejeitar utilizador","other":"rejeitar utilizadores ({{count}})"},"titles":{"active":"Utilizadores Ativos","new":"Utilizadores Novos","pending":"Utilizadores com Confirmação Pendente","newuser":"Utilizadores no Nível de Confiança 0 (Novo Utilizador)","basic":"Utilizadores no Nível de Confiança 1 (Utilizador Básico)","member":"Utilizadores no Nível de Confiança 2 (Membro)","regular":"Utilizadores no Nível de Confiança 3 (Habitual)","leader":"Utilizadores no Nível de Confiança 4 (Líder)","staff":"Pessoal","admins":"Utilizadores da Administração","moderators":"Moderadores","blocked":"Utilizadores Bloqueados","suspended":"Utilizadores Suspensos","suspect":"Utilizadores Suspeitos"},"reject_successful":{"one":"1 utilizador foi rejeitado com sucesso.","other":"%{count} utilizadores foram rejeitados com sucesso."},"reject_failures":{"one":"Falha ao rejeitar 1 utilizador.","other":"Falha ao rejeitar %{count} utilizadores."},"not_verified":"Não verificado","check_email":{"title":"Revelar o endereço de email deste utilizador","text":"Mostrar"}},"user":{"suspend_failed":"Ocorreu um erro ao suspender este utilizador {{error}}","unsuspend_failed":"Ocorreu um erro ao retirar a suspensão deste utilizador {{error}}","suspend_duration":"Durante quanto tempo o utilizador estará suspenso?","suspend_duration_units":"(dias)","suspend_reason_label":"Qual é o motivo da sua suspensão? Este texto \u003cb\u003eestará visível para todos\u003c/b\u003e na página do perfil deste utilizador, e será mostrada ao utilizador quando tentar iniciar sessão. Mantenha-o breve.","suspend_reason":"Motivo","suspended_by":"Suspendido por","delete_all_posts":"Eliminar todas as mensagens","suspend":"Suspender","unsuspend":"Retirar a suspensão","suspended":"Suspendido?","moderator":"Moderador?","admin":"Administração?","blocked":"Bloqueado?","staged":"Temporário?","show_admin_profile":"Administração","edit_title":"Editar Título","save_title":"Guardar Título","refresh_browsers":"Forçar atualização da página no browser","refresh_browsers_message":"Mensagem enviada para todos os clientes!","show_public_profile":"Mostrar Perfil Público","impersonate":"Personificar","ip_lookup":"Pesquisa de IP","log_out":"Terminar Sessão","logged_out":"Sessão do utilizador encerrada em todos os dispositivos","revoke_admin":"Revogar Administração","grant_admin":"Conceder Administração","revoke_moderation":"Revogar Moderação","grant_moderation":"Conceder Moderação","unblock":"Desbloquear","block":"Bloquear","reputation":"Reputação","permissions":"Permissões","activity":"Atividade","like_count":"Gostos Dados / Recebidos","last_100_days":"nos últimos 100 dias","private_topics_count":"Tópicos Privados","posts_read_count":"Mensagens lidas","post_count":"Mensagens criadas","topics_entered":"Tópicos Visualizados","flags_given_count":"Sinalizações Dadas","flags_received_count":"Sinalizações Recebidas","warnings_received_count":"Avisos Recebidos","flags_given_received_count":"Sinalizações Dadas / Recebidas","approve":"Aprovar","approved_by":"aprovado por","approve_success":"Utilizador aprovado e email enviado com instruções de ativação.","approve_bulk_success":"Sucesso! Todos os utilizadores selecionados foram aprovados e notificados.","time_read":"Tempo de leitura","anonymize":"Tornar utilizador anónimo","anonymize_confirm":"Tem a CERTEZA que deseja tornar esta conta anónima? Isto irá alterar o nome de utilizador e email e repor todas as informações de perfil.","anonymize_yes":"Sim, tornar esta conta anónima","anonymize_failed":"Ocorreu um problema ao tornar esta conta anónima.","delete":"Eliminar Utilizador","delete_forbidden_because_staff":"Administradores e moderadores não podem ser eliminados.","delete_posts_forbidden_because_staff":"Não é possível eliminar todas as mensagens dos administradores e moderadores.","delete_forbidden":{"one":"Utilizadores não podem ser eliminados se tiverem mensagens. Apague todas as mensagens antes de eliminar o utilizador. (Mensagens com mais de %{count} dia de existência não podem ser eliminadas.)","other":"Utilizadores não podem ser eliminados se tiverem mensagens. Apague todas as mensagens antes de eliminar o utilizador. (Mensagens com mais de %{count} dias de existência não podem ser eliminadas.)"},"cant_delete_all_posts":{"one":"Não é possível eliminar todas as mensagens. Algumas mensagens existem há mais de %{count} dia. (A configuração delete_user_max_post_age.)","other":"Não é possível eliminar todas as mensagens. Algumas mensagens existem há mais de %{count} dias. (A configuração delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Não é possível eliminar todas as mensagens porque o utilizador tem mais de 1 mensagens. (delete_all_posts_max)","other":"Não é possível eliminar todas as mensagens porque o utilizador tem mais de %{count} mensagens. (delete_all_posts_max)"},"delete_confirm":"Tem a CERTEZA que deseja eliminar este utilizador? Esta ação é permanente!","delete_and_block":"Eliminar e \u003cb\u003ebloquear\u003cb\u003e este endereço de email e IP","delete_dont_block":"Apenas eliminar","deleted":"O utilizador foi eliminado.","delete_failed":"Ocorreu um erro ao eliminar o utilizador. Certifique-se de que todas as suas mensagens foram apagadas antes de tentar eliminá-lo.","send_activation_email":"Enviar Email de Ativação","activation_email_sent":"Um email de ativação foi enviado.","send_activation_email_failed":"Ocorreu um problema ao enviar um novo email de ativação. %{error}","activate":"Ativar Conta","activate_failed":"Ocorreu um problema ao ativar o utilizador.","deactivate_account":"Desativar Conta","deactivate_failed":"Ocorreu um problema ao desativar o utilizador.","unblock_failed":"Ocorreu um problema ao desbloquear o utilizador.","block_failed":"Ocorreu um problema ao bloquear o utilizador.","block_confirm":"Tem a certeza que pretende bloquear este utilizador? Este não será capaz de criar novos tópicos ou mensagens.","block_accept":"Sim, bloquear este utilizador","deactivate_explanation":"Um utilizador desativado deve revalidar o seu email.","suspended_explanation":"Um utilizador suspenso não pode iniciar sessão.","block_explanation":"Um utilizador bloqueado não pode publicar mensagens ou iniciar tópicos.","trust_level_change_failed":"Ocorreu um problema ao alterar o Nível de Confiança do utilizador.","suspend_modal_title":"Utilizador Suspenso","trust_level_2_users":"Utilizadores no Nível de Confiança 2","trust_level_3_requirements":"Requisitos do Nível de Confiança 3","trust_level_locked_tip":"o Nível de Confiança está bloqueado, o sistema não irá promover ou despromover o utilizador","trust_level_unlocked_tip":"o Nível de Confiança está desbloqueado, o sistema poderá promover ou despromover o utilizador","lock_trust_level":"Bloquear Nível de Confiança","unlock_trust_level":"Desbloquear Nível de Confiança","tl3_requirements":{"title":"Requisitos para o Nível de Confiança 3","value_heading":"Valor","requirement_heading":"Requisito","visits":"Visitas","days":"dias","topics_replied_to":"Tópicos com Respostas","topics_viewed":"Tópicos Visualizados","topics_viewed_all_time":"Tópicos Visualizados (desde sempre)","posts_read":"Mensagens lidas","posts_read_all_time":"Mensagens lidas (desde sempre)","flagged_posts":"Mensagens Sinalizadas","flagged_by_users":"Utilizadores Que Sinalizaram","likes_given":"Gostos Dados","likes_received":"Gostos Recebidos","likes_received_days":"Gostos recebidos: dias únicos","likes_received_users":"Gostos recebidos: utilizadores únicos","qualifies":"Qualifica-se para Nível de Confiança 3.","does_not_qualify":"Não se qualifica para o nível de confiança 3.","will_be_promoted":"Será promovido brevemente.","will_be_demoted":"Será despromovido brevemente.","on_grace_period":"Atualmente no período de carência da promoção, não será despromovido.","locked_will_not_be_promoted":"Nível de Confiança bloqueado. Nunca será promovido.","locked_will_not_be_demoted":"Nível de Confiança bloqueado. Nunca será despromovido."},"sso":{"title":"Inscrição Única","external_id":"ID Externo","external_username":"Nome de Utilizador","external_name":"Nome","external_email":"Email","external_avatar_url":"URL da Fotografia de Perfil"}},"user_fields":{"title":"Campos de utilizador","help":"Adicione campos que os seus utilizadores poderão preencher.","create":"Criar Campo de Utilizador","untitled":"Sem título","name":"Nome do Campo","type":"Tipo do Campo","description":"Descrição do Campo","save":"Guardar","edit":"Editar","delete":"Eliminar","cancel":"Cancelar","delete_confirm":"Tem a certeza que quer eliminar esse campo de utilizador?","options":"Opções","required":{"title":"Obrigatório na inscrição?","enabled":"obrigatório","disabled":"não obrigatório"},"editable":{"title":"Editável depois da inscrição?","enabled":"editável","disabled":"não editável"},"show_on_profile":{"title":"Exibir no perfil público?","enabled":"exibido no perfil","disabled":"não exibido no perfil"},"show_on_user_card":{"title":"Mostrar no cartão de utilizador?","enabled":"mostrar no cartão de utilizador","disabled":"não apresentado no cartão de utilizador"},"field_types":{"text":"Campo de Texto","confirm":"Confirmação","dropdown":"Suspenso"}},"site_text":{"description":"Pode personalizar qualquer texto no seu fórum. Por favor comece por pesquisar abaixo:","search":"Pesquisar o texto que gostaria de editar","title":"Conteúdo do Texto","edit":"editar","revert":"Reverter Alterações","revert_confirm":"Tem a certeza que quer reverter as suas alterações?","go_back":"De volta à Pesquisa","recommended":"Recomendamos personalizar o seguinte texto para que se aplique às suas necessidades.","show_overriden":"Apenas mostrar valores alterados"},"site_settings":{"show_overriden":"Apenas mostrar valores alterados","title":"Configurações","reset":"repor","none":"nenhum","no_results":"Não foi encontrado nenhum resultado.","clear_filter":"Limpar","add_url":"adicionar URL","add_host":"adicionar host","categories":{"all_results":"Todos","required":"Necessário","basic":"Configuração Básica","users":"Utilizadores","posting":"A publicar","email":"Email","files":"Ficheiros","trust":"Níveis de Confiança","security":"Segurança","onebox":"Caixa Única","seo":"SEO","spam":"Spam","rate_limits":"Limites de Classificação","developer":"Programador","embedding":"Incorporação","legal":"Legal","uncategorized":"Outro","backups":"Fazer Cópias de Segurança","login":"Iniciar Sessão","plugins":"Plugins","user_preferences":"Preferências do Utilizador","tags":"Etiquetas"}},"badges":{"title":"Distintivos","new_badge":"Novo Distintivo","new":"Novo","name":"Nome","badge":"Distintivo","display_name":"Exibir Nome","description":"Descrição","long_description":"Descrição longa","badge_type":"Tipo de Distintivo","badge_grouping":"Grupo","badge_groupings":{"modal_title":"Agrupamento de Distintivos"},"granted_by":"Concedido Por","granted_at":"Concedido Em","reason_help":"(Uma hiperligação para uma mensagem ou tópico)","save":"Guardar","delete":"Apagar","delete_confirm":"Tem a certeza que quer eliminar este distintivo?","revoke":"Revogar","reason":"Motivo","expand":"Expandir \u0026hellip;","revoke_confirm":"Tem a certeza que quer revogar este distintivo?","edit_badges":"Editar Distintivos","grant_badge":"Conceder Distintivo","granted_badges":"Distintivos Concedidos","grant":"Conceder","no_user_badges":"%{name} não recebeu qualquer distintivo.","no_badges":"Não existe qualquer distintivo que possa ser concedido.","none_selected":"Selecione um distintivo para iniciar","allow_title":"Permitir o uso de distintivos como título","multiple_grant":"Pode ser concedido múltiplas vezes","listable":"Mostrar distintivo na página pública de distintivos","enabled":"Ativar distintivos","icon":"Ícone","image":"Imagem","icon_help":"Use uma classe Font Awesome ou um URL para uma imagem","query":"\"Query\" de Distintivo (SQL)","target_posts":"\"Query\" direcionada a mensagens","auto_revoke":"Executar diariamente a \"query\" de revogação ","show_posts":"Mostrar mensagens de concessão de distintivo na página de distintivos","trigger":"Acionar","trigger_type":{"none":"Atualizado diariamente","post_action":"Quando um utilizador atua numa mensagem","post_revision":"Quando um utilizador edita ou cria uma mensagem","trust_level_change":"Quando um utilizador muda de Nível de Confiança","user_change":"Quando um utilizador é editado ou criado","post_processed":"Depois de uma mensagem ser processada"},"preview":{"link_text":"Pré-visualizar distintivos concedidos","plan_text":"Pré-visualizar com plano de consulta","modal_title":"Pré-visualização da \"Query\" de Distintivo","sql_error_header":"Ocorreu um erro com a consulta.","error_help":"Veja as seguintes hiperligações para obter ajuda com \"queries\" de distintivos","bad_count_warning":{"header":"AVISO!","text":"Estão em falta amostras de concessão. Isto acontece quando a \"query\" do sistema de distintivos devolve IDs de nomes de utilizador ou IDs de mensagens que não existem. Isto pode causar resultados inesperados futuramente, sendo que deverá rever a sua \"query\"."},"no_grant_count":"Nenhuns distintivos a atribuir.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e distintivo a atribuir.","other":"\u003cb\u003e%{count}\u003c/b\u003e distintivos a atribuir."},"sample":"Amostra:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e pela mensagem em %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e pela mensagem em %{link} às \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e às \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Adicionar novo emoji que irá estar disponível para todos. (PROTIP: arraste múltiplos ficheiros de uma só vez)","add":"Adicionar Novo Emoji","name":"Nome","image":"Imagem","delete_confirm":"Tem a certeza que deseja eliminar o emoji :%{name}:?"},"embedding":{"get_started":"Se deseja incorporar o Discourse noutro sítio, comece por adicionar o seu servidor.","confirm_delete":"Tem certeza que deseja eliminar este servidor?","sample":"Utilize o seguinte código HTML no seu sítio para criar e incorporar tópicos do discourse. Substitua \u003cb\u003eREPLACE_ME\u003c/b\u003e pelo URL canónico da página onde está a incorporá-los.","title":"Incorporação","host":"Servidores Permitidos","edit":"editar","category":"Mensagem para Categoria","add_host":"Adicionar Servidor","settings":"Configurações de Incorporação","feed_settings":"Configurações do Feed","feed_description":"Fornecer um fed RSS/ATOM para o seu sítio pode melhorar a habilidade do Discourse de importar o seu conteúdo.","crawling_settings":"Configurações de Rastreio","crawling_description":"Quando o Discourse cria tópicos para as suas mensagens, se nenhum feed RSS/ATOM está presente o Discourse irá tentar analisar o seu conteúdo fora do seu HTML. Algumas vezes pode ser um desafio extrair o seu conteúdo, por isso temos a habilidade de especificar regras CSS para tornar a extração mais fácil. ","embed_by_username":"Nome de uilizador para criação do tópico","embed_post_limit":"Número máximo de mensagens a incorporar","embed_username_key_from_feed":"Chave para puxar o nome de utilizador discouse do feed","embed_truncate":"Truncar as mensagens incorporadas","embed_whitelist_selector":"Seletor CSS para elementos que são permitidos nas incorporações","embed_blacklist_selector":"Seletor CSS para elementos que são removidos das incorporações","feed_polling_enabled":"Importar mensagens através de RSS/ATOM","feed_polling_url":"URL do feed RSS/ATOM para rastreio","save":"Guardar Configurações de Incorporação"},"permalink":{"title":"Hiperligações Permanentes","url":"URL","topic_id":"ID do Tópico","topic_title":"Tópico","post_id":"ID da Mensagem","post_title":"Mensagem","category_id":"ID da Categoria","category_title":"Categoria","external_url":"URL Externo","delete_confirm":"Tem a certeza que deseja eliminar esta hiperligação permanente?","form":{"label":"Novo:","add":"Adicionar","filter":"Pesquisar (URL ou URL Externo)"}}}}},"en":{"js":{"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"mailing_list_mode":{"many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","watched_topics_link":"Show watched topics","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","invited":{"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To"}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}."},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e"},"search":{"too_short":"Your search term is too short.","context":{"category":"Search the #{{category}} category"}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."}},"post":{"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"}}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"logs":{"staff_actions":{"actions":{"revoke_email":"revoke email"}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'pt';
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
//! locale : portuguese (pt)
//! author : Jefferson : https://github.com/jalex79

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var pt = moment.defineLocale('pt', {
        months : 'Janeiro_Fevereiro_Março_Abril_Maio_Junho_Julho_Agosto_Setembro_Outubro_Novembro_Dezembro'.split('_'),
        monthsShort : 'Jan_Fev_Mar_Abr_Mai_Jun_Jul_Ago_Set_Out_Nov_Dez'.split('_'),
        weekdays : 'Domingo_Segunda-Feira_Terça-Feira_Quarta-Feira_Quinta-Feira_Sexta-Feira_Sábado'.split('_'),
        weekdaysShort : 'Dom_Seg_Ter_Qua_Qui_Sex_Sáb'.split('_'),
        weekdaysMin : 'Dom_2ª_3ª_4ª_5ª_6ª_Sáb'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D [de] MMMM [de] YYYY',
            LLL : 'D [de] MMMM [de] YYYY HH:mm',
            LLLL : 'dddd, D [de] MMMM [de] YYYY HH:mm'
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
            past : 'há %s',
            s : 'segundos',
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
        ordinal : '%dº',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return pt;

}));
moment.fn.shortDateNoYear = function(){ return this.format('DD MMM'); };
moment.fn.shortDate = function(){ return this.format('DD MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('DD de MMMM de YYYY hh:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
