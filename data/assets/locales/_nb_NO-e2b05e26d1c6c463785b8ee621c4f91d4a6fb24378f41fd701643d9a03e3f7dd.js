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
I18n._compiledMFs = {"topic.read_more_MF" : function(){ return "Invalid Format: Error: Plural Function not found for locale: nb_NO/nError: Plural Function not found for locale: nb_NO";}, "posts_likes_MF" : function(){ return "Invalid Format: Error: Plural Function not found for locale: nb_NO/nError: Plural Function not found for locale: nb_NO";}};

MessageFormat.locale.en = function ( n ) {
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
I18n.translations = {"nb_NO":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Byte"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","long_no_year":"D MMM h:mm a","long_no_year_no_time":"D MMM","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM, YYYY h:mm a","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1t","other":"%{count}t"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1år","other":"%{count}år"},"over_x_years":{"one":"\u003e 1år","other":"\u003e %{count}år"},"almost_x_years":{"one":"1år","other":"%{count}år"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minutt","other":"%{count} minutter"},"x_hours":{"one":"1 time","other":"%{count} timer"},"x_days":{"one":"1 dag","other":"%{count} dager"},"date_year":"D MMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 minutt siden","other":"%{count} minutter siden"},"x_hours":{"one":"1 time siden","other":"%{count} timer siden"},"x_days":{"one":"1 dag siden","other":"%{count} dager siden"}},"later":{"x_days":{"one":"1 dag senere","other":"%{count} dager senere"},"x_months":{"one":"1 måned senere","other":"%{count} måneder senere"},"x_years":{"one":"1 år senere","other":"%{count} år senere"}},"previous_month":"Forrige Måned","next_month":"Neste Måned"},"share":{"topic":"del en lenke til dette emnet","post":"innlegg #%{postNumber}","close":"lukk","twitter":"del denne lenken på Twitter","facebook":"del denne lenken på Facebook","google+":"del denne lenken på Google+","email":"del denne lenken i en e-post"},"action_codes":{"public_topic":"gjorde dette emnet offentlig %{when}","private_topic":"gjorde dette emnet privat %{when}","invited_user":"inviterte %{who} %{when}","removed_user":"fjernet %{who} %{when}","autoclosed":{"enabled":"lukket %{when}","disabled":"åpnet %{when}"},"closed":{"enabled":"lukket %{when}","disabled":"åpnet %{when}"},"archived":{"enabled":"arkivert %{when}","disabled":"fjernet fra arkiv %{when}"},"pinned":{"enabled":"festet %{when}","disabled":"avfestet %{when}"},"pinned_globally":{"enabled":"festet globalt %{when}"}},"topic_admin_menu":"admin-handlinger for emne","emails_are_disabled":"All utgående e-post har blitt deaktivert globalt av en administrator. Ingen e-postvarslinger vil bli sendt.","edit":"rediger tittelen og kategorien til dette emnet","not_implemented":"Beklager, denne funksjonen har ikke blitt implementert enda.","no_value":"Nei","yes_value":"Ja","generic_error":"Beklager, det har oppstått en feil.","generic_error_with_reason":"Det oppstod et problem: %{error}","sign_up":"Registrer deg","log_in":"Logg inn","age":"Alder","joined":"Ble medlem","admin_title":"Admin","flags_title":"Rapporteringer","show_more":"vis mer","show_help":"alternativer","links":"Lenker","links_lowercase":{"one":"link","other":"linker"},"faq":"FAQ","guidelines":"Retningslinjer","privacy_policy":"Personvern","privacy":"Personvern","terms_of_service":"Betingelser","mobile_view":"Mobilvisning","desktop_view":"Skrivebordsvisning","you":"Du","or":"eller","now":"akkurat nå","read_more":"les mer","more":"Mer","less":"Mindre","never":"aldri","every_30_minutes":"hvert 30 minutt","every_hour":"hver time","daily":"daglig","weekly":"ukentlig","every_two_weeks":"annenhver uke","every_three_days":"hver tredje dag","max_of_count":"maksimum av {{count}}","alternation":"eller","character_count":{"one":"{{count}} tegn","other":"{{count}} tegn"},"suggested_topics":{"title":"Anbefalte emner","pm_title":"Foreslåtte Meldinger"},"about":{"simple_title":"Om","title":"Om %{title}","stats":"Nettstedsstatistikk","our_admins":"Våre administratorer","our_moderators":"Våre moderatorer","stat":{"all_time":"Gjennom tidene","last_7_days":"Siste 7 dager","last_30_days":"Siste 30 dager"},"like_count":"Likes","topic_count":"Emner","post_count":"Innlegg","user_count":"Nye brukere","active_user_count":"Aktive brukere","contact":"Kontakt Oss","contact_info":"Hvis noe kritisk skulle oppstå eller det er en hastesak som påvirker siden, ta kontakt på %{contact_info}."},"bookmarked":{"title":"Bokmerke","clear_bookmarks":"Fjern bokmerker","help":{"bookmark":"Klikk for å bokmerke det første innlegget i dette emnet","unbookmark":"Klikk for å fjerne alle bokmerker i dette emnet"}},"bookmarks":{"not_logged_in":"beklager, du må være innlogget for å kunne bokmerke innlegg","created":"du har bokmerket dette innlegget","not_bookmarked":"du har lest dette innlegget, trykk for å bokmerke det","last_read":"dette er det siste innlegget du har lest, trykk for å bokmerke det","remove":"Fjern bokmerke","confirm_clear":"Er du sikker på at du vil fjerne alle bokmerkene fra dette emnet?"},"topic_count_latest":{"one":"{{count}} nytt eller oppdatert emne","other":"{{count}} nye eller oppdaterte emner"},"topic_count_unread":{"one":"{{count}} ulest emne","other":"{{count}} uleste emner"},"topic_count_new":{"one":"{{count}} nytt emne","other":"{{count}} nye emner"},"click_to_show":"Klikk for å vise","preview":"forhåndsvisning","cancel":"avbryt","save":"Lagre endringer","saving":"Lagrer...","saved":"Lagret!","upload":"Last opp","uploading":"Laster opp...","uploading_filename":"Laster opp {{filename}}...","uploaded":"Lastet opp!","enable":"Aktiver","disable":"Deaktiver","undo":"Angre","revert":"Reverser","failed":"Mislykket","banner":{"close":"Fjern denne banneren","edit":"Endre denne banneren \u003e\u003e"},"choose_topic":{"none_found":"Ingen emner funnet.","title":{"search":"Søk etter et emne ved navn, url eller id:","placeholder":"skriv emnetittelen her"}},"queue":{"topic":"Emne:","approve":"Godkjenn","reject":"Avvis","delete_user":"Slett Bruker","title":"Trenger godkjenning","none":"Det er ingen innlegg som må evalueres.","edit":"Rediger","cancel":"Avbryt","view_pending":"vis påventende innlegg","has_pending_posts":{"one":"Dette emnet har \u003cb\u003e1\u003c/b\u003e innlegg som venter på godkjenning","other":"Dette emnet har \u003cb\u003e{{count}}\u003c/b\u003e innlegg som venter på godkjenning"},"confirm":"Lagre endringer","approval":{"title":"Innlegg Behøver Godkjenning","description":"Vi har mottatt ditt nye innlegg men det krever godkjenning av en moderator før det vises. Venligst vær tålmodig.","pending_posts":{"one":"Du har \u003cstrong\u003e1\u003c/strong\u003e innlegg som venter på godkjenning.","other":"Du har \u003cstrong\u003e{{count}}\u003c/strong\u003e innlegg som venter på godkjenning."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e postet \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e postet \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e besvarte \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e besvarte \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e besvarte \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e besvarte \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nevnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nevnte \u003ca href='{{user2Url}}'\u003edeg\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e nevnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postet av \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postet av \u003ca href='{{userUrl}}'\u003edeg\u003c/a\u003e","sent_by_user":"Sendt av \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Sendt av \u003ca href='{{userUrl}}'\u003edeg\u003c/a\u003e"},"directory":{"filter_name":"filtrer etter navn","title":"Brukere","likes_given":"Gitt","likes_received":"Mottatt","topics_entered_long":"Emner Sett","time_read":"Tid lest","topic_count":"Emner","topic_count_long":"Emner startet","post_count":"Svar","post_count_long":"Svar","no_results":"Ingen treff","days_visited":"Besøk","days_visited_long":"Dager besøkt","posts_read":"Lest","posts_read_long":"Lest","total_rows":{"one":"1 bruker","other":"%{count} brukere"}},"groups":{"empty":{"posts":"Det er ingen innlegg av medlemmene i denne gruppen.","members":"Det er ingen medlemmer i denne gruppen.","messages":"Det er ingen meldinger for denne gruppen."},"add":"Legg til","selector_placeholder":"Legg til medlemmer","owner":"eier","visible":"Gruppen er synlig for alle brukere","title":{"one":"gruppe","other":"grupper"},"members":"Medlemmer","topics":"Emner","posts":"Innlegg","mentions":"Omtalelser","messages":"Meldinger","alias_levels":{"nobody":"Ingen","only_admins":"Kun administratorer","mods_and_admins":"Kun moderatorer og administratorer","members_mods_and_admins":"Kun gruppemedlemmer, moderatorer og administratorer","everyone":"Alle"},"trust_levels":{"none":"ingen"},"notifications":{"watching":{"title":"Følger"},"tracking":{"title":"Sporer"},"regular":{"title":"Normal","description":"Du vil bli varslet hvis noen nevner ditt @navn eller svarer deg."},"muted":{"title":"Dempet"}}},"user_action_groups":{"1":"Liker tildelt","2":"Liker mottatt","3":"Bokmerker","4":"Emner","5":"Svar","6":"Svar","7":"Omtalelser","9":"Sitater","11":"Redigeringer","12":"Sendte elementer","13":"Innboks","14":"Venter"},"categories":{"all":"Alle","all_subcategories":"alle","no_subcategory":"ingen","category":"Kategori","reorder":{"save":"Lagre Rekkefølge"},"posts":"Innlegg","topics":"Emner","latest":"Siste","latest_by":"siste av","toggle_ordering":"veksle rekkefølge","subcategories":"Underkategorier","topic_stat_sentence":{"one":"%{count} nytt emner de siste %{unit}.","other":"%{count} nye emner de siste %{unit}."}},"ip_lookup":{"title":"Slå opp IP-adresse","hostname":"Vertsnavn","location":"Posisjon","location_not_found":"(ukjent)","organisation":"Organisasjon","phone":"Telefon","other_accounts":"Andre kontoer med denne IP-adressen:","delete_other_accounts":"Slett %{count}","username":"brukernavn","trust_level":"TN","read_time":"lesetid","topics_entered":"emner laget","post_count":"# innlegg","confirm_delete_other_accounts":"Er du sikker på at du vil slette disse kontoene?"},"user_fields":{"none":"(velg et alternativ)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Demp","edit":"Rediger innstillinger","download_archive":"Last ned mine innlegg","new_private_message":"Ny Melding","private_message":"Melding","private_messages":"Meldinger","activity_stream":"Aktivitet","preferences":"Innstillinger","bookmarks":"Bokmerker","bio":"Om meg","invited_by":"Invitert av","trust_level":"Tillitsnivå","notifications":"Varsler","statistics":"Statistikk","desktop_notifications":{"label":"Skrivebordsvarslinger","perm_default":"Slå på varslinger","perm_denied_btn":"Tillatelse avslått","disable":"Slå av varslinger","enable":"Slå på varslinger","each_browser_note":"Merk: Du må endre denne innstillinger for hver nettleser du bruker."},"dismiss_notifications_tooltip":"Merk alle uleste varslinger som lest","disable_jump_reply":"Ikke hopp til ditt nye innlegg etter svar","dynamic_favicon":"Vis antall nye / oppdaterte emner på nettleser ikonet","external_links_in_new_tab":"Åpne alle eksterne lenker i ny fane","enable_quoting":"Aktiver svar med sitat for uthevet tekst","change":"Endre","moderator":"{{user}} er en moderator","admin":"{{user}} er en admin","moderator_tooltip":"Denne brukeren er en moderator","admin_tooltip":"Denne brukeren er en administrator","blocked_tooltip":"Denne brukeren er blokkert","suspended_notice":"Denne brukeren er bannlyst til {{date}}.","suspended_reason":"Begrunnelse:","github_profile":"Github","watched_categories":"Følger","tracked_categories":"Sporet","muted_categories":"Dempet","delete_account":"Slett kontoen min","delete_account_confirm":"Er du sikker på at du vil slette kontoen din permanent? Denne handlingen kan ikke angres!","deleted_yourself":"Slettingen av din konto har vært vellykket.","delete_yourself_not_allowed":"Kontoen din kan ikke slettes akkurat nå. Kontakt en administrator til å slette kontoen for deg.","unread_message_count":"Meldinger","admin_delete":"Slett","users":"Brukere","muted_users":"Dempet","muted_users_instructions":"Skjul alle varsler fra denne brukeren","staff_counters":{"flags_given":"nyttige rapporteringer","flagged_posts":"rapporterte innlegg","deleted_posts":"slettede innlegg","suspensions":"suspenderinger","warnings_received":"advarsler"},"messages":{"all":"Alle","inbox":"Innboks","sent":"Sendt","groups":"Mine grupper","bulk_select":"Velg meldinger","move_to_inbox":"Flytt til inboks","select_all":"Velg Alle"},"change_password":{"success":"(e-post sendt)","in_progress":"(sender e-post)","error":"(feil)","action":"Send e-post for passordnullstilling","set_password":"Sett passord"},"change_about":{"title":"Rediger om meg"},"change_username":{"title":"Endre brukernavn","taken":"Beklager, det brukernavnet er tatt.","error":"Det skjedde en feil ved endring av ditt brukernavn.","invalid":"Det brukernavnet er ugyldig. Det kan bare inneholde nummer og bokstaver."},"change_email":{"title":"Endre e-postadresse","taken":"Beklager, den e-postadressen er ikke tilgjengelig.","error":"Det oppsto en feil ved endring av din e-postadresse. Kanskje den adressen allerede er i bruk?","success":"Vi har sendt en e-post til den adressen. Vennligst følg meldingens instruksjoner for bekreftelse."},"change_avatar":{"title":"Bytt profilbilde","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basert på","gravatar_title":"Endre din avatar på Gravatars nettside","refresh_gravatar_title":"Oppdater din Gravatar","letter_based":"Systemtildelt profilbilde","uploaded_avatar":"Egendefinert bilde","uploaded_avatar_empty":"Legg til egendefinert bilde","upload_title":"Last opp bilde","upload_picture":"Last opp bilde","image_is_not_a_square":"Vi har beskjært bildet ditt, høyde og bredde er ikke lik"},"change_profile_background":{"title":"Profilbakgrunn","instructions":"Profil bakgrunner vil bli sentrert med en standard bredde på 850px"},"change_card_background":{"title":"Brukerkort bakgrunn","instructions":"Bakgrunnsbilder vil bli sentrert og ha en standard bredde på 590px."},"email":{"title":"E-post","instructions":"Blir aldri vist offentlig","ok":"Vi sender deg en e-post for å bekrefte","invalid":"Vennligst oppgi en gyldig e-postadresse","authenticated":"Din e-post har blitt autentisert av {{provider}}"},"name":{"title":"Navn","instructions":"Ditt fulle navn (valgfritt)","instructions_required":"Ditt fulle navn","too_short":"Navnet ditt er for kort.","ok":"Navnet ditt ser bra ut."},"username":{"title":"Brukernavn","instructions":"Unikt, kort og uten mellomrom.","short_instructions":"Folk kan nevne deg som @{{username}}.","available":"Ditt brukernavn er tilgjengelig.","global_match":"E-post stemmer med det registrerte brukernavnet","global_mismatch":"Allerede registrert. Prøv {{suggestion}}?","not_available":"Ikke tilgjengelig. Prøv {{suggestion}}?","too_short":"Ditt brukernavn er for kort.","too_long":"Ditt brukernavn er for langt.","checking":"Sjekker brukernavnets tilgjengelighet...","enter_email":"Brukernavn funnet; oppgi samsvarende e-post","prefilled":"E-post stemmer med dette registrerte brukernavnet"},"locale":{"title":"Språk for grensesnitt","instructions":"Språk for grensesnitt. Endringen vil tre i kraft når du oppdaterer siden.","default":"(standard)"},"password_confirmation":{"title":"Passord igjen"},"last_posted":"Siste Innlegg","last_emailed":"Sist kontaktet","last_seen":"Sist sett","created":"Medlem fra","log_out":"Logg ut","location":"Posisjon","card_badge":{"title":"Brukerkort merke"},"website":"Nettsted","email_settings":"E-post","like_notification_frequency":{"title":"Varsle når likt","always":"Alltid","first_time_and_daily":"Første gnag et innlegg blir likt og daglig","first_time":"Første gang et innlegg blir likt","never":"Aldri"},"email_previous_replies":{"always":"alltid","never":"aldri"},"email_digests":{"every_30_minutes":"hvert 30 minutt","every_hour":"hver time","daily":"daglig","every_three_days":"hver tredje dag","weekly":"ukentlig","every_two_weeks":"annenhver uke"},"email_direct":"Motta en e-post når noen siterer deg, svarer på dine innlegg, nevner ditt brukernavn eller inviterer deg til et emne","email_private_messages":"Motta en e-post når noen sender deg en melding","email_always":"Send meg varsler på epost selv når jeg er aktiv på nettstedet","other_settings":"Annet","categories_settings":"Kategorier","new_topic_duration":{"label":"Anse emner som nye når","not_viewed":"Jeg har ikke sett på dem enda.","last_here":"opprettet siden jeg var her sist"},"auto_track_topics":"Følg automatisk emner jeg åpner","auto_track_options":{"never":"aldri","immediately":"øyeblikkelig","after_1_minute":"etter 1 minutt","after_2_minutes":"etter 2 minutt","after_3_minutes":"etter 3 minutt","after_4_minutes":"etter 4 minutt","after_5_minutes":"etter 5 minut","after_10_minutes":"etter 10 minutt"},"invited":{"search":"skriv for å søke etter invitasjoner...","title":"invitasjoner","user":"Invitert bruker","sent":"Sendt","redeemed":"Løs inn invitasjoner","redeemed_tab":"Brukt","redeemed_at":"Løst inn ved","pending":"Ventende invitasjoner","pending_tab":"På vent","topics_entered":"Emner vist","posts_read_count":"Innlegg lest","expired":"Denne invitasjonen har utløpt","rescind":"Fjern","rescinded":"Invitasjon fjernet","reinvite":"Send invitasjon igjen","reinvited":"Invitasjon sendt igjen","time_read":"Lesetid","days_visited":"Dager besøkt","account_age_days":"Kontoalder i dager","create":"Send en invitasjon","bulk_invite":{"none":"Du har ikke invitert noen hit enda. Du kan sende individuelle invitasjoner, eller invitere en gruppe folk på en gang ved å \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003elaste opp en fil med flere invitasjoner\u003c/a\u003e.","text":"Masseinvitasjon fra fil","uploading":"Laster opp...","success":"Filen er lastet opp, du vil motta en melding når prosessesen er ferdig","error":"En feil oppsto ved opplastingen av '{{filename}}': {{message}}"}},"password":{"title":"Passord","too_short":"Passordet ditt er for kort","common":"Det passordet er for vanlig.","same_as_username":"Ditt passord er det samme som ditt brukernavn.","same_as_email":"Ditt passord er det samme som din e-post.","ok":"Passordet ditt ser bra ut","instructions":"Minst %{count} tegn."},"summary":{"title":"Oppsummering","stats":"Statistikk","top_replies":"Mest Populære Svar","top_topics":"Mest Populære Emner","more_topics":"Flere Emner"},"associated_accounts":"Innloggingsforsøk","ip_address":{"title":"Siste IP-adresse"},"registration_ip_address":{"title":"Registreringens IP-adresse."},"avatar":{"title":"Profilbilde","header_title":"Profil, meldinger, bokmerker og innstillinger"},"title":{"title":"Tittel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Skrevet av","sent_by":"Sendt av","private_message":"melding","the_topic":"emnet"}},"loading":"Laster...","errors":{"prev_page":"ved lasting","reasons":{"network":"Nettverksfeil","server":"Serverfeil","forbidden":"Tilgang avslått","unknown":"Feil","not_found":"Side Ikke funnet"},"desc":{"network":"Vennligst sjekk nettverkstilkoblingen din","network_fixed":"Ser ut som om den er tilbake.","server":"Feilkode: {{status}}","forbidden":"Du har ikke tilgang til dette.","not_found":"Oops, applikasjonen forsøkte å laste en URL som ikke eksisterer.","unknown":"Noe gikk galt."},"buttons":{"back":"Gå tilbake","again":"Prøv igjen","fixed":"Last side"}},"close":"Lukk","assets_changed_confirm":"Dette nettstedet ble nettopp oppdatert. Oppdater nå for nyeste versjon?","logout":"Du ble logget ut","refresh":"Refresh","read_only_mode":{"login_disabled":"Innlogging er deaktivert mens nettsiden er i skrivebeskyttet modus."},"learn_more":"lær mer...","year":"år","year_desc":"emner opprettet de siste 365 dagene","month":"måned","month_desc":"emner opprettet de siste 30 dagene","week":"uke","week_desc":"emner opprettet de siste 7 dagene","day":"dag","first_post":"Første innlegg","mute":"Demp","unmute":"Fjern demping","last_post":"Siste innlegg","last_reply_lowercase":"siste svar","replies_lowercase":{"one":"svar","other":"svar"},"signup_cta":{"sign_up":"Registrer deg","hide_session":"Spør meg igjen i morgen","hide_forever":"nei takk","hidden_for_session":"OK, jeg spør igjen i morgen. Du kan også registrere en konto når du vil!","intro":"Hei du! :heart_eyes: Det ser ut som du følger diskusjonen, men ikke har registrert deg enda.","value_prop":"Når du registrerer deg husker vi hvor langt du har lest, så du starter på riktig sted neste gang du åpner en tråd. Du får også varsler, her og på e-post når det skjer ting i diskusjonene du vil følge. I tillegg kan du like innlegg :heartbeat:"},"summary":{"enabled_description":"Du ser for øyeblikket en oppsummering av dette emnet: de mest interessante innleggene i følge nettsamfunnet.","enable":"Oppsummer dette emnet","disable":"Vis alle innlegg"},"deleted_filter":{"enabled_description":"Dette emnet inneholder slettede innlegg som har blitt skjult.","disabled_description":"Slettede innlegg i emnet vises.","enable":"Skjul slettede innlegg","disable":"Vis slettede innlegg"},"private_message_info":{"title":"Send","invite":"Inviter andre...","remove_allowed_user":"Er du sikker på at du vil fjerne {{name}} fra denne meldingen?"},"email":"E-post","username":"Brukernavn","last_seen":"Sist sett","created":"Opprettet","created_lowercase":"opprettet","trust_level":"Tillitsnivå","search_hint":"brukernavn, e-post eller IP-adresse","create_account":{"title":"Opprett ny konto","failed":"Noe gikk galt, kanskje denne e-postadressen allerede er registrert. Prøv lenke for glemt passord"},"forgot_password":{"title":"Nullstill Passord","action":"Glemt passord","invite":"Skriv inn ditt brukernavn eller din e-postadresse, så sender vi deg en e-post for å nullstille ditt passord.","reset":"Nullstill passord","complete_username":"Hvis en konto med brukernavn \u003cb\u003e%{username}\u003c/b\u003e finnes vil du motta en e-post om kort tid med instruksjoner om hvordan du kan nullstille passordet.","complete_email":"Hvis en konto med e-postadressen \u003cb\u003e%{email}\u003c/b\u003e eksisterer i systemet vil du om kort tid motta en e-post med instruksjoner om hvordan du kan nullstille passordet.","complete_username_found":"Vi fant en konto med brukernavn \u003cb\u003e%{username}\u003c/b\u003e. Du mottar om litt en e-post med instruksjoner for hovrdan du nullstiller passordet.","complete_email_found":"Vi fant en konto med e-postadressen \u003cb\u003e%{email}\u003c/b\u003e. Du mottar om litt en e-post med instruksjoner for hvordan du nullstiller passordet.","complete_username_not_found":"Ingen konto har med brukernavnet \u003cb\u003e%{username}\u003c/b\u003e er registrert","complete_email_not_found":"Ingen konto med e-postadressen \u003cb\u003e%{email}\u003c/b\u003e er registrert"},"login":{"title":"Logg Inn","username":"Bruker","password":"Passord","email_placeholder":"e-postadresse eller brukernavn","caps_lock_warning":"Caps Lock er på","error":"Ukjent feil","rate_limit":"Vennligst vent litt før du logger inn igjen.","blank_username_or_password":"Vennligst oppgi din e-postadresse eller brukernavn og ditt passord.","reset_password":"Nullstill passord","logging_in":"Logger på...","or":"Eller","authenticating":"Autentiserer...","awaiting_confirmation":"Din konto avventer aktivering. Bruk lenken for glemt passord for å sende en ny e-post for aktivering.","awaiting_approval":"Din konto har ikke blitt godkjent av en moderator ennå. Du vil motta en e-post når den er godkjent.","requires_invite":"Beklager, tilgang til dette forumet er kun ved invitasjon.","not_activated":"Du kan ikke logge inn ennå. Vi sendte en e-post for aktivering til deg på \u003cb\u003e{{sentTo}}\u003c/b\u003e. Vennligst følg instruksjonene i den e-posten for å aktivere din konto.","not_allowed_from_ip_address":"Du kan ikke logge inn fra den IP-adressen.","admin_not_allowed_from_ip_address":"Du kan ikke logge inn som administrator fra den IP-adressen.","resend_activation_email":"Klikk her for å sende e-posten for aktivering igjen.","sent_activation_email_again":"Vi sendte deg en ny e-post for aktivering på \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Det kan ta noen minutter før den kommer fram; sørg for at du sjekker nettsøppel om du ikke finner den.","to_continue":"Vennligst Logg Inn","preferences":"Du må være innlogget for å endre brukerinnstillinger.","forgot":"I husker ikke mine kontodetaljer","google":{"title":"med Google","message":"Autentiserer med Google (sørg for at du tillater pop-up vindu)"},"google_oauth2":{"title":"med Google","message":"Autentiserer med Google (sørg for at du tillater pop-up vindu)"},"twitter":{"title":"med Twitter","message":"Autentiserer med Twitter (sørg for at du tillater pop-up vindu)"},"facebook":{"title":"med Facebook","message":"Autentiserer med Facebook (sørg for at du tillater pop-up vindu)"},"yahoo":{"title":"med Yahoo","message":"Autentiserer med Yahoo (sørg for at du tillater pop-up vindu)"},"github":{"title":"med GitHub","message":"Autentiserer med GitHub (sørg for at du tillater pop-up vindu)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"mer...","options":"Alternativer","whisper":"hvisker","add_warning":"Dette er en offisiell advarsel.","posting_not_on_topic":"Du svarer på emnet \"{{title}}\", men for øyeblikket ser du på et annet emne.","saving_draft_tip":"lagrer...","saved_draft_tip":"lagret","saved_local_draft_tip":"lagret lokalt","similar_topics":"Emnet ditt har likheter med...","drafts_offline":"utkast offline","error":{"title_missing":"Tittel er påkrevd","title_too_short":"Tittel må være minst {{min}} tegn","title_too_long":"Tittel kan ikke være mer enn {{max}} tegn","post_missing":"Innlegget kan ikke være tomt","post_length":"Innlegget må være minst {{min}} tegn","try_like":"Har du prøvd \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e knappen?","category_missing":"Du må velge en kategori"},"save_edit":"Lagre endring","reply_original":"Besvar det originale emnet","reply_here":"Svar her","reply":"Svar","cancel":"Avbryt","create_topic":"Nytt Emne","create_pm":"Melding","title":"Eller trykk Ctrl+Enter","users_placeholder":"Legg til en bruker","title_placeholder":"Oppsummert i en setning, hva handler denne diskusjonen om?","edit_reason_placeholder":"hvorfor endrer du?","show_edit_reason":"(legg till endringsbegrunnelse)","view_new_post":"Se ditt nye innlegg.","saving":"Lagrer","saved":"Lagret!","saved_draft":"Innleggsutkast. Velg for å fortsette.","uploading":"Laster opp...","show_preview":"se forhånsvisning \u0026raquo;","hide_preview":"\u0026laquo; skjul forhåndsvisning","quote_post_title":"Siter hele innlegget","bold_title":"Sterk","bold_text":"sterk tekst","italic_title":"Kursiv","italic_text":"kursiv tekst","link_title":"Hyperlenke","link_description":"beskriv lenken her","link_dialog_title":"Sett inn hyperlenke","link_optional_text":"valgfri tittel","quote_title":"Sitatramme","quote_text":"Sitatramme","code_title":"Kode Utsnitt","code_text":"Skriv inn preformattert tekst med 4 mellomroms innrykk.","upload_title":"Bilde","upload_description":"beskriv bildet her","olist_title":"Nummerert Liste","ulist_title":"Kulepunkt Liste","list_item":"Listeelement","heading_title":"Overskrift","heading_text":"Overskrift","hr_title":"Horisontalt Skille","help":"Hjelp for redigering i Markdown","toggler":"gjem eller vis redigeringspanelet","modal_ok":"OK","modal_cancel":"Avbryt","admin_options_title":"Valgfrie emne-instillinger for ansatte","auto_close":{"label":"Tid for auto-lukking av emnet:","error":"Vennligst skriv en gyldig verdi.","based_on_last_post":"Ikke lukk før den siste posten i emnet er minst så gammel.","all":{"examples":"Før inn antall timer (24), absolutt tid (17:30) eller tidsstempel (2013-11-22 14:00)."},"limited":{"units":"(# timer)","examples":"Før inn antall timer (24)."}}},"notifications":{"title":"varsler om at ditt @navn blir nevnt, svar på dine innlegg, emner, meldinger, osv","none":"Notifikasjoner er ikke tilgjengelig for øyeblikket.","more":"se gamle varsler","total_flagged":"totalt rapporterte innlegg","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eBle tildelt '{{description}}'\u003c/p\u003e","alt":{"mentioned":"Nevnt av","quoted":"Sitert av","replied":"Svart","posted":"Innlegg av","liked":"Likte innlegget ditt","private_message":"Privat melding fra","linked":"Link til innlegget ditt","granted_badge":"Merke innvilget"},"popup":{"mentioned":"{{username}} nevnte deg i \"{{topic}}\" - {{site_title}}","quoted":"{{username}} siterte deg i \"{{topic}}\" - {{site_title}}","replied":"{{username}} svarte deg i \"{{topic}}\" - {{site_title}}","posted":"{{username}} skrev i \"{{topic}}\" - {{site_title}}","private_message":"{{username}} sendte deg en privat melding: \"{{topic}}\" - {{site_title}}","linked":"{{username}} lenket til ditt innlegg i \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Legg til Bilde","title_with_attachments":"Legg til et bilde eller en fil","from_my_computer":"Fra Min Enhet","from_the_web":"Fra nettet","remote_tip":"link til bilde","local_tip":"velg bilder fra din enhet","hint":"(du kan også drag \u0026 drop inn i editoren for å laste dem opp)","uploading":"Laster opp bilde","select_file":"Velg Fil","image_link":"lenken som bildet skal peke til"},"search":{"sort_by":"Sorter etter","relevance":"Relevanse","latest_post":"Nyeste Innlegg","most_viewed":"Mest Lest","most_liked":"Mest Likt","select_all":"Velg Alle","clear_all":"Fjern Alle","title":"søk etter emner, innlegg, brukere eller kategorier","no_results":"Ingen resultater funnet.","no_more_results":"Ingen flere resultater funnet.","search_help":"Søkehjelp","searching":"Søker ...","post_format":"#{{post_number}} av {{username}}","context":{"user":"Søk innleggene av @{{username}}","topic":"Søk i dette emnet","private_messages":"Søk i meldinger"}},"hamburger_menu":"gå til en annen emneliste eller kategori","new_item":"ny","go_back":"gå tilbake","not_logged_in_user":"brukerside med oppsummering av nylig aktivtet og preferanser.","current_user":"go til din brukerside","topics":{"bulk":{"reset_read":"Nullstill lest","delete":"Slett Emne","dismiss_new":"Lest","toggle":"Veksle mellom massevelging av emner","actions":"Massehandlinger","change_category":"Endre Kategori","close_topics":"Lukk Emner","archive_topics":"Arkiverte emner","notification_level":"Endre varslingsnivå","choose_new_category":"Velg den nye kategorien for emnene:","selected":{"one":"Du har valgt \u003cb\u003e1\u003c/b\u003e emne.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e emner."}},"none":{"unread":"Du har ingen uleste emner å lese.","new":"Du har ingen nye emner å lese.","read":"Du har ikke lest noen emner enda.","posted":"Du har ikke postet i noen emner enda.","latest":"Det er ingen siste emner. Det er trist.","hot":"Det er ingen populære emner.","bookmarks":"Du har ingen bokmerkede emner.","category":"Det er ingen {{category}} emner.","top":"Det er ingen populære emner.","search":"Det er ingen søkeresultater"},"bottom":{"latest":"Det er ikke noen siste emner igjen å lese.","hot":"Det er ikke noen populære emner igjen å lese.","posted":"Det er ikke noen postede emner igjen å lese.","read":"Det er ikke noen leste emner igjen å lese.","new":"Det er ikke noen nye emner igjen å lese.","unread":"Det er ikke noen uleste emner igjen å lese.","category":"Det er ikke noen {{category}} emner igjen.","top":"Det er ingen flere populære emner.","bookmarks":"Det er ingen bokmerkede emner.","search":"Det er ingen flere søkeresultater"}},"topic":{"create":"Nytt emne","create_long":"Opprett et nytt emne","private_message":"Begynn en melding","archive_message":{"title":"Arkiver"},"move_to_inbox":{"title":"Flytt til Inbox","help":"Flytt meldingen tilbake til Inbox"},"list":"Emner","new":"nytt emne","unread":"ulest","new_topics":{"one":"Ett nytt emne","other":"{{count}} nye emner"},"unread_topics":{"one":"Ett ulest emne","other":"{{count}} uleste emner"},"title":"Emne","invalid_access":{"title":"Emnet er privat","description":"Beklager, du har ikke tilgang til det emnet!","login_required":"Du må være logget inn for å lese dette emnet."},"server_error":{"title":"Emnet kunne ikke bli behandlet","description":"Beklager, vi kunne ikke behanldle det emnet, muligens på grunn av et tilkoblingsproblem. Vennligst prøv igjen. Om problemet vedvarer, fortell oss."},"not_found":{"title":"Emnet kunne ikke bli funnet","description":"Beklager, vi kunne ikke finne det emnet. Kanskjer det ble fjernet av en moderator?"},"total_unread_posts":{"one":"du har 1 ulest innlegg i dette emnet","other":"du har {{count}} uleste innlegg i dette emnet"},"unread_posts":{"one":"du har 1 ulest gammelt innlegg i dette emnet","other":"du har {{count}} uleste gamle innlegg i dette emnet"},"new_posts":{"one":"Det er 1 nytt innlegg i dette emnet siden sist du leste det","other":"Det er {{count}} nye innlegg i dette emnet siden sist du leste det"},"likes":{"one":"det er 1 liker i dette emnet","other":"det er {{count}} liker i dette emnet"},"back_to_list":"Tilbake til Emnelisten","options":"Valg for Emner","show_links":"vis lenker i dette emnet","toggle_information":"vis/skjul emnedetaljer","read_more_in_category":"Vil du lese mer? Bla gjennom andre emner i {{catLink}} eller {{latestLink}}.","read_more":"Vil du lese mer? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Se alle kategorier","view_latest_topics":"se siste emner","suggest_create_topic":"Hvorfor ikke opprette et emne?","jump_reply_up":"hopp til tidligere svar","jump_reply_down":"hopp til senere svar","deleted":"Emnet har blitt slettet","auto_close_notice":"Dette emnet vil automatisk lukkes %{timeLeft}.","auto_close_notice_based_on_last_post":"Dette emnet vil bli lukket %{duration} etter det siste innlegget.","auto_close_title":"Auto-Lukk Innstillinger","auto_close_save":"Lagre","auto_close_remove":"Ikke lukk dette emnet automatisk","progress":{"title":"emnefrangang","go_top":"topp","go_bottom":"bunn","go":"Gå","jump_bottom":"Hopp til nyeste innlegg","jump_bottom_with_number":"hopp til innlegg %{post_number}","total":"innlegg totalt","current":"gjeldende innlegg"},"notifications":{"reasons":{"3_6":"Du vil motta varsler fordi du følger denne kategorien","3_5":"Du vil motta varsler fordi du startet å følge dette emnet automatisk.","3_2":"Du vil motta varsler fordi du følger dette emnet.","3_1":"Du vil motta varsler fordi du opprettet dette emnet.","3":"Du vil motta varsler fordi du følger dette emnet.","2_8":"Du vil motta varsler fordi du følger denne kategorien.","2_4":"Du vil motta varsler fordi du svarte på dette emnet.","2_2":"Du vil motta varsler fordi du følger dette emnet.","2":"Du vil motta varsler fordi du \u003ca href=\"/users/{{username}}/preferences\"\u003eread this topic\u003c/a\u003e.","1_2":"Du vil bli varslet om noen nevner ditt @navn eller svarer på ditt innlegg.","1":"Du vil bli varslet om noen nevner ditt @navn eller svarer på ditt innlegg.","0_7":"Du ignorerer alle varsler i denne kategorien.","0_2":"Du ignorerer alle varsler på dette emnet.","0":"Du ignorerer alle varsler på dette emnet."},"watching_pm":{"title":"Følger","description":"Du vil bli varslet om hvert nye innlegg i denne meldingen. Antall nye tilbakemeldinger vil også bli vist. "},"watching":{"title":"Følger","description":"Du vil bli varslet om hvert nye innlegg i dette emnet. Antall nye tilbakemeldinger vil også bli vist. "},"tracking_pm":{"title":"Følger","description":"Antall nye tilbakemeldinger vil bli vist for denne meldingen. Du vil bli varslet om noen nevner ditt @name eller svarer på din melding. "},"tracking":{"title":"Følger","description":"Antall nye svar vil bli vist for dette emnet. Du vil bli varslet om noen nevner ditt @name eller svarer på ditt innlegg.. "},"regular":{"title":"Normal","description":"Du vil bli varslet om noen nevner ditt @navn eller svarer på ditt innlegg."},"regular_pm":{"title":"Normal","description":"Du vil bli varslet om noen nevner ditt @navn eller svarer på ditt innlegg."},"muted_pm":{"title":"Dempet","description":"Du vil ikke få varslinger om noe i denne meldingnen. "},"muted":{"title":"Dempet"}},"actions":{"recover":"Gjenopprett emne","delete":"slett emne","open":"Åpne Emne","close":"Lukk Emne","multi_select":"Velg Innlegg...","auto_close":"Lukk Automatisk","pin":"Feste emnet...","unpin":"Løsgjør Emne","unarchive":"Uarkiver Emne","archive":"Arkiver Emne","invisible":"Skjul Emnet","visible":"Vist Emnet","reset_read":"Tilbakestill Lesedata"},"feature":{"pin":"Fest Emnet","unpin":"Løsgjør Emnet","pin_globally":"Fest Emnet Globalt","make_banner":"Banneremne","remove_banner":"Fjern Banneremne"},"reply":{"title":"Svar","help":"begynn å skrive et svar til dette emnet"},"clear_pin":{"title":"Løsgjør emne","help":"Løsgjør fastsatt-statusen til dette emnet så det ikke lenger vises på toppen av din emneliste"},"share":{"title":"Del","help":"del en lenke til dette emnet"},"flag_topic":{"title":"Rapporter","help":"rapporter dette innlegget privat eller send et privat varsel om det","success_message":"Du har rapportert dette emnet"},"feature_topic":{"title":"Fremhev dette emnet","confirm_pin":"Du har allerede {{count}} låste emner. For mange låste emner kan være et problem for nye og anonyme brukere. Er du sikker på at du ønsker å låse et til emne i denne kategorien?","unpin":"Fjern dette emnet fra toppen av {{categoryLink}} kategorien.","pin_note":"Brukere kan låse opp emnet selv.","confirm_pin_globally":"Du har allerede {{count}} globalt låste emner. For mange låste emner kan bli en byrde for nye og anonyme brukere. Er du sikker på at du vil låse et til emne globalt? ","unpin_globally":"Fjern dette emnet fra toppen av alle emnelister. ","global_pin_note":"Brukere kan låse opp emner for dem selv. ","make_banner":"Gjør dette emnet til et banner som dukker opp på toppen av alle sider.","remove_banner":"Fjern banneret som dukker opp på toppen av alle sider. ","banner_note":"Brukere kan fjerne banneret ved å lukke det. Kun et emne kan være banner på en og samme tid. "},"inviting":"Inviterer...","invite_private":{"title":"Inviter til samtale","email_or_username":"Invitertes e-post eller brukernavn.","email_or_username_placeholder":"e-postadresse eller brukernavn","action":"Inviter","success":"Vi har invitert denne brukeren til å delta i denne meldingen.","error":"Beklager, det oppstod en feil ved å invitere den brukeren.","group_name":"gruppenavn"},"controls":"Emnefunksjoner","invite_reply":{"title":"Inviter","username_placeholder":"brukernavn","action":"Send Invitasjon","help":"Inviter andre til dette emnet via epost eller varsler","to_forum":"Vi sender en kortfattet e-post som gjør det mulig for en venn å umiddelbart registreres ved å klikke på en lenke. Ingen innlogging er nødvendig.","sso_enabled":"Oppgi brukernavnet til personen du ønsker å invitere til dette emnet.","to_topic_blank":"Oppgi brukernavnet eller epost-adressen til personen du ønsker å invitere til dette emnet.","to_topic_email":"Du har oppgitt en epostadresse. Vi vil sende invitasjonen som later vennen din umiddelbart svare på dette emnet.","to_topic_username":"Du har oppgitt et brukernavn. Vi sender et varsel med en link som inviterer dem til dette emnet.","to_username":"Oppgi brukernavnet til personen du ønsker å invitere. Vi sender et varsel med en lenke som inviterer dem til dette emnet.","email_placeholder":"navn@example.com","success_email":"Vi har sendt ut en invitasjon til \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Vi varsler deg når invitasjonen er godtatt. Sjekk invitiasjonsfanen på brukersiden din for å holde styr på invitasjonene dine.","success_username":"Vi har invitert brukeren til å delta i dette emnet.","error":"Beklager, vi kunne ikke invitere den brukeren. De har muligens allerede blitt invitert?"},"login_reply":"Logg Inn for å svare","filters":{"n_posts":{"one":"1 innlegg","other":"{{count}} innlegg"},"cancel":"Fjern filter"},"split_topic":{"title":"Del opp Emne","action":"del opp emne","topic_name":"Nytt Emnenavn:","error":"Det oppsto en feil ved deling av dette emnet.","instructions":{"one":"Du er i ferd med å lage et nytt emne basert på innlegget du har valgt..","other":"Du er i ferd med å lage et nytt emne basert på \u003cb\u003e{{count}}\u003c/b\u003e innlegg du har valgt."}},"merge_topic":{"title":"Slå sammen Emne","action":"slå sammen emne","error":"Det oppsto en feil ved sammenslåing av dette emnet.","instructions":{"one":"Vennligst velg det emnet du vil flytte det innlegget til.","other":"Vennligst velg emnet du vil flytte de \u003cb\u003e{{count}}\u003c/b\u003e innleggene til."}},"change_owner":{"title":"Endre innleggenes eier","action":"Endre eierskap","error":"Det oppsto en feil ved endring av eierskap til innleggene.","label":"Innleggenes nye eier","placeholder":"den nye eierens brukernavn","instructions":{"one":"Velg den nye eieren til innlegget av \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Velg den nye eieren til {{count}} innlegg av  \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Merk at ingen varsler om dette innlegget vil overføres til den nye eieren i etterkant.\u003cbr\u003eAdvarsel: For øyeblikket blir ingen innleggsavhengige data overført til den nye brukeren. Bruk med omhu."},"multi_select":{"select":"velg","selected":"valgte ({{count}})","select_replies":"velg +svar","delete":"fjern valgte","cancel":"avbryt valg","select_all":"velg alle","deselect_all":"fjern alle","description":{"one":"Du har valgt \u003cb\u003e1\u003c/b\u003e innlegg.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e innlegg."}}},"post":{"quote_reply":"siter svar","edit":"Redigerer {{link}} {{replyAvatar}} {{username}}","edit_reason":"Begrunnelse:","post_number":"post {{number}}","last_edited_on":"innlegg sist redigert","reply_as_new_topic":"Svar med lenket emne","continue_discussion":"Fortsetter diskusjonen fra {{postLink}}:","follow_quote":"gå til det siterte innlegget","show_full":"Vis hele posten","show_hidden":"Se skjult innhold","deleted_by_author":{"one":"(innlegg som er trukket tilbake av forfatter, blir automatisk slettet etter % {count} time, med mindre de blir flagget)","other":"(innlegg trukket tilbake av forfatter, blir automatisk slettet etter %{count} timer, med mindre det blir rapportert)"},"expand_collapse":"utvid/vis","gap":{"one":"vis 1 skjult svar","other":"vis {{count}} skjulte svar"},"unread":"Innlegget er ulest","has_replies":{"one":"{{count}} Svar","other":"{{count}} Svar"},"has_likes":{"one":"{{count}} Like","other":"{{count}} liker"},"has_likes_title":{"one":"{{count}} bruker likte dette innlegget","other":"{{count}} brukere likte dette innlegget"},"has_likes_title_only_you":"du likte dette innlegget","has_likes_title_you":{"one":"du og 1 annen bruker likte dette innlegget","other":"du og {{count}} andre likte dette innlegget"},"errors":{"create":"Beklager, det oppstod en feil ved å publisere ditt innlegg. Vennligst prøv igjen.","edit":"Beklager, det oppstod en feil ved redigeringen av ditt innlegg. Vennligst prøv igjen.","upload":"Sorry, there was an error uploading that file. Please try again.","too_many_uploads":"Beklager, du kan bare laste opp ett bilde om gangen.","upload_not_authorized":"Beklager, filen du prøver å laste opp er ikke godkjent (godkjente filtyper: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Beklager, nye brukere kan ikke laste opp bilder","attachment_upload_not_allowed_for_new_user":"Beklager, nye brukere kan ikke laste opp vedlegg.","attachment_download_requires_login":"Beklager, du må være logget inn for å laste ned vedlegg."},"abandon":{"confirm":"Er du sikker på at du vil forlate innlegget ditt?","no_value":"Nei","yes_value":"Ja"},"via_email":"Dette innlegget ankom via e-post","archetypes":{"save":"Lagre Alternativene"},"controls":{"reply":"begynn å skrive et svar til dette innlegget","like":"lik dette innlegget","has_liked":"du liker dette innlegget","undo_like":"angre liker","edit":"rediger dette innlegget","edit_anonymous":"Beklager, du må være innlogget for å endre dette innlegget.","flag":"rapporter dette innlegget privat eller send et privat varsel om det","delete":"slett dette innlegget","undelete":"gjenopprett dette innlegget","share":"del en lenke til dette innlegget","more":"Mer","delete_replies":{"confirm":{"one":"Vil du òg slette det direkte svaret til dette innlegget?","other":"Vil du òg slette de {{count}} direkte svarene til dette innlegget?"},"yes_value":"Ja, slett svarene også.","no_value":"Nei, kun dette innlegget."},"admin":"Innleggsadministrasjon","wiki":"Opprett wiki","unwiki":"Fjern Wiki","convert_to_moderator":"Legg til stabsfarge","revert_to_regular":"Fjern stabsfarge","rebake":"Gjenoppbygg HTML","unhide":"Vis"},"actions":{"flag":"Rapportering","defer_flags":{"one":"Utsett rapportering","other":"Utsett rapporteringer"},"undo":{"off_topic":"Angre rapportering","spam":"Angre rapportering","inappropriate":"Angre rapportering","bookmark":"Angre bokmerke","like":"Angre liker","vote":"Angre stemme"},"people":{"spam":"flagget dette som spam","inappropriate":"flagget dette som upassende","notify_moderators":"varslet moderatorer","notify_user":"sendte en melding","like":"likte dette","vote":"stemte for dette"},"by_you":{"off_topic":"Du rapporterte dette som irrelevant","spam":"Du rapporterte dette som spam","inappropriate":"Du rapporterte dette som upassende","notify_moderators":"Du rapporterte dette for moderering","notify_user":"Du sendte en melding til denne brukeren","bookmark":"Du bokmerket dette innlegget","like":"Du likte dette","vote":"Du stemte for dette innlegget"},"by_you_and_others":{"off_topic":{"one":"Du og 1 annen markerte dette som irrelevant","other":"Du og {{count}} andre rapporterte dette som irrelevant"},"spam":{"one":"Du og 1 annen markerte dette som spam","other":"Du og {{count}} andre rapporterte dette som spam"},"inappropriate":{"one":"Du og 1 annen markerte dette som upassende","other":"Du og {{count}} andre rapporterte dette som upassende"},"notify_moderators":{"one":"Du og 1 annen markerte dette for moderering","other":"Du og {{count}} andre rapporterte dette for moderering"},"notify_user":{"one":"Du og 1 annen bruker sendte en melding til denne brukeren","other":"Du og {{count}} andre brukere har sendt en melding til denne brukeren"},"bookmark":{"one":"Du og 1 annen bokmerket dette innlegget","other":"Du og {{count}} andre bokmerket dette innlegget"},"like":{"one":"Du og 1 annen likte dette","other":"Du og {{count}} andre likte dette"},"vote":{"one":"Du og 1 annen stemte på dette innlegget","other":"Du og {{count}} andre stemte på dette innlegget"}},"by_others":{"off_topic":{"one":"1 bruker markerte dette som irrelevant","other":"{{count}} brukere rapporterte dette som irrelevant"},"spam":{"one":"1 bruker markerte dette som spam","other":"{{count}} brukere rapporterte dette som spam"},"inappropriate":{"one":"1 bruker markerte dette som upassende","other":"{{count}} brukere rapporterte dette som upassende"},"notify_moderators":{"one":"1 bruker markerte dette for moderering","other":"{{count}} brukere rapporterte dette for moderering"},"notify_user":{"one":"1 person har sendt en melding til denne brukeren","other":"{{count}} har sendt en melding til denne brukeren"},"bookmark":{"one":"1 bruker bokmerket dette innlegget","other":"{{count}} brukere bokmerket dette innlegget"},"like":{"one":"1 bruker likte dette","other":"{{count}} brukere likte dette"},"vote":{"one":"1 bruker stemte på dette innlegget","other":"{{count}} brukere stemte på dette innlegget"}}},"delete":{"confirm":{"one":"Er du sikker på at du vil slette det innlegget?","other":"Er du sikker på at du vil slette alle de innleggene?"}},"revisions":{"controls":{"first":"Første revisjon","previous":"Forrige revisjon","next":"Neste revisjon","last":"Siste revisjon","hide":"Skjul revisjon","show":"Vis revisjon","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Vis endelig tekst med endringene der de er gjort","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Vis endringer i endelig tekst side ved side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Vis diff for kilderåtekst side ved side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Raw"}}}},"category":{"can":"kan\u0026hellip;","none":"(no category)","all":"Alle kategorier","choose":"Velg en katekori\u0026hellip;","edit":"rediger","edit_long":"Rediger","view":"Se Emner i Kategori","general":"Generellt","settings":"Innstillinger","topic_template":"Emnemal","delete":"Slett kategori","create":"Ny Kategori","create_long":"Opprett en ny kategori","save":"Lagre Kategori","slug":"Kategorinavn i URL","slug_placeholder":"(valgfritt) sammensatte ord for bruk i URL","creation_error":"Det oppstod en feil ved å lage denne kategorien.","save_error":"Det oppstod en feil ved lagrinen av denne kategorien.","name":"Kategorinavn","description":"Beskrivelse","topic":"kategori emne","logo":"Kategoribilde","background_image":"Kategoriens bakgrunnsbilde","badge_colors":"Merkefarger","background_color":"Bakgrunnsfarge","foreground_color":"Forgrunnsfarge","name_placeholder":"Bør være kortfattet.","color_placeholder":"Enhver webfarge","delete_confirm":"Er du sikker på at du vil slette denne kategorien?","delete_error":"Det oppstod en feil ved å slette denne kategorien.","list":"List Kategorier","no_description":"Vennligst legg til en beskrivelse for denne kategorien.","change_in_category_topic":"Rediger Beskrivelse","already_used":"Denne fargen er i bruk av en annen kategori","security":"Sikkerhet","images":"Bilder","auto_close_label":"Lukk emner automatisk etter:","auto_close_units":"timer","email_in":"Egendefinert inkommende e-postadresse:","email_in_allow_strangers":"Godta e-post fra anonyme brukere uten brukerkonto","email_in_disabled":"Posting av nye emner via e-post er deaktivert i nettstedsinstillingene. For å aktivere posting av nye emner via e-post,","email_in_disabled_click":"aktiver innstillingen \"e-post inn\".","allow_badges_label":"Tillat merker å bli tildelt i denne kategorien","edit_permissions":"Rediger tillatelser","add_permission":"Legg til tillatelser","this_year":"dette året","position":"posisjon","default_position":"Standard posisjon","position_disabled":"Kategorier vil bli vist i henhold til aktivitet. For å styre rekkefølgen av kategorier i listen","position_disabled_click":"kan du aktivere \"faste kategoriposisjoner\" i innstillinger.","parent":"Foreldrekategori","notifications":{"watching":{"title":"Følger"},"tracking":{"title":"Sporing"},"regular":{"title":"Normal","description":"Du vil bli varslet om noen nevner ditt @navn eller svarer deg."},"muted":{"title":"Dempet"}}},"flagging":{"title":"Takk for at du hjelper å holde forumet ryddig!","action":"Rapporter innlegg","take_action":"Ta Handling","notify_action":"Melding","official_warning":"Offisiell Advarsel","delete_spammer":"Slett spammer","yes_delete_spammer":"Ja, slett spammer","ip_address_missing":"(N/A)","hidden_email_address":"(skjult)","submit_tooltip":"Rapporter privat","take_action_tooltip":"Oppnå rapporteringsterskel umiddelbart, i stedet for å vente på flere rapporteringer.","cant":"Beklager, du kan ikke rapportere dette innlegget nå.","formatted_name":{"off_topic":"Det er off-topic ","inappropriate":"Det er upassende","spam":"Det er reklame"},"custom_placeholder_notify_user":"Vær spesifikk, konstruktiv og snill.","custom_placeholder_notify_moderators":"La oss vite nøyaktig hva problemet er, og del relevante lenker og eksempler hvorvidt det er mulig."},"flagging_topic":{"title":"Takk for at du hjelper med å vedlikeholde god skikk i samfundet vårt!","action":"Rapporter emne","notify_action":"Melding"},"topic_map":{"title":"Emneoppsummering","participants_title":"Hyppige Bidragsytere","links_title":"Populære Lenker","clicks":{"one":"1 klikk","other":"%{count} klikk"}},"topic_statuses":{"warning":{"help":"Dette er en offisiell advarsel."},"bookmarked":{"help":"Du lagret dette emnet"},"locked":{"help":"dette emnet er låst; det aksepterer ikke lenger nye svar"},"archived":{"help":"dette emnet er arkivert; det er fryst og kan ikke bli aktivert"},"unpinned":{"title":"Løsgjort","help":"Dette emnet er ikke lenger fastsatt, det vil vises i vanlig rekkefølge"},"pinned_globally":{"title":"Globalt fastsatt"},"pinned":{"title":"Fastsatt","help":"Dette emnet er fastsatt for deg; det vil vises i toppen av sin kategori"},"invisible":{"help":"Dette emnet er ikke listet; det vil ikke vises i emnelister, og kan kun leses via en direktelenke"}},"posts":"Innlegg","posts_long":"{{number}} innlegg i dette emnet","original_post":"Originalt Innlegg","views":"Visninger","views_lowercase":{"one":"visninger","other":"visninger"},"replies":"Svar","views_long":"dette emnet har blit sett {{number}} ganger","activity":"Aktivitet","likes":"Liker","likes_lowercase":{"one":"like","other":"likes"},"likes_long":"det er {{number}} liker i dette emnet","users":"Deltakere","users_lowercase":{"one":"bruker","other":"brukere"},"category_title":"Kategori","history":"Historie","changed_by":"av {{author}}","raw_email":{"title":"Rå e-post","not_available":"Ikke tilgjengelig!"},"categories_list":"Kategoriliste","filters":{"with_topics":"%{filter} emner","with_category":"%{filter} %{category} emner","latest":{"title":"Siste","title_with_count":{"one":"Siste (1)","other":"Siste ({{count}})"},"help":"de sist oppdaterte emnene"},"hot":{"title":"Populære","help":"et utvalg av de mest populære emnene"},"read":{"title":"Lest","help":"emner du har lest, i den rekkefølgen du har lest dem"},"search":{"title":"Søk","help":"Søk i alle emner"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alle emner sortert etter kategori"},"unread":{"title":"Ulest","title_with_count":{"one":"Ulest (1)","other":"Ulest ({{count}})"},"help":"emner du for øyeblikket følger eller sporer med uleste innlegg","lower_title_with_count":{"one":"1 ulest","other":"{{count}} uleste"}},"new":{"lower_title_with_count":{"one":"1 ny","other":"{{count}} nye"},"lower_title":"ny","title":"Ny","title_with_count":{"one":"Nye (1)","other":"Nye ({{count}})"},"help":"emner opprettet de siste dagene"},"posted":{"title":"Mine Innlegg","help":"emner du har postet i"},"bookmarks":{"title":"Bokmerker","help":"emner du har bokmerket"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"siste emner i {{categoryName}}-kategorien"},"top":{"title":"Aktive","help":"de mest aktive emnene det siste året, den siste måneden, den siste uken eller i dag","all":{"title":"Totalt"},"yearly":{"title":"Årlig"},"quarterly":{"title":"Kvartalsvis"},"monthly":{"title":"Månedlig"},"weekly":{"title":"Ukentlig"},"daily":{"title":"Daglig"},"all_time":"Totalt","this_year":"År","this_quarter":"Kvartal","this_month":"Måned","this_week":"Uke","today":"I dag","other_periods":"se toppen"}},"browser_update":"Dessverre, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eDin nettleser er for gammel og fungerer ikke med dette nettstedet.\u003c/a\u003e. Vennligst \u003ca href=\"http://browsehappy.com\"\u003eoppgrader nettleseren din\u003c/a\u003e.","permission_types":{"full":"Opprett / Svar / Se","create_post":"Svar / Se","readonly":"Se"},"poll":{"voters":{"one":"stemmegiver","other":"stemmegivere"},"total_votes":{"one":"antall stemmer","other":"antall stemmer"},"average_rating":"Gjennomsnitt: \u003cstrong\u003e%{average}\u003c/strong\u003e.","cast-votes":{"title":"Stem nå","label":"Stem!"},"show-results":{"title":"Vis resultat","label":"Vis resultat"},"hide-results":{"title":"Tilbake til dine stemmer","label":"Skjul resultater"},"open":{"title":"Åpne avstemming","label":"Åpne","confirm":"Er du sikker på at du vil åpne avstemmingen?"},"close":{"title":"Lukk avstemming","label":"Lukk","confirm":"Er du sikker på at du vil lukke avstemmingen?"}},"type_to_filter":"skriv for å filtrere...","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"Dashbord","last_updated":"Dashboardet var sist oppdatert:","version":"Versjon","up_to_date":"Du har den seneste versjonen!","critical_available":"En kritisk oppdatering er tilgjengelig.","updates_available":"Oppdateringer er tilgjengelig.","please_upgrade":"Vennligst oppgrader!","no_check_performed":"En sjekk for oppdateringer har ikke blitt utført. Verifiser at sidekiq kjører.","stale_data":"Det har ikke vært sjekket for oppdateringer på en stund. Sjekk at sidekiq kjører.","version_check_pending":"Ser ut som om du oppgraderte nylig. Fantastisk!","installed_version":"Installert","latest_version":"Seneste","problems_found":"Det har oppstått noen problemer med din installasjon av Discourse:","last_checked":"Sist sjekket","refresh_problems":"Last inn siden på nytt","no_problems":"Ingen problemer ble funnet.","moderators":"Moderatorer:","admins":"Adminer:","blocked":"sperret:","suspended":"Bannlyst:","private_messages_short":"Meldinger","private_messages_title":"Meldinger","mobile_title":"Mobil","space_free":"{{size}} ledig","uploads":"opplastinger","backups":"sikkerhetskopier","traffic_short":"Trafikk","traffic":"Applikasjon webforespørsler","page_views":"API forespørsler","page_views_short":"API forespørsler","show_traffic_report":"Vis detaljert trafikkrapport","reports":{"today":"I dag","yesterday":"I går","last_7_days":"Siste 7 Dager","last_30_days":"Siste 30 Dager","all_time":"Gjennom Tidene","7_days_ago":"7 Dager Siden","30_days_ago":"30 Dager Siden","all":"Alle","view_table":"tabell","view_graph":"graf","refresh_report":"Refresh Rapport","start_date":"Startdato","end_date":"Sluttdato","groups":"Alle grupper"}},"commits":{"latest_changes":"Siste endringer: Vennligst oppgrader ofte!","by":"av"},"flags":{"title":"Rapporteringer","old":"Gamle","active":"Aktive","agree":"Godta","agree_title":"Bekreft at denne rapporteringen er gyldig og korrekt","agree_flag_modal_title":"Godta og...","agree_flag_hide_post":"Godta (skjul innlegg + send PM)","agree_flag_hide_post_title":"Skjul dette innlegget og automatisk send brukeren en melding som oppfordrer vedkommende til å foreta endringer","agree_flag_restore_post":"Gi medhold (gjenopprett innlegg)","agree_flag_restore_post_title":"Gjenopprett dette innlegget","agree_flag":"Si deg enig med rapportering","agree_flag_title":"Si deg enig med rapportering og la innlegget stå urørt","defer_flag":"Utsett","defer_flag_title":"Fjern denne rapporteringen; den krever ingen handling på dette tidspunktet.","delete":"Slett","delete_title":"Fjern innlegget denne rapporteringen refererer til.","delete_post_defer_flag":"Slett innlegg og utsett rapportering","delete_post_defer_flag_title":"Slett innlegg; hvis det er første innlegg, slett emnet","delete_post_agree_flag":"Slett innlegg og si deg enig med rapportering","delete_post_agree_flag_title":"Slett innlegg; hvis det er første innlegg, slett emnet","delete_flag_modal_title":"Slett og...","delete_spammer":"Slett spammer","delete_spammer_title":"Fjern denne brukeren og alle innlegg og emner av brukeren.","disagree_flag_unhide_post":"Si deg uenig med rapportering (vis innlegg)","disagree_flag_unhide_post_title":"Fjern alle rapporteringer fra dette innlegget og gjør det synlig igjen","disagree_flag":"Si deg uenig","disagree_flag_title":"Benekt rapportering som ugyldig eller uriktig","clear_topic_flags":"Ferdig","clear_topic_flags_title":"Emnet har blitt undersøkt og problemer har blitt løst. Klikk Ferdig for å fjerne rapporteringene.","more":"(flere svar...)","dispositions":{"agreed":"enig","disagreed":"uenig","deferred":"utsatt"},"flagged_by":"Rapportert av","resolved_by":"Løst av","took_action":"Tok Handling","system":"System","error":"Noe gikk galt","reply_message":"Svar","no_results":"Det er ingen rapporteringer.","topic_flagged":"Dette emnet har blitt rapportert.","visit_topic":"Besøk emnet for å utføre handling","was_edited":"Innlegget ble redigert etter første rapportering","previous_flags_count":"Dette innlegget har allerede blitt rapportert {{count}} ganger.","summary":{"action_type_3":{"one":"irrelevant","other":"irrelevant x{{count}}"},"action_type_4":{"one":"upassende","other":"upassende x{{count}}"},"action_type_6":{"one":"tilpasset","other":"tilpasset x{{count}}"},"action_type_7":{"one":"tilpasset","other":"tilpasset x{{count}}"},"action_type_8":{"one":"nettsøppel","other":"nettsøppel x{{count}}"}}},"groups":{"primary":"Primærgruppe","no_primary":"(ingen primærgruppe)","title":"Grupper","edit":"Rediger Grupper","refresh":"Last inn på nytt","new":"Ny","selector_placeholder":"oppgi brukernavn","name_placeholder":"Gruppenavn, ingen mellomrom, samme regler som for brukernavn","about":"Rediger gruppemedlemskap og navn her.","group_members":"Gruppemedlemmer","delete":"Slett","delete_confirm":"Slette denne grupper?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed.","delete_member_confirm":"Fjern '%{username}' fra '%{group}' gruppen?","name":"Navn","add":"Legg til","add_members":"Legg til medlemmer","custom":"Egendefinert","automatic":"Automatisk","automatic_membership_email_domains":"Brukere som registererer seg med et epostdomene som matcher en i denne listen vil automatisk bli lagt til i denne gruppen.","automatic_membership_retroactive":"Benytt samme epostdomeneregel for å legge til eksisterende brukere","default_title":"Standardtittel for alle brukere i denne gruppen","primary_group":"Sett som primærgruppe automatisk","group_owners":"Eiere","add_owners":"Legg til eiere","incoming_email_placeholder":"oppgi epostadresse"},"api":{"generate_master":"Generer Master API-nøkkel","none":"Det er ingen aktive API-nøkler akkurat nå.","user":"Bruker","title":"API","key":"Nøkkel","generate":"Generer API Nøkkel","regenerate":"Regenerer API Nøkkel","revoke":"Tilbakedra","confirm_regen":"Er du sikker på at du vil erstatte denne API-nøkkelen med en ny?","confirm_revoke":"Er du sikker på at du vil tilbakedra denne nøkkelen?","info_html":"Din API nøkkel vil tillate deg å lage og oppdatere emner ved å bruke JSON samteler.","all_users":"Alle brukere","note_html":"Hold denne nøkkelen \u003cstrong\u003ehemmelig\u003c/strong\u003e. Alle brukere som har den vil kunne opprette vilkårlige innlegg som en hvilken som helst bruker. "},"plugins":{"title":"Utvidelser","installed":"Installerte Utvidelser","name":"Navn","none_installed":"Du har ikke installert noen utvidelser.","version":"Versjon","enabled":"Aktivert?","is_enabled":"J","not_enabled":"N","change_settings":"Endre instillinger","change_settings_short":"Innstillinger","howto":"Hvordan installerer jeg utvidelser?"},"backups":{"title":"Sikkerhetskopieringer","menu":{"backups":"Sikkerhetskopieringer","logs":"Logger"},"none":"Ingen sikkerhetskopiering er tilgjengelig.","logs":{"none":"Ingen logger enda..."},"columns":{"filename":"Filnavn","size":"Størrelse"},"upload":{"label":"Last opp","title":"Last opp en sikkerhetskopi til denne instansen","uploading":"Laster opp...","success":"'{{filename}}' har blitt lastet opp.","error":"Det oppsto en feil ved opplastingen av '{{filename}}': {{message}}"},"operations":{"is_running":"En prosess pågår...","failed":" {{operation}} feilet. Venligst undersøk loggene.","cancel":{"label":"Avbryt","title":"Avbryt den nåværende handlingen","confirm":"Er du sikker på at du vil avbryte denne operasjonen?"},"backup":{"label":"Sikkerhetskopi","title":"Opprett en sikkerhetskopiering","confirm":"Vil du starte en ny sikkerhetskopiering?","without_uploads":"Ja (ikke inkluder filer)"},"download":{"label":"Last ned","title":"Last ned sikkerhetskopi"},"destroy":{"title":"Fjern sikkerhetskopi","confirm":"Er du sikker på at du vil slette denne sikkerhetskopien"},"restore":{"is_disabled":"Gjenoppretting er deaktivert i nettstedsinnstillingene.","label":"Gjenooprett","title":"Gjenopprett sikkerhetskopien"},"rollback":{"label":"Gjenopprett","title":"Gjenopprett databasen til en tidligere fungerende tilstand"}}},"export_csv":{"user_archive_confirm":"Er du sikker på at du vil laste ned innleggene dine?","success":"Eksportering iverksatt. Du vil bli varslet med en melding når prosessen er fullført.","failed":"Eksporteringen feilet. Venligst undersøk loggene.","rate_limit_error":"Innlegg kan lastes ned en gang om dagen, vennligst prøv igjen i morgen.","button_text":"Eksporter","button_title":{"user":"Eksporter full medlemsliste i CSV format.","staff_action":"Eksporter full handligslogg i CSV format.","screened_email":"Eksporter komplett liste over filtrerte epostadresser i CSV format.","screened_ip":"Eksporter komplett liste over filtrerte IP-addresser i CSV format.","screened_url":"Eksporter komplett liste over filtrerte URL'er i CSV format."}},"export_json":{"button_text":"Eksporter"},"invite":{"button_text":"Send invitasjoner","button_title":"Send invitasjoner"},"customize":{"title":"Tilpasse","long_title":"Nettstedstilpasninger","css":"CSS","header":"Header","top":"Topp","footer":"Footer","embedded_css":"Innebygd CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML som settes inn før \u003c/head\u003e taggen."},"body_tag":{"text":"\u003c/body\u003e","title":"HTML som settes inn før \u003c/body\u003e taggen."},"override_default":"Ikke inkluder standard stilark","enabled":"Aktivert?","preview":"forhåndsvisning","undo_preview":"avbryt forhåndsvisning","rescue_preview":"standard stil","explain_preview":"Se nettstedet med dette skreddersydde stilarket","explain_undo_preview":"Gå tilbake til nåværende aktivert tilpasset stilark","explain_rescue_preview":"Se nettstedet med standard stilark","save":"Lagre","new":"Ny","new_style":"Ny Stil","import":"Importer","import_title":"Velg en fil eller lim inn tekst","delete":"Slett","delete_confirm":"Slett denne tilpasningen?","about":"Endre CSS og HTML-headere på nettstedet. Legg til en tilpasning for å starte.","color":"Farge","opacity":"Opacity","copy":"Kopier","email_templates":{"subject":"Emne"},"css_html":{"title":"CSS/HTML","long_title":"CSS og HTML-tilpasninger"},"colors":{"title":"Farger","long_title":"Fargepanel","about":"Endre farger som brukes på nettstedet uten å skrive CSS. Legg til et skjema for å starte.","new_name":"Nytt fargetema","copy_name_prefix":"Kopi av","delete_confirm":"Slett dette fargetemaet?","undo":"angre","undo_title":"Fjern endringer av denne fargen siden sist den ble lagret.","revert":"gå tilbake","revert_title":"Nullstill denne fargen til standard fargeskjema for Discourse","primary":{"name":"primær","description":"Det meste av tekst, ikoner og kanter."},"secondary":{"name":"sekundær","description":"Primær bakgrunnsfarge og tekstfarge på noen knapper"},"tertiary":{"name":"tertiær","description":"Lenker, noen knapper, varsler og effektfarge"},"quaternary":{"name":"kvartær","description":"Navigasjonslenker."},"header_background":{"name":"bakgrunn i header","description":"Bakgrunnsfarge i nettstedets header"},"header_primary":{"name":"primær header","description":"Tekst og ikoner i nettstedets header"},"highlight":{"name":"utheving","description":"Bakgrunnsfarge på uthevede elementer på siden, som innlegg og emner."},"danger":{"name":"fare","description":"Uthevingsfarge for handlinger som sletting av innlegg og emner."},"success":{"name":"suksess","description":"Brukt til å indikere hvorvidt en handling var vellykket."},"love":{"name":"liker","description":"Fargen til Liker-knappen."}}},"email":{"title":"Eposter","settings":"Instillinger","preview_digest":"Forhåndsvis Oppsummering","sending_test":"Sender e-post for testing","error":"\u003cb\u003eERROR\u003c/b\u003e - %{server_error}","test_error":"Det oppsto et problem ved utsendelse av e-post for testing. Sjekk e-postinnstillinger nøye, sjekk at verten ikke blokkerer e-posttilkoblinger, og prøv igjen.","sent":"Sendt","skipped":"Hoppet over","sent_at":"Sendt","time":"Tid","user":"Bruker","email_type":"E-posttype","to_address":"Til adresse","test_email_address":"e-postadresse å teste","send_test":"Send e-post for testing","sent_test":"sendt!","delivery_method":"Leveringsmetode","refresh":"Refresh","format":"Format","html":"html","text":"tekst","last_seen_user":"Sist Sett Bruker:","reply_key":"Svar ID","skipped_reason":"Hopp over grunn","incoming_emails":{"from_address":"Fra","to_addresses":"Til","subject":"Emne","error":"Feil","filters":{"error_placeholder":"Feil"}},"logs":{"none":"Ingen logger funnet","filters":{"title":"Filtrer","user_placeholder":"brukernavn","address_placeholder":"navn@eksempel.com","type_placeholder":"oppsummering, registrering...","reply_key_placeholder":"svarnøkkel","skipped_reason_placeholder":"grunn"}}},"logs":{"title":"Logger","action":"Handling","created_at":"Opprettet","last_match_at":"Siste treff","match_count":"Treff","ip_address":"IP","topic_id":"Emne ID","post_id":"Innlegg ID","category_id":"Kategori ID","delete":"Slett","edit":"Endre","save":"Lagre","screened_actions":{"block":"blokker","do_nothing":"ikke gjør noe"},"staff_actions":{"title":"Personalhandlinger","instructions":"Klikk på brukernavn og handlinger for å filtrere listen. Klikk på profilbilder for å gå til brukerens side.","clear_filters":"Vis alt","staff_user":"Personale","target_user":"Målbruker","subject":"Emne","when":"Når","context":"Kontekst","details":"Detaljer","previous_value":"Forrige","new_value":"Ny","diff":"Diff","show":"Vis","modal_title":"Detaljer","no_previous":"Det finnes ingen forrige verdi.","deleted":"Ingen ny verdi. Posten ble slettet.","actions":{"delete_user":"slett bruker","change_trust_level":"endre tillitsnivå","change_username":"endre brukernavn","change_site_setting":"endre nettstedsinnstilling","change_site_customization":"endre tilpasninger for nettstedet","delete_site_customization":"slett tilpasninger for nettstedet","suspend_user":"bannlys bruker","unsuspend_user":"gjeninnsett bruker","grant_badge":"tildel merke","revoke_badge":"tilbakedra merke","check_email":"sjekk e-post","delete_topic":"slett emne","delete_post":"slett innlegg","impersonate":"overta brukerkonto","anonymize_user":"anonymiser bruker","roll_up":"rull opp IP-blokker","delete_category":"slett kategori","create_category":"opprett kategori"}},"screened_emails":{"title":"Kontrollerte e-poster","description":"Når noen forsøker å lage en ny konto, vil de følgende e-postadressene bli sjekket, og registreringen vil bli blokkert, eller en annen handling vil bli utført.","email":"E-postadresse","actions":{"allow":"Tillat"}},"screened_urls":{"title":"Kontrollerte URLs","description":"URLer listet her ble brukt i innlegg av brukere som har blitt identifisert som spammere.","url":"URL","domain":"Domene"},"screened_ips":{"title":"Kontrollerte IPs","description":"IP-adresser som blir fulgt. Benytt \"Tillat\" for å hvitliste IP-adresser.","delete_confirm":"Er du sikker på at du vil fjerne regelen for %{ip_address}?","rolled_up_some_subnets":"Fullførte sammenslåingen av blokkerte IP-addresser til disse subnettene: %{subnets}.","rolled_up_no_subnet":"Det var ingenting å slå sammen.","actions":{"block":"Blokker","do_nothing":"Tillat","allow_admin":"Tillat Admin"},"form":{"label":"Ny:","ip_address":"IP-adresse","add":"Legg til","filter":"Søk"},"roll_up":{"text":"Slå sammen.","title":"Lager nye blokkeringsoppføringer for subnett hvis det er minst 'min_ban_entries_for_roll_up' oppføringer."}},"logster":{"title":"Feillogg"}},"impersonate":{"title":"Fremstå som","help":"Bruk dette verktøyet for å fremstå som en annen bruker for feilsøking. Du må logge ut når du er ferdig.","not_found":"Den brukeren kunne ikke bli funnet.","invalid":"Beklager, du kan ikke gi deg ut for å være den brukeren."},"users":{"title":"Brukere","create":"Legg til Admin Bruker","last_emailed":"Sist kontaktet","not_found":"Beklager, det brukernavner eksisterer ikke i systemet vårt.","id_not_found":"Beklager, denne brukerID eksisterer ikke i vårt system.","active":"Aktiv","show_emails":"Vis e-poster","nav":{"new":"Ny","active":"Aktiv","pending":"Ventende","staff":"Stab","suspended":"Bannlyst","blocked":"Blokkert","suspect":"Mistenkt"},"approved":"Godkjent?","approved_selected":{"one":"godkjenn bruker","other":"godkjenn brukere ({{count}})"},"reject_selected":{"one":"avvis bruker","other":"avvis brukere ({{count}})"},"titles":{"active":"Aktive Brukere","new":"Nye Brukere","pending":"Brukere som venter på evaluering","newuser":"Brukere med tillitsnivå 0 (Ny Bruker)","basic":"Brukere med tillitsnivå 1 (Juniormedlem)","staff":"Stab","admins":"Admins","moderators":"Moderatorer","blocked":"Blokkerte brukere","suspended":"Bannlyste brukere","suspect":"Mistenkte Brukere"},"reject_successful":{"one":"Avvist 1 bruker.","other":"Avviste %{count} brukere."},"reject_failures":{"one":"Kunne ikke avvise 1 bruker.","other":"Kunne ikke avvise %{count} brukere."},"not_verified":"Uverifisert","check_email":{"title":"Vis denne brukerens e-postadresse","text":"Vis"}},"user":{"suspend_failed":"Noe gikk galt ved å bannlyse denne brukeren {{error}}","unsuspend_failed":"Noe gikk galt ved å gjeninsette denne brukeren {{error}}","suspend_duration":"Hvor lenge vil du bannlyse denne brukeren? (dager)","suspend_duration_units":"(dager)","suspend_reason_label":"Hvorfor vil du bannlyse? Denne teksten \u003cb\u003evil være synlig for alle\u003c/b\u003e på denne brukerens profilside, og blir vist til brukeren om de skulle forsøke å logge inn. Fatt deg i korthet.","suspend_reason":"Begrunnelse","suspended_by":"Bannlyst av","delete_all_posts":"Slett alle innlegg","suspend":"Bannlyst","unsuspend":"Gjeninnsett\"","suspended":"Bannlyst?","moderator":"Moderator?","admin":"Admin?","blocked":"Blokkert?","show_admin_profile":"Admin","edit_title":"Rediger Tittel","save_title":"Lagre Tittel","refresh_browsers":"Tving nettleser refresh","refresh_browsers_message":"Melding sendt til alle klienter!","show_public_profile":"Vis offentlig profil","impersonate":"Gi deg ut for å være en annen","ip_lookup":"IP Lookup","log_out":"Logg ut","logged_out":"Brukeren ble logget ut med alle enheter","revoke_admin":"Tilbakedra Admin","grant_admin":"Innvilg admin","revoke_moderation":"Tilbakedra Moderering","grant_moderation":"Innvilg moderering","unblock":"Opphev blokkering","block":"Blokker","reputation":"Rykte","permissions":"Tillatelser","activity":"Aktivitet","like_count":"Liker tildelt / mottatt","last_100_days":"de siste 100 dagene","private_topics_count":"Private emner","posts_read_count":"Innlegg lest","post_count":"Innlegg skrevet","topics_entered":"Emner vist","flags_given_count":"Rapporteringer tildelt","flags_received_count":"Rapporteringer mottatt","warnings_received_count":"Advarsler mottatt","flags_given_received_count":"Rapporteringer tildelt / mottatt","approve":"Godta","approved_by":"Godtatt Av","approve_success":"Brukeren er godkjent og e-post med aktiveringsinstruksjoner er sendt.","approve_bulk_success":"Suksess! Alle valgte brukere har blitt godkjent og varslet.","time_read":"Lesetid","anonymize":"Anonymiser Bruker","anonymize_confirm":"Ønsker du virkelig å anonymisere denne kontoen? Dette vil endre brukernavn og e-post samt tilbakestille kontoinnstillinger.","anonymize_yes":"Ja, anonymiser denne kontoen","anonymize_failed":"Det oppstod en feil ved anonymisering av denne kontoen.","delete":"Slett Bruker","delete_forbidden_because_staff":"Administratorer og moderatorer kan ikke slettes.","delete_posts_forbidden_because_staff":"Kan ikke slette alle innlegg av administratorer og moderatorer.","delete_forbidden":{"one":"Brukere kan ikke slettes om de har innlegg. Slett alle brukerens innlegg før bruker kan slettes. (Innlegg eldre enn %{count} dag kan ikke slettes.)","other":"Brukere kan ikke slettes om de har innlegg. Slett alle brukerens innlegg før bruker kan slettes. (Innlegg eldre enn %{count} dager kan ikke slettes.)"},"cant_delete_all_posts":{"one":"Kan ikke slette alle innlegg. Noen innlegg er eldre enn %{count} dag gammel. (Innstillingen delete_user_max_post_age.)","other":"Kan ikke slette alle innlegg. Noen innlegg er eldre enn %{count} dager gamle. (Innstillingen delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Kan ikke slette alle innlegg fordi brukeren har mer enn 1 innlegg. (delete_all_posts_max)","other":"Kan ikke slette alle innlegg fordi brukeren har mer enn %{count} innlegg. (delete_all_posts_max)"},"delete_confirm":"Er du HELT SIKKER på at du vil slette denne brukeren? Denne handlingen er permanent!","delete_and_block":"Slett og \u003cb\u003eblokker\u003c/b\u003e denne e-post- og IP-adressen","delete_dont_block":"Bare slett","deleted":"Brukeren ble slettet.","delete_failed":"Det oppstod en feil ved slettingen av den brukeren. Sørg for at alle av brukerens innlegg er slettet før du prøver å slette brukeren.","send_activation_email":"Send e-post for aktivering","activation_email_sent":"En e-post for aktivering har blitt sendt.","send_activation_email_failed":"Det oppstod et problem ved sending av ny e-post for aktivering. %{error}","activate":"Aktiver Konto","activate_failed":"Det oppstod et problem ved aktiveringen av den brukeren.","deactivate_account":"Deaktiver Konto","deactivate_failed":"Det oppstod et problem ved deaktiveringen av den brukeren.","unblock_failed":"Det oppstod et problem med å oppheve blokkeringen av brukeren.","block_failed":"Det oppstod et problem med blokkeringen av brukeren.","deactivate_explanation":"En deaktivert bruker må re-validere sin e-post.","suspended_explanation":"En bannlyst bruker kan ikke logge inn.","block_explanation":"En blokkert bruker kan ikke poste eller starte emner.","trust_level_change_failed":"Det oppsto et problem ved endring av brukerens tillitsnivå.","suspend_modal_title":"Bannlys bruker","trust_level_2_users":"Brukere med tillitsnivå 2","trust_level_3_requirements":"Krav til tillitsnivå 3","trust_level_locked_tip":"tillitsnivå er låst, systemet vil ikke forfremme eller degradere bruker","trust_level_unlocked_tip":"tillitsnivå er ulåst, systemet kan forfremme eller degradere bruker","lock_trust_level":"Lås tillitsnivå","unlock_trust_level":"Lås opp tillitsnivå","tl3_requirements":{"title":"Krav til tillitsnivå 3","value_heading":"Verdi","requirement_heading":"Krav","visits":"Besøk","days":"dager","topics_replied_to":"Emner besvart","topics_viewed":"Emner vist","topics_viewed_all_time":"Emner vist (totalt)","posts_read":"Innlegg lest","posts_read_all_time":"Innlegg lest (totalt)","flagged_posts":"Rapporterte innlegg","flagged_by_users":"Brukere som rapporterte","likes_given":"Likes tildelt","likes_received":"Likes mottatt","likes_received_days":"Likes Mottatt: unike dager","likes_received_users":"Likes Mottatt: unike brukere","qualifies":"Kvalifiserer til tillitsnivå 3.","does_not_qualify":"Kvalifiserer ikke til tillitsnivå 3.","will_be_promoted":"Vil snart forfremmes.","will_be_demoted":"Vil snart degraderes.","on_grace_period":"For tiden i prøvetid for forfremmelse, vil ikke degraderes","locked_will_not_be_promoted":"Tillitsnivå låst. Vil aldri bli forfremmet.","locked_will_not_be_demoted":"Tillitsnivå låst. Vil aldri bli degradert."},"sso":{"title":"Single Sign On","external_id":"Ekstern ID","external_username":"Brukernavn","external_name":"Navn","external_email":"E-post","external_avatar_url":"Profilbilde URL"}},"user_fields":{"title":"Brukerfelter","help":"Legg til felt som dine brukere kan fylle ut.","create":"Opprett brukerfelt","untitled":"Uten tittel","name":"Feltnavn","type":"Felttype","description":"Beskrivelse av felt","save":"Lagre","edit":"Endre","delete":"Slett","cancel":"Avbryt","delete_confirm":"Er du sikker på at du vil fjerne brukerfeltet?","options":"Alternativer","required":{"title":"Nødvendig ved registrering?","enabled":"nødvendig","disabled":"ikke obligatorisk"},"editable":{"title":"Kan det endres etter registrering?","enabled":"kan endres","disabled":"kan ikke endres"},"show_on_profile":{"title":"Vis på offentlig profil?","enabled":"vises på profil","disabled":"vises ikke på profil"},"field_types":{"text":"Tekstfelt","confirm":"Bekreftelse","dropdown":"Nedtrekk"}},"site_text":{"title":"Tekstinnhold"},"site_settings":{"show_overriden":"Bare vis overstyrte","title":"Innstillinger","reset":"tilbakestill","none":"intet","no_results":"Ingen treff funnet.","clear_filter":"Tøm","add_url":"legg til URL","add_host":"legg til host","categories":{"all_results":"Alle","required":"Påkrevd","basic":"Grunnleggende oppsett","users":"Brukere","posting":"Posting","email":"E-post","files":"Filer","trust":"Tillitsnivå","security":"Sikkerhet","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Frekvensbegresninger","developer":"Utvikler","embedding":"Embedding","legal":"Juridisk","uncategorized":"Annet","backups":"Sikkerhetskopier","login":"Login","plugins":"Utvidelser"}},"badges":{"title":"Merker","new_badge":"Nytt merke","new":"Ny","name":"Navn","badge":"Merke","display_name":"Visningsnavn","description":"Beskrivelse","badge_type":"Merketype","badge_grouping":"Gruppe","badge_groupings":{"modal_title":"Merkegrupper"},"granted_by":"Tildelt av","granted_at":"Tildelt","reason_help":"(En lenke til et innlegg eller emne)","save":"Lagre","delete":"Slett","delete_confirm":"Er du sikker på at du vil slette dette merket?","revoke":"Tilbakedra","reason":"Grunn","expand":"Ekspander","revoke_confirm":"Er du sikker på at du vil tilbakedra dette merket?","edit_badges":"Rediger merker","grant_badge":"Tildel merke","granted_badges":"Tildelte merker","grant":"Tildel","no_user_badges":"%{name} har ikke blitt tildelt noen merker.","no_badges":"Det er ingen merker som kan bli tildelt.","none_selected":"Velg et merke for å komme i gang","allow_title":"Tillat merke å bli benyttet som en tittel","multiple_grant":"Kan bli tildelt flere ganger","listable":"Vis merket på den offentlige merkesiden","enabled":"Aktiver merke","icon":"Ikon","image":"Bilde","icon_help":"Bruk enten en Font Awesome class eller URL for et bilde","query":"Spørring for merke (SQL)","target_posts":"Spørring har innlegg som mål","auto_revoke":"Kjør tilbakedragningsspørring daglig","show_posts":"Vis innlegg som ga tildeling av merke på merkesiden","trigger":"Utløser","trigger_type":{"none":"Oppdater daglig","post_action":"Når en bruker gjør en handling på et innlegg","post_revision":"Når en bruker redigerer eller lager et nytt innlegg","trust_level_change":"Når bruker endrer tillitsnivå","user_change":"Når en bruker blir redigert eller registrert"},"preview":{"link_text":"Forhåndsvis tildelte merker","plan_text":"Forhåndsvis med plan for spørring","modal_title":"Forhåndsvisning av spørring for merke","sql_error_header":"Det oppsto en feil med spørringen.","error_help":"Se følgende lenker for hjelp til spørringer for merker.","bad_count_warning":{"header":"ADVARSEL!","text":"Det er manglende grant samples. Dette skjer når badge søket returnerer bruker-IDer eller post IDer som ikke eksisterer. Dette kan føre til uventede resultater senere - vennligst dobbeltsjekk søket ditt."},"sample":"Eksempel:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for innlegg i %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for innlegg i %{link} - \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e - \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Legg til en ny emoji som vil være tilgjengelig for alle. (PROTIP: Dra og slipp flere filer samtidig)","add":"Legg til ny Emoji","name":"Navn","image":"Bilde","delete_confirm":"Sikker på at du vil slette: %{name}: emoji?"},"permalink":{"title":"Permalenker","url":"URL","topic_id":"Emne ID","topic_title":"Emne","post_id":"Innlegg ID","post_title":"Innlegg","category_id":"Kategori ID","category_title":"Kategori","external_url":"Ekstern URL","delete_confirm":"Er du sikker du vil slette denne permalenken?","form":{"label":"Ny:","add":"Legg til","filter":"Søk (URL eller ekstern URL)"}}}}},"en":{"js":{"dates":{"timeline_date":"MMM YYYY","wrap_ago":"%{date} ago"},"action_codes":{"split_topic":"split this topic %{when}","invited_group":"invited %{who} %{when}","removed_group":"removed %{who} %{when}","pinned_globally":{"disabled":"unpinned %{when}"},"visible":{"enabled":"listed %{when}","disabled":"unlisted %{when}"}},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)","cn_north_1":"China (Beijing)"}},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","queue":{"delete_prompt":"Are you sure you want to delete \u003cb\u003e%{username}\u003c/b\u003e? This will remove all of their posts and block their email and IP address."},"directory":{"topics_entered":"Viewed"},"groups":{"empty":{"mentions":"There is no mention of this group.","topics":"There is no topic by members of this group."},"index":"Groups","alias_levels":{"title":"Who can message and @mention this group?"},"trust_levels":{"title":"Trust level automatically granted to members when they're added:"},"notifications":{"watching":{"description":"You will be notified of every new post in every message, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."},"tracking":{"description":"You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"muted":{"description":"You will never be notified of anything about new topics in this group."}}},"categories":{"category_list":"Display category list","reorder":{"title":"Reorder Categories","title_long":"Reorganize the category list","fix_order":"Fix Positions","fix_order_tooltip":"Not all categories have a unique position number, which may cause unexpected results.","apply_all":"Apply","position":"Position"},"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"expand_profile":"Expand","desktop_notifications":{"not_supported":"Notifications are not supported on this browser. Sorry.","perm_denied_expl":"You denied permission for notifications. Allow notifications via your browser settings.","currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","email_activity_summary":"Activity Summary","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","muted_categories_instructions":"You will not be notified of anything about new topics in these categories, and they will not appear in latest.","muted_topics_link":"Show muted topics","watched_topics_link":"Show watched topics","automatically_unpin_topics":"Automatically unpin topics when I reach the bottom.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","messages":{"archive":"Archive","move_to_archive":"Archive","failed_to_move":"Failed to move selected messages (perhaps your network is down)"},"change_about":{"error":"There was an error changing this value."},"change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"change_avatar":{"cache_notice":"You've successfully changed your profile picture but it might take some time to appear due to browser caching."},"email":{"frequency_immediately":"We'll email you immediately if you haven't read the thing we're emailing you about.","frequency":{"one":"We'll only email you if we haven't seen you in the last minute.","other":"We'll only email you if we haven't seen you in the last {{count}} minutes."}},"email_previous_replies":{"title":"Include previous replies at the bottom of emails","unless_emailed":"unless previously sent"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","new_topic_duration":{"after_1_day":"created in the last day","after_2_days":"created in the last 2 days","after_1_week":"created in the last week","after_2_weeks":"created in the last 2 weeks"},"auto_track_options":{"after_30_seconds":"after 30 seconds"},"invited":{"none":"There are no pending invites to display.","truncated":{"one":"Showing the first invite.","other":"Showing the first {{count}} invites."},"redeemed_tab_with_count":"Redeemed ({{count}})","pending_tab_with_count":"Pending ({{count}})","reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!","generate_link":"Copy Invite Link","generated_link_message":"\u003cp\u003eInvite link generated successfully!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eInvite link is only valid for this email address: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e"},"summary":{"time_read":"read time","topic_count":{"one":"topic created","other":"topics created"},"post_count":{"one":"post created","other":"posts created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"no_replies":"No replies yet.","more_replies":"More Replies","no_topics":"No topics yet.","top_badges":"Top Badges","no_badges":"No badges yet.","more_badges":"More Badges","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"read_only_mode":{"enabled":"This site is in read only mode. Please continue to browse, but replying, likes, and other actions are disabled for now.","logout_disabled":"Logout is disabled while the site is in read only mode."},"too_few_topics_and_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","too_few_topics_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics. New visitors need some conversations to read and respond to.","too_few_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"summary":{"description":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies.","description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"login":{"instagram":{"title":"with Instagram","message":"Authenticating with Instagram (make sure pop up blockers are not enabled)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_whisper":"Toggle Whisper","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","reply_placeholder":"Type here. Use Markdown, BBCode, or HTML to format. Drag or paste images.","bold_label":"B","italic_label":"I","link_url_placeholder":"http://example.com","paste_code_text":"type or paste code here","heading_label":"H","cant_send_pm":"Sorry, you can't send a message to %{username}.","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"},"alt":{"edited":"Edit your post by","invited_to_private_message":"Invited to a private message from","invited_to_topic":"Invited to a topic from","invitee_accepted":"Invite accepted by","moved_post":"Your post was moved by","group_message_summary":"Messages in group inbox"},"popup":{"group_mentioned":"{{username}} mentioned you in \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"remote_tip_with_attachments":"link to image or file {{authorized_extensions}}","local_tip_with_attachments":"select images or files from your device {{authorized_extensions}}","hint_for_supported_browsers":"you can also drag and drop or paste images into the editor"},"search":{"too_short":"Your search term is too short.","result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} results for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"context":{"category":"Search the #{{category}} category"}},"topics":{"bulk":{"unlist_topics":"Unlist Topics","dismiss":"Dismiss","dismiss_read":"Dismiss all unread","dismiss_button":"Dismiss…","dismiss_tooltip":"Dismiss just new posts or stop tracking topics","also_dismiss_topics":"Stop tracking these topics so they never show up as unread for me again","change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."},"none":{"educate":{"new":"\u003cp\u003eYour new topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered new and will show a \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e indicator if they were created in the last 2 days.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e","unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}}},"topic":{"unsubscribe":{"stop_notifications":"You will now receive less notifications for \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Your current notification state is "},"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"archive_message":{"help":"Move message to your archive"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."},"muted":{"description":"You will never be notified of anything about this topic, and it will not appear in latest."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"feature_topic":{"pin":"Make this topic appear at the top of the {{categoryLink}} category until","unpin_until":"Remove this topic from the top of the {{categoryLink}} category or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_validation":"A date is required to pin this topic.","not_pinned":"There are no topics pinned in {{categoryLink}}.","already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Make this topic appear at the top of all topic lists until","unpin_globally_until":"Remove this topic from the top of all topic lists or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","not_pinned_globally":"There are no topics pinned globally.","already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"no_banner_exists":"There is no banner topic.","banner_exists":"There \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e currently a banner topic."},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_timestamp":{"title":"Change Timestamp","action":"change timestamp","invalid_timestamp":"Timestamp cannot be in the future.","error":"There was an error changing the timestamp of the topic.","instructions":"Please select the new timestamp of the topic. Posts in the topic will be updated to have the same time difference."}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","whisper":"this post is a private whisper for moderators","wiki":{"about":"this post is a wiki"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","controls":{"change_owner":"Change Ownership"},"actions":{"people":{"off_topic":"flagged this as off-topic","bookmark":"bookmarked this"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","suppress_from_homepage":"Suppress this category from the homepage.","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"muted":{"description":"You will never be notified of anything about new topics in these categories, and they will not appear in latest."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"topic_statuses":{"locked_and_archived":{"help":"This topic is closed and archived; it no longer accepts new replies and cannot be changed"},"pinned_globally":{"help":"This topic is pinned globally; it will display at the top of latest and its category"}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"public":{"title":"Votes are public."},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"groups":{"delete_owner_confirm":"Remove owner privilege for '%{username}'?","bulk_complete":"The users have been added to the group.","bulk":"Bulk Add to Group","bulk_paste":"Paste a list of usernames or emails, one per line:","bulk_select":"(select a group)","incoming_email":"Custom incoming email address","flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"operations":{"restore":{"confirm":"Are you sure you want to restore this backup?"},"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"customize":{"email_templates":{"title":"Email Templates","multiple_subjects":"This email template has multiple subjects.","body":"Body","none_selected":"Select an email template to begin editing.","revert":"Revert Changes","revert_confirm":"Are you sure you want to revert your changes?"}},"email":{"templates":"Templates","bounced":"Bounced","received":"Received","rejected":"Rejected","preview_digest_desc":"Preview the content of the digest emails sent to inactive users.","incoming_emails":{"cc_addresses":"Cc","none":"No incoming emails found.","modal":{"title":"Incoming Email Details","error":"Error","headers":"Headers","subject":"Subject","body":"Body","rejection_message":"Rejection Mail"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Subject..."}}},"logs":{"staff_actions":{"actions":{"change_site_text":"change site text","change_category_settings":"change category settings","block_user":"block user","unblock_user":"unblock user","grant_admin":"grant admin","revoke_admin":"revoke admin","grant_moderation":"grant moderation","revoke_moderation":"revoke moderation","backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}},"screened_ips":{"roll_up_confirm":"Are you sure you want to roll up commonly screened IP addresses into subnets?"}},"users":{"titles":{"member":"Users at Trust Level 2 (Member)","regular":"Users at Trust Level 3 (Regular)","leader":"Users at Trust Level 4 (Leader)"}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","block_confirm":"Are you sure you want to block this user? They will not be able to create any new topics or posts.","block_accept":"Yes, block this user","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"}},"site_text":{"description":"You can customize any of the text on your forum. Please start by searching below:","search":"Search for the text you'd like to edit","edit":"edit","revert":"Revert Changes","revert_confirm":"Are you sure you want to revert your changes?","go_back":"Back to Search","recommended":"We recommend customizing the following text to suit your needs:","show_overriden":"Only show overridden"},"site_settings":{"categories":{"user_api":"User API","user_preferences":"User Preferences","tags":"Tags","search":"Search"}},"badges":{"long_description":"Long Description","trigger_type":{"post_processed":"After a post is processed"},"preview":{"no_grant_count":"No badges to be assigned.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned.","other":"\u003cb\u003e%{count}\u003c/b\u003e badges to be assigned."}}},"embedding":{"get_started":"If you'd like to embed Discourse on another website, begin by adding its host.","confirm_delete":"Are you sure you want to delete that host?","sample":"Use the following HTML code into your site to create and embed discourse topics. Replace \u003cb\u003eREPLACE_ME\u003c/b\u003e with the canonical URL of the page you are embedding it on.","title":"Embedding","host":"Allowed Hosts","path_whitelist":"Path Whitelist","edit":"edit","category":"Post to Category","add_host":"Add Host","settings":"Embedding Settings","feed_settings":"Feed Settings","feed_description":"Providing an RSS/ATOM feed for your site can improve Discourse's ability to import your content.","crawling_settings":"Crawler Settings","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"Username for topic creation","embed_post_limit":"Maximum number of posts to embed","embed_username_key_from_feed":"Key to pull discourse username from feed","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_truncate":"Truncate the embedded posts","embed_whitelist_selector":"CSS selector for elements that are allowed in embeds","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","embed_classname_whitelist":"Allowed CSS class names","feed_polling_enabled":"Import posts via RSS/ATOM","feed_polling_url":"URL of RSS/ATOM feed to crawl","save":"Save Embedding Settings"}}}}};
I18n.locale = 'nb_NO';
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
//! locale : norwegian bokmål (nb)
//! authors : Espen Hovlandsdal : https://github.com/rexxars
//!           Sigurd Gartmann : https://github.com/sigurdga

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var nb = moment.defineLocale('nb', {
        months : 'januar_februar_mars_april_mai_juni_juli_august_september_oktober_november_desember'.split('_'),
        monthsShort : 'jan._feb._mars_april_mai_juni_juli_aug._sep._okt._nov._des.'.split('_'),
        monthsParseExact : true,
        weekdays : 'søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag'.split('_'),
        weekdaysShort : 'sø._ma._ti._on._to._fr._lø.'.split('_'),
        weekdaysMin : 'sø_ma_ti_on_to_fr_lø'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY [kl.] HH:mm',
            LLLL : 'dddd D. MMMM YYYY [kl.] HH:mm'
        },
        calendar : {
            sameDay: '[i dag kl.] LT',
            nextDay: '[i morgen kl.] LT',
            nextWeek: 'dddd [kl.] LT',
            lastDay: '[i går kl.] LT',
            lastWeek: '[forrige] dddd [kl.] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'om %s',
            past : '%s siden',
            s : 'noen sekunder',
            m : 'ett minutt',
            mm : '%d minutter',
            h : 'en time',
            hh : '%d timer',
            d : 'en dag',
            dd : '%d dager',
            M : 'en måned',
            MM : '%d måneder',
            y : 'ett år',
            yy : '%d år'
        },
        ordinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return nb;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
