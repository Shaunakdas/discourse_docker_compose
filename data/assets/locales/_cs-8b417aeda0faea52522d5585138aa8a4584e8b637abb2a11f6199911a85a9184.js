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
I18n._compiledMFs = {"posts_likes_MF" : function(d){
var r = "";
r += "Toto téma má ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 příspěvek";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " příspěvků";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "s velkým poměrem líbí se na příspěvek";
return r;
},
"med" : function(d){
var r = "";
r += "s velmi velkým poměrem líbí se na příspěvek";
return r;
},
"high" : function(d){
var r = "";
r += "s extrémně velkým poměrem líbí se na příspěvek";
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

MessageFormat.locale.cs = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n == 2 || n == 3 || n == 4) {
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
I18n.translations = {"cs":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajty","other":"bajtů"},"gb":"GB","kb":"kB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"H:mm","timeline_date":"MMM YYYY","long_no_year":"D. MMMM H:mm","long_no_year_no_time":"D. MMMM","full_no_year_no_time":"D. MMMM","long_with_year":"D. M. YYYY, H:mm","long_with_year_no_time":"D. M. YYYY","full_with_year_no_time":"D. MMMM YYYY","long_date_with_year":"D. M. YYYY, H:mm","long_date_without_year":"D. MMMM, H:mm","long_date_with_year_without_time":"D. M. YYYY","long_date_without_year_with_linebreak":"D. MMMM \u003cbr/\u003eH:mm","long_date_with_year_with_linebreak":"D. M. YYYY \u003cbr/\u003eH:mm","wrap_ago":"před %{date}","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","few":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","few":"%{count}s","other":"%{count}s"},"x_minutes":{"one":"1m","few":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"1h","few":"%{count}h","other":"%{count}h"},"x_days":{"one":"1d","few":"%{count}d","other":"%{count}d"},"about_x_years":{"one":"1r","few":"%{count}r","other":"%{count}let"},"over_x_years":{"one":"\u003e 1r","few":"\u003e %{count}r","other":"\u003e %{count}let"},"almost_x_years":{"one":"1r","few":"%{count}r","other":"%{count}let"},"date_month":"D. MMMM","date_year":"MMMM YYYY"},"medium":{"x_minutes":{"one":"1 minuta","few":"%{count} minuty","other":"%{count} minut"},"x_hours":{"one":"1 hodina","few":"%{count} hodiny","other":"%{count} hodin"},"x_days":{"one":"1 den","few":"%{count} dny","other":"%{count} dní"},"date_year":"D. M. YYYY"},"medium_with_ago":{"x_minutes":{"one":"před 1 minutou","few":"před %{count} minutami","other":"před %{count} minutami"},"x_hours":{"one":"před 1 hodinou","few":"před %{count} hodinami","other":"před %{count} hodinami"},"x_days":{"one":"před 1 dnem","few":"před %{count} dny","other":"před %{count} dny"}},"later":{"x_days":{"one":"za 1 den","few":"za %{count} dny","other":"za %{count} dní"},"x_months":{"one":"za 1 měsíc","few":"za %{count} měsíce","other":"za %{count} měsíců"},"x_years":{"one":"za 1 rok","few":"za %{count} roků","other":"za %{count} let"}},"previous_month":"Předchozí měsíc","next_month":"Další měsíc"},"share":{"topic":"sdílet odkaz na toto téma","post":"příspěvek #%{postNumber}","close":"zavřít","twitter":"sdílet odkaz na Twitteru","facebook":"sdílet odkaz na Facebooku","google+":"sdílet odkaz na Google+","email":"odeslat odkaz emailem"},"action_codes":{"public_topic":"Téma zveřejněno %{when}","private_topic":"Téma změněno na soukromé %{when}","split_topic":"rozděl toto téma %{when}","invited_user":"%{who} pozván %{when}","invited_group":"%{who} pozvána %{when}","removed_user":"%{who} smazán %{when}","removed_group":"%{who} smazána %{when}","autoclosed":{"enabled":"uzavřeno %{when}","disabled":"otevřeno %{when}"},"closed":{"enabled":"uzavřeno %{when}","disabled":"otevřeno %{when}"},"archived":{"enabled":"archivováno %{when}","disabled":"odarchivováno %{when}"},"pinned":{"enabled":"připnuto %{when}","disabled":"odepnuto %{when}"},"pinned_globally":{"enabled":"globálně přinuto %{when}","disabled":"odepnuto %{when}"},"visible":{"enabled":"uvedeno %{when}","disabled":"neuvedeno %{when}"}},"topic_admin_menu":"akce administrátora tématu","emails_are_disabled":"Všechny odchozí emaily byly administrátorem vypnuty. Žádné odchozí emaily nebudou odeslány.","bootstrap_mode_enabled":"Aby se váš web jednodušeji rozjel, nachází se v režimu bootstrap. Všichni noví uživatelé začínají s důveryhodností 1 a mají povolené denní odesílání souhrnných emailů. Tento režim se automaticky vypne, jakmile počet registrovaných uživatelů překročí %{min_users}.","bootstrap_mode_disabled":"Režim bootstrap bude deaktivován v následujících 24 hodinách.","s3":{"regions":{"us_east_1":"Východ USA (S. Virginie)","us_west_1":"Západ USA (S. Kalifornie)","us_west_2":"Západ USA (Oregon)","us_gov_west_1":"AWS GovCloud (USA)","eu_west_1":"EU (Irsko)","eu_central_1":"EU (Frankfurt)","sa_east_1":"Jižní Amerika (Sao Paulo)"}},"edit":"upravit název a kategorii příspěvku","not_implemented":"Tato funkce ještě nebyla naprogramována, omlouváme se.","no_value":"Ne","yes_value":"Ano","generic_error":"Bohužel nastala chyba.","generic_error_with_reason":"Nastala chyba: %{error}","sign_up":"Registrace","log_in":"Přihlásit se","age":"Věk","joined":"Účet vytvořen","admin_title":"Administrace","flags_title":"Nahlášení","show_more":"zobrazit více","show_help":"volby","links":"Odkazy","links_lowercase":{"one":"odkaz","few":"odkazy","other":"odkazů"},"faq":"FAQ","guidelines":"Pokyny","privacy_policy":"Ochrana soukromí","privacy":"Soukromí","terms_of_service":"Podmínky služby","mobile_view":"Mobilní verze","desktop_view":"Plná verze","you":"Vy","or":"nebo","now":"právě teď","read_more":"číst dále","more":"Více","less":"Méně","never":"nikdy","every_30_minutes":"každých 30 minut","every_hour":"každou hodinu","daily":"denně","weekly":"týdně","every_two_weeks":"jednou za 14 dní","every_three_days":"každé tři dny","max_of_count":"max z","alternation":"nebo","character_count":{"one":"{{count}} znak","few":"{{count}} znaky","other":"{{count}} znaků"},"suggested_topics":{"title":"Doporučená témata","pm_title":"Doporučené zprávy"},"about":{"simple_title":"O fóru","title":"O %{title}","stats":"Statistiky Webu","our_admins":"Naši Admini","our_moderators":"Naši Moderátoři","stat":{"all_time":"Za celou dobu","last_7_days":"Posledních 7 dní","last_30_days":"Posledních 30 dní"},"like_count":"Líbí se","topic_count":"Témata","post_count":"Příspěvky","user_count":"Noví uživatelé","active_user_count":"Aktivní uživatelé","contact":"Kontaktujte nás","contact_info":"V případě kritické chyby nebo urgentní záležitosti ovlivňující tuto stránku nás prosím kontaktujte na %{contact_info}."},"bookmarked":{"title":"Záložka","clear_bookmarks":"Odstranit záložky","help":{"bookmark":"Kliknutím vložíte záložku na první příspěvek tohoto tématu","unbookmark":"Kliknutím odstraníte všechny záložky v tématu"}},"bookmarks":{"not_logged_in":"Pro přidání záložky se musíte přihlásit.","created":"Záložka byla přidána.","not_bookmarked":"Tento příspěvek jste již četli. Klikněte pro přidání záložky.","last_read":"Toto je váš poslední přečtený příspěvek. Klikněte pro přidání záložky.","remove":"Odstranit záložku","confirm_clear":"Opravdu chcete odstranit všechny záložky z tohoto tématu?"},"topic_count_latest":{"one":"{{count}} nové nebo upravené téma.","few":"{{count}} nová nebo upravená témata.","other":"{{count}} nových nebo upravených témat."},"topic_count_unread":{"one":"{{count}} nepřečtené téma.","few":"{{count}} nepřečtená témata.","other":"{{count}} nepřečtených témat."},"topic_count_new":{"one":"{{count}} nové téma.","few":"{{count}} nová témata.","other":"{{count}} nových témat."},"click_to_show":"Klikněte pro zobrazení.","preview":"ukázka","cancel":"zrušit","save":"Uložit změny","saving":"Ukládám...","saved":"Uloženo!","upload":"Obrázek","uploading":"Nahrávám...","uploading_filename":"Nahrávání {{filename}}...","uploaded":"Nahráno!","enable":"Zapnout","disable":"Vypnout","undo":"Zpět","revert":"Vrátit","failed":"Selhání","switch_to_anon":"Vstoupit do anonymního módu","switch_from_anon":"Opustit anonymní mód","banner":{"close":"Odmítnout tento banner.","edit":"Editujte tento banner \u003e\u003e"},"choose_topic":{"none_found":"Žádná témata nenalezena.","title":{"search":"Hledat téma podle názvu, URL nebo ID:","placeholder":"sem napište název tématu"}},"queue":{"topic":"Téma:","approve":"Schválit","reject":"Odmítnout","delete_user":"Smažat uživatele","title":"Potřebuje schválení","none":"Žádné příspěvky ke kontrole.","edit":"Upravit","cancel":"Zrušit","view_pending":"zobrazit příspěvky čekající na schválení","has_pending_posts":{"one":"Toto téma má 1 příspěvek, který čeká na schválení.","few":"Toto téma má \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které čekají na schválení.","other":"Toto téma má \u003cb\u003e{{count}}\u003c/b\u003e příspěvků, které čekají na schválení."},"confirm":"Uložit změny","delete_prompt":"Jste si jistí, že chcete smazat uživatele \u003cb\u003e%{username}\u003c/b\u003e? Tímto smažete všechny jejich příspěvky a zablokujete jejich emailovou a IP addresu.","approval":{"title":"Příspěvek potřebuje schválení","description":"Obdrželi jsme váš příspěvek, ale musí být před zveřejněním schválen moderátorem. Buďte trpěliví.","pending_posts":{"one":"Máte \u003cstrong\u003e1\u003c/strong\u003e příspěvek ke schválení.","few":"Máte \u003cstrong\u003e{{count}}\u003c/strong\u003e příspěvků ke schválení.","other":"Máte \u003cstrong\u003e{{count}}\u003c/strong\u003e příspěvků ke schválení."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e zaslal \u003ca href='{{topicUrl}}'\u003etéma\u003c/a\u003e","you_posted_topic":"Zaslal jste \u003ca href='{{topicUrl}}'\u003etéma\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpověděl na příspěvek \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"Odpověděl jste na příspěvek \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e přispěl do \u003ca href='{{topicUrl}}'\u003etématu\u003c/a\u003e","you_replied_to_topic":"Přispěl jste do \u003ca href='{{topicUrl}}'\u003etématu\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e zmínil uživatele \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003evás\u003c/a\u003e zmínil","you_mentioned_user":"Zmínil jste uživatele \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Příspěvěk od \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Odesláno \u003ca href='{{userUrl}}'\u003evámi\u003c/a\u003e","sent_by_user":"Posláno uživatelem \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Posláno \u003ca href='{{userUrl}}'\u003evámi\u003c/a\u003e"},"directory":{"filter_name":"Filtrovat podle uživatelského jména","title":"Uživatelé","likes_given":"Rozdáno","likes_received":"Obdrženo","topics_entered":"Zobrazeno","topics_entered_long":"Zobrazeno témat","time_read":"Čas strávený čtením","topic_count":"Témata","topic_count_long":"Témat vytvořeno","post_count":"Odpovědi","post_count_long":"Odpovědí","no_results":"Žádné výsledky","days_visited":"Návštěv","days_visited_long":"Dní navštíveno","posts_read":"Přečteno","posts_read_long":"Příspěvků přečteno","total_rows":{"one":"1 uživatel","few":"%{count} uživatelé","other":"%{count} uživatelů"}},"groups":{"empty":{"posts":"V této skupině není od žádného člena ani jeden příspěvek.","members":"V této skupině není žádny uživatel.","mentions":"Tato skupina nebyla ještě @zmíněna.","messages":"Pro tuto skupinu není žádná zpráva.","topics":"V této skupině není od žádného člena ani jedno téma."},"add":"Přidat","selector_placeholder":"Přidat členy","owner":"Vlastník","visible":"Skupina je viditelná pro všechny uživatele","title":{"one":"skupina","few":"skupiny","other":"skupiny"},"members":"Členové","topics":"Témata","posts":"Odpovědi","mentions":"Zmínění","messages":"Zprávy","alias_levels":{"title":"Kdo může do této skupiny psát zprávy a @zmiňovat ji?","nobody":"Nikdo","only_admins":"Pouze správci","mods_and_admins":"Pouze moderátoři a správci","members_mods_and_admins":"Pouze členové skupiny, moderátoři a správci","everyone":"Kdokoliv"},"trust_levels":{"title":"Automaticky přidělená úroveň důvěryhodnosti členům když jsou přidáni: ","none":"Žádná"},"notifications":{"watching":{"title":"Hlídané","description":"Budete informováni o každém novém příspěvku v každné zprávě a také se vám zobrazí počet nepřečtených příspěvků."},"watching_first_post":{"title":"Hlídané první příspěvky","description":"Budete informováni o prvním novém příspěvku v každém novém tématu vytvořeném v této skupině."},"tracking":{"title":"Sledování","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek a zobrazí se vám počet nových odpovědí."},"regular":{"title":"Normalní","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"muted":{"title":"Ztišený","description":"Nikdy nedostanete oznámení o nových tématech v této skupině."}}},"user_action_groups":{"1":"Rozdaných 'líbí se'","2":"Obdržených 'líbí se'","3":"Záložky","4":"Témata","5":"Odpovědi","6":"Odezva","7":"Zmínění","9":"Citace","11":"Editace","12":"Odeslané zprávy","13":"Přijaté zprávy","14":"Čeká na schválení"},"categories":{"all":"všechny kategorie","all_subcategories":"vše","no_subcategory":"žádné","category":"Kategorie","category_list":"Zobrazit seznam kategorií","reorder":{"title":"Přeřadit kategorie","title_long":"Přeorganizovat seznam kategorií","fix_order":"Zafixovat umístění","fix_order_tooltip":"Ne všechny kategorie mají jedinečné číslo umístěni, což může způsobovat nečekané následky.","save":"Uložit pořadí","apply_all":"Použít","position":"Umístění"},"posts":"Příspěvky","topics":"Témata","latest":"Aktuální","latest_by":"latest by","toggle_ordering":"Přepnout editaci pořadí","subcategories":"Podkategorie","topic_stat_sentence":{"one":"%{count} nové téma za posledních %{unit}.","few":"%{count} nová témata za posledních %{unit}.","other":"%{count} nových témat za posledních %{unit}."}},"ip_lookup":{"title":"Vyhledávání podle IP adresy","hostname":"Hostname","location":"Lokace","location_not_found":"(neznámá)","organisation":"Organizace","phone":"Telefon","other_accounts":"Další účty s touto IP adresou:","delete_other_accounts":"Smazat","username":"uživatelské jméno","trust_level":"Důvěra","read_time":"čas k přečtení","topics_entered":"témat zadáno","post_count":"počet příspěvků","confirm_delete_other_accounts":"Určitě chcete smazat tyto účty?"},"user_fields":{"none":"(zvolit možnost)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Ignorovat","edit":"Upravit nastavení","download_archive":"Stáhnout moje příspěvky","new_private_message":"Nová zpráva","private_message":"Zpráva","private_messages":"Zprávy","activity_stream":"Aktivita","preferences":"Nastavení","expand_profile":"Rozšířit","bookmarks":"Záložky","bio":"O mně","invited_by":"Pozvánka od","trust_level":"Důvěryhodnost","notifications":"Oznámení","statistics":"Statistiky","desktop_notifications":{"label":"Upozornění na desktopu","not_supported":"Tento prohlížeč nepodporuje upozornění. Omlouváme se.","perm_default":"Vypnout upozornění.","perm_denied_btn":"Povolení zamítnuto","perm_denied_expl":"Máte zakázané upozornění. Povolte upozornění v nastavení vašeho prohlížeče.","disable":"Vypnout upozornění","enable":"Povolit upozornění","each_browser_note":"Poznámka: Musíš změnit tuto volbu v každém prohlížeči, který používáš."},"dismiss_notifications":"Odbýt vše","dismiss_notifications_tooltip":"Označit všechny nepřečtené notifikace jako přečtené","disable_jump_reply":"Po odpovědi nepřeskakovat na nový příspěvek","dynamic_favicon":"Zobrazit počet nových témat v ikoně prohlížeče","external_links_in_new_tab":"Otevírat všechny externí odkazy do nové záložky","enable_quoting":"Povolit odpověď s citací z označeného textu","change":"změnit","moderator":"{{user}} je moderátor","admin":"{{user}} je administrátor","moderator_tooltip":"Tento uživatel je moderátor","admin_tooltip":"Tento uživatel je admi","blocked_tooltip":"Tento uživatel je zablokován.","suspended_notice":"Uživatel je suspendován do {{date}}.","suspended_reason":"Důvod: ","github_profile":"Github","email_activity_summary":"Souhrn aktivit","mailing_list_mode":{"label":"Režim elektronická pošta","enabled":"Zapnout režim elektronická pošta","instructions":"Toto nastavení deaktivuje souhrn aktivit.\u003cbr/\u003e\nZtlumená témata a kategorie nejsou zahrnuté v těchto emailech.\n","daily":"Denně posílat aktuality","individual":"Upozornit emailem na každý nový příspěvek","many_per_day":"Upozornit emailem na každý nový příspěvek (asi {{dailyEmailEstimate}} každý den)","few_per_day":"Upozornit emailem na každý nový příspěvek (asi 2 každý den)"},"tag_settings":"Štítky","watched_tags":"Hlídané","watched_tags_instructions":"Budete automaticky hlídat všechna nová témata s těmito štítky. Na všechny nové příspěvky a témata budete upozorněni. Počet nových příspěvků se zobrazí vedle tématu.","tracked_tags":"Sledované","muted_tags":"Ztišené","muted_tags_instructions":"Nikdy nebudete dostávat upozornění na nová témata s těmito štítky a neobjeví se v aktuálních.","watched_categories":"Hlídané","watched_categories_instructions":"Budete automaticky sledovat všechna nová témata v těchto kategoriích. Na všechny nové příspěvky budete upozorněni. Počet nových příspěvků se zobrazí vedle tématu.","tracked_categories":"Sledované","watched_first_post_categories":"Hlídané první příspěvky","watched_first_post_categories_instructions":"Budete informováni o prvním novém příspěvku v každém novém tématu vytvořeném v těchto kategoriích.","muted_categories":"Ztišené","muted_categories_instructions":"Budeš přijímat upornění na nová témata v těchto kategoriích a ty se neobjeví v aktuálních.","delete_account":"Smazat můj účet","delete_account_confirm":"Jste si jisti, že chcete trvale odstranit svůj účet? Tuto akci nelze vrátit zpět!","deleted_yourself":"Váš účet byl úspěšně odstraněn.","delete_yourself_not_allowed":"Váš účet teď nejde odstranit. Obraťte se na správce aby váš účet smazal za vás.","unread_message_count":"Zprávy","admin_delete":"Smazat","users":"Uživatelé","muted_users":"Ztišení","muted_users_instructions":"Umlčet všechny notifikace od těchto uživatelů.","muted_topics_link":"Ukázat utlumená témata","watched_topics_link":"Ukázat hlídaná témata","automatically_unpin_topics":"Atomaticky odepni téma jakmile se dostanu na konec.","staff_counters":{"flags_given":"užitečná nahlášení","flagged_posts":"nahlášených příspěvků","deleted_posts":"smazaných příspěvků","suspensions":"vyloučení","warnings_received":"varování"},"messages":{"all":"Všechny","inbox":"Doručené","sent":"Odeslané","archive":"Archív","groups":"Moje skupiny","bulk_select":"Vybrat zprávy","move_to_inbox":"Přesunout do doručených","move_to_archive":"Archivovat","failed_to_move":"Nepodařilo se přesunout vybrané zprávy (možná vám spadlo připojení)","select_all":"Vybrat vše"},"change_password":{"success":"(email odeslán)","in_progress":"(odesílám)","error":"(chyba)","action":"Odeslat email na obnovu hesla","set_password":"Nastavit heslo"},"change_about":{"title":"Změna o mně","error":"Došlo k chybě při pokusu změnit tuto hodnotu."},"change_username":{"title":"Změnit uživatelské jméno","confirm":"Pokud si změníte vaše uživatelské jméno, všechny přechozí citace vašich příspěvků a zmínky vašeho @jména budou rozbité. Jste si absolutně jistý, že chcete potvrdit toto operaci?","taken":"Toto uživatelské jméno je již zabrané.","error":"Nastala chyba při změně uživatelského jména.","invalid":"Uživatelské jméno je neplatné. Musí obsahovat pouze písmena a číslice."},"change_email":{"title":"Změnit emailovou adresu","taken":"Tato emailová adresa není k dispozici.","error":"Nastala chyba při změně emailové adresy. Není tato adresa již používaná?","success":"Na zadanou adresu jsme zaslali email. Následujte, prosím, instrukce v tomto emailu."},"change_avatar":{"title":"Změňte si svůj profilový obrázek","gravatar":"Založeno na \u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003eu","gravatar_title":"Změňte si avatar na webových stránkách Gravatar","refresh_gravatar_title":"Obnovit Gravatar","letter_based":"Systémem přidělený profilový obrázek","uploaded_avatar":"Vlastní obrázek","uploaded_avatar_empty":"Přidat vlastní obrázek","upload_title":"Nahrát obrázek","upload_picture":"Nahrát obrázek","image_is_not_a_square":"Varování: Ořízli jsme váš avatar; šířka a délka nebyla stejná.","cache_notice":"Úspěšně jsi si vyměnil profilovou fotku, ale chvíli může trvat, než se zobrazí kvůli ukládání v mezipaměti prohlížeče. "},"change_profile_background":{"title":"Pozadí profilu","instructions":"Pozadí profilu je zarovnáno doprostřed a má výchozí šířku 850px."},"change_card_background":{"title":"Pozadí uživatelské karty","instructions":"Obrázky pozadí jsou zarovnány a mají výchozí šířku 590px. "},"email":{"title":"Emailová adresa","instructions":"Nebude zveřejněno","ok":"Pro potvrzení vám pošleme email.","invalid":"Zadejte prosím správnou emailovou adresu","authenticated":"Vaše emailová adresa byla autorizována přes službu {{provider}}.","frequency_immediately":"Pokud jste obsah dosud nečetli, pošleme vám ho ihned emailem.","frequency":{"one":"Email vám zašleme pouze pokud jste se neukázali během poslední minuty.","few":"Email vám zašleme pouze pokud jste se neukázali během posledních {{count}} minut.","other":"Email vám zašleme pouze pokud jste se neukázali během posledních {{count}} minut."}},"name":{"title":"Jméno","instructions":"Celé jméno (volitelně)","instructions_required":"Vaše celé jméno","too_short":"Máte moc krátké jméno","ok":"Parádní jméno"},"username":{"title":"Uživatelské jméno","instructions":"Unikátní, bez mezer, radši kratší","short_instructions":"Lidé vás mohou zmínit pomocí @{{username}}","available":"Vaše uživatelské jméno je volné","global_match":"Email odpovídá registrovanému uživatelskému jménu.","global_mismatch":"již zaregistrováno. Co třeba {{suggestion}}?","not_available":"Není k dispozici. Co třeba {{suggestion}}?","too_short":"Uživatelské jméno je moc krátké","too_long":"Uživatelské jméno je moc dlouhé","checking":"Zjišťuji, zda je uživatelské jméno volné...","enter_email":"Uživatelské jméno nalezeno; vyplňte propojený email","prefilled":"Email je propojen s tímto uživatelským jménem"},"locale":{"title":"Jazyk rozhraní","instructions":"Jazyk uživatelského prostředí. Změna obnoví stránku.","default":"(výchozí)"},"password_confirmation":{"title":"Heslo znovu"},"last_posted":"Poslední příspěvek","last_emailed":"Email naposledy zaslán","last_seen":"Naposledy viděn","created":"Účet vytvořen","log_out":"Odhlásit se","location":"Lokace","card_badge":{"title":"User Card Badge"},"website":"Webová stránka","email_settings":"Emailová upozornění","like_notification_frequency":{"title":"Upozornit mě na \"to se mi líbí\"","always":"Vždy","first_time_and_daily":"Po prvé a pak každý den","first_time":"Po prvé","never":"Nikdy"},"email_previous_replies":{"title":"Zahrnout předchozí reakce na konci emailů","unless_emailed":"pokud nebyli dříve odeslány","always":"vždy","never":"nikdy"},"email_digests":{"title":"Pokud tady dlouho nebudu, chci zasílat souhrnné emaily s populárními tématy a reakcemi","every_30_minutes":"každých 30 minut","every_hour":"každou hodinu","daily":"denně","every_three_days":"každé tři dny","weekly":"týdně","every_two_weeks":"každé dva týdny"},"include_tl0_in_digests":"Zahrnout obsah nových uživatelů v souhrnných emailech","email_in_reply_to":"Zahrnout v emailech úryvek příspěvku, na který je reagováno","email_direct":"Zašli mi email, pokud mě někde cituje, odpoví na můj příspěvek, zmíní mé @jméno nebo mě pozve do tématu.","email_private_messages":"Zašli mi email, pokud mi někdo pošle zprávu.","email_always":"Zašli mi upozornění emailem i když jsem aktivní na fóru","other_settings":"Ostatní","categories_settings":"Kategorie","new_topic_duration":{"label":"Považovat témata za nová, pokud","not_viewed":"jsem je dosud neviděl.","last_here":"byla vytvořena od mé poslední návštěvy.","after_1_day":"vytvořeno během posledního dne","after_2_days":"vytvořeno během posledních 2 dnů","after_1_week":"vytvořeno během posledního týdne","after_2_weeks":"vytvořeno během posledních 2 týdnů"},"auto_track_topics":"Automaticky sledovat témata, která navštívím","auto_track_options":{"never":"nikdy","immediately":"ihned","after_30_seconds":"po 30 sekundách","after_1_minute":"po 1 minutě","after_2_minutes":"po 2 minutách","after_3_minutes":"po 3 minutách","after_4_minutes":"po 4 minutách","after_5_minutes":"po 5 minutách","after_10_minutes":"po 10 minutách"},"invited":{"search":"pište pro hledání v pozvánkách...","title":"Pozvánky","user":"Pozvaný uživatel","sent":"Odeslané","none":"Nemáte žádně nevyřízené pozvánky na zobrazení.","truncated":{"one":"Zobrazena první pozvánka.","few":"Zobrazeno prvních {{count}} pozvánek.","other":"Zobrazeno prvních {{count}} pozvánek."},"redeemed":"Uplatněné pozvánky","redeemed_tab":"Uplatněno","redeemed_tab_with_count":"Vyřízeno ({{count}})","redeemed_at":"Uplatněno","pending":"Nevyřízené pozvánky","pending_tab":"Čeká na schválení","pending_tab_with_count":"Nevyřízeno ({{count}})","topics_entered":"Zobrazil témat","posts_read_count":"Přečteno příspěvků","expired":"Poznávka je už prošlá.","rescind":"Smazat","rescinded":"Pozvánka odstraněna","reinvite":"Znovu poslat pozvánku","reinvite_all":"Znovu poslat všechny pozvánky","reinvited":"Pozvánka byla opětovně odeslána.","reinvited_all":"Všechny pozvánky byly opětovně odeslány!","time_read":"Čas čtení","days_visited":"Přítomen dnů","account_age_days":"Stáří účtu ve dnech","create":"Poslat pozvánku","generate_link":"Zkopírovat odkaz na pozvánku","generated_link_message":"\u003cp\u003eOdkaz na poznámku byl úspěšně vygenerován!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eOdkaz na pozvánku je platný jen pro tuto e-mailovou adresu: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Zatím jste nikoho nepozval. Můžete poslat individuální pozvánku nebo pozvat skupinu lidí naráz pomocí \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003enahrání souboru\u003c/a\u003e.","text":"Hromadné pozvání s pomocí souboru","uploading":"Nahrávám...","success":"Nahrání souboru proběhlo úspěšně. O dokončení celého procesu budete informování pomocí zprávy.","error":"Nastala chyba při nahrávání '{{filename}}': {{message}}"}},"password":{"title":"Heslo","too_short":"Vaše heslo je příliš krátké.","common":"Toto heslo je používané moc často.","same_as_username":"Vaše heslo je stejné jako Vaše uživatelské jméno.","same_as_email":"Vaše heslo je stejné jako váš e-mail.","ok":"Vaše heslo je v pořádku.","instructions":"Alespo %{count} znaků."},"summary":{"title":"Souhrn","stats":"Statistiky","time_read":"načteno","topic_count":{"one":"téma vytvořeno","few":"témata vytvořena","other":"témat vytvořeno"},"post_count":{"one":"příspěvek vytvořen","few":"příspěvky vytvořeny","other":"příspěvků vytvořeno"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dán","few":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dány","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dáno"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e obdržen","few":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e obdrženy","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e obdrženo"},"days_visited":{"one":"den navštíven","few":"dny navštíveno","other":"dní navštíveno"},"posts_read":{"one":"přečten příspěvek","few":"přečteny příspěvky","other":"přečteno příspěvků"},"bookmark_count":{"one":"záložka","few":"záložky","other":"záložek"},"top_replies":"Nejnovější příspěvky","no_replies":"Zatím žádné odpovědi.","more_replies":"Více odpovědí","top_topics":"Nejnovější témata","no_topics":"Zatím žádné témata.","more_topics":"Více témat","top_badges":"Nejnovější odznaky","no_badges":"Zatím žádné odznaky.","more_badges":"Více odznaků","top_links":"Nejnovější odkazy","no_links":"Zatím žádné odkazy.","most_liked_by":"Nejvíce \"to se mi líbí\" od uživatele","most_liked_users":"Nejvíce \"to se mi líbí\"","most_replied_to_users":"Nejvíce odpovědí","no_likes":"Zatím žádné \"to se mi líbí\""},"associated_accounts":"Přihlášení","ip_address":{"title":"Poslední IP adresa"},"registration_ip_address":{"title":"Registrační IP adresa"},"avatar":{"title":"Profilový obrázek","header_title":"profil, zprávy, záložky a nastavení"},"title":{"title":"Titul"},"filters":{"all":"Všechno"},"stream":{"posted_by":"Zaslal","sent_by":"Odeslal","private_message":"zpráva","the_topic":"téma"}},"loading":"Načítám...","errors":{"prev_page":"při nahrávání stránky","reasons":{"network":"Chyba sítě","server":"Chyba serveru","forbidden":"Přístup zamítnut","unknown":"Chyba","not_found":"Stránka nenalezena"},"desc":{"network":"Prosím zkontrolujte své připojení.","network_fixed":"Looks like it's back.","server":"Kód chyby: {{status}}","forbidden":"Nemáte povolení to spatřit.","not_found":"Jejda, aplikace zkusila načíst neexistující URL.","unknown":"Něco se pokazilo."},"buttons":{"back":"Zpět","again":"Zkusit znovu","fixed":"Nahrávám"}},"close":"Zavřít","assets_changed_confirm":"Tento web se právě aktualizoval. Chcete obnovit stránku a mít nejnovější verzi?","logout":"Byli jste odhlášeni.","refresh":"Obnovit","read_only_mode":{"enabled":"Tato stránka je v režimu jen pro čtení. Prosim pokračujte v prohlížení, ale odpovídání a ostatní operace jsou momentálně vypnuté.","login_disabled":"Přihlášení je zakázáno jelikož je stránka v režimu jen pro čtení.","logout_disabled":"Odhlášení je zakázáno zatímco je stránka v režimu jen pro čtení."},"learn_more":"více informací...","year":"rok","year_desc":"témata za posledních 365 dní","month":"měsíc","month_desc":"témata za posledních 30 dní","week":"týden","week_desc":"témata za posledních 7 dní","day":"den","first_post":"První příspěvek","mute":"Ignorovat","unmute":"Zrušit ignorování","last_post":"Poslední příspěvek","last_reply_lowercase":"poslední odpověď","replies_lowercase":{"one":"odpověď","few":"odpovědi","other":"odpovědí"},"signup_cta":{"sign_up":"Registrovat se","hide_session":"Připomenout mi zítra","hide_forever":"děkuji, ne","hidden_for_session":"Dobrá, zeptám se tě zítra. Pro založení účtu můžeš také vždy použít 'Přihlásit se'.","intro":"Nazdar! :heart_eyes: Vypadá to, že si užíváš diskuzi, ale zatím jsi si nezaložil účet.","value_prop":"Pokud si založíš účet, budeme si přesně pomatovat, co jsi četly, takže se vždycky vrátíš do bodu, odkud jsi odešel. Také budeš dostávat upozornění, zde a přes e-mail, kdykoli přibydou nově příspěvky. A můžeš přidávat 'to se mi líbí' a šířit tak lásku. :heartbeat:"},"summary":{"enabled_description":"Čtete shrnutí tohoto tématu: nejzajímavější příspěvky podle komunity.","enable":"Přepnout na \"nejlepší příspěvky\"","disable":"Přepnout na normální zobrazení"},"deleted_filter":{"enabled_description":"Toto téma obsahuje schované smazané příspěvky.","disabled_description":"Smazané příspěvky v tomto tématu jsou zobrazeny.","enable":"Schovat smazané příspěvky","disable":"Zobrazit smazané příspěvky"},"private_message_info":{"title":"Zpráva","invite":"pozvat účastníka","remove_allowed_user":"Určitě chcete odstranit {{name}} z této zprávy?","remove_allowed_group":"Opravdu chcete odstranit {{name}} z této zprávy?"},"email":"Email","username":"Uživatelské jméno","last_seen":"Naposledy viděn","created":"Vytvořeno","created_lowercase":"vytvořeno","trust_level":"Důvěryhodnost","search_hint":"uživatelské jméno, email nebo IP adresa","create_account":{"title":"Vytvořit nový účet","failed":"Něco se nepovedlo, možná je tato e-mailová adresa již použita. Zkuste použít formulář pro obnovení hesla."},"forgot_password":{"title":"Obnovení hesla","action":"Zapomněl jsem své heslo","invite":"Vložte svoje uživatelské jméno nebo e-mailovou adresu a my vám zašleme postup pro obnovení hesla.","reset":"Resetovat heslo","complete_username":"Pokud nějaký účet odpovídá uživatelskému jménu \u003cb\u003e%{username}\u003c/b\u003e, obdržíte záhy email s instrukcemi jak dál postupovat v resetování hesla.","complete_email":"Pokud nějaký účet odpovídá emailu \u003cb\u003e%{email}\u003c/b\u003e, obdržíte záhy email s instrukcemi jak dál postupovat v resetování hesla.","complete_username_found":"Byl nalezen účet s uživatelským jménem \u003cb\u003e%{username}\u003c/b\u003e. Za chvilku obdržíte email s instrukcemi jak přenastavit vaše heslo.","complete_email_found":"Byl nalezen účet odpovídající emailu \u003cb\u003e%{email}\u003c/b\u003e. Za chvilku obdržíte email s instrukcemi jak přenastavit vaše heslo.","complete_username_not_found":"Nebyl nalezen účet s uživatelským jménem \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nebyl nalezen účet s odpovídající emailu \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Přihlásit se","username":"Uživatel","password":"Heslo","email_placeholder":"emailová adresa nebo uživatelské jméno","caps_lock_warning":"zapnutý Caps Lock","error":"Neznámá chyba","rate_limit":"Počkejte před dalším pokusem se přihlásit.","blank_username_or_password":"Vyplňte prosím email nebo uživatelské jméno, a heslo.","reset_password":"Resetovat heslo","logging_in":"Přihlašuji...","or":"Nebo","authenticating":"Autorizuji...","awaiting_confirmation":"Váš účet nyní čeká na aktivaci, použijte odkaz pro zapomené heslo, jestli chcete, abychom vám zaslali další aktivační email.","awaiting_approval":"Váš účet zatím nebyl schválen moderátorem. Až se tak stane, budeme vás informovat emailem.","requires_invite":"Promiňte, toto fórum je pouze pro zvané.","not_activated":"Ještě se nemůžete přihlásit. Zaslali jsme vám aktivační email v \u003cb\u003e{{sentTo}}\u003c/b\u003e. Prosím následujte instrukce v tomto emailu, abychom mohli váš účet aktivovat.","not_allowed_from_ip_address":"Z této IP adresy se nemůžete přihlásit.","admin_not_allowed_from_ip_address":"Z této IP adresy se nemůžete přihlásit jako administrátor.","resend_activation_email":"Klikněte sem pro zaslání aktivačního emailu.","sent_activation_email_again":"Zaslali jsme vám další aktivační email na \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Může trvat několik minut, než vám dorazí. Zkontrolujte také vaši složku s nevyžádanou pošlou.","to_continue":"Přihlaš se, prosím","preferences":"Pro to, aby jsi mohl měnit své uživatelské nastavení, se musíš přihlásit.","forgot":"Nevybavuju si podrobnosti svého účtu","google":{"title":"přes Google","message":"Autentizuji přes Google (ujistěte se, že nemáte zablokovaná popup okna)"},"google_oauth2":{"title":"přes Google","message":"Přihlašování přes Google (ujistěte se že nemáte zaplé blokování pop up oken)"},"twitter":{"title":"přes Twitter","message":"Autentizuji přes Twitter (ujistěte se, že nemáte zablokovaná popup okna)"},"instagram":{"title":"s Instagramem","message":"Autentizuji pres Instagram (ujistěte se, že nemáte zablokovaná popup okna)"},"facebook":{"title":"přes Facebook","message":"Autentizuji přes Facebook (ujistěte se, že nemáte zablokovaná popup okna)"},"yahoo":{"title":"přes Yahoo","message":"Autentizuji přes Yahoo (ujistěte se, že nemáte zablokovaná popup okna)"},"github":{"title":"přes GitHub","message":"Autentizuji přes GitHub (ujistěte se, že nemáte zablokovaná popup okna)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Smajlíky :)","more_emoji":"více...","options":"Možnosti","whisper":"šeptat","add_warning":"Toto je oficiální varování.","toggle_whisper":"Přepnout šeptání","posting_not_on_topic":"Rozepsali jste odpověď na téma \"{{title}}\", ale nyní máte otevřené jiné téma.","saving_draft_tip":"ukládá se...","saved_draft_tip":"uloženo","saved_local_draft_tip":"uloženo lokálně","similar_topics":"Podobná témata","drafts_offline":"koncepty offline","error":{"title_missing":"Název musí být vyplněn","title_too_short":"Název musí být dlouhý alespoň {{min}} znaků","title_too_long":"Název nemůže být delší než {{max}} znaků","post_missing":"Příspěvek nemůže být prázdný","post_length":"Příspěvek musí být alespoň {{min}} znaků dlouhý","try_like":"Zkusili jste tlačítko \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Musíte vybrat kategorii"},"save_edit":"Uložit změnu","reply_original":"Odpovědět na původní téma","reply_here":"Odpovědět sem","reply":"Odpovědět","cancel":"Zrušit","create_topic":"Vytvořit téma","create_pm":"Zpráva","title":"Nebo zmáčkněte Ctrl+Enter","users_placeholder":"Přidat uživatele","title_placeholder":"O čem je ve zkratce tato diskuze?","edit_reason_placeholder":"proč byla nutná úprava?","show_edit_reason":"(přidat důvod úpravy)","reply_placeholder":"Piš tady. Pro formátování používej Markdown, BBCode nebo HTML. Přetáhni nebo vlož obrázky.","view_new_post":"Zobrazit váš nový příspěvek.","saving":"Ukládám","saved":"Uloženo!","saved_draft":"Máte rozepsaný příspěvek. Klikněte pro obnovení.","uploading":"Nahrávám...","show_preview":"zobrazit náhled \u0026raquo;","hide_preview":"\u0026laquo; skrýt náhled","quote_post_title":"Citovat celý příspěvek","bold_title":"Tučně","bold_text":"tučný text","italic_title":"Kurzíva","italic_text":"text kurzívou","link_title":"Odkazy","link_description":"sem vložte popis odkazu","link_dialog_title":"Vložit odkaz","link_optional_text":"volitelný popis","link_url_placeholder":"http://example.com","quote_title":"Bloková citace","quote_text":"Bloková citace","code_title":"Ukázka kódu","code_text":"odsadit předformátovaný text o 4 mezery","paste_code_text":"napište nebo vložte kód tady","upload_title":"Obrázek","upload_description":"sem vložek popis obrázku","olist_title":"Číslovaný seznam","ulist_title":"Odrážkový seznam","list_item":"Položka seznam","heading_title":"Nadpis","heading_text":"Nadpis","hr_title":"Horizontální oddělovač","help":"Nápověda pro Markdown","toggler":"zobrazit nebo skrýt editor příspěvku","modal_ok":"OK","modal_cancel":"Zrušit","cant_send_pm":"Bohužel, nemůžete poslat zprávu uživateli %{username}.","admin_options_title":"Volitelné administrační nastavení tématu","auto_close":{"label":"Automaticky zavřít téma za:","error":"Prosím zadejte platnou hodnotu.","based_on_last_post":"Neuzavírejte téma dokud poslední příspěvek v tomto tématu není alespoň takto starý.","all":{"examples":"Zadejte počet hodin (24), přesný čas (17:30) nebo časovou značku (2013-11-22 14:00)."},"limited":{"units":"(počet hodin)","examples":"Zadejte počet hodin (24)."}}},"notifications":{"title":"oznámení o zmínkách pomocí @name, odpovědi na vaše příspěvky a témata, zprávy, atd.","none":"Notifikace nebylo možné načíst.","empty":"Žádné upozornění nenalezeny.","more":"zobrazit starší oznámení","total_flagged":"celkem nahlášeno příspěvků","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e přijal vaši pozvánku\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e přesunul {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eZískáno '{{description}}'\u003c/p\u003e","alt":{"mentioned":"Zmíněno","quoted":"Citováno","replied":"Odpověděl","posted":"Příspěvek od","edited":"Editovat váš příspěvek od","liked":"Líbil se tvůj příspěvek","private_message":"Soukromá zpráva od","invited_to_private_message":"Pozván k soukromé zprávě od","invited_to_topic":"Pozván k tématu od","invitee_accepted":"Pozvánka přijata od","moved_post":"Tvůj příspěvek přesunul","linked":"Odkaz na tvůj příspěvek","granted_badge":"Odznak přidělen","group_message_summary":"Zprávy ve skupinové schránce"},"popup":{"mentioned":"{{username}} vás zmínil v \"{{topic}}\" - {{site_title}}","group_mentioned":"Uživatel {{username}} vás zmínil v \"{{topic}}\" - {{site_title}}","quoted":"{{username}} vás citoval v \"{{topic}}\" - {{site_title}}","replied":"{{username}} vám odpověděl v \"{{topic}}\" - {{site_title}}","posted":"{{username}} přispěl do \"{{topic}}\" - {{site_title}}","private_message":"{{username}} vám poslal soukromou zprávu v \"{{topic}}\" - {{site_title}}","linked":"{{username}} odkázal na vás příspěvek v \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Vložit obrázek","title_with_attachments":"Nahrát obrázek nebo soubor","from_my_computer":"Z mého zařízení","from_the_web":"Z webu","remote_tip":"odkaz na obrázek","remote_tip_with_attachments":"odkaz na obrázek nebo soubor {{authorized_extensions}}","local_tip":"vyber obrázky z tvého zařízení","local_tip_with_attachments":"vyber obrázky nebo soubory ze svého zařízení {{authorized_extensions}}","hint":"(můžete také rovnou soubor do editoru přetáhnout)","hint_for_supported_browsers":"také můžeš obrázky do editoru přetáhnout nebo vložit","uploading":"Nahrávám","select_file":"Vyberte soubor","image_link":"adresa na kterou má váš obrázek odkazovat"},"search":{"sort_by":"Seřadil","relevance":"Relevance","latest_post":"Poslední příspěvek","most_viewed":"Nejzobrazovanější","most_liked":"Nejoblíbenější","select_all":"Vybrat vše","clear_all":"Vymazat vše","result_count":{"one":"1 výsledek pro \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","few":"{{count}} výsledků pro \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} výsledků pro \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"vyhledávat témata, příspěvky, uživatele nebo kategorie","no_results":"Nenalezeny žádné výsledky.","no_more_results":"Nenalezeny žádné další výsledky.","search_help":"Pomoc s hledáním","searching":"Hledám ...","post_format":"#{{post_number}} od {{username}}","context":{"user":"Vyhledat příspěvky od @{{username}}","category":"Hledat v kategorii #{{category}}","topic":"Vyhledat v tomto tématu","private_messages":"Hledat ve zprávách"}},"hamburger_menu":"jít na jiný seznam témat nebo kategorii","new_item":"nové","go_back":"jít zpět","not_logged_in_user":"stránka uživatele s přehledem o aktuální činnosti a nastavení","current_user":"jít na vaši uživatelskou stránku","topics":{"bulk":{"unlist_topics":"Odebrat témata ze seznamu","reset_read":"reset přečteného","delete":"Smazat témata","dismiss":"Odbýt","dismiss_read":"Odbýt všechna nepřečtená","dismiss_button":"Odbýt...","dismiss_tooltip":"Odbýt jen nové příspěvka nebo přestat sledovat témata","also_dismiss_topics":"Přestat sledovat tyto témata, takže se mi znovu nezobrazí jako nepřečtená","dismiss_new":"Odbýt nová","toggle":"hromadný výběr témat","actions":"Hromadné akce","change_category":"Změnit kategorii","close_topics":"Zavřít téma","archive_topics":"Archivovat témata","notification_level":"Změnit úroveň upozornění","choose_new_category":"Zvolte novou kategorii pro témata:","selected":{"one":"Vybrali jste \u003cb\u003e1\u003c/b\u003e téma.","few":"Vybrali jste \u003cb\u003e{{count}}\u003c/b\u003e témata.","other":"Vybrali jste \u003cb\u003e{{count}}\u003c/b\u003e témat."},"change_tags":"Změnit štítky","choose_new_tags":"Zvolte nové tagy pro témata:","changed_tags":"Tagy témat byly změněny."},"none":{"unread":"Nemáte žádná nepřečtená témata.","new":"Nemáte žádná nová témata ke čtení.","read":"Zatím jste nečetli žádná témata.","posted":"Zatím jste nepřispěli do žádného tématu.","latest":"Nejsou tu žádná témata z poslední doby. To je docela smutné.","hot":"Nejsou tu žádná populární témata.","bookmarks":"V tématech nemáte žádné záložky.","category":"V kategorii {{category}} nejsou žádná témata.","top":"Nejsou tu žádná populární témata.","search":"There are no search results."},"bottom":{"latest":"Nejsou tu žádná další témata z poslední doby.","hot":"Nejsou tu žádná další populární témata k přečtení.","posted":"Nejsou tu žádná další zaslaná témata k přečtení.","read":"Nejsou tu žádná další přečtená témata.","new":"Nejsou tu žádná další nová témata k přečtení.","unread":"Nejsou tu žádná další nepřečtená témata.","category":"V kategorii {{category}} nejsou žádná další témata.","top":"Nejsou tu žádná další populární témata.","bookmarks":"Žádná další oblíbená témata nejsou k dispozici.","search":"There are no more search results."}},"topic":{"unsubscribe":{"stop_notifications":"Budete dostávat méně upozornění pro \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Váš momentální stav oznámení je"},"create":"Nové téma","create_long":"Vytvořit nové téma","private_message":"Vytvořit zprávu","archive_message":{"help":"Přesunout zprávy do archívu","title":"Archív"},"move_to_inbox":{"title":"Přesunout do Přijaté","help":"Přesunout zprávu zpět do Přijaté"},"list":"Témata","new":"nové téma","unread":"nepřečtený","new_topics":{"one":"1 nové téma","few":"{{count}} nová témata","other":"{{count}} nových témat"},"unread_topics":{"one":"1 nepřečtené téma","few":"{{count}} nepřečtená témata","other":"{{count}} nepřečtených témat"},"title":"Téma","invalid_access":{"title":"Téma je soukromé","description":"Bohužel nemáte přístup k tomuto tématu.","login_required":"Musíte se přihlásit, abyste viděli toto téma."},"server_error":{"title":"Téma se nepodařilo načíst","description":"Bohužel není možné načíst toto téma, může to být způsobeno problémem s vaším připojením. Prosím, zkuste stránku načíst znovu. Pokud bude problém přetrvávat, dejte nám vědět."},"not_found":{"title":"Téma nenalezeno","description":"Bohužel se nám nepovedlo najít toto téma. Nebylo odstraněno moderátorem?"},"total_unread_posts":{"one":"máte 1 nepřečtený příspěvek v tomto tématu","few":"máte {{count}} nepřečtené příspěvky v tomto tématu.","other":"máte {{count}} nepřečtených příspěvků v tomto tématu."},"unread_posts":{"one":"máte 1 nepřečtený příspěvěk v tomto tématu","few":"máte {{count}} nepřečtené příspěvky v tomto tématu","other":"máte {{count}} nepřečtených příspěvků v tomto tématu"},"new_posts":{"one":"je zde 1 nový příspěvek od doby, kdy jste toto téma naposledy četli","few":"jsou zde {{count}} nové příspěvky od doby, kdy jste toto téma naposledy četli","other":"je zde {{count}} nových příspěvků od doby, kdy jste toto téma naposledy četli"},"likes":{"one":"v tomto tématu je jedno 'líbí se'","few":"v tomto tématu tématu je {{count}} 'líbí se'","other":"v tomto tématu tématu je {{count}} 'líbí se'"},"back_to_list":"Zpátky na seznam témat","options":"Možnosti","show_links":"zobrazit odkazy v tomto tématu","toggle_information":"zobrazit/skrýt detaily tématu","read_more_in_category":"Chcete si toho přečíst víc? Projděte si témata v {{catLink}} nebo {{latestLink}}.","read_more":"Chcete si přečíst další informace? {{catLink}} nebo {{latestLink}}.","browse_all_categories":"Projděte všechny kategorie","view_latest_topics":"si zobrazte populární témata","suggest_create_topic":"Co takhle založit nové téma?","jump_reply_up":"přejít na předchozí odpověď","jump_reply_down":"přejít na následující odpověď","deleted":"Téma bylo smazáno","auto_close_notice":"Toto téma se automaticky zavře %{timeLeft}.","auto_close_notice_based_on_last_post":"Toto téma se uzavře za %{duration} po poslední odpovědi.","auto_close_title":"Nastavení automatického zavření","auto_close_save":"Uložit","auto_close_remove":"Nezavírat téma automaticky","timeline":{"back":"Zpět","back_description":"Přejít na poslední nepřečtený příspěvek"},"progress":{"title":"pozice v tématu","go_top":"nahoru","go_bottom":"dolů","go":"go","jump_bottom":"na poslední příspěvek","jump_bottom_with_number":"Skočit na příspěvěk %{post_number}","total":"celkem příspěvků","current":"aktuální příspěvek"},"notifications":{"reasons":{"3_6":"Budete dostávat oznámení, protože hlídáte tuhle kategorii.","3_5":"Budete dostávat oznámení, protože jste tohle téma automaticky začali hlídat.","3_2":"Budete dostávat oznámení, protože hlídáte toto téma.","3_1":"Budete dostávat oznámení, protože jste autorem totoho tématu.","3":"Budete dostávat oznámení, protože hlídáte toto téma.","2_8":"Budete dostávat upozornění, protože sledujete tuto kategorii.","2_4":"Budete dostávat oznámení, protože jste zaslal odpověď do tohoto tématu.","2_2":"Budete dostávat oznámení, protože sledujete toto téma.","2":"Budete dostávat oznámení, protože \u003ca href=\"/users/{{username}}/preferences\"\u003ejste četli toto téma\u003c/a\u003e.","1_2":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek.","1":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek.","0_7":"Ignorujete všechna oznámení v této kategorii.","0_2":"Ignorujete všechna oznámení z tohoto tématu.","0":"Ignorujete všechna oznámení z tohoto tématu."},"watching_pm":{"title":"Hlídání","description":"Budete informováni o každém novém příspěvku v této zprávě. Vedle názvu tématu se objeví počet nepřečtených příspěvků."},"watching":{"title":"Hlídané","description":"Budete informováni o každém novém příspěvku v tomto tématu. Vedle názvu tématu se objeví počet nepřečtených příspěvků."},"tracking_pm":{"title":"Sledování","description":"U této zprávy se zobrazí počet nových příspěvků. Budete upozorněni, pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"tracking":{"title":"Sledované","description":"U tohoto tématu se zobrazí počet nových příspěvků. Budete upozorněni, pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"regular":{"title":"Normální","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"regular_pm":{"title":"Normální","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"muted_pm":{"title":"Ztišení","description":"Nikdy nedostanete oznámení týkající se čehokoliv v této zprávě."},"muted":{"title":"Ztišené","description":"Nikdy nedostanete nic ohledně tohoto tématu a nezobrazí se v aktuálních."}},"actions":{"recover":"Vrátit téma","delete":"Odstranit téma","open":"Otevřít téma","close":"Zavřít téma","multi_select":"Zvolte příspěvky…","auto_close":"Automaticky zavřít","pin":"Připevnit téma","unpin":"Odstranit připevnění","unarchive":"Navrátit z archivu","archive":"Archivovat téma","invisible":"Zneviditelnit","visible":"Zviditelnit","reset_read":"Vynulovat počet čtení","make_public":"Vytvořit Veřejné Téma","make_private":"Vytvořit Soukromou zprávu"},"feature":{"pin":"Připevnit téma","unpin":"Odstranit připevnění","pin_globally":"Připnout téma globálně","make_banner":"Banner Topic","remove_banner":"Remove Banner Topic"},"reply":{"title":"Odpovědět","help":"začněte psát odpověď na toto téma"},"clear_pin":{"title":"Odstranit připnutí","help":"Odebere připnutí tohoto tématu, takže se již nebude zobrazovat na vrcholu seznamu témat"},"share":{"title":"Sdílet","help":"sdílet odkaz na toto téma"},"flag_topic":{"title":"Nahlásit","help":"Soukromě nahlásit tento příspěvek moderátorům","success_message":"Téma úspěšně nahlášeno."},"feature_topic":{"title":"Povýšit téma","pin":"Zobrazit toto téma na vrcholu kategorie {{categoryLink}} dokud","confirm_pin":"Již máte {{count}} připevněných příspěvků. Příliš mnoho připevněných příspěvků může zatěžovat nové nebo anonymní uživatele. Určitě chcete připevnit další téma v této kategorii?","unpin":"Odstranit toto téma z vrcholu {{categoryLink}} kategorie.","unpin_until":"Odstranit toto téma z vrcholu kategorie {{categoryLink}}, nebo počkat dokud \u003cstrong\u003e%{until}\u003c/strong\u003e","pin_note":"Uživatelé mohou odepnout téma sami pro sebe.","pin_validation":"Pro připíchnutí tohoto tématu je třeba datum.","not_pinned":"V kategorii {{categoryLink}} nejsou žádná připnutá témata.","pin_globally":"Zobrazit toto téma na vrcholu seznamu všech témat dokud","confirm_pin_globally":"Již máte {{count}} globálně připevněných příspěvků. Příliš mnoho připevněných příspěvků může zatěžovat nové nebo anonymní uživatele. Určitě chcete připevnit další téma globálně?","unpin_globally":"Odstranit toto téma z vrcholu všech seznamů s tématy.","unpin_globally_until":"Odstranit toto téma z vrcholu seznamu všech témat nebo počat dokud \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Uživatelé mohou odepnout téma sami pro sebe.","not_pinned_globally":"Nemáte žádná globálně připevněná témata.","already_pinned_globally":{"one":"V současnosti globálně připevněná témata: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","few":"V současnosti globálně připevněná témata: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"V současnosti globálně připevněná témata: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Udělat z tohoto tématu banner, který se zobrazí na vrcholu všech stránek.","remove_banner":"Odstranit banner, který se zobrazuje na vrcholu všech stránek.","banner_note":"Uživatelé mohou odmítnout banner jeho zavřením. V jeden moment může být pouze jedno téma jako banner.","no_banner_exists":"Žádné téma není jako banner.","banner_exists":"V současnosti \u003cstrong class='badge badge-notification unread'\u003eje\u003c/strong\u003e zde téma jako banner."},"inviting":"Odesílám pozvánku...","invite_private":{"title":"Pozvat do konverzace","email_or_username":"Email nebo uživatelské jméno pozvaného","email_or_username_placeholder":"emailová adresa nebo uživatelské jméno","action":"Pozvat","success":"Pozvali jsme tohoto uživatele, aby se připojil do této zprávy.","error":"Bohužel nastala chyba při odesílání pozvánky.","group_name":"název skupiny"},"invite_reply":{"title":"Pozvat k diskuzi","username_placeholder":"uživatelské jméno","action":"Poslat pozvánku","help":"pozval ostatní do tohoto tématu pomocí emailu nebo notifikací","to_forum":"Pošleme krátký email dovolující vašemu příteli se okamžitě zapojit s pomocí kliknutí na odkaz. Nebude potřeba registrace.","sso_enabled":"Zadej uživatelské jméno člověka, kterého chceš pozvat do tohoto tématu.","to_topic_blank":"Zadej uživatelské jméno a email člověka, kterého chceš pozvat do tohoto tématu.","to_topic_email":"Zadal jste emailovou adresu. Pošleme na ni pozvánku, s jejíž pomocí bude moci váš kamarád ihned odpovědět do tohoto tématu.","to_topic_username":"Zadali jste uživatelské jméno. Zašleme pozvánku s odkazem do tohoto tématu.","to_username":"Zadejte uživatelské jméno člověka, kterého chcete pozvat. Zašleme pozvánku s odkazem do tohoto tématu.","email_placeholder":"jmeno@priklad.cz","success_email":"Zaslali jsme pozvánku na \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Upozorníme vás až bude pozvánka použita. Své pozvánky můžete sledovat v tabulce pozvánek na svém uživatelském profilu.","success_username":"Pozvali jsme zadaného uživatele, aby se zúčastnil tématu.","error":"Bohužel se nepodařilo pozvat tuto osobu. Možná už byla pozvána? (Počet opakovaných pozvánek je omezen)."},"login_reply":"Přihlaste se, chcete-li odpovědět","filters":{"n_posts":{"one":"Je zobrazen pouze 1 příspěvek","few":"Jsou zobrazeny pouze {{count}} příspěvky","other":"Je zobrazeno pouze {{count}} příspěvků"},"cancel":"Zrušit filtr"},"split_topic":{"title":"Rozdělit téma","action":"do nového téma","topic_name":"Název nového tématu:","error":"Bohužel nastala chyba při rozdělování tématu.","instructions":{"one":"Chystáte se vytvořit nové téma a naplnit ho příspěvkem, který jste označili.","few":"Chystate se vytvořit noté téma a naplnit ho \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které jste označili.","other":"Chystate se vytvořit noté téma a naplnit ho \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které jste označili."}},"merge_topic":{"title":"Sloučit téma","action":"do jiného tématu","error":"Bohužel nastala chyba při slučování tématu.","instructions":{"one":"Prosím, vyberte téma, do kterého chcete příspěvek přesunout.","few":"Prosím, vyberte téma, do kterého chcete tyto \u003cb\u003e{{count}}\u003c/b\u003e příspěvky přesunout.","other":"Prosím, vyberte téma, do kterého chcete těchto \u003cb\u003e{{count}}\u003c/b\u003e příspěvků přesunout."}},"change_owner":{"title":"Změnit autora","action":"změna autora","error":"Chyba při měnění autora u příspevků.","label":"Nový autor příspěvků","placeholder":"uživatelské jméno nového autora","instructions":{"one":"Vyberte prosím nového autora příspěvku od \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Vyberte prosím nového autora {{count}} příspěvků od \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Vyberte prosím nového autora {{count}} příspěvků od \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Poznámka: Žádná upozornění na tento příspěvek nebudou zpětně přenesena na nového uživatele.\u003cbr\u003eVarování: V současné chvíli, žádná data svázaná s příspěvkem nebudou přenesena na nového uživatele. Používejte opatrně."},"change_timestamp":{"title":"Změnit časovou značku","action":"změnit časovou značku","invalid_timestamp":"Časová značka nemůže být v budoucnosti.","error":"Nastala chyba při změně časové značky tématu.","instructions":"Zvol novou časovou značku tématu, prosím. Příspěvky v tématu se aktualizují tak aby měly stejný rozdíl v čase."},"multi_select":{"select":"vybrat","selected":"vybráno ({{count}})","select_replies":"vybrat +odpovědi","delete":"smazat označené","cancel":"zrušit označování","select_all":"vybrat vše","deselect_all":"zrušit výběr","description":{"one":"Máte označen \u003cb\u003e1\u003c/b\u003e příspěvek.","few":"Máte označeny \u003cb\u003e{{count}}\u003c/b\u003e příspěvky.","other":"Máte označeno \u003cb\u003e{{count}}\u003c/b\u003e příspěvků."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"odpověď s citací","edit":"Editujete {{link}} {{replyAvatar}} {{username}}","edit_reason":"Důvod: ","post_number":"příspěvek č. {{number}}","last_edited_on":"příspěvek naposledy upraven","reply_as_new_topic":"Odpovědět v propojeném tématu","continue_discussion":"Pokračující diskuze z {{postLink}}:","follow_quote":"přejít na citovaný příspěvek","show_full":"Zobrazit celý příspěvek","show_hidden":"Zobraz skrytý obsah.","deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","few":"(post withdrawn by author, will be automatically deleted in %{count} hours unless flagged)","other":"(post withdrawn by author, will be automatically deleted in %{count} hours unless flagged)"},"expand_collapse":"rozbalit/sbalit","gap":{"one":"zobrazit 1 skrytou odpověď","few":"zobrazit {{count}} skryté odpovědi","other":"zobrazit {{count}} skrytých odpovědí"},"unread":"Příspěvek je nepřečtený.","has_replies":{"one":"{{count}} odpověď","few":"{{count}} odpovědi","other":"{{count}} odpovědí"},"has_likes":{"one":"{{count}} líbí se mi","few":"{{count}} líbí se mi","other":"{{count}} líbí se mi"},"has_likes_title":{"one":"1 člověku se líbí tento příspěvek","few":"{{count}} lidem se líbí tento příspěvek","other":"{{count}} lidem se líbí tento příspěvek"},"has_likes_title_only_you":"tento příspěvek se mi líbí","has_likes_title_you":{"one":"vám a 1 dalšímu člověku se tento příspěvek líbí","few":"vám a {{count}} dalším lidem se tento příspěvek líbí","other":"vám a {{count}} dalším lidem se tento příspěvek líbí"},"errors":{"create":"Bohužel nastala chyba při vytváření příspěvku. Prosím zkuste to znovu.","edit":"Bohužel nastala chyba při editaci příspěvku. Prosím zkuste to znovu.","upload":"Bohužel nastala chyba při nahrávání příspěvku. Prosím zkuste to znovu.","too_many_uploads":"Bohužel, najednou smíte nahrát jen jeden soubor.","upload_not_authorized":"Bohužel, soubor, který se snažíte nahrát, není povolený (povolené přípony: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat obrázky.","attachment_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat přílohy.","attachment_download_requires_login":"Omlouváme se, ale pro stáhnutí přílohy musíte být přihlášen."},"abandon":{"confirm":"Opravdu chcete svůj příspěvek zahodit?","no_value":"Nezahazovat","yes_value":"Ano, zahodit"},"via_email":"tento příspěvek byl přijat přes email","whisper":"tento příspěvek je soukromé šeptání pro moderátory","archetypes":{"save":"Uložit nastavení"},"controls":{"reply":"otevře okno pro sepsání odpovědi na tento příspěvek","like":"to se mi líbí","has_liked":"tento příspěvek se mi líbí","undo_like":"už se mi to nelíbí","edit":"upravit příspěvek","edit_anonymous":"Omlouváme se, ale pro editaci tohoto příspěvku musíte být přihlášení.","flag":"nahlásit příspěvek moderátorovi","delete":"smazat příspěvek","undelete":"obnovit příspěvek","share":"sdílet odkaz na tento příspěvek","more":"Více","delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?","few":"Do you also want to delete the {{count}} direct replies to this post?","other":"Do you also want to delete the {{count}} direct replies to this post?"},"yes_value":"Ano, smazat i odpovědi","no_value":"Ne, jenom tento příspěvek"},"admin":"post admin actions","wiki":"Vytvořte Wiki","unwiki":"Odtraňte Wiki","convert_to_moderator":"Přidejte Staff Color","revert_to_regular":"Odstraňte Staff Color","rebake":"Obnovit HTML","unhide":"Odkrýt","change_owner":"Změna autora"},"actions":{"flag":"Nahlásit","defer_flags":{"one":"Odložit nahlášení","few":"Odložit nahlášení","other":"Odložit nahlášení"},"undo":{"off_topic":"Zrušit nahlášení","spam":"Zrušit nahlášení","inappropriate":"Zrušit nahlášení","bookmark":"Odebrat ze záložek","like":"Už se mi to nelíbí","vote":"Zrušit hlas"},"by_you":{"off_topic":"Označili jste tento příspěvek jako off-topic","spam":"Označili jste tento příspěvek jako spam","inappropriate":"Označili jste tento příspěvek jako nevhodný","notify_moderators":"Nahlásili jste tento příspěvek","notify_user":"Tomuto uživateli jste zaslali zprávu","bookmark":"Přidali jste si tento příspěvek do záložek","like":"Toto se vám líbí","vote":"Hlasovali jste pro tento příspěvek"},"by_you_and_others":{"off_topic":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako off-topic","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako off-topic","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako off-topic"},"spam":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako spam","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako spam","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako spam"},"inappropriate":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako nevhodný","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako nevhodný","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako nevhodný"},"notify_moderators":{"one":"Vy a 1 další člověk jste nahlásili tento příspěvek","few":"Vy a {{count}} další lidé jste nahlásili tento příspěvek","other":"Vy a {{count}} dalších lidí jste nahlásili tento příspěvek"},"notify_user":{"one":"Vy a 1 další uživatel jste poslali zprávu tomuto uživateli","few":"Vy a {{count}} ostatní lidé jste poslali zprávu tomuto uživateli","other":"Vy a {{count}} ostatních lidí jste poslali zprávu tomuto uživateli"},"bookmark":{"one":"Vy a 1 další člověk jste si přidali tento příspěvek do záložek","few":"Vy a {{count}} další lidé jste si přidali tento příspěvek do záložek","other":"Vy a {{count}} dalších lidí si přidali tento příspěvek do záložek"},"like":{"one":"Vám a 1 dalšímu člověku se tento příspěvek líbí","few":"Vám a {{count}} dalším lidem se tento příspěvek líbí","other":"Vám a {{count}} dalším lidem se tento příspěvek líbí"},"vote":{"one":"Vy a 1 další člověk jste hlasovali pro tento příspěvek","few":"Vy a {{count}} další lidé jste hlasovali pro tento příspěvek","other":"Vy a {{count}} dalších lidí jste hlasovali pro tento příspěvek"}},"by_others":{"off_topic":{"one":"1 člověk označil tento příspěvek jako off-topic","few":"{{count}} lidé označili tento příspěvek jako off-topic","other":"{{count}} lidí označilo tento příspěvek jako off-topic"},"spam":{"one":"1 člověk označil tento příspěvek jako spam","few":"{{count}} lidé označili tento příspěvek jako spam","other":"{{count}} lidí označilo tento příspěvek jako spam"},"inappropriate":{"one":"1 člověk označil tento příspěvek jako nevhodný","few":"{{count}} lidé označili tento příspěvek jako nevhodný","other":"{{count}} lidí označilo tento příspěvek jako nevhodný"},"notify_moderators":{"one":"1 člověk nahlásil tento příspěvek","few":"{{count}} lidé nahlásili tento příspěvek","other":"{{count}} lidí nahlásilo tento příspěvek"},"notify_user":{"one":"1 člověk poslal zprávu tomuto uživateli","few":"{{count}} lidé poslali zprávu tomuto uživateli","other":"{{count}} lidí poslalo zprávu tomuto uživateli"},"bookmark":{"one":"1 člověk si přidal tento příspěvek do záložek","few":"{{count}} lidé si přidali tento příspěvek do záložek","other":"{{count}} lidí si přidalo tento příspěvek do záložek"},"like":{"one":"1 člověku se tento příspěvek líbí","few":"{{count}} lidem se tento příspěvek líbí","other":"{{count}} lidem se tento příspěvek líbí"},"vote":{"one":"1 člověk hlasoval pro tento příspěvek","few":"{{count}} lidé hlasovali pro tento příspěvek","other":"{{count}} lidí hlasovalo pro tento příspěvek"}}},"delete":{"confirm":{"one":"Opravdu chcete odstranit tento příspěvek?","few":"Opravdu chcete odstranit všechny tyto příspěvky?","other":"Opravdu chcete odstranit všechny tyto příspěvky?"}},"revisions":{"controls":{"first":"První revize","previous":"Předchozí revize","next":"Další revize","last":"Poslední revize","hide":"Schovejte revizi","show":"Zobrazte revizi","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Vykreslený příspěvek se změnami zobrazenými v textu","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Rozdíli mezi vykreslenými příspěveky vedle sebe","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Show the raw source diffs side-by-side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Kód"}}}},"category":{"can":"smí\u0026hellip; ","none":"(bez kategorie)","all":"Všechny kategorie","choose":"Vyberte kategorii\u0026hellip;","edit":"upravit","edit_long":"Upravit","view":"Zobrazit témata v kategorii","general":"Základní","settings":"Nastavení","topic_template":"Šablona tématu","delete":"Smazat kategorii","create":"Nová kategorie","create_long":"Vytvořit novou kategorii","save":"Uložit kategorii","slug":"Odkaz kategorie","slug_placeholder":"(Dobrovolné) podtržená URL","creation_error":"Během vytváření nové kategorie nastala chyba.","save_error":"Během ukládání kategorie nastala chyba.","name":"Název kategorie","description":"Popis","topic":"téma kategorie","logo":"Logo kategorie","background_image":"Obrázek na pozadí této kategorie","badge_colors":"Barvy štítku","background_color":"Barva pozadí","foreground_color":"Barva textu","name_placeholder":"Měl by být krátký a výstižný.","color_placeholder":"Jakákoliv webová barva","delete_confirm":"Opravdu chcete odstranit tuto kategorii?","delete_error":"Nastala chyba při odstraňování kategorie.","list":"Seznam kategorií","no_description":"Doplňte prosím popis této kategorie.","change_in_category_topic":"navštivte téma kategorie pro editaci jejího popisu","already_used":"Tato barva je již použita jinou kategorií","security":"Zabezpečení","images":"Obrázky","auto_close_label":"Automaticky zavírat témata po:","auto_close_units":"hodinách","email_in":"Vlastní příchozí emailová adresa:","email_in_allow_strangers":"Přijímat emaily i od neregistrovaných uživatelů","email_in_disabled":"Přidávání nových témat před email je zakázáno v Nastavení fóra. K povolení nových témat přes email,","email_in_disabled_click":"povolit nastavení \"email in\"","suppress_from_homepage":"Potlač tuto kategorii na domovské stránce.","allow_badges_label":"Povolit používání odznaků v této kategorii","edit_permissions":"Upravit oprávnění","add_permission":"Přidat oprávnění","this_year":"letos","position":"umístění","default_position":"Výchozí umístění","position_disabled":"Kategorie jsou zobrazovány podle pořadí aktivity. Pro kontrolu pořadí kategorií v seznamech,","position_disabled_click":"povolte nastavení \"neměnné pozice kategorií\" (fixed category positions).","parent":"Nadřazená kategorie","notifications":{"watching":{"title":"Hlídání"},"tracking":{"title":"Sledování"},"regular":{"title":"Normální","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"muted":{"title":"Ztišený","description":"Nikdy nebudete dostávat upozornění na nová témata v těchto kategoriích a neobjeví se v aktuálních."}}},"flagging":{"title":"Děkujeme, že pomáháte udržovat komunitu zdvořilou!","action":"Nahlásit příspěvek","take_action":"Zakročit","notify_action":"Zpráva","delete_spammer":"Odstranit spamera","yes_delete_spammer":"Ano, odstranit spamera","ip_address_missing":"(N/A)","hidden_email_address":"(skrytý)","submit_tooltip":"Podat soukromé nahlášení","take_action_tooltip":"Ihned dosáhni vlaječky prahu, než aby jsi čekal na více komunitních vlaječek","cant":"Bohužel nyní nemůžete tento příspěvek nahlásit.","formatted_name":{"off_topic":"Je to mimo téma.","inappropriate":"Je to nevhodné","spam":"Je to spam"},"custom_placeholder_notify_user":"Buďte věcný, konstruktivní a vždy zdvořilý.","custom_placeholder_notify_moderators":"Sdělte nám, co vás přesně trápí a kde to bude možné, tak nám poskytněte související odkazy a příklady."},"flagging_topic":{"title":"Děkujeme, že pomáháte udržovat komunitu zdvořilou!","action":"Nahlásit téma","notify_action":"Zpráva"},"topic_map":{"title":"Souhrn tématu","participants_title":"Častí přispěvatelé","links_title":"Populární odkazy","clicks":{"one":"1 kliknutí","few":"%{count} kliknutí","other":"%{count} kliknutí"}},"topic_statuses":{"warning":{"help":"Toto je oficiální varování."},"bookmarked":{"help":"V tématu je vložena záložka"},"locked":{"help":"toto téma je uzavřené; další odpovědi nejsou přijímány"},"archived":{"help":"toto téma je archivováno; je zmraženo a nelze ho již měnit"},"locked_and_archived":{"help":"Toto téma je uzavřené a archivované; další odpovědi nejsou přijímány a změny nejsou možné"},"unpinned":{"title":"Nepřipnuté","help":"Pro vás toto téma není připnuté; bude se zobrazovat v běžném pořadí"},"pinned_globally":{"title":"Připnuté globálně","help":"Toto téma je připnuté; bude se zobrazovat na vrcholu aktuálních a ve své kategorii"},"pinned":{"title":"Připnuto","help":"Pro vás je toto téma připnuté; bude se zobrazovat na vrcholu seznamu ve své kategorii"},"invisible":{"help":"Toto téma je neviditelné; nebude se zobrazovat v seznamu témat a lze ho navštívit pouze přes přímý odkaz"}},"posts":"Příspěvků","posts_long":"v tomto tématu je {{number}} příspěvků","original_post":"Původní příspěvek","views":"Zobrazení","views_lowercase":{"one":"zobrazení","few":"zobrazení","other":"zobrazení"},"replies":"Odpovědi","views_long":"toto téma bylo zobrazeno {{number}}krát","activity":"Aktivita","likes":"Líbí se","likes_lowercase":{"one":"líbí se","few":"líbí se","other":"líbí se"},"likes_long":"v tomto tématu je {{number}} 'líbí se'","users":"Účastníci","users_lowercase":{"one":"uživatel","few":"uživatelé","other":"uživatelů"},"category_title":"Kategorie","history":"Historie","changed_by":"od uživatele {{author}}","raw_email":{"title":"Neupravený email","not_available":"Není k dispozici!"},"categories_list":"Seznam kategorií","filters":{"with_topics":"%{filter} témata","with_category":"%{filter} %{category} témata","latest":{"title":"Nejaktuálnější","title_with_count":{"one":"Nedávné (1)","few":"Nedávná ({{count}})","other":"Nedávná ({{count}})"},"help":"nejaktuálnější témata"},"hot":{"title":"Populární","help":"populární témata z poslední doby"},"read":{"title":"Přečtená","help":"témata, která jste si přečetli"},"search":{"title":"Vyhledat","help":"prohledat všechna témata"},"categories":{"title":"Kategorie","title_in":"Kategorie - {{categoryName}}","help":"všechna témata seskupená podle kategorie"},"unread":{"title":"Nepřečtená","title_with_count":{"one":"Nepřečtená ({{1}})","few":"Nepřečtená ({{count}})","other":"Nepřečtená ({{count}})"},"help":"témata. která sledujete nebo hlídáte, s nepřečtenými příspěvky","lower_title_with_count":{"one":"{{count}} nepřečtené","few":"{{count}} nepřečtených","other":"{{count}} nepřečtených"}},"new":{"lower_title_with_count":{"one":"{{count}} nové","few":"{{count}} nových","other":"{{count}} nových"},"lower_title":"nové","title":"Nová","title_with_count":{"one":"Nové","few":"Nová ({{count}})","other":"Nová ({{count}})"},"help":"témata vytvořená za posledních několik dní"},"posted":{"title":"Mé příspěvky","help":"témata, do kterých jste přispěli"},"bookmarks":{"title":"Záložky","help":"témata, do kterých jste si vložili záložku"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"populární témata v kategorii {{categoryName}}"},"top":{"title":"Nejlepší","help":"výběr nejlepších témat za rok, měsíc, týden nebo den","all":{"title":"Za celou dobu"},"yearly":{"title":"Ročně"},"quarterly":{"title":"Čtvrtletně"},"monthly":{"title":"Měsíčně"},"weekly":{"title":"Týdně"},"daily":{"title":"Denně"},"all_time":"Za celou dobu","this_year":"Rok","this_quarter":"Čtvrtletí","this_month":"Měsíc","this_week":"Týden","today":"Dnes","other_periods":"viz nahoře"}},"browser_update":"Bohužel, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eváš prohlížeč je příliš starý, aby na něm Discourse mohl fungovat\u003c/a\u003e. Prosím \u003ca href=\"http://browsehappy.com\"\u003eaktualizujte svůj prohlížeč\u003c/a\u003e.","permission_types":{"full":"Vytvářet / Odpovídat / Prohlížet","create_post":"Odpovídat / Prohlížet","readonly":"Prohlížet"},"poll":{"voters":{"one":"hlasující","few":"hlasujících","other":"hlasující"},"total_votes":{"one":"hlas celkem","few":"hlasy celkem","other":"hlasů celkem"},"average_rating":"Průměrné hodnocení: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Hlasy jsou veřejné."},"multiple":{"help":{"at_least_min_options":{"one":"Zvolte alespoň \u003cstrong\u003e1\u003c/strong\u003e možnost.","few":"Zvolte alespoň \u003cstrong\u003e%{count}\u003c/strong\u003e možnosti.","other":"Zvolte alespoň \u003cstrong\u003e%{count}\u003c/strong\u003e možností."},"up_to_max_options":{"one":"Zvolte maximálně \u003cstrong\u003e1\u003c/strong\u003e možnost.","few":"Zvolte maximálně \u003cstrong\u003e%{count}\u003c/strong\u003e možnosti.","other":"Zvolte maximálně \u003cstrong\u003e%{count}\u003c/strong\u003e možností."},"x_options":{"one":"Zvolte \u003cstrong\u003e1\u003c/strong\u003e možnost.","few":"Zvolte \u003cstrong\u003e%{count}\u003c/strong\u003e možnosti.","other":"Zvolte \u003cstrong\u003e%{count}\u003c/strong\u003e možností."},"between_min_and_max_options":"Zvolte mezi \u003cstrong\u003e%{min}\u003c/strong\u003e a \u003cstrong\u003e%{max}\u003c/strong\u003e možnostmi."}},"cast-votes":{"title":"Hlasujte","label":"Hlasovat!"},"show-results":{"title":"Zobraz výsledky hlasování","label":"Ukaž výsledky"},"hide-results":{"title":"Zpět k hlasování","label":"Schovej výsledky"},"open":{"title":"Otevřít hlasování","label":"Otevři","confirm":"Opravdu chcete otevřít toto hlasování?"},"close":{"title":"Zavřít hlasování","label":"Zavřít","confirm":"Opravdu chcete uzavřít toto hlasování?"},"error_while_toggling_status":"Došlo k chybě při změně statusu hlasování","error_while_casting_votes":"Došlo k chybě při odesílání vašeho hlasu.","error_while_fetching_voters":"Došlo k chybě při zobrazování hlasujících.","ui_builder":{"title":"Vytvořit hlasování","insert":"Vložit hlasování","help":{"options_count":"Zadejte alespoň 2 možnosti"},"poll_type":{"label":"Typ","regular":"Jedna možnost","multiple":"Více možností","number":"Číselné hodnocení"},"poll_config":{"max":"Maximum","min":"Minimum","step":"Krok"},"poll_public":{"label":"Zobrazit kdo hlasoval"},"poll_options":{"label":"Na každý řádek zadejte jednu možnost hlasování"}}},"type_to_filter":"text pro filtrování...","admin":{"title":"Administrátor","moderator":"Moderátor","dashboard":{"title":"Rozcestník","last_updated":"Přehled naposled aktualizován:","version":"Verze Discourse","up_to_date":"Máte aktuální!","critical_available":"Je k dispozici důležitá aktualizace.","updates_available":"Jsou k dispozici aktualizace.","please_upgrade":"Prosím aktualizujte!","no_check_performed":"Kontrola na aktualizace nebyla provedena. Ujistěte se, že běží služby sidekiq.","stale_data":"V poslední době neproběhal kontrola aktualizací. Ujistěte se, že běží služby sidekiq.","version_check_pending":"Že tys nedávno provedl aktualizaci. Báječné!","installed_version":"Nainstalováno","latest_version":"Poslední verze","problems_found":"Byly nalezeny problémy s vaší instalací systému Discourse:","last_checked":"Naposledy zkontrolováno","refresh_problems":"Obnovit","no_problems":"Nenalezeny žádné problémy.","moderators":"Moderátoři:","admins":"Administrátoři:","blocked":"Blokováno:","suspended":"Zakázáno:","private_messages_short":"Msgs","private_messages_title":"Zprávy","mobile_title":"Mobilní verze","space_free":"{{size}} prázdné","uploads":"Nahrané soubory","backups":"zálohy","traffic_short":"Provoz","traffic":"Webové požadavky na aplikaci","page_views":"API požadavky","page_views_short":"API požadavky","show_traffic_report":"Zobrazit detailní zprávu o provozu","reports":{"today":"Dnes","yesterday":"Včera","last_7_days":"Týden","last_30_days":"Měsíc","all_time":"Za celou dobu","7_days_ago":"Týden","30_days_ago":"Měsíc","all":"Celkem","view_table":"tabulka","refresh_report":"Obnovit hlášení","start_date":"Datum začátku","end_date":"Datum konce"}},"commits":{"latest_changes":"Poslední změny:","by":"od"},"flags":{"title":"Nahlášení","old":"Stará","active":"Aktivní","agree":"Schválit","agree_title":"Potvrdit toto hlášení jako právoplatné a korektní","agree_flag_modal_title":"Schvaluji a...","agree_flag_hide_post":"Schvaluji (skrýt příspěvek + poslat soukromou zprávu)","agree_flag_hide_post_title":"Skrýt tento příspěvek a automaticky odeslat zprávu, která uživatele žádá o editaci","agree_flag_restore_post":"Schvaluji (obnovit příspěvek)","agree_flag_restore_post_title":"Obnovit tento příspěvek","agree_flag":"Souhlasit s hlášením","agree_flag_title":"Schválit hlášení a nechat příspěvek nezměněný","defer_flag":"Odložit","defer_flag_title":"Odstranit nahlášení; teď nevyžaduje žádné opatření.","delete":"Smazat","delete_title":"Smazat příspěvek, na který toto hlášení odkazuje.","delete_post_defer_flag":"Smazat příspěvek a odložit nahlášení","delete_post_defer_flag_title":"Smazat příspěvek; pokud je to první příspěvek, tak smazat téma","delete_post_agree_flag":"Smazat příspěvek a Schválit hlášení","delete_post_agree_flag_title":"Smazat příspěvek; pokud je to první příspěvek, tak smazat téma","delete_flag_modal_title":"Smazat a...","delete_spammer":"Odstranit spamera","delete_spammer_title":"Odstranit uživatele a všechny příspěvky a témata tohoto uživatele.","disagree_flag_unhide_post":"Neschvaluji (zviditelnit příspěvek)","disagree_flag_unhide_post_title":"Odstranit všechna nahlášení u tohoto příspěvku a znovu ho zviditelnit","disagree_flag":"Neschvaluji","disagree_flag_title":"Odmítnout hlášení jako neprávoplatné a nekorektní","clear_topic_flags":"Hotovo","clear_topic_flags_title":"The topic has been investigated and issues have been resolved. Click Done to remove the flags.","more":"(více odpovědí...)","dispositions":{"agreed":"schváleno","disagreed":"neschváleno","deferred":"odloženo"},"flagged_by":"Nahlásil","resolved_by":"Vyřešeno","took_action":"Zakročit","system":"Systémové soukromé zprávy","error":"Něco se pokazilo","reply_message":"Odpovědět","no_results":"Nejsou zde žádná nahlášení.","topic_flagged":"Tohle \u003cstrong\u003etéma\u003c/strong\u003e bylo označeno.","visit_topic":"Zobrazit téma pro přijmutí opatření.","was_edited":"Příspěvek byl upraven po prvním nahlášení","previous_flags_count":"Tento příspěvek byl již nahlášen {{count}} krát.","summary":{"action_type_3":{"one":"off-topic","few":"off-topic x{{count}}","other":"off-topic x{{count}}"},"action_type_4":{"one":"nevhodné","few":"nevhodné x{{count}}","other":"nevhodné x{{count}}"},"action_type_6":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"},"action_type_7":{"one":"vlastní","few":"vlastní x{{count}}","other":"vlastní x{{count}}"},"action_type_8":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"}}},"groups":{"primary":"Hlavní skupina","no_primary":"(žádná hlavní skupina)","title":"Skupiny","edit":"Upravit skupiny","refresh":"Obnovit","new":"Nová","selector_placeholder":"zadejte uživatelské jméno","name_placeholder":"Název skupiny, bez mezer, stejná pravidla jako pro uživatelská jména","about":"Zde můžete upravit názvy skupin a členství","group_members":"Členové skupiny","delete":"Smazat","delete_confirm":"Smazat toto skupiny?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed.","delete_member_confirm":"Odstranit '%{username}' ze '%{group}' skupiny?","delete_owner_confirm":"Odstranit vlastnickou výsadu od '%{username}'?","name":"Jméno","add":"Přidat","add_members":"Přidat členy","custom":"Přizpůsobené","bulk_complete":"Uživatelé byli přidáni do skupiny.","bulk":"Hromadné přidání do skupiny","bulk_paste":"Vlož seznam uživatelských jmen a e-mailů, jeden záznam na řádek","bulk_select":"(vyber skupinu)","automatic":"Automatické","automatic_membership_email_domains":"Uživatelé zaregistrovaní s emailem jehož doména se přesně shoduje s jednou z tohoto seznamu budou automaticky přidáni to této skupiny:","automatic_membership_retroactive":"Aplikovat stejné doménové pravidlo na už existující uživatele","default_title":"Výchozí popis pro všechny uživatele této skupiny","primary_group":"Automaticky nastavit jako hlavní skupinu","group_owners":"Vlastníci","add_owners":"Přidat vlastníky","incoming_email":"Vlastní příchozí emailová adresa","incoming_email_placeholder":"zadej emailovou adresu"},"api":{"generate_master":"Vygenerovat Master API Key","none":"Nejsou tu žádné aktivní API klíče.","user":"Uživatel","title":"API","key":"API klíč","generate":"Vygenerovat API klíč","regenerate":"Znovu-vygenerovat API klíč","revoke":"zrušit","confirm_regen":"Určitě chcete nahradit tenhle API klíč novým?","confirm_revoke":"Jste si jisti, že chcete tento klíč zrušit?","info_html":"Váš API klíč umožní vytvářet a aktualizovat témata pomocí JSONových volání.","all_users":"Všichni uživatelé","note_html":"Uchovejte tento klíč \u003cstrong\u003ev bezpečí\u003c/strong\u003e, každý, kdo má tento klíč, může libovolně vytvářet příspěvky na fóru i za ostatní uživatele."},"plugins":{"title":"Pluginy","installed":"Nainstalované pluginy","name":"Název","none_installed":"Nemáte nainstalované žádné pluginy.","version":"Verze","enabled":"Zapnutý?","is_enabled":"A","not_enabled":"N","change_settings":"Změnit nastavení","change_settings_short":"Nastavení","howto":"Jak nainstaluji pluginy?"},"backups":{"title":"Zálohy","menu":{"backups":"Zálohy","logs":"Logy"},"none":"Žádné zálohy nejsou k dispozici.","logs":{"none":"Zatím je log prázdný..."},"columns":{"filename":"Název souboru","size":"Velikost"},"upload":{"label":"Nahrát","title":"Nahrát zálohu do téhle instance","uploading":"Nahrávání...","success":"'{{filename}}' has successfully been uploaded.","error":"There has been an error while uploading '{{filename}}': {{message}}"},"operations":{"is_running":"An operation is currently running...","failed":"The {{operation}} failed. Please check the logs.","cancel":{"label":"Zrušit","title":"Cancel the current operation","confirm":"Are you sure you want to cancel the current operation?"},"backup":{"label":"Záloha","title":"Vytvořit zálohu","confirm":"Chcete začít novou zálohu?","without_uploads":"Ano (nepřikládej soubory)"},"download":{"label":"Stáhnout","title":"Stáhnout zálohu"},"destroy":{"title":"Odstranit zálohu","confirm":"Are you sure you want to destroy this backup?"},"restore":{"is_disabled":"Restore is disabled in the site settings.","label":"Obnovit","title":"Restore the backup"},"rollback":{"label":"Rollback","title":"Rollback the database to previous working state"}}},"export_csv":{"user_archive_confirm":"Jste si jistí, že chcete stáhnout všechny své příspěvky?","success":"Export byl spuštěn. O dokončení celého procesu budete informování pomocí zprávy.","failed":"Exportování selhalo. Prosím zkontrolujte logy.","rate_limit_error":"Příspěvky mohou být staženy jednou za den. Prosíme, zkuste to znovu zítra.","button_text":"Export","button_title":{"user":"Exportovat kompletní seznam uživatelů v CSV formátu.","staff_action":"Exportovat kompletní akce redakce v CSV formátu.","screened_email":"Exportovat kompletní seznam emailů v CSV formátu.","screened_ip":"Exportovat kompletní seznam IP adres v CSV formátu.","screened_url":"Exportovat kompletní seznam URL v CSV formátu."}},"export_json":{"button_text":"Export"},"invite":{"button_text":"Poslat pozvánky","button_title":"Poslat pozvánky"},"customize":{"title":"Přizpůsobení","long_title":"Přizpůsobení webu","css":"CSS","header":"header","top":"Vršek","footer":"Patička","head_tag":{"text":"\u003c/head\u003e","title":"HTML které bude vloženo před \u003c/head\u003e HTML tag"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML které bude vloženo před \u003c/body\u003e HTML tag"},"override_default":"Přetížit výchozí?","enabled":"Zapnuto?","preview":"náhled","undo_preview":"odstranit náhled","rescue_preview":"výchozí styl","explain_preview":"Náhled stránky s vlastním stylesheetem.","explain_undo_preview":"Vrátit se k aktuálnímu použitému vlastnímu stylesheetu.","explain_rescue_preview":"Zobrazit web s výchozím stylesheetem.","save":"Uložit","new":"Nové","new_style":"Nový styl","import":"Import","import_title":"Vyberte soubor nebo vložte text","delete":"Smazat","delete_confirm":"Smazat toto přizpůsobení?","about":"Změn CSS styly a hlavičky HTML na stránkách. Přidej přizpůsobení na začátek.","color":"Barva","opacity":"Neprůhlednost","copy":"Kopírovat","email_templates":{"title":"Šablona emailu","subject":"Předmět","multiple_subjects":"Tato šablona emailu má více předmětů.","body":"Tělo","none_selected":"Pro začátek editace zvolte šablonu emailu.","revert":"Vrátit změny","revert_confirm":"Opravdu chcete vrátit změny?"},"css_html":{"title":"CSS/HTML","long_title":"Přizpůsobení CSS a HTML"},"colors":{"title":"Barvy","long_title":"Barevná schémata","about":"Změn barvy použité na stránkách bez psaní CSS. Přidej schéma na začátek.","new_name":"Nové barevné schéma","copy_name_prefix":"Kopie","delete_confirm":"Chcete smazat toto barevné schéma?","undo":"zpět","undo_title":"Vrať svoje změny této barvy od doby kdy byla posledně uložena.","revert":"vrátit","revert_title":"Vrátit tuto barvu na výchozí barevné schéma Discourse.","primary":{"name":"primární","description":"Většina textu, ikon a okrajů."},"secondary":{"name":"sekundární","description":"Hlavní barva pozadí, a barva textu některých tlačítek."},"tertiary":{"name":"terciární","description":"Odkazy, některá tlačítka, notifikace, a barvy zdůraznění"},"quaternary":{"name":"kvarciální","description":"Navigační odkazy."},"header_background":{"name":"pozadí hlavičky","description":"Barva pozadí záhlaví stránky."},"header_primary":{"name":"primární záhlaví","description":"Text a ikony v záhlaví stránky."},"highlight":{"name":"zvýraznit","description":"Barva pozadí zvýrazněných prvků stránky, například příspěvků a témat."},"danger":{"name":"nebezpečí","description":"Barva zvýraznění pro akce jako mazání příspěvků a témat."},"success":{"name":"úspěch","description":"Používá se pro indikaci úspěšné akce."},"love":{"name":"láska","description":"Barva tlačítka Like."}}},"email":{"settings":"Nastavení","preview_digest":"Náhled souhrnu","sending_test":"Zkušební email se odesílá...","error":"\u003cb\u003eCHYBA\u003c/b\u003e - %{server_error}","test_error":"Nastal problém při odesílání testovacího emailu. Zkontroluj si, prosím, své mailové nastavení, ověř, že hosting neblokuje mailové spojení a zkus to znova.","sent":"Odeslané","skipped":"Přeskočené","sent_at":"Odesláno","time":"Čas","user":"Uživatel","email_type":"Typ emailu","to_address":"Komu","test_email_address":"testovací emailová adresa","send_test":"Odešli testovací email","sent_test":"odesláno!","delivery_method":"Způsob doručení","preview_digest_desc":"Zobraz náhled mailů se souhrnem posílaným neaktivním uživatelúm.","refresh":"Aktualizovat","format":"Formát","html":"html","text":"text","last_seen_user":"Uživatel byl naposled přítomen:","reply_key":"Klíč pro odpověď","skipped_reason":"Důvod přeskočení","incoming_emails":{"from_address":"Od koho","to_addresses":"Komu","cc_addresses":"Kopie","subject":"Předmět","error":"Chyba","none":"Žádné příchozí emaily nenalezeny.","modal":{"title":"Detaily příchozích emailů","error":"Chyba","headers":"Hlavičky","subject":"Předmět","body":"Obsah","rejection_message":"Email o nepřijetí"},"filters":{"from_placeholder":"odkoho@example.com","to_placeholder":"komu@example.com","cc_placeholder":"kopie@example.com","subject_placeholder":"Předmět...","error_placeholder":"Chyba"}},"logs":{"none":"Žádné záznamy nalezeny.","filters":{"title":"Filtr","user_placeholder":"uživatelské jméno","address_placeholder":"jmeno@priklad.cz","type_placeholder":"souhrn, registrace...","reply_key_placeholder":"klíč pro odpověď","skipped_reason_placeholder":"důvod"}}},"logs":{"title":"Logy a filtry","action":"Akce","created_at":"Zaznamenáno","last_match_at":"Poslední zázn.","match_count":"Záznamů","ip_address":"IP","topic_id":"ID tématu","post_id":"ID příspěvku","category_id":"ID kategorie","delete":"Smazat","edit":"Upravit","save":"Uložit","screened_actions":{"block":"blokovat","do_nothing":"nedělat nic"},"staff_actions":{"title":"Akce moderátorů","instructions":"Pro filtrování seznamu klikejte na uživatele a akce. Kliknutí na avatar otevře profil uživatele.","clear_filters":"Zobrazit vše","staff_user":"Moderátor","target_user":"Cílový uživatel","subject":"Předmět","when":"Kdy","context":"Kontext","details":"Podrobnosti","previous_value":"Předchozí","new_value":"Nové","diff":"Rozdíly","show":"Zobrazit","modal_title":"Podrobnosti","no_previous":"Předchozí hodnota neexistuje.","deleted":"Žádná nová hodnota. Záznam byl odstraněn.","actions":{"delete_user":"odstranit uživatele","change_trust_level":"z. důvěryhodnosti","change_username":"Změnit uživatelské jméno","change_site_setting":"změna nastavení","change_site_customization":"změna přizpůsobení","delete_site_customization":"odstranit přizpůsobení","suspend_user":"suspendovat uživatele","unsuspend_user":"zrušit suspendování","grant_badge":"udělit odznak","revoke_badge":"vzít odznak","check_email":"zkontrolujte email","delete_topic":"smazat téma","delete_post":"smazat příspěvek","impersonate":"vydávat se za uživatele","anonymize_user":"anonymní uživatel","change_category_settings":"změnit nastavení kategorie","delete_category":"smazat kategorii","create_category":"vytvořit kategorii"}},"screened_emails":{"title":"Filtrované emaily","description":"Při registraci nového účtu budou konzultovány následujíci adresy. Při shodě bude registrace zablokována, nebo bude provedena jiná akce.","email":"Email Address","actions":{"allow":"Povolit"}},"screened_urls":{"title":"Filtrované URL","description":"URL adresy v tomto seznamu byli použity v příspěvcích od spammerů.","url":"URL","domain":"Doména"},"screened_ips":{"title":"Filtrované IP","description":"Sledované IP adresy. Zvolte „Povolit“ pro přidání IP adresy do whitelistu.","delete_confirm":"Are you sure you want to remove the rule for %{ip_address}?","actions":{"block":"Zablokovat","do_nothing":"Povolit","allow_admin":"Povolit administraci"},"form":{"label":"Nové:","ip_address":"IP adresa","add":"Přidat","filter":"Vyhledat"}},"logster":{"title":"Chybové záznamy"}},"impersonate":{"title":"Přihlásit se jako","not_found":"Tento uživatel nebyl nalezen.","invalid":"Bohužel, za tohoto uživatele se nemůžete vydávat."},"users":{"title":"Uživatelé","create":"Přidat administrátora","last_emailed":"Email naposledy zaslán","not_found":"Bohužel uživatel s tímto jménem není v našem systému.","id_not_found":"Bohužel uživatel s tímto id není v našem systému.","active":"Aktivní","show_emails":"Ukázat emailové adresy","nav":{"new":"Noví","active":"Aktivní","pending":"Čeká na schválení","staff":"Štáb","suspended":"Zakázaní","blocked":"Blokovaní","suspect":"Podezřelí"},"approved":"Schválen?","approved_selected":{"one":"schválit uživatele","few":"schválit uživatele ({{count}})","other":"schválit uživatele ({{count}})"},"reject_selected":{"one":"reject user","few":"reject users ({{count}})","other":"reject users ({{count}})"},"titles":{"active":"Aktivní uživatelé","new":"Noví uživatelé","pending":"Uživatelé čekající na schválení","newuser":"Uživatelé s věrohodností 0 (Nový uživatel)","basic":"Uživatelé s věrohodností 1 (Základní uživatel)","member":"Uživatelé s věrohodností 2 (Člen)","regular":"Uživatelé s věrohodností 3 (Pravidelný uživatel)","leader":"Uživatelé s věrohodností 4 (Vedoucí)","staff":"Štáb","admins":"Admininstrátoři","moderators":"Moderátoři","blocked":"Blokovaní uživatelé","suspended":"Zakázaní uživatelé","suspect":"Podezřelí uživatelé"},"reject_successful":{"one":"Successfully rejected 1 user.","few":"Successfully rejected %{count} users.","other":"Successfully rejected %{count} users."},"reject_failures":{"one":"Failed to reject 1 user.","few":"Failed to reject %{count} users.","other":"Failed to reject %{count} users."},"not_verified":"Neověřeno","check_email":{"title":"Odhal emailovou adresu tohoto uživatele","text":"Zobrazit"}},"user":{"suspend_failed":"Nastala chyba při zakazování uživatele {{error}}","unsuspend_failed":"Nastala chyba při povolování uživatele {{error}}","suspend_duration":"Jak dlouho má zákaz platit? (dny)","suspend_duration_units":"(days)","suspend_reason_label":"Why are you suspending? This text \u003cb\u003ewill be visible to everyone\u003c/b\u003e on this user's profile page, and will be shown to the user when they try to log in. Keep it short.","suspend_reason":"Reason","suspended_by":"Suspended by","delete_all_posts":"Smazat všechny příspěvky","suspend":"Zakázat","unsuspend":"Povolit","suspended":"Zakázán?","moderator":"Moderátor?","admin":"Administrátor?","blocked":"Zablokovaný?","show_admin_profile":"Administrace","edit_title":"Upravit titul","save_title":"Uložit nadpis","refresh_browsers":"Vynutit obnovení prohlížeče","refresh_browsers_message":"Zpráva odeslána všem klientům!","show_public_profile":"Zobrazit veřejný profil","impersonate":"Vydávat se za uživatele","ip_lookup":"Vyhledávání IP adresy","log_out":"Odhlásit se","logged_out":"Uživatel byl odhlášen na všech zařízeních.","revoke_admin":"Odebrat administrátorská práva","grant_admin":"Udělit administrátorská práva","revoke_moderation":"Odebrat moderátorská práva","grant_moderation":"Udělit moderátorská práva","unblock":"Odblokovat","block":"Zablokovat","reputation":"Reputace","permissions":"Oprávnění","activity":"Aktivita","like_count":"Rozdaných / obdržených 'líbí se'","last_100_days":"Za posledních 100 dní","private_topics_count":"Počet soukromách témat","posts_read_count":"Přečteno příspěvků","post_count":"Vytvořeno příspěvků","topics_entered":"Témat zobrazeno","flags_given_count":"Uděleno nahlášení","flags_received_count":"Přijato nahlášení","warnings_received_count":"Obdržené varování","flags_given_received_count":"Rozdaná / obdržená nahlášení","approve":"Schválit","approved_by":"schválil","approve_success":"Uživatel bys schválen a byl mu zaslán aktivační email s instrukcemi.","approve_bulk_success":"Povedlo se! Všichni uživatelé byli schváleni a byly jim rozeslány notifikace.","time_read":"Čas strávený čtením","anonymize":"Anonymní uživatel","anonymize_confirm":"Jsi si JISTÝ, že chceš udělat tento účet anonymním? Změní se uživatelské jméno a email a vymažou se všechny informace v profilu.","anonymize_yes":"Ano, udělejte tento účet anonymním","anonymize_failed":"Nastal problém při anonymizování účtu.","delete":"Smazat uživatele","delete_forbidden_because_staff":"Správci ani moderátoři nemůžou být odstraněni.","delete_posts_forbidden_because_staff":"Nemohu smazat všechny příspěvky administrátorů a moderátorů.","delete_forbidden":{"one":"Uživatelé nemůžou být smazáni pokud mají příspěvky. Před smazáním uživatele smažte všechny jeho příspěvky. (Příspěvky starší než den nemůžou být smazány.)","few":"Uživatelé nemůžou být smazáni pokud mají příspěvky. Před smazáním uživatele smažte všechny jeho příspěvky. (Příspěvky starší než %{count} dny nemůžou být smazány.)","other":"Uživatelé nemůžou být smazáni pokud mají příspěvky. Před smazáním uživatele smažte všechny jeho příspěvky. (Příspěvky starší než %{count} dnů nemůžou být smazány.)"},"cant_delete_all_posts":{"one":"Všechny příspěvky nelze smazat. Některé příspěvky jsou starší než %{count} den. (Nastavení delete_user_max_post_age.)","few":"Všechny příspěvky nelze smazat. Některé příspěvky jsou starší než %{count} dny. (Nastavení delete_user_max_post_age.)","other":"Všechny příspěvky nelze smazat. Některé příspěvky jsou starší než %{count} dní. (Nastavení delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Nelze smazat všechny příspěvky, protože uživatel má více než 1 příspěvek. (delete_all_posts_max)","few":"Nelze smazat všechny příspěvky, protože uživatel má více než %{count} příspěvky. (delete_all_posts_max)","other":"Nelze smazat všechny příspěvky, protože uživatel má více než %{count} příspěvků. (delete_all_posts_max)"},"delete_confirm":"Jste si jistí, že chcete smazat tohoto uživatele? Tato akce je nevratná!","delete_and_block":"Smaž a \u003cb\u003eblokuj\u003c/b\u003e tento email a IP adresu.","delete_dont_block":"Pouze smazat","deleted":"Uživatel byl smazán.","delete_failed":"Nastala chyba při odstraňování uživatele. Ujistěte se, že jsou všechny příspěvky tohoto uživatele smazané, než budete uživatele mazat.","send_activation_email":"Odeslat aktivační email","activation_email_sent":"Aktivační email byl odeslán.","send_activation_email_failed":"Nastal problém při odesílání aktivačního emailu.","activate":"Aktivovat účet","activate_failed":"Nasstal problém při aktivování tohoto uživatele.","deactivate_account":"Deaktivovat účet","deactivate_failed":"Nastal problém při deaktivování tohoto uživatele.","unblock_failed":"Nastal problém při odblokování uživatele.","block_failed":"Nastal problém při blokování uživatele.","deactivate_explanation":"Uživatel bude muset znovu potvrdit emailovou adresu.","suspended_explanation":"Zakázaný uživatel se nemůže přihlásit.","block_explanation":"Zablokovaný uživatel nemůže přispívat nebo vytvářet nová témata.","trust_level_change_failed":"Nastal problém při změně důveryhodnosti uživatele.","suspend_modal_title":"Suspend User","trust_level_2_users":"Uživatelé důvěryhodnosti 2","trust_level_3_requirements":"Požadavky pro důvěryhodnost 3","trust_level_locked_tip":"úroveň důvěryhodnosti uzamčena. Systém nebude povyšovat ani degradovat uživatele","trust_level_unlocked_tip":"úroveň důvěryhodnosti odemčena. Systém může povyšovat nebo degradovat uživatele","lock_trust_level":"Zamknout úroveň důvěryhodnosti","unlock_trust_level":"Odemknout úroveň důvěryhodnosti","tl3_requirements":{"title":"Požadavky pro důvěryhodnost 3","value_heading":"Hodnota","requirement_heading":"Požadavek","visits":"Návštěv","days":"dní","topics_replied_to":"Odpovědí na témata","topics_viewed":"Zobrazeno témat","topics_viewed_all_time":"Zobrazeno témat (od počátku věků)","posts_read":"Přečteno příspěvků","posts_read_all_time":"Přečteno příspěvků (od počátku věků)","flagged_posts":"Nahlášené příspěvky","flagged_by_users":"Users Who Flagged","likes_given":"Rozdaných 'líbí se'","likes_received":"Obdržených 'líbí se'","likes_received_days":"Obdržených 'líbí se': unikátní dny","likes_received_users":"Obdržených 'líbí se': unikátní uživatelé","qualifies":"Splňuje úroveň důvěryhodnosti 3.","does_not_qualify":"Nesplňuje úroveň důvěryhodnosti 3.","will_be_promoted":"Bude brzy povýšen.","will_be_demoted":"Bude brzy degradován.","on_grace_period":"Currently in promotion grace period, will not be demoted.","locked_will_not_be_promoted":"Úroveň důvěryhodnosti uzamčena. Nikdy nebude povýšen.","locked_will_not_be_demoted":"Úroveň důvěryhodnosti uzamčena. Nikdy nebude degradován."},"sso":{"title":"Jednorázové přihlášení","external_id":"Externí ID","external_username":"Uživatelské jméno","external_name":"Jméno","external_email":"Email","external_avatar_url":"URL na profilový obrázek"}},"user_fields":{"title":"User Fields","help":"Přidej fields, které tvoji uživatelé mohou vyplnit.","create":"Vytvořit rozšíření","untitled":"Untitled","name":"Field Name","type":"Field Type","description":"Field Description","save":"Uložit","edit":"Upravit","delete":"Smazat","cancel":"Zrušit","delete_confirm":"Určitě chcete smazat toto rozšíření?","options":"Možnosti","required":{"title":"Povinné pro registraci?","enabled":"povinné","disabled":"není povinné"},"editable":{"title":"Editovatelné po registraci?","enabled":"editovatelné","disabled":"není editovatelné"},"show_on_profile":{"title":"Zveřejnit na uživatelském profilu?","enabled":"zveřejněno na profilu","disabled":"nezveřejněno na profilu"},"show_on_user_card":{"title":"Zobrazit na kartě uživatele?","enabled":"zobrazeno na kartě uživatele"},"field_types":{"text":"Text Field","confirm":"Potvrzení","dropdown":"Menu"}},"site_text":{"description":"Můžete uzpůsobit jakýkoli text na fóru. Začnětj s vyhledáváním níže, prosím:","search":"Hledat text, který byste chtěli upravit","title":"Texty","edit":"upravit","revert":"Vrátit změny","revert_confirm":"Opravdu chcete vrátit změny?","go_back":"Zpět na hledání","recommended":"Doporučujeme uzpůsobit následující text tak, aby vám vyhovoval:","show_overriden":"Zobrazit pouze změněná nastavení"},"site_settings":{"show_overriden":"Zobrazit pouze změněná nastavení","title":"Nastavení","reset":"obnovit výchozí","none":"žádné","no_results":"Nenalezeny žádné výsledky.","clear_filter":"Zrušit","add_url":"přidat URL","add_host":"přidat hostitele","categories":{"all_results":"Všechny","required":"Nezbytnosti","basic":"Základní nastavení","users":"Uživatelé","posting":"Přispívání","email":"Emaily","files":"Soubory","trust":"Důvěryhodnosti","security":"Bezpečnost","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limity a omezení","developer":"Vývojáři","embedding":"Embedding","legal":"Právní záležitosti","uncategorized":"Ostatní","backups":"Zálohy","login":"Login","plugins":"Pluginy","user_preferences":"Uživatelká nastavení","tags":"Tagy"}},"badges":{"title":"Odznaky","new_badge":"Nový odznak","new":"Nové","name":"Jméno","badge":"Odznak","display_name":"Zobrazované jméno","description":"Popis","long_description":"Dlouhý Popis","badge_type":"Typ odznaku","badge_grouping":"Skupina","badge_groupings":{"modal_title":"Sdružování odznaků"},"granted_by":"Uděleno","granted_at":"Uděleno v","reason_help":"(Odkaz na příspěvek nebo téma)","save":"Uložit","delete":"Smazat","delete_confirm":"Určitě chcete tento oznak smazat?","revoke":"zrušit","reason":"Důvod","expand":"Rozevřít \u0026hellip;","revoke_confirm":"Určitě chcete tento odznak odejmout?","edit_badges":"Upravit odznaky","grant_badge":"Udělit odznak","granted_badges":"Udělené odznaky","grant":"Udělit","no_user_badges":"%{name} nezískal žádné oznaky.","no_badges":"Nejsou tu žádné odznaky, které by se dali rozdat.","none_selected":"Vyberte odznak, abyste mohli začít","allow_title":"Povolit užití odzanku jako titul","multiple_grant":"Může být přiděleno několikrát","listable":"Zobrazit odznak na veřejné stránce s odzanky","enabled":"Povolit odznaky","icon":"Ikona","image":"Obrázek","icon_help":"Použijte buď Font Awesome nebo URL k obrázku.","query":"Dotaz na odznak (SQL)","trigger":"Spouštěč","trigger_type":{"none":"Aktualizujte denně","post_action":"Když uživatel reaguje na příspěvek","post_revision":"Když uživatel upraví nebo vytvoří příspěvek","trust_level_change":"Když uživatel změní důvěryhodnost","user_change":"Když je uživatel upraven nebo vytvořen"},"preview":{"link_text":"Náhled udělených odznaků","plan_text":"Náhled s plánem dotazu","modal_title":"Náhled dotazu na odznak","sql_error_header":"Bohužel, nastala chyba s dotazem.","error_help":"Prohlédněte si následující odkazy, které vám zodpoví dotazy o odznacích.","bad_count_warning":{"header":"VAROVÁNÍ!"},"no_grant_count":"Žádné odznaky k udělení.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e odznak k udělení.","few":"\u003cb\u003e%{count}\u003c/b\u003e odznaků k udělení.","other":"\u003cb\u003e%{count}\u003c/b\u003e odznaků k udělení."},"sample":"Příklad:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link} at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Vložte nové emoji, které bude dostupné pro všechny na fóru. (Protip: můžete přetáhnout několik souborů najednou.)","add":"Vložit nový Emoji","name":"Název","image":"Obrázek","delete_confirm":"Určitě chcete smazat :%{name}: emoji?"},"embedding":{"get_started":"Pokud chceš zabudovat Discourse do jiných stránek, začni s přidáním hostu.","confirm_delete":"Opravdu chcete smazat tento host?","sample":"Abyste vytvořili a zabudovali témata z discourse, použijte následující HTML kód na vašem webu. Nahraď \u003cb\u003eREPLACE_ME\u003c/b\u003e celkovým URL stránky, do které je zabudováváš.","title":"Zabudování","host":"Povolené hosty","edit":"upravit","category":"Příspěvek do kategorie","add_host":"Přidat host","settings":"Nastavení zabudování","feed_settings":"Nastavení odebírání","crawling_settings":"Nastavení procházení","embed_by_username":"Uživatelské jméno pro vytvářéní témat","embed_post_limit":"Maximální počet příspěvků k zabudování","embed_truncate":"Useknout zabudované příspěvky","feed_polling_enabled":"Importovat příspěvky pomocí RSS/ATOM","save":"Uložit nastavení zabudování"},"permalink":{"title":"Trvalé odkazy","url":"URL","topic_id":"ID tématu","topic_title":"Téma","post_id":"ID příspěvku","post_title":"Příspěvek","category_id":"ID kategorie","category_title":"Kategorie","external_url":"Externí URL","delete_confirm":"Opravdu chcete smazat tento trvalý odkaz?","form":{"label":"Nové:","add":"Přidat","filter":"Hledat (URL nebo externí URL)"}}}}},"en":{"js":{"s3":{"regions":{"ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","cn_north_1":"China (Beijing)"}},"groups":{"index":"Groups"},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write"},"too_few_topics_and_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","too_few_topics_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics. New visitors need some conversations to read and respond to.","too_few_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"summary":{"description":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies.","description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"}},"search":{"too_short":"Your search term is too short."},"topics":{"none":{"educate":{"new":"\u003cp\u003eYour new topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered new and will show a \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e indicator if they were created in the last 2 days.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e","unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"read_more_MF":"There { UNREAD, plural, =0 {} one { is \u003ca href='/unread'\u003e1 unread\u003c/a\u003e } other { are \u003ca href='/unread'\u003e# unread\u003c/a\u003e } } { NEW, plural, =0 {} one { {BOTH, select, true{and } false {is } other{}} \u003ca href='/new'\u003e1 new\u003c/a\u003e topic} other { {BOTH, select, true{and } false {are } other{}} \u003ca href='/new'\u003e# new\u003c/a\u003e topics} } remaining, or {CATEGORY, select, true {browse other topics in {catLink}} false {{latestLink}} other {}}","auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"}},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"controls":"Topic Controls","merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."}},"post":{"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","wiki":{"about":"this post is a wiki"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","actions":{"people":{"off_topic":"flagged this as off-topic","spam":"flagged this as spam","inappropriate":"flagged this as inappropriate","notify_moderators":"notified moderators","notify_user":"sent a message","bookmark":"bookmarked this","like":"liked this","vote":"voted for this"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph","groups":"All groups"}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"operations":{"restore":{"confirm":"Are you sure you want to restore this backup?"},"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"customize":{"embedded_css":"Embedded CSS"},"email":{"title":"Emails","templates":"Templates","bounced":"Bounced","received":"Received","rejected":"Rejected"},"logs":{"staff_actions":{"actions":{"change_site_text":"change site text","roll_up":"roll up IP blocks","block_user":"block user","unblock_user":"unblock user","grant_admin":"grant admin","revoke_admin":"revoke admin","grant_moderation":"grant moderation","revoke_moderation":"revoke moderation","backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}},"screened_ips":{"roll_up_confirm":"Are you sure you want to roll up commonly screened IP addresses into subnets?","rolled_up_some_subnets":"Successfully rolled up IP ban entries to these subnets: %{subnets}.","rolled_up_no_subnet":"There was nothing to roll up.","roll_up":{"text":"Roll up","title":"Creates new subnet ban entries if there are at least 'min_ban_entries_for_roll_up' entries."}}},"impersonate":{"help":"Use this tool to impersonate a user account for debugging purposes. You will have to log out once finished."},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","block_confirm":"Are you sure you want to block this user? They will not be able to create any new topics or posts.","block_accept":"Yes, block this user","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"disabled":"not shown on user card"}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"badges":{"target_posts":"Query targets posts","auto_revoke":"Run revocation query daily","show_posts":"Show post granting badge on badge page","trigger_type":{"post_processed":"After a post is processed"},"preview":{"bad_count_warning":{"text":"There are missing grant samples. This happens when the badge query returns user IDs or post IDs that do not exist. This may cause unexpected results later on - please double-check your query."}}},"embedding":{"path_whitelist":"Path Whitelist","feed_description":"Providing an RSS/ATOM feed for your site can improve Discourse's ability to import your content.","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_username_key_from_feed":"Key to pull discourse username from feed","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_whitelist_selector":"CSS selector for elements that are allowed in embeds","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","embed_classname_whitelist":"Allowed CSS class names","feed_polling_url":"URL of RSS/ATOM feed to crawl"}}}}};
I18n.locale = 'cs';
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
//! locale : czech (cs)
//! author : petrbela : https://github.com/petrbela

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var months = 'leden_únor_březen_duben_květen_červen_červenec_srpen_září_říjen_listopad_prosinec'.split('_'),
        monthsShort = 'led_úno_bře_dub_kvě_čvn_čvc_srp_zář_říj_lis_pro'.split('_');
    function plural(n) {
        return (n > 1) && (n < 5) && (~~(n / 10) !== 1);
    }
    function translate(number, withoutSuffix, key, isFuture) {
        var result = number + ' ';
        switch (key) {
        case 's':  // a few seconds / in a few seconds / a few seconds ago
            return (withoutSuffix || isFuture) ? 'pár sekund' : 'pár sekundami';
        case 'm':  // a minute / in a minute / a minute ago
            return withoutSuffix ? 'minuta' : (isFuture ? 'minutu' : 'minutou');
        case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'minuty' : 'minut');
            } else {
                return result + 'minutami';
            }
            break;
        case 'h':  // an hour / in an hour / an hour ago
            return withoutSuffix ? 'hodina' : (isFuture ? 'hodinu' : 'hodinou');
        case 'hh': // 9 hours / in 9 hours / 9 hours ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'hodiny' : 'hodin');
            } else {
                return result + 'hodinami';
            }
            break;
        case 'd':  // a day / in a day / a day ago
            return (withoutSuffix || isFuture) ? 'den' : 'dnem';
        case 'dd': // 9 days / in 9 days / 9 days ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'dny' : 'dní');
            } else {
                return result + 'dny';
            }
            break;
        case 'M':  // a month / in a month / a month ago
            return (withoutSuffix || isFuture) ? 'měsíc' : 'měsícem';
        case 'MM': // 9 months / in 9 months / 9 months ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'měsíce' : 'měsíců');
            } else {
                return result + 'měsíci';
            }
            break;
        case 'y':  // a year / in a year / a year ago
            return (withoutSuffix || isFuture) ? 'rok' : 'rokem';
        case 'yy': // 9 years / in 9 years / 9 years ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'roky' : 'let');
            } else {
                return result + 'lety';
            }
            break;
        }
    }

    var cs = moment.defineLocale('cs', {
        months : months,
        monthsShort : monthsShort,
        monthsParse : (function (months, monthsShort) {
            var i, _monthsParse = [];
            for (i = 0; i < 12; i++) {
                // use custom parser to solve problem with July (červenec)
                _monthsParse[i] = new RegExp('^' + months[i] + '$|^' + monthsShort[i] + '$', 'i');
            }
            return _monthsParse;
        }(months, monthsShort)),
        shortMonthsParse : (function (monthsShort) {
            var i, _shortMonthsParse = [];
            for (i = 0; i < 12; i++) {
                _shortMonthsParse[i] = new RegExp('^' + monthsShort[i] + '$', 'i');
            }
            return _shortMonthsParse;
        }(monthsShort)),
        longMonthsParse : (function (months) {
            var i, _longMonthsParse = [];
            for (i = 0; i < 12; i++) {
                _longMonthsParse[i] = new RegExp('^' + months[i] + '$', 'i');
            }
            return _longMonthsParse;
        }(months)),
        weekdays : 'neděle_pondělí_úterý_středa_čtvrtek_pátek_sobota'.split('_'),
        weekdaysShort : 'ne_po_út_st_čt_pá_so'.split('_'),
        weekdaysMin : 'ne_po_út_st_čt_pá_so'.split('_'),
        longDateFormat : {
            LT: 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY H:mm',
            LLLL : 'dddd D. MMMM YYYY H:mm'
        },
        calendar : {
            sameDay: '[dnes v] LT',
            nextDay: '[zítra v] LT',
            nextWeek: function () {
                switch (this.day()) {
                case 0:
                    return '[v neděli v] LT';
                case 1:
                case 2:
                    return '[v] dddd [v] LT';
                case 3:
                    return '[ve středu v] LT';
                case 4:
                    return '[ve čtvrtek v] LT';
                case 5:
                    return '[v pátek v] LT';
                case 6:
                    return '[v sobotu v] LT';
                }
            },
            lastDay: '[včera v] LT',
            lastWeek: function () {
                switch (this.day()) {
                case 0:
                    return '[minulou neděli v] LT';
                case 1:
                case 2:
                    return '[minulé] dddd [v] LT';
                case 3:
                    return '[minulou středu v] LT';
                case 4:
                case 5:
                    return '[minulý] dddd [v] LT';
                case 6:
                    return '[minulou sobotu v] LT';
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'za %s',
            past : 'před %s',
            s : translate,
            m : translate,
            mm : translate,
            h : translate,
            hh : translate,
            d : translate,
            dd : translate,
            M : translate,
            MM : translate,
            y : translate,
            yy : translate
        },
        ordinalParse : /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return cs;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D. MMMM'); };
moment.fn.shortDate = function(){ return this.format('D. MMMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D. MMMM YYYY H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['cs'] = function (n) {
  if (n == 0) return ["zero", "none", "other"];
  if (n == 1) return "one";
  if (n >= 2 && n <= 4) return "few";
  return "other";
};
