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
I18n._compiledMFs = {};

MessageFormat.locale.pl_PL = function (n) {
  if (n == 1) {
    return 'one';
  }
  if ((n % 10) >= 2 && (n % 10) <= 4 &&
      ((n % 100) < 12 || (n % 100) > 14) && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 10) === 0 || n != 1 && (n % 10) == 1 ||
      ((n % 10) >= 5 && (n % 10) <= 9 || (n % 100) >= 12 && (n % 100) <= 14) &&
      n == Math.floor(n)) {
    return 'many';
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
I18n.translations = {"pl_PL":{"js":{"number":{"format":{"separator":",","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajty","other":"bajtów"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"H:mm","timeline_date":"MMM YYYY","long_no_year":"D MMM H:mm","long_no_year_no_time":"D MMM","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM YYYY H:mm","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} temu","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","few":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","few":"%{count}s","other":"%{count}s"},"x_minutes":{"one":"1m","few":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"1h","few":"%{count}h","other":"%{count}h"},"x_days":{"one":"1d","few":"%{count}d","other":"%{count}d"},"about_x_years":{"one":"1r","few":"%{count}r","other":"%{count}r"},"over_x_years":{"one":"\u003e 1r","few":"\u003e %{count}r","other":"\u003e %{count}r"},"almost_x_years":{"one":"1r","few":"%{count}r","other":"%{count}r"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuta","few":"%{count} minuty","other":"%{count} minut"},"x_hours":{"one":"1 godzina","few":"%{count} godziny","other":"%{count} godzin"},"x_days":{"one":"1 dzień","few":"%{count} dni","other":"%{count} dni"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"minutę temu","few":"%{count} minuty temu","other":"%{count} minut temu"},"x_hours":{"one":"godzinę temu","few":"%{count} godziny temu","other":"%{count} godzin temu"},"x_days":{"one":"wczoraj","few":"%{count} dni temu","other":"%{count} dni temu"}},"later":{"x_days":{"one":"1 dzień później","few":"%{count} dni później","other":"%{count} dni później"},"x_months":{"one":"1 miesiąc później","few":"%{count} miesiące później","other":"%{count} miesięcy później"},"x_years":{"one":"1 rok później","few":"%{count} lata później","other":"%{count} lat później"}},"previous_month":"Poprzedni miesiąc","next_month":"Następny miesiąc"},"share":{"topic":"udostępnij odnośnik do tego tematu","post":"wpis #%{postNumber}","close":"zamknij","twitter":"udostępnij ten odnośnik na Twitterze","facebook":"udostępnij ten odnośnik na Facebooku","google+":"udostępnij ten odnośnik na Google+","email":"wyślij ten odnośnik przez email"},"action_codes":{"split_topic":"podziel ten temat %{when}","invited_user":"%{who} został zaproszony %{when}","invited_group":"%{who} został zaproszony %{when}","removed_user":"%{who} został usunięty %{when}","removed_group":"%{who} został usunięty %{when}","autoclosed":{"enabled":"zamknięcie %{when}","disabled":"otworzenie %{when}"},"closed":{"enabled":"zamknięcie %{when}","disabled":"otworzenie %{when}"},"archived":{"enabled":"archiwizacja %{when}","disabled":"dearchiwizacja %{when}"},"pinned":{"enabled":"przypięcie %{when}","disabled":"odpięcie %{when}"},"pinned_globally":{"enabled":"globalne przypięcie %{when}","disabled":"globalne odpięcie %{when}"},"visible":{"enabled":"wylistowanie %{when}","disabled":"odlistowanie %{when}"}},"topic_admin_menu":"akcje administratora","emails_are_disabled":"Wysyłanie e-maili zostało globalnie wyłączone przez administrację. Powiadomienia e-mail nie będą dostarczane.","bootstrap_mode_disabled":"Tryb Bootstrap zostanie wyłączony w ciągu najbliższych 24 godzin.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Irlandia)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"Ameryka Południowa (Sao Paulo)","cn_north_1":"Chiny (Beijing)"}},"edit":"edytuj tytuł i kategorię tego tematu","not_implemented":"Bardzo nam przykro, ale ta funkcja nie została jeszcze zaimplementowana.","no_value":"Nie","yes_value":"Tak","generic_error":"Przepraszamy, wystąpił błąd.","generic_error_with_reason":"Wystąpił błąd: %{error}","sign_up":"Rejestracja","log_in":"Logowanie","age":"Wiek","joined":"Dołączył","admin_title":"Administracja","flags_title":"Flagi","show_more":"pokaż więcej","show_help":"pomoc","links":"Odnośniki","links_lowercase":{"one":"link","few":"linki","other":"linków"},"faq":"FAQ","guidelines":"Przewodnik","privacy_policy":"Polityka prywatności","privacy":"Prywatność","terms_of_service":"Warunki użytkowania serwisu","mobile_view":"Wersja mobilna","desktop_view":"Wersja komputerowa","you":"Ty","or":"lub","now":"teraz","read_more":"więcej","more":"Więcej","less":"Mniej","never":"nigdy","every_30_minutes":"co 30 minut","every_hour":"co godzinę","daily":"dziennie","weekly":"tygodniowo","every_two_weeks":"co dwa tygodnie","every_three_days":"co trzy dni","max_of_count":"max z {{count}}","alternation":"lub","character_count":{"one":"1 znak","few":"{{count}} znaki","other":"{{count}} znaków"},"suggested_topics":{"title":"Sugerowane tematy","pm_title":"sugerowane wiadomości"},"about":{"simple_title":"O stronie","title":"O %{title}","stats":"Statystyki strony","our_admins":"Administratorzy","our_moderators":"Moderatoratorzy","stat":{"all_time":"Ogółem","last_7_days":"Ostatnich 7 dni","last_30_days":"Ostatnie 30 dni"},"like_count":"Lajki","topic_count":"Tematy","post_count":"Wpisy","user_count":"Nowi użytkownicy","active_user_count":"Aktywni użytkownicy","contact":"Kontakt","contact_info":"W sprawach wymagających szybkiej reakcji lub związanych z poprawnym funkcjonowaniem serwisu, prosimy o kontakt: %{contact_info}."},"bookmarked":{"title":"Zakładka","clear_bookmarks":"Usuń z zakładek","help":{"bookmark":"Kliknij, aby dodać pierwszy wpis tematu do zakładek","unbookmark":"Kliknij, aby usunąć wszystkie zakładki z tego tematu"}},"bookmarks":{"not_logged_in":"przykro nam, ale należy się zalogować, aby dodawać zakładki","created":"zakładka dodana","not_bookmarked":"wpis przeczytany: kliknij, aby dodać zakładkę","last_read":"to ostatni przeczytany przez ciebie wpis: kliknij, aby dodać zakładkę","remove":"Usuń zakładkę","confirm_clear":"Czy na pewno chcesz usunąć wszystkie zakładki ustawione w tym temacie?"},"topic_count_latest":{"one":"{{count}} nowy lub zaktualizowany temat","few":"{{count}} nowe lub zaktualizowane tematy","other":"{{count}} nowych lub zaktualizowanych tematów"},"topic_count_unread":{"one":"{{count}} nieprzeczytany temat.","few":"{{count}} nieprzeczytane tematy.","other":"{{count}} nieprzeczytanych tematów."},"topic_count_new":{"one":"{{count}} nowy temat.","few":"{{count}} nowe tematy.","other":"{{count}} nowych tematów."},"click_to_show":"Kliknij aby zobaczyć.","preview":"podgląd","cancel":"anuluj","save":"Zapisz zmiany","saving":"Zapisuję…","saved":"Zapisano!","upload":"Dodaj","uploading":"Wysyłam…","uploading_filename":"Wysyłanie {{filename}}...","uploaded":"Wgrano!","enable":"Włącz","disable":"Wyłącz","undo":"Cofnij","revert":"Przywróć","failed":"Niepowodzenie","switch_to_anon":"Włącz tryb anonimowy","switch_from_anon":"Zakończ tryb anonimowy","banner":{"close":"Zamknij ten baner.","edit":"Edytuj ten baner \u003e\u003e"},"choose_topic":{"none_found":"Nie znaleziono tematów.","title":{"search":"Szukaj tematu po nazwie, URL-u albo ID:","placeholder":"tutaj wpisz tytuł tematu"}},"queue":{"topic":"Temat:","approve":"Zatwierdź","reject":"Odrzuć","delete_user":"Usuń użytkownika","title":"Wymaga zatwierdzenia","none":"Brak wpisów wymagających uwagi.","edit":"Edytuj","cancel":"Anuluj","view_pending":"wyświetl oczekujące wpisy","has_pending_posts":{"one":"Ten temat posiada \u003cb\u003e1\u003c/b\u003e wpis oczekujący na akceptację","few":"Ten temat posiada \u003cb\u003e{{count}}\u003c/b\u003e wpisy oczekujące na akceptację","other":"Ten temat posiada \u003cb\u003e{{count}}\u003c/b\u003e wpisów oczekujących na akceptację"},"confirm":"Zapisz zmiany","delete_prompt":"Czy na pewno chcesz usunąć \u003cb\u003e%{username}\u003c/b\u003e? To spowoduje usunięcie wszystkich wiadomości, zablokowanie adresu e-mail i adresu IP tego użytkownika.","approval":{"title":"Wpis wymaga zatwierdzenia","description":"Twój nowy wpis został umieszczony w kolejce i pojawi się po zatwierdzeniu przez moderatora. Prosimy o cierpliwość.","pending_posts":{"one":"Posiadasz \u003cstrong\u003e1\u003c/strong\u003e oczekujący wpis.","few":"Posiadasz \u003cstrong\u003e{{count}}\u003c/strong\u003e oczekujące wpisy.","other":"Posiadasz \u003cstrong\u003e{{count}}\u003c/strong\u003e oczekujących wpisów."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e tworzy \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDodajesz\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpowiada na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eOdpowiadasz\u003c/a\u003e na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpisuje na \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eOdpowiadasz\u003c/a\u003e w \u003ca href='{{topicUrl}}'\u003etemacie\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e wspomina o \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e wspomniał o \u003ca href='{{user2Url}}'\u003etobie\u003c/a\u003e","you_mentioned_user":"\u003ca href=\"{{user1Url}}\"\u003eWspomniałeś/aś\u003c/a\u003e o użytkowniku \u003ca href=\"{{user2Url}}\"\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Wysłane przez \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Dodany przez \u003ca href='{{userUrl}}'\u003eciebie\u003c/a\u003e","sent_by_user":"Wysłano przez \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Wysłano przez \u003ca href='{{userUrl}}'\u003eCiebie\u003c/a\u003e"},"directory":{"filter_name":"sortuj po nazwie użytkownika","title":"Użytkownicy","likes_given":"Oddane","likes_received":"Otrzymane","topics_entered":"Odsłony","topics_entered_long":"Wyświetlone Tematy","time_read":"Czas","topic_count":"Tematy","topic_count_long":"Utworzone tematy","post_count":"Odpowiedzi","post_count_long":"Wysłane odpowiedzi","no_results":"Nie znaleziono wyników.","days_visited":"Odwiedziny","days_visited_long":"Dni Odwiedzin","posts_read":"Przeczytane","posts_read_long":"Przeczytane wpisy","total_rows":{"one":"1 użytkownik","few":"%{count} użytkownicy","other":"%{count} użytkowników"}},"groups":{"empty":{"posts":"Członkowie tej grupy nie opublikowali żadnych postów.","members":"W tej grupie nie ma żadnych członków.","mentions":"Nie ma wzmianki w tej grupie.","messages":"Nie ma żadnej wiadomości dla tej grupy.","topics":"Członkowie tej grupy nie opublikowali żadnych postów."},"add":"Dodaj","selector_placeholder":"Dodaj członków","owner":"właściciel","visible":"Grupa jest widoczna dla wszystkich użytkowników","index":"Grupy","title":{"one":"grupa","few":"grupy","other":"grupy"},"members":"Członkowie","topics":"Tematy","posts":"Wpisów","mentions":"Wzmianki","messages":"Wiadomości","alias_levels":{"title":"Kto może wysyłać wiadomości i używać @aliasu tej grupy?","nobody":"Nikt","only_admins":"Tylko administratorzy","mods_and_admins":"Tylko moderatorzy i administratorzy","members_mods_and_admins":"Tylko członkowie grupy, moderatorzy i administratorzy","everyone":"Wszyscy"},"trust_levels":{"title":"Domyślny poziom zaufania przyznawany nowych użytkownikom:","none":"Brak"},"notifications":{"watching":{"title":"Obserwowanie","description":"Dostaniesz powiadomienie o każdym nowym wpisie w każdej dyskusji, zobaczysz również ilość odpowiedzi."},"watching_first_post":{"title":"Oglądasz pierwszy post","description":"Zostaniesz powiadomiony tylko o pierwszym wpisie w każdym nowym temacie w tej grupie."},"tracking":{"title":"Śledzenie","description":"Dostaniesz powiadomienie, gdy ktoś ci odpowie lub wspomni twoją @nazwę, zobaczysz również liczbę odpowiedzi."},"regular":{"title":"Normalny","description":"Dostaniesz powiadomienie, gdy ktoś ci odpowie lub wspomni twoją @nazwę."},"muted":{"title":"Wyciszony","description":"Nie otrzymasz powiadomień o nowych tematach w tej grupie."}}},"user_action_groups":{"1":"Przyznane lajki","2":"Otrzymane lajki","3":"Zakładki","4":"Tematy","5":"Odpowiedzi","6":"Odpowiedzi","7":"Wzmianki","9":"Cytaty","11":"Edycje","12":"Wysłane","13":"Skrzynka odbiorcza","14":"Oczekujące"},"categories":{"all":"wszystkie kategorie","all_subcategories":"wszystkie","no_subcategory":"żadne","category":"Kategoria","category_list":"Wyświetl listę kategorii","reorder":{"title":"Zmień kolejność kategorii","title_long":"Zmień kolejność listy kategorii","fix_order":"Popraw pozycje","fix_order_tooltip":"Nie wszystkie kategorie posiadają unikalny numer porządkowy, co może wygenerować nieoczekiwane wyniki.","save":"Zapisz kolejność","apply_all":"Zastosuj","position":"Pozycja"},"posts":"Wpisy","topics":"Tematy","latest":"Aktualne","latest_by":"najnowszy wpis: ","toggle_ordering":"przełącz kolejność kontroli","subcategories":"Podkategorie","topic_stat_sentence":{"one":"ostatni %{unit}: %{count} nowy temat.","few":"ostatni %{unit}: %{count} nowe tematy.","other":"ostatni %{unit}: %{count} nowych tematów."}},"ip_lookup":{"title":"Wyszukiwanie adresu IP","hostname":"Nazwa hosta","location":"Lokalizacja","location_not_found":"(nieznane)","organisation":"Organizacja","phone":"Numer telefonu","other_accounts":"Inne konta z tym adresem IP:","delete_other_accounts":"Usuń %{count}","username":"nazwa użytkownika","trust_level":"TL","read_time":"czas czytania:","topics_entered":"wprowadzone tematy:","post_count":"# wpisów","confirm_delete_other_accounts":"Czy na pewno chcesz usunąć wybrane konta?"},"user_fields":{"none":"(wybierz opcję)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Wycisz","edit":"Edytuj ustawienia","download_archive":"Pobierz moje wpisy","new_private_message":"Nowa wiadomość","private_message":"Wiadomość","private_messages":"Wiadomości","activity_stream":"Aktywność","preferences":"Ustawienia","expand_profile":"Rozwiń","bookmarks":"Zakładki","bio":"O mnie","invited_by":"Zaproszono przez","trust_level":"Poziom zaufania","notifications":"Powiadomienia","statistics":"Statystyki","desktop_notifications":{"label":"Powiadomienia systemowe","not_supported":"Powiadomienia nie są wspierane przez tę przeglądarkę. Przepraszamy.","perm_default":"Włącz powiadomienia","perm_denied_btn":"Brak uprawnień","perm_denied_expl":"Odmówiłeś dostępu dla powiadomień. Pozwól na powiadomienia w ustawieniach przeglądarki.","disable":"Wyłącz powiadomienia","enable":"Włącz powiadomienia","each_browser_note":"Uwaga: to ustawienie musisz zmienić w każdej przeglądarce której używasz."},"dismiss_notifications":"Odrzuć wszystkie","dismiss_notifications_tooltip":"Oznacz wszystkie powiadomienia jako przeczytane","disable_jump_reply":"Po odpowiedzi nie przechodź do nowego wpisu","dynamic_favicon":"Pokazuj licznik powiadomień na karcie jako dynamiczny favicon","external_links_in_new_tab":"Otwieraj wszystkie zewnętrzne odnośniki w nowej karcie","enable_quoting":"Włącz cytowanie zaznaczonego tekstu","change":"zmień","moderator":"{{user}} jest moderatorem","admin":"{{user}} jest adminem","moderator_tooltip":"Ten użytkownik jest moderatorem","admin_tooltip":"Ten użytkownik jest administratorem","blocked_tooltip":"Ten użytkownik jest zablokowany","suspended_notice":"ten użytkownik jest zawieszony do {{date}}.","suspended_reason":"Powód: ","github_profile":"Github","email_activity_summary":"Podsumowanie aktywności","mailing_list_mode":{"label":"Tryb listy mailingowej","enabled":"Włącz tryb listy mailingowej","daily":"Wyślij codzienne aktualizacje","individual":"Wyślij e-mail dla każdego nowego postu","many_per_day":"Wyślij mi e-mail dla każdego nowego posta (około {{dailyEmailEstimate}} na dzień)","few_per_day":"Wyślij mi e-mail dla każdego nowego posta (około 2 dziennie)"},"tag_settings":"Tagi","watched_tags":"Obserwowane","tracked_tags":"Śledzone","muted_tags":"Wyciszone","watched_categories":"Obserwowane","tracked_categories":"Śledzone","watched_first_post_categories":"Oglądasz pierwszy post","watched_first_post_tags":"Oglądasz pierwszy post","watched_first_post_tags_instructions":"Zostaniesz powiadomiony tylko o pierwszym wpisie w każdym nowym temacie oznaczonym tymi tagami.","muted_categories":"Wyciszone","muted_categories_instructions":"Nie będziesz powiadamiany o nowych tematach w tych kategoriach. Nie pojawią się na liście nieprzeczytanych.","delete_account":"Usuń moje konto","delete_account_confirm":"Czy na pewno chcesz usunąć swoje konto? To nieodwracalne!","deleted_yourself":"Twoje konto zostało usunięte.","delete_yourself_not_allowed":"Nie możesz usunąć swojego konta w tej chwili. Skontaktuj się z administratorem, by usunął Twoje konto za Ciebie.","unread_message_count":"Wiadomości","admin_delete":"Usuń","users":"Użytkownicy","muted_users":"Uciszeni","muted_users_instructions":"Wstrzymaj powiadomienia od tych użytkowników.","muted_topics_link":"Pokaż wyciszone tematy","watched_topics_link":"Pokaż obserwowane tematy","automatically_unpin_topics":"Automatycznie odpinaj tematy kiedy dotrę do końca strony.","apps":"Aplikacje","revoke_access":"Zablokuj dostęp","undo_revoke_access":"Cofnij zablokowanie dostępu","api_permissions":"Uprawnienia:","api_approved":"Zatwierdzony:","api_read":"odczyt","api_read_write":"odczyt i zapis","staff_counters":{"flags_given":"uczynnych oflagowań","flagged_posts":"oflagowane wpisy","deleted_posts":"usunięte wpisy","suspensions":"zawieszone","warnings_received":"otrzymanych ostrzeżeń"},"messages":{"all":"Wszystkie","inbox":"Skrzynka odbiorcza","sent":"Wysłane","archive":"Archiwum","groups":"Moje grupy","bulk_select":"Zaznacz wiadomości","move_to_inbox":"Przenieś do skrzynki odbiorczej","move_to_archive":"Archiwum","failed_to_move":"Nie udało się przenieść zaznaczonych wiadomości (prawdopodobnie wystąpił problem z Twoim połączeniem)","select_all":"Zaznacz wszystko"},"change_password":{"success":"(email wysłany)","in_progress":"(email wysyłany)","error":"(błąd)","action":"Wyślij wiadomość email resetującą hasło","set_password":"Ustaw hasło"},"change_about":{"title":"Zmień O mnie","error":"Wystąpił błąd podczas zmiany tej wartości."},"change_username":{"title":"Zmień nazwę użytkownika","taken":"Przykro nam, ale ta nazwa jest zajęta.","error":"Podczas zmiany twojej nazwy użytkownika wystąpił błąd.","invalid":"Ta nazwa jest niepoprawna. Powinna zawierać jedynie liczby i litery."},"change_email":{"title":"Zmień adres email","taken":"Przykro nam, ale ten adres email nie jest dostępny.","error":"Wystąpił błąd podczas próby zmiany twojego adresu email. Być może ten email jest już zarejestrowany?","success":"Wysłaliśmy wiadomość do potwierdzenia na podany adres email."},"change_avatar":{"title":"Zmień swój awatar","gravatar":"bazujący na \u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e","gravatar_title":"Zmień swój awatar na stronie serwisu Gravatar","refresh_gravatar_title":"Zaktualizuj swój Gravatar","letter_based":"Awatar przyznany przez system","uploaded_avatar":"Zwyczajny obrazek","uploaded_avatar_empty":"Dodaj zwyczajny obrazek","upload_title":"Wyślij swoją grafikę","upload_picture":"Wyślij grafikę","image_is_not_a_square":"Uwaga: grafika została przycięta ponieważ jej wysokość i szerokość nie były równe. ","cache_notice":"Twój awatar został pomyślnie zmieniony, ale z uwagi na cache przeglądarki nowa wersja może pojawić się dopiero za jakiś czas."},"change_profile_background":{"title":"Tło profilu","instructions":"Tła w profilach są wycentrowane i posiadają domyślną szerokość 850px."},"change_card_background":{"title":"Tło karty użytkownika","instructions":"Tło karty użytkownika est wycentrowane i posiada domyślną szerokość 590px."},"email":{"title":"Email","instructions":"Nie będzie publicznie widoczny","ok":"Otrzymasz potwierdzenie emailem","invalid":"Podaj poprawny adres email","authenticated":"Twój email został potwierdzony przez {{provider}}","frequency_immediately":"Wyślemy powiadomienie jeśli wskazana rzecz nie została jeszcze przez Ciebie przeczytana.","frequency":{"one":"Otrzymasz e-mail tylko jeśli nie widzieliśmy Cię w ciągu ostatniej minuty.","few":"Otrzymasz e-mail tylko jeśli nie widzieliśmy Cię w ciągu ostatnich {{count}} minut.","other":"Otrzymasz e-mail tylko jeśli nie widzieliśmy Cię w ciągu ostatnich {{count}} minut."}},"name":{"title":"Pełna nazwa","instructions":"Twoja pełna nazwa (opcjonalna)","instructions_required":"Twoja pełna nazwa","too_short":"Twoja nazwa jest zbyt krótka","ok":"Twoja nazwa jest ok"},"username":{"title":"Nazwa konta","instructions":"Unikalna, krótka i bez spacji","short_instructions":"Inni mogą o tobie wspomnieć pisząc @{{username}}","available":"Nazwa użytkownika jest dostępna","global_match":"Email zgadza się z zarejestrowaną nazwą użytkownika","global_mismatch":"Zajęta. Może spróbuj {{suggestion}}?","not_available":"Niedostępna. Może spróbuj {{suggestion}}?","too_short":"Nazwa użytkownika jest zbyt krótka","too_long":"Nazwa użytkownika jest zbyt długa","checking":"Sprawdzanie, czy nazwa jest dostępna…","enter_email":"Nazwa użytkownika znaleziona – wpisz przypisany adres email","prefilled":"Email zgadza się z zarejestrowaną nazwą użytkownika"},"locale":{"title":"Język interfejsu","instructions":"Język interfejsu użytkownika. Zmieni się, gdy odświeżysz stronę.","default":"(domyślny)"},"password_confirmation":{"title":"Powtórz hasło"},"last_posted":"Ostatni wpis","last_emailed":"Ostatnio otrzymał email","last_seen":"Ostatnio widziano","created":"Dołączył","log_out":"Wyloguj","location":"Lokalizacja","card_badge":{"title":"Odznaka karty użytkownika"},"website":"Strona internetowa","email_settings":"Email","like_notification_frequency":{"title":"Powiadom o lajkach","always":"Zawsze","first_time_and_daily":"Pierwszy lajk i raz dziennie","first_time":"Pierwszy lajk","never":"Nigdy"},"email_previous_replies":{"unless_emailed":"chyba wcześniej wysłany","always":"zawsze","never":"nigdy"},"email_digests":{"every_30_minutes":"co 30 minut","every_hour":"co godzinę","daily":"codziennie","every_three_days":"co trzy dni","weekly":"co tydzień","every_two_weeks":"co dwa tygodnie"},"email_direct":"Wysyłaj e-mail gdy ktoś mnie cytuje, odpowiada na mój wpis, wywołuje moją @nazwę lub zaprasza mnie do tematu.","email_private_messages":"Wyślij e-mail, gdy ktoś napisze mi prywatną wiadomość","email_always":"Wysyłaj powiadomienia email nawet, gdy przejawiam aktywność w serwisie","other_settings":"Inne","categories_settings":"Kategorie","new_topic_duration":{"label":"Uznaj, że temat jest nowy, jeśli","not_viewed":"niewidziane ","last_here":"dodane od ostatniej wizyty","after_1_day":"utworzone w ciągu ostatniego dnia","after_2_days":"utworzone w ciągu ostatnich 2 dni","after_1_week":"utworzone w ostatnim tygodniu","after_2_weeks":"utworzone w ostatnich 2 tygodniach"},"auto_track_topics":"Automatycznie śledź tematy które odwiedzę","auto_track_options":{"never":"nigdy","immediately":"natychmiast","after_30_seconds":"po 30 sekundach","after_1_minute":"po 1 minucie","after_2_minutes":"po 2 minutach","after_3_minutes":"po 3 minutach","after_4_minutes":"po 4 minutach","after_5_minutes":"po 5 minutach","after_10_minutes":"po 10 minutach"},"invited":{"search":"wpisz aby szukać zaproszeń…","title":"Zaproszenia","user":"Zaproszony(-a) użytkownik(-czka)","sent":"Wysłane","none":"Nie ma żadnych zaproszeń do wyświetlenia.","truncated":{"one":"Wyświetlanie pierwszego zaproszenia.","few":"Wyświetlanie {{count}} pierwszych zaproszeń.","other":"Wyświetlanie {{count}} pierwszych zaproszeń."},"redeemed":"Cofnięte zaproszenia","redeemed_tab":"Przyjęte","redeemed_tab_with_count":"Zrealizowane ({{count}})","redeemed_at":"Przyjęte","pending":"Oczekujące zaproszenia","pending_tab":"Oczekujący","pending_tab_with_count":"Oczekujące ({{count}})","topics_entered":"Obejrzane tematy","posts_read_count":"Przeczytane wpisy","expired":"To zaproszenie wygasło.","rescind":"Usuń","rescinded":"Zaproszenie usunięte","reinvite":"Ponów zaproszenie","reinvite_all":"Wyślij ponownie wszystkie zaproszenia","reinvited":"Ponowne wysłanie zaproszenia","reinvited_all":"Wszystkie zaproszenia zostały ponownie wysłane!","time_read":"Czas odczytu","days_visited":"Dni odwiedzin","account_age_days":"Wiek konta w dniach","create":"Wyślij zaproszenie","generate_link":"Skopiuj link z zaproszeniem","generated_link_message":"\u003cp\u003eLink z zaproszeniem został wygenerowany pomyślnie!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eLink zaproszenia jest ważny jedynie dla tego adresu e-mail: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Jeszcze nikogo nie zaproszono. Możesz wysłać pojedyncze zaproszenie lub \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003ezaprosić wiele osób na raz wysyłając odpowiedni plik\u003c/a\u003e.","text":"Zaproszenia hurtowe z pliku","uploading":"Wysyłanie…","success":"Plik został przesłany pomyślnie: otrzymasz prywatną wiadomość, gdy proces zostanie zakończony.","error":"Podczas przesyłania wystąpił błąd '{{filename}}': {{message}}"}},"password":{"title":"Hasło","too_short":"Hasło jest za krótkie.","common":"To hasło jest zbyt popularne.","same_as_username":"Twoje hasło jest takie samo jak nazwa użytkownika.","same_as_email":"Twoje hasło jest takie samo jak twój e-mail.","ok":"Twoje hasło jest poprawne.","instructions":"Co najmniej %{count} znaków."},"summary":{"title":"Podsumowanie","stats":"Statystyki","time_read":"czas odczytu","topic_count":{"one":"utworzono temat","few":"utworzono tematów","other":"utworzono tematy"},"post_count":{"one":"utworzono post","few":"utworzonych postów","other":"utworzono posty"},"days_visited":{"one":"dzień odwiedzin","few":"dni odwiedzin","other":"dni odwiedzin"},"posts_read":{"one":"przeczytany post","few":"przeczytanych postów","other":"przeczytane posty"},"bookmark_count":{"one":"zakładka","few":"zakładki","other":"zakładki"},"top_replies":"Najlepsze odpowiedzi","no_replies":"Póki co brak odpowiedzi.","more_replies":"Więcej odpowiedzi","top_topics":"Najlepsze tematy","no_topics":"Póki co brak tematów.","more_topics":"Więcej tematów","top_badges":"Najlepsze odznaki","no_badges":"Póki co brak odznak.","more_badges":"Więcej odznak","top_links":"Najlepsze linki","no_links":"Póki co brak linków.","most_liked_by":"Najbardziej lajkowane przez","most_liked_users":"Najbardziej lajkowane","most_replied_to_users":"Najwięcej odpowiedzi do","no_likes":"Brak lajków."},"associated_accounts":"Powiązane konta","ip_address":{"title":"Ostatni adres IP"},"registration_ip_address":{"title":"Adres IP rejestracji"},"avatar":{"title":"Awatar","header_title":"profil, wiadomości, zakładki i ustawienia"},"title":{"title":"Tytuł"},"filters":{"all":"Wszystkie"},"stream":{"posted_by":"Wysłane przez","sent_by":"Wysłane przez","private_message":"wiadomość","the_topic":"temat"}},"loading":"Wczytuję…","errors":{"prev_page":"podczas próby wczytania","reasons":{"network":"Błąd sieci","server":"błąd serwera","forbidden":"Brak dostępu","unknown":"Błąd","not_found":"Nie znaleziono strony"},"desc":{"network":"Sprawdź swoje połączenie.","network_fixed":"Chyba już w porządku.","server":"Kod błędu: {{status}}","forbidden":"Nie możesz obejrzeć tego zasobu.","not_found":"Ups, aplikacja próbowała otworzyć URL który nie istnieje.","unknown":"Coś poszło nie tak."},"buttons":{"back":"Cofnij","again":"Spróbuj ponownie","fixed":"Załaduj stronę"}},"close":"Zamknij","assets_changed_confirm":"Serwis został zmieniony, czy pozwolisz na przeładowanie strony w celu aktualizacji do najnowszej wersji?","logout":"Nastąpiło wylogowanie.","refresh":"Odśwież","read_only_mode":{"enabled":"Strona jest w trybie tylko-do-odczytu. Możesz nadal przeglądać serwis, ale operacje takie jak postowanie, lajkowanie i inne są wyłączone.","login_disabled":"Logowanie jest zablokowane, gdy strona jest w trybie tylko do odczytu.","logout_disabled":"Wylogowanie jest zablokowane gdy strona jest w trybie tylko do odczytu."},"too_few_topics_and_posts_notice":"Pora \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003erozruszać dyskusję!\u003c/a\u003e Aktualnie istnieje \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tematów i \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e wpisów. Odwiedzający potrzebują więcej tematów i konwersacji do czytania i pisania na ich temat.","too_few_topics_notice":"Pora \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003erozruszać dyskusję!\u003c/a\u003e Aktualnie istnieje \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tematów. Odwiedzający potrzebują więcej tematów i konwersacji do czytania i pisania na ich temat.","too_few_posts_notice":"Pora \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003erozruszać dyskusję!\u003c/a\u003e Aktualnie istnieje \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e wpisów. Odwiedzający potrzebują więcej tematów i konwersacji do czytania i pisania na ich temat.","learn_more":"dowiedz się więcej…","year":"rok","year_desc":"tematy dodane w ciągu ostatnich 365 dni","month":"miesiąc","month_desc":"tematy dodane w ciągu ostatnich 30 dni","week":"tydzień","week_desc":"tematy dodane w ciągu ostatnich 7 dni","day":"dzień","first_post":"Pierwszy wpis","mute":"Wycisz","unmute":"Wyłącz wyciszenie","last_post":"Ostatni wpis","last_reply_lowercase":"ostatnia odpowiedź","replies_lowercase":{"one":"odpowiedź","few":"odpowiedzi","other":"odpowiedzi"},"signup_cta":{"sign_up":"Rejestracja","hide_session":"Przypomnij mi jutro","hide_forever":"nie, dziękuję","hidden_for_session":"Ok, zapytamy jutro. Pamiętaj, że konto możesz w każdej chwili założyć klikając na 'Logowanie'.","intro":"Hej! :heart_eyes: Wygląda na to, że zainteresowała Cię dyskusja, ale nie posiadasz jeszcze konta.","value_prop":"Jeśli stworzysz konto, zapamiętamy przeczytane przez Ciebie wpisy i tematy, dzięki czemu zawsze powrócisz do odpowiedniego miejsca.  Otrzymasz też powiadomienia o nowych wpisach. Dodatkowo możliwe będzie polubienie ciekawych wpisów  :heartbeat:"},"summary":{"enabled_description":"Przeglądasz podsumowanie tego tematu: widoczne są jedynie najbardziej wartościowe wpisy zdaniem uczestników. ","description":"Jest  \u003cb\u003e{{replyCount}}\u003c/b\u003e odpowiedzi.","enable":"Podsumuj ten temat","disable":"Pokaż wszystkie wpisy"},"deleted_filter":{"enabled_description":"Ten temat posiada usunięte wpisy, które zostały ukryte.","disabled_description":"Usunięte wpisy w tym temacie są widoczne.","enable":"Ukryj usunięte wpisy","disable":"Pokaż usunięte wpisy."},"private_message_info":{"title":"Wiadomość","invite":"Zaproś innych","remove_allowed_user":"Czy naprawdę chcesz usunąć {{name}} z tej dyskusji?","remove_allowed_group":"Czy naprawdę chcesz usunąć {{name}} z tej wiadomości?"},"email":"Email","username":"Nazwa konta","last_seen":"Ostatnio oglądane","created":"Utworzono","created_lowercase":"utworzono","trust_level":"Poziom zaufania","search_hint":"nazwa użytkownika, email lub IP","create_account":{"title":"Utwórz konto","failed":"Coś poszło nie tak, możliwe, że wybrany adres email jest już zarejestrowany, spróbuj użyć odnośnika przypomnienia hasła"},"forgot_password":{"title":"Reset hasła","action":"Zapomniałem(-łam) hasła","invite":"Wpisz swoją nazwę użytkownika lub adres email. Wyślemy do ciebie email z linkiem do zresetowania hasła.","reset":"Resetuj hasło","complete_username":"Jeśli jakieś mamy konto o nazwie użytkownika \u003cb\u003e%{username}\u003c/b\u003e, za chwilę zostanie wysłana wiadomość z instrukcją jak ustawić nowe hasło.","complete_email":"Jeśli jakieś konto użytkownika posiada adres \u003cb\u003e%{email}\u003c/b\u003e, za chwilę zostanie wysłana wiadomość z instrukcją jak ustawić nowe hasło.","complete_username_found":"Znaleziono konto o nazwie \u003cb\u003e%{username}\u003c/b\u003e,  wkrótce otrzymasz email z instrukcjami opisującymi reset hasła.","complete_email_found":"Znaleziono konto przypisane do adresu \u003cb\u003e%{email}\u003c/b\u003e,  wkrótce otrzymasz email z instrukcjami opisującymi reset hasła.","complete_username_not_found":"Nie znaleziono konta o nazwie \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nie znaleziono konta przypisanego do \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Logowanie","username":"Użytkownik","password":"Hasło","email_placeholder":"adres email lub nazwa użytkownika","caps_lock_warning":"Caps Lock jest włączony","error":"Nieznany błąd","rate_limit":"Poczekaj, zanim ponowisz próbę logowania.","blank_username_or_password":"Podaj swój email lub nazwę użytkownika i hasło","reset_password":"Resetuj hasło","logging_in":"Uwierzytelnianie…","or":"Lub","authenticating":"Uwierzytelnianie…","awaiting_confirmation":"Twoje konto czeka na aktywację. Użyj odnośnika przypomnienia hasła, aby otrzymać kolejny email aktywujący konta.","awaiting_approval":"Twoje konto jeszcze nie zostało zatwierdzone przez osoby z obsługi. Otrzymasz email gdy zostanie zatwierdzone.","requires_invite":"Przepraszamy, dostęp do tego forum jest tylko za zaproszeniem.","not_activated":"Nie możesz się jeszcze zalogować. Wysłaliśmy email aktywujący konto na adres \u003cb\u003e{{sentTo}}\u003c/b\u003e. W celu aktywacji konta postępuj zgodnie z instrukcjami otrzymanymi w emailu.","not_allowed_from_ip_address":"Nie możesz się zalogować z tego adresu IP.","admin_not_allowed_from_ip_address":"Nie możesz się zalogować jako admin z tego adresu IP.","resend_activation_email":"Kliknij tutaj, aby ponownie wysłać email z aktywacją konta.","sent_activation_email_again":"Wysłaliśmy do ciebie kolejny email z aktywacją konta na \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Zanim dotrze, może minąć kilka minut; pamiętaj, żeby sprawdzić folder ze spamem.","to_continue":"Zaloguj się","preferences":"Musisz się zalogować, aby zmieniać swoje ustawienia.","forgot":"Nie pamiętam konta","google":{"title":"przez Google","message":"Uwierzytelnianie przy pomocy konta Google (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"google_oauth2":{"title":"przez Google","message":"Uwierzytelniam przy pomocy Google (upewnij się wyskakujące okienka nie są blokowane)"},"twitter":{"title":"przez Twitter","message":"Uwierzytelnianie przy pomocy konta na Twitterze (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"instagram":{"message":"Uwierzytelnianie przy pomocy konta na Instagramie (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"facebook":{"title":"przez Facebook","message":"Uwierzytelnianie przy pomocy konta Facebook (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"yahoo":{"title":"przez Yahoo","message":"Uwierzytelnianie przy pomocy konta Yahoo (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"github":{"title":"przez GitHub","message":"Uwierzytelnianie przez GitHub (upewnij się, że blokada wyskakujących okienek nie jest włączona)"}},"emoji_set":{"apple_international":"Apple/Międzynarodowy","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Tylko kategorie","categories_and_latest_topics":"Kategorie i ostatnie tematy"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"więcej…","options":"Opcje","whisper":"szept","add_warning":"To jest oficjalne ostrzeżenie.","toggle_whisper":"Przełącz szept","posting_not_on_topic":"W którym temacie chcesz odpowiedzieć?","saving_draft_tip":"zapisuję...","saved_draft_tip":"zapisano","saved_local_draft_tip":"zapisano lokalnie","similar_topics":"Twój temat jest podobny do…","drafts_offline":"szkice offline","error":{"title_missing":"tytuł jest wymagany","title_too_short":"tytuł musi zawierać co najmniej {{min}} znaków","title_too_long":"Tytuł nie może zawierać więcej niż {{max}} znaków","post_missing":"wpis nie może być pusty","post_length":"Wpis musi zawierać przynajmniej {{min}} znaków","try_like":"Może warto użyć przycisku \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Musisz wybrać kategorię"},"save_edit":"Zapisz zmiany","reply_original":"Odpowiedz na Oryginalny Temat","reply_here":"Odpowiedz tutaj","reply":"Odpowiedz","cancel":"Anuluj","create_topic":"Utwórz temat","create_pm":"Wiadomość","title":"Lub naciśnij Ctrl+Enter","users_placeholder":"Dodaj osobę","title_placeholder":"O czym jest ta dyskusja w jednym zwartym zdaniu. ","edit_reason_placeholder":"z jakiego powodu edytujesz?","show_edit_reason":"(dodaj powód edycji)","reply_placeholder":"Pisz w tym miejscu. Wspierane formatowanie to Markdown, BBCode lub HTML.  Możesz też przeciągnąć tu obrazek.","view_new_post":"Zobacz Twój nowy wpis.","saving":"Zapisywanie","saved":"Zapisano!","saved_draft":"Posiadasz zachowany szkic wpisu. Kliknij tu aby wznowić jego edycję.","uploading":"Wczytuję…","show_preview":"pokaż podgląd \u0026raquo;","hide_preview":"\u0026laquo; schowaj podgląd","quote_post_title":"Cytuj cały wpis","bold_title":"Pogrubienie","bold_text":"pogrubiony tekst","italic_title":"Wyróżnienie","italic_text":"wyróżniony tekst","link_title":"Odnośnik","link_description":"wprowadź tutaj opis odnośnika","link_dialog_title":"Wstaw odnośnik","link_optional_text":"opcjonalny tytuł","link_url_placeholder":"http://example.com","quote_title":"Cytat","quote_text":"Cytat","code_title":"Tekst sformatowany","code_text":"Sformatowany blok tekstu poprzedź 4 spacjami","paste_code_text":"wpisz lub wklej tutaj kod","upload_title":"Dodaj","upload_description":"wprowadź opis tutaj","olist_title":"Lista numerowana","ulist_title":"Lista wypunktowana","list_item":"Element listy","heading_title":"Nagłówek","heading_text":"Nagłówek","hr_title":"Pozioma linia","help":"Pomoc formatowania Markdown","toggler":"ukryj lub pokaż panel kompozytora tekstu","modal_ok":"OK","modal_cancel":"Anuluj","cant_send_pm":"Przepraszamy, niestety nie możesz wysłać prywatnej wiadomości do %{username}.","yourself_confirm":{"title":"Nie zapomniałeś dodać odbiorców?"},"admin_options_title":"Opcjonalne ustawienia obsługi dla tego tematu","auto_close":{"label":"Automatycznie zamykaj tematy po:","error":"Podaj poprawną wartość.","based_on_last_post":"Nie zamykaj tematu dopóki od ostatniego wpisu nie upłynie przynajmniej tyle czasu.","all":{"examples":"Podaj godzinę  (17:30), liczbę godzin (24) lub konkretną datę i czas (2013-11-22 14:00)."},"limited":{"units":"(# godzin)","examples":"Podaj liczbę godzin (24)."}}},"notifications":{"title":"powiadomienia o wywołanej @nazwie, odpowiedzi do twoich wpisów i tematów, prywatne wiadomości, itp","none":"Nie udało się załadować listy powiadomień.","empty":"Nie znaleziono powiadomień.","more":"pokaż starsze powiadomienia","total_flagged":"wszystkie oflagowane wpisy","mentioned":"\u003ci title='wspomniano' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='wywołanie grupy' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='cytat' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='odpowiedź' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edycja' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='polubienie' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} oraz 1 inna osoba\u003c/span\u003e {{description}}\u003c/p\u003e","few":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} i {{count}} innych osób\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} i {{count}} innych osób\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='prywatna wiadomość' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='prywatna wiadomość' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='zaproszenie do tematu' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='przyjęcie twojego zaproszenia' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e przyjmuje twoje zaproszenie\u003c/p\u003e","moved_post":"\u003ci title='przeniesienie wpisu' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e przenosi {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='otrzymano odznakę' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eOtrzymujesz '{{description}}'\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e masz {{count}} wiadomość w skrzynce odbiorczej {{group_name}} \u003c/p\u003e","few":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e masz {{count}} wiadomości w skrzynce odbiorczej {{group_name}} \u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e masz {{count}} wiadomości w skrzynce odbiorczej {{group_name}}\u003c/p\u003e"},"alt":{"mentioned":"Wywołanie przez","quoted":"Cytowanie przez","replied":"Odpowiedź","posted":"Autor wpisu","edited":"Edycja twojego wpisu","liked":"Lajk twojego wpisu","private_message":"Prywatna wiadomość od","invited_to_private_message":"Zaproszenie do prywatnej wiadomości od","invited_to_topic":"Zaproszenie do tematu od","invitee_accepted":"Zaproszenie zaakceptowane przez","moved_post":"Twój wpis został przeniesiony przez","linked":"Linkownie do twojego wpisu","granted_badge":"Przyznanie odznaki","group_message_summary":"Wiadomości w grupowej skrzynce odbiorczej"},"popup":{"mentioned":"{{username}} wspomina o tobie w \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} wspomniał o Tobie w \"{{topic}}\" - {{site_title}}","quoted":"{{username}} cytuje cie w \"{{topic}}\" - {{site_title}}","replied":"{{username}} odpowiada na twój wpis w \"{{topic}}\" - {{site_title}}","posted":"{{username}} pisze w \"{{topic}}\" - {{site_title}}","private_message":"{{username}} wysyła ci prywatną wiadomość w \"{{topic}}\" - {{site_title}}","linked":"{{username}} linkuje do twojego wpisu z \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Dodaj obraz","title_with_attachments":"Dodaj obraz lub plik","from_my_computer":"Z mojego urządzenia","from_the_web":"Z Internetu","remote_tip":"link do obrazu","remote_tip_with_attachments":"link do obrazu lub pliku  {{authorized_extensions}}","local_tip":"wybierz obrazy ze swojego urządzenia","local_tip_with_attachments":"wybierz obrazy lub pliki ze swojego urządzenia {{authorized_extensions}}","hint":"(możesz także upuścić plik z katalogu komputera w okno edytora)","hint_for_supported_browsers":"możesz też przeciągać lub wklejać grafiki do edytora","uploading":"Wgrywanie","select_file":"Wybierz plik","image_link":"odnośnik do którego Twój obraz będzie kierował"},"search":{"sort_by":"Sortuj po","relevance":"Trafność","latest_post":"Aktualne wpisy","most_viewed":"Popularne","most_liked":"Najbardziej lajkowane","select_all":"Zaznacz wszystkie","clear_all":"Wyczyść wszystkie","too_short":"Wyszukiwane określenie jest zbyt krótkie.","result_count":{"one":"1 wynik dla \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","few":"{{count}} wyniki dla \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} wyników dla \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"szukaj tematów, wpisów, użytkowników lub kategorii","no_results":"Brak wyników wyszukiwania","no_more_results":"Nie znaleziono więcej wyników.","search_help":"Wyszukaj w pomocy","searching":"Szukam…","post_format":"#{{post_number}} za {{username}}","context":{"user":"Szukaj wpisów @{{username}}","category":"Szukaj w kategorii #{{category}}","topic":"Szukaj w tym temacie","private_messages":"Wyszukiwanie wiadomości"}},"hamburger_menu":"przejdź do innej listy lub kategorii","new_item":"nowy","go_back":"wróć","not_logged_in_user":"strona użytkownika z podsumowaniem bieżących działań i ustawień","current_user":"idź do swojej strony użytkowanika","topics":{"bulk":{"unlist_topics":"Ukryj tematy","reset_read":"Wyzeruj przeczytane","delete":"Usuń tematy","dismiss":"Wyczyść","dismiss_read":"Wyczyść nieprzeczytane","dismiss_button":"Wyczyść…","dismiss_tooltip":"Wyczyść nowe wpisy lub przestań śledzić tematy","also_dismiss_topics":"Przestać śledzić wskazane tematy. Nie chcę, aby pojawiały się w zakładce nieprzeczytane.","dismiss_new":"Wyczyść nowe","toggle":"włącz grupowe zaznaczanie tematów","actions":"Operacje grupowe","change_category":"Zmień kategorię","close_topics":"Zamknij wpisy","archive_topics":"Zarchiwizuj tematy","notification_level":"Poziom powiadomień o zmianach","choose_new_category":"Wybierz nową kategorię dla tematów:","selected":{"one":"Zaznaczono \u003cb\u003e1\u003c/b\u003e temat.","few":"Zaznaczono \u003cb\u003e{{count}}\u003c/b\u003e tematy.","other":"Zaznaczono \u003cb\u003e{{count}}\u003c/b\u003e tematów."},"change_tags":"Zmień tagi","choose_new_tags":"Wybierz nowe tagi dla tych tematów:","changed_tags":"Tagi tych tematów były zmieniane."},"none":{"unread":"Nie masz nieprzeczytanych tematów.","new":"Nie masz nowych tematów.","read":"You haven't read any topics yet.","posted":"Jeszcze nie zamieściłeś wpisu w żadnym z tematów.","latest":"Nie ma najnowszych tematów. Smutne.","hot":"Nie ma gorących tematów.","bookmarks":"Nie posiadasz tematów dodanych do zakładek.","category":"Nie ma tematów w kategorii {{category}}.","top":"Brak najlepszych tematów.","search":"Brak wyników wyszukiwania.","educate":{"new":"\u003cp\u003eNowe tematy będą pojawiać się tutaj.\u003c/p\u003e\u003cp\u003eDomyślnie tematy są określane jako nowe i będą oznaczone jako\u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enowe\u003c/span\u003e jeśli były stworzone w ciągu ostatnich 2 dni.\u003c/p\u003e\u003cp\u003eOdwiedź swoje \u003ca href=\"%{userPrefsUrl}\"\u003eustawienia\u003c/a\u003e by to zmienić.\u003c/p\u003e"}},"bottom":{"latest":"Nie ma więcej najnowszych tematów.","hot":"Nie ma więcej gorących tematów.","posted":"Nie ma więcej tematów w których pisałeś.","read":"Nie ma więcej przeczytanych tematów.","new":"Nie ma więcej nowych tematów.","unread":"Nie ma więcej nieprzeczytanych tematów.","category":"Nie ma więcej tematów w kategorii {{category}}.","top":"Nie ma już więcej najlepszych tematów.","bookmarks":"Nie ma więcej zakładek.","search":"Nie znaleziono więcej wyników."}},"topic":{"unsubscribe":{"stop_notifications":"Będziesz otrzymywać mniej powiadomień o \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Twój aktualny stan powiadomień to"},"create":"Nowy temat","create_long":"Utwórz nowy temat","private_message":"Napisz wiadomość","archive_message":{"help":"Przenieś wiadomość do archiwum","title":"Archiwum"},"move_to_inbox":{"title":"Przenieś do skrzynki odbiorczej","help":"Przenieś wiadomość z powrotem do skrzynki odbiorczej"},"list":"Tematy","new":"nowy temat","unread":"nieprzeczytane","new_topics":{"one":"1 nowy temat","few":"{{count}} nowe tematy","other":"{{count}} nowych tematów"},"unread_topics":{"one":"1 nieprzeczytany temat","few":"{{count}} nieprzeczytane tematy","other":"{{count}} nieprzeczytanych tematów"},"title":"Temat","invalid_access":{"title":"Temat jest prywatny","description":"Przepraszamy, nie masz dostępu do tego tematu!","login_required":"Musisz się zalogować, aby zobaczyć ten temat."},"server_error":{"title":"Wystąpił błąd przy wczytywaniu Tematu","description":"Przepraszamy, nie możliwe było wczytanie tematu, możliwe że wystąpił problem z połączeniem. Prosimy, spróbuj ponownie. Jeżeli problem wystąpi ponownie, powiadom administrację."},"not_found":{"title":"Temat nie został znaleziony","description":"Przepraszamy, ale temat nie został znaleziony. Możliwe, że został usunięty przez moderatora?"},"total_unread_posts":{"one":"masz 1 nieprzeczytany wpis w tym temacie","few":"masz {{count}} nieprzeczytane wpisy w tym temacie","other":"masz {{count}} nieprzeczytanych wpisów w tym temacie"},"unread_posts":{"one":"masz 1 nieprzeczytany wpis w tym temacie","few":"masz {{count}} nieprzeczytane wpisy w tym temacie","other":"masz {{count}} nieprzeczytanych wpisów w tym temacie"},"new_posts":{"one":"od Twoich ostatnich odwiedzin pojawił się 1 nowy wpis","few":"od Twoich ostatnich odwiedzin pojawiły się {{count}} nowe wpisy","other":"od Twoich ostatnich odwiedzin pojawiło się {{count}} nowych wpisów"},"likes":{"one":"temat zawiera 1 lajk","few":"temat zawiera {{count}} lajki","other":"temat zawiera {{count}} lajków"},"back_to_list":"Wróć do Listy Tematów","options":"Opcje tematu","show_links":"pokaż odnośniki z tego tematu","toggle_information":"przełącz szczegóły tematu","read_more_in_category":"Chcesz przeczytać więcej? Przeglądaj inne tematy w {{catLink}} lub {{latestLink}}.","read_more":"Chcesz przeczytać więcej? {{catLink}} lub {{latestLink}}.","browse_all_categories":"Przeglądaj wszystkie kategorie","view_latest_topics":"pokaż aktualne tematy","suggest_create_topic":"Może rozpoczniesz temat?","jump_reply_up":"przeskocz do wcześniejszej odpowiedzi","jump_reply_down":"przeskocz do późniejszej odpowiedzi","deleted":"Temat został usunięty","auto_close_notice":"Ten temat zostanie automatycznie zamknięty %{timeLeft}.","auto_close_notice_based_on_last_post":"Ten temat zostanie automatycznie zamknięty %{duration} po ostatniej odpowiedzi.","auto_close_title":"Ustawienia automatycznego zamykania","auto_close_save":"Zapisz","auto_close_remove":"Nie zamykaj automatycznie tego tematu","timeline":{"back":"Wstecz","back_description":"Wróć do ostatniego nieprzeczytanego postu","replies_short":"%{current} / %{total}"},"progress":{"title":"postęp tematu","go_top":"początek","go_bottom":"koniec","go":"idź","jump_bottom":"Przejdź na koniec","jump_prompt":"przejdź do postu","jump_bottom_with_number":"przeskocz do wpisu %{post_number}","total":"w sumie wpisów","current":"obecny wpis"},"notifications":{"reasons":{"3_6":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie i temacie, ponieważ obserwujesz tę kategorię.","3_5":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ włączono automatyczne obserwowanie tego tematu.","3_2":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ obserwujesz ten temat.","3_1":"Będziesz otrzymywać powiadomienia, ponieważ jesteś autorem tego tematu.","3":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ obserwujesz ten temat.","2_8":"Będziesz otrzymywać powiadomienia, ponieważ śledzisz tę kategorię.","2_4":"Będziesz otrzymywać powiadomienia, ponieważ jesteś autorem odpowiedzi w tym temacie.","2_2":"Będziesz otrzymywać powiadomienia, ponieważ śledzisz ten temat.","2":"Będziesz otrzymywać powiadomienia, ponieważ \u003ca href=\"/users/{{username}}/preferences\"\u003eten temat został uznany za przeczytany\u003c/a\u003e.","1_2":"Dostaniesz powiadomienie jedynie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis.","1":"Dostaniesz powiadomienie jedynie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis.","0_7":"Ignorujesz wszystkie powiadomienia z tej kategorii.","0_2":"Ignorujesz wszystkie powiadomienia w tym temacie.","0":"Ignorujesz wszystkie powiadomienia w tym temacie."},"watching_pm":{"title":"Obserwuj wszystko","description":"Dostaniesz powiadomienie o każdym nowym wpisie w tej dyskusji. Liczba nowych wpisów pojawi się obok jej tytułu na liście wiadomości."},"watching":{"title":"Obserwuj wszystko","description":"Dostaniesz powiadomienie o każdym nowym wpisie w tym temacie. Liczba nowych wpisów pojawi się obok jego tytułu na liście wiadomości."},"tracking_pm":{"title":"Śledzenie","description":"Licznik nowych wpisów pojawi się obok tej dyskusji. Dostaniesz powiadomienie jedynie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"tracking":{"title":"Śledzenie","description":"Licznik nowych odpowiedzi pojawi się obok tytułu tego tematu. Dostaniesz powiadomienie jedynie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"regular":{"title":"Normalny","description":"Dostaniesz powiadomienie jedynie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"regular_pm":{"title":"Normalny","description":"Dostaniesz powiadomienie jedynie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"muted_pm":{"title":"Wyciszono","description":"Nie będziesz otrzymywać powiadomień dotyczących tej dyskusji."},"muted":{"title":"Wyciszenie","description":"Nie otrzymasz powiadomień o nowych wpisach w tym temacie. Nie pojawią się na liście nieprzeczytanych"}},"actions":{"recover":"Przywróć temat","delete":"Usuń temat","open":"Otwórz temat","close":"Zamknij temat","multi_select":"Wybierz wpisy…","auto_close":"Zamknij automatycznie…","pin":"Przypnij temat…","unpin":"Odepnij temat…","unarchive":"Przywróć z archiwum","archive":"Archiwizuj temat","invisible":"Ustaw jako niewidoczny","visible":"Ustaw jako widoczny","reset_read":"Zresetuj przeczytane dane","make_public":"Upublicznij temat","make_private":"Utwórz prywatną wiadomość"},"feature":{"pin":"Przypnij temat","unpin":"Odepnij temat","pin_globally":"Przypnij temat globalnie","make_banner":"Ustaw jako baner","remove_banner":"Wyłącz baner"},"reply":{"title":"Odpowiedz","help":"zacznij pisać odpowiedź"},"clear_pin":{"title":"Odepnij","help":"Odepnij ten temat. Przestanie wyświetlać się na początku listy tematów."},"share":{"title":"Udostępnij","help":"udostępnij odnośnik do tego tematu"},"flag_topic":{"title":"Zgłoś","help":"zgłoś ten temat, aby zwrócić uwagę moderacji lub wyślij powiadomienie o nim","success_message":"Ten temat został pomyślnie zgłoszony."},"feature_topic":{"title":"Wyróżnij ten temat","pin":"Wyróżnij ten temat przypinając go na górze w kategorii {{categoryLink}} do","confirm_pin":"Czy na pewno przypiąć ten temat w tej kategorii? Masz już {{count}} przypiętych tematów -- zbyt wiele może obniżyć czytelność innych aktywnych tematów.","unpin":"Odepnij ten temat z początku kategorii {{categoryLink}}.","unpin_until":"Odepnij ten temat z początku kategorii {{categoryLink}} lub poczekaj do \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Użytkownicy mogą przypinać tematy dla samych siebie.","pin_validation":"Przypięcie tego tematu wymaga podania daty.","not_pinned":"Brak przypiętych tematów w {{categoryLink}}.","already_pinned":{"one":"Tematy przypięte w {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","few":"Tematy przypięte w {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Tematy przypięte w {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Wyróżnij ten temat przypinając go na górze wszystkich list do","confirm_pin_globally":"Czy na pewno chcesz globalnie przypiąć kolejny temat? Masz już {{count}} przypiętych tematów -- zbyt wiele może obniżyć czytelność innych aktywnych tematów.","unpin_globally":"Usuń wyróżnienie dla tego tematu odpinając go z początku wszystkich list.","unpin_globally_until":"Usuń wyróżnienie dla tego tematu odpinając go z początku wszystkich list lub poczekaj do \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Użytkownicy mogą przypinać tematy dla samych siebie.","not_pinned_globally":"Brak przypiętych globalnie tematów.","already_pinned_globally":{"one":"Tematy przypięte globalnie: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e.","few":"Tematy przypięte globalnie: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e.","other":"Tematy przypięte globalnie: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"make_banner":"Ustaw ten temat jako baner wyświetlany na górze każdej strony.","remove_banner":"Usuń ten temat jako baner wyświetlany na górze każdej strony.","banner_note":"Użytkownicy mogą usunąć baner zamykając go przyciskiem. Tylko jeden temat może być banerem w danej chwili.","no_banner_exists":"Baner nie jest obecnie ustawiony.","banner_exists":"Baner \u003cstrong class='badge badge-notification unread'\u003ejest\u003c/strong\u003e obecnie ustawiony."},"inviting":"Zapraszam…","automatically_add_to_groups":"To zaproszenie obejmuje również dostęp do tych grup:","invite_private":{"title":"Zaproś do dyskusji","email_or_username":"Adres email lub nazwa użytkownika zapraszanej osoby","email_or_username_placeholder":"adres email lub nazwa użytkownika","action":"Zaproś","success":"Wskazany użytkownik został zaproszony do udziału w tej dyskusji.","error":"Przepraszamy, wystąpił błąd w trakcie zapraszania użytkownika(-czki).","group_name":"nazwa grupy"},"invite_reply":{"title":"Zaproś","username_placeholder":"nazwa użytkownika","action":"Wyślij zaproszenie","help":"zaproś innych do tego tematu e-mailem lub powiadomieniem","to_forum":"Wyślemy krótki email pozwalający twojemu znajomemu błyskawicznie dołączyć przez kliknięcie w link (bez logowania).","sso_enabled":"Podaj nazwę użytkownika lub e-mail osoby którą chcesz zaprosić do tego tematu.","to_topic_blank":"Podaj nazwę użytkownika lub e-mail osoby którą chcesz zaprosić do tego tematu.","to_topic_email":"Wprowadzony został adres e-mail. Wyślemy tam zaproszenie umożliwiające wskazanej osobie odpowiedź w tym temacie.","to_topic_username":"Konto o wprowadzonej nazwie użytkownika otrzyma powiadomienie z linkiem do tego tematu.","to_username":"Podaj nazwę użytkownika osoby którą chcesz zaprosić. Otrzyma powiadomienie z linkiem do tego tematu.","email_placeholder":"nazwa@example.com","success_email":"Wysłaliśmy zaproszenie do \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Otrzymasz powiadomienie, gdy zaproszenie zostanie przyjęte. Sprawdź zakładkę zaproszenia w swoim profilu, aby śledzić status tego i innych zaproszeń.","success_username":"Wskazany użytkownik został zaproszony do udziału w tym temacie.","error":"Przepraszamy, nie udało się zaprosić wskazanej osoby. Być może została już zaproszona? (Lub wysyłasz zbyt wiele zaproszeń)"},"login_reply":"Zaloguj się, aby odpowiedzieć","filters":{"n_posts":{"one":"1 wpis","few":"{{count}} wpisy","other":"{{count}} wpisów"},"cancel":"Usuń filtr"},"split_topic":{"title":"Przenieś do nowego tematu","action":"przenieś do nowego tematu","topic_name":"Nazwa Nowego Tematu","error":"Wystąpił błąd podczas przenoszenia wpisów do nowego tematu.","instructions":{"one":"Masz zamiar utworzyć nowy temat, składający się z wybranego przez ciebie wpisu.","few":"Masz zamiar utworzyć nowy temat, składający się z \u003cb\u003e{{count}}\u003c/b\u003e wybranych przez ciebie wpisów.","other":"Masz zamiar utworzyć nowy temat, składający się z \u003cb\u003e{{count}}\u003c/b\u003e wybranych przez ciebie wpisów."}},"merge_topic":{"title":"Przenieś do Istniejącego Tematu","action":"przenieś do istniejącego tematu","error":"Wystąpił błąd podczas przenoszenia wpisów do danego tematu.","instructions":{"one":"Wybierz temat, do którego chcesz przenieś ten wpis.","few":"Wybierz temat, do którego chcesz przenieść wybrane \u003cb\u003e{{count}}\u003c/b\u003e wpisy.","other":"Wybierz temat, do którego chcesz przenieść \u003cb\u003e{{count}}\u003c/b\u003e wybranych wpisów."}},"merge_posts":{"title":"Scal wybrane posty","action":"scal wybrane posty"},"change_owner":{"title":"Zmień właściciela wpisów","action":"zmień właściciela","error":"Wystąpił błąd podczas zmiany właściciela wpisów.","label":"Nowy właściciel wpisów","placeholder":"nazwa nowego właściciela","instructions":{"one":"Wybierz nowego właściciela wpisu autorstwa \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Wybierz nowego właściciela dla {{count}} wpisów autorstwa \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Wybierz nowego właściciela dla {{count}} wpisów autorstwa \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Przeszłe powiadomienia dla tego wpisu nie zostaną przypisane do nowego użytkownika. \u003cbr\u003eUwaga: Aktualnie, żadne dane uzależnione od wpisu nie są przenoszone do nowego użytkownika. Zachowaj ostrożność."},"change_timestamp":{"title":"Zmień znacznik czasu","action":"zmień znacznik czasu","invalid_timestamp":"Znacznik czasu nie może wskazywać na przyszłość.","error":"Wystąpił błąd podczas zmiany znacznika czasu tego tematu.","instructions":"Wybierz nowy znacznik czasu dla tematu. Wpisy w temacie zostaną zaktualizowane o tę samą różnicę."},"multi_select":{"select":"wybierz","selected":"wybrano ({{count}})","select_replies":"wybierz +replies","delete":"usuń wybrane","cancel":"anuluj wybieranie","select_all":"zaznacz wszystkie","deselect_all":"odznacz wszystkie","description":{"one":"Wybrano \u003cb\u003e1\u003c/b\u003e wpis.","few":"Wybrano \u003cb\u003e{{count}}\u003c/b\u003e wpisy.","other":"Wybrano \u003cb\u003e{{count}}\u003c/b\u003e wpisów."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"odpowiedz na ten cytat","edit":"Edycja {{link}} {{replyAvatar}} {{username}}","edit_reason":"Powód","post_number":"wpis {{number}}","last_edited_on":"ostatnia edycja wpisu","reply_as_new_topic":"Odpowiedz w nowym temacie","continue_discussion":"Kontynuując dyskusję z {{postLink}}:","follow_quote":"idź do cytowanego wpisu","show_full":"Pokaż pełny wpis","show_hidden":"Zobacz ukrytą zawartość.","deleted_by_author":{"one":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godzinę, chyba że zostanie oflagowany) ","few":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godziny, chyba że zostanie oflagowany) ","other":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godzin, chyba że zostanie oflagowany) "},"expand_collapse":"rozwiń/zwiń","gap":{"one":"pokaż 1 ukrytą odpowiedź","few":"pokaż {{count}} ukryte odpowiedzi","other":"pokaż {{count}} ukrytych odpowiedzi"},"unread":"Nieprzeczytany wpis","has_replies":{"one":"{{count}} odpowiedź","few":"{{count}} odpowiedzi","other":"{{count}} odpowiedzi"},"has_likes":{"one":"{{count}} lajk","few":"{{count}} lajki","other":"{{count}} lajków"},"has_likes_title":{"one":"1 osoba lajkuje ten wpis","few":"{{count}} osoby lajkują ten wpis","other":"{{count}} osób lajkuje ten wpis"},"has_likes_title_only_you":"lajkowany wpis","has_likes_title_you":{"one":"ty i 1 inna osoba lajkuje ten wpis","few":"ty i {{count}} inne osoby lajkują ten wpis","other":"ty i {{count}} innych osób lajkuje ten wpis"},"errors":{"create":"Przepraszamy, podczas tworzenia twojego wpisu wystąpił błąd. Spróbuj ponownie.","edit":"Przepraszamy, podczas edytowania twojego wpisu wystąpił błąd. Spróbuj ponownie.","upload":"Przepraszamy, wystąpił błąd podczas wczytywania Twojego pliku. Proszę, spróbuj ponownie.","too_many_uploads":"Przepraszamy, ale możesz wgrać tylko jeden plik naraz.","too_many_dragged_and_dropped_files":"Przepraszamy, ale możesz wgrać tylko 10 plików naraz.","upload_not_authorized":"Przepraszamy, ale plik który chcesz wgrać jest niedozwolony (dozwolone rozszerzenia: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Przepraszamy, ale nowi użytkownicy nie mogą wgrywać obrazów.","attachment_upload_not_allowed_for_new_user":"Przepraszamy, ale nowi użytkownicy nie mogą wgrywać załączników.","attachment_download_requires_login":"Przepraszamy, musisz się zalogować, aby pobierać załączniki."},"abandon":{"confirm":"Czy na pewno chcesz porzucić ten wpis?","no_value":"Nie, pozostaw","yes_value":"Tak, porzuć"},"via_email":"ten wpis został dodany emailem","via_auto_generated_email":"ten post został dodany poprzez automatycznie wygenerowaną wiadomość e-mail","whisper":"ten wpis jest prywatnym szeptem do moderatorów","wiki":{"about":"ten post jest Wiki"},"archetypes":{"save":"Opcje zapisu"},"controls":{"reply":"zacznij tworzyć odpowiedź na ten wpis","like":"lajkuj ten wpis","has_liked":"lajkujesz ten wpis","undo_like":"wycofaj lajka","edit":"edytuj ten wpis","edit_anonymous":"Przykro nam, ale musisz być zalogowany aby edytować ten wpis.","flag":"oflaguj ten wpis lub wyślij powiadomienie o nim do moderatorów","delete":"usuń ten wpis","undelete":"przywróc ten wpis","share":"udostępnij odnośnik do tego wpisu","more":"Więcej","delete_replies":{"confirm":{"one":"Czy chcesz usunąć również bezpośrednią odpowiedź na ten wpis?","few":"Czy chcesz usunąć również {{count}} bezpośrednie odpowiedzi na ten wpis?","other":"Czy chcesz usunąć również {{count}} bezpośrednich odpowiedzi na ten wpis?"},"yes_value":"Tak, usuń też odpowiedzi","no_value":"Nie, tylko ten wpis"},"admin":"administracja wpisem (tryb wiki itp)","wiki":"Włącz tryb Wiki","unwiki":"Wyłącz tryb Wiki","convert_to_moderator":"Włącz kolor moderatora","revert_to_regular":"Wyłącz kolor moderatora","rebake":"Odśwież HTML","unhide":"Wycofaj ukrycie","change_owner":"Zmiana właściciela"},"actions":{"flag":"Oflaguj","defer_flags":{"one":"Odrocz flagę","few":"Odrocz flagi","other":"Odrocz flagi"},"undo":{"off_topic":"Cofnij flagę","spam":"Cofnij flagę","inappropriate":"Cofnij flagę","bookmark":"Cofnij zakładkę","like":"Cofnij","vote":"Cofnij głos"},"people":{"off_topic":"Oflagowano jako nie-na-temat","spam":"oznacz jako spam","inappropriate":"Oflagowano jako nieodpowiednie","notify_moderators":"Powiadomiono moderatorów","notify_user":"Wysłano wiadomość","bookmark":"dodaj do zakładek","like":"lajkuje to","vote":"zagłosowało"},"by_you":{"off_topic":"Oznaczono jako nie-na-temat","spam":"Oflagowano jako spam","inappropriate":"Oznaczono jako niewłaściwe","notify_moderators":"Oflagowano do moderacji","notify_user":"Wysłano wiadomość do tego użytkownika","bookmark":"Dodano zakładkę w tym wpisie","like":"Lajkujesz ten wpis","vote":"Zagłosowano na ten wpis"},"by_you_and_others":{"off_topic":{"one":"Ty i 1 inna osoba oznaczyliście to jako nie-na-temat.","few":"Ty i {{count}} inne osoby oznaczyliście to jako nie-na-temat.","other":"Ty i {{count}} innych osób oznaczyliście to jako nie-na-temat."},"spam":{"one":"Ty i 1 inna osoba oflagowaliście to jako spam.","few":"Ty i {{count}} inne osoby oflagowaliście to jako spam.","other":"Ty i {{count}} innych osób oflagowaliście to jako spam."},"inappropriate":{"one":"Ty i 1 inna osoba oflagowaliście to jako niewłaściwe.","few":"Ty i {{count}} inne osoby oflagowaliście to jako niewłaściwe.","other":"Ty i {{count}} innych osób oflagowaliście to jako niewłaściwe."},"notify_moderators":{"one":"Ty i 1 inna osoba oflagowaliście to do moderacji.","few":"Ty i {{count}} inne osoby oflagowaliście to do moderacji.","other":"Ty i {{count}} innych osób oflagowaliście to do moderacji."},"notify_user":{"one":"Ty i 1 inna osoba wysłaliście wiadomość do tego użytkownika","few":"Ty i {{count}} inne osoby wysłaliście wiadomość do tego użytkownika","other":"Ty i {{count}} innych osób wysłaliście wiadomość do tego użytkownika"},"bookmark":{"one":"Ty i 1 inna osoba dodaliście ten wpis do zakładek.","few":"Ty i {{count}} inne osoby dodaliście ten wpis do zakładek.","other":"Ty i {{count}} innych osób dodaliście ten wpis do zakładek."},"like":{"one":"Ty i 1 inna osoba lajkujecie to.","few":"Ty i {{count}} inne osoby lajkują to.","other":"Ty i {{count}} innych osób lajkuje to."},"vote":{"one":"Ty i 1 inna osoba zagłosowaliście za tym wpisem","few":"Ty i {{count}} inne osoby zagłosowaliście za tym wpisem","other":"Ty i {{count}} innych osób zagłosowaliście za tym wpisem"}},"by_others":{"off_topic":{"one":"1 osoba oflagowała to jako nie-na-temat","few":"{{count}} osoby oflagowały to jako nie-na-temat","other":"{{count}} osób oflagowało to jako nie-na-temat"},"spam":{"one":"1 osoba oflagowała to jako spam","few":"{{count}} osoby oflagowały to jako spam","other":"{{count}} osób oflagowało to jako spam"},"inappropriate":{"one":"1 osoba oflagowała to jako niewłaściwe","few":"{{count}} osoby oflagowały to jako niewłaściwe","other":"{{count}} osób oflagowało to jako niewłaściwe"},"notify_moderators":{"one":"1 osoba oflagowała to do moderacji","few":"{{count}} osoby oflagowały to do moderacji","other":"{{count}} osób oflagowało to do moderacji"},"notify_user":{"one":"1 osoba wysłała wiadomość do tego użytkownika","few":"{{count}} osoby wysłały wiadomość do tego użytkownika","other":"{{count}} osób wysłało wiadomość do tego użytkownika"},"bookmark":{"one":"1 osoba dodała ten wpis do zakładek","few":"{{count}} osoby dodały ten wpis do zakładek","other":"{{count}} osób dodało ten wpis do zakładek"},"like":{"one":"1 osoba lajkuje to","few":"{{count}} osoby lajkują to","other":"{{count}} osób lajkuje to"},"vote":{"one":"1 osoba zagłosowała za tym wpisem","few":"{{count}} osoby zagłosowały za tym wpisem","other":"{{count}} osób zagłosowało za tym wpisem"}}},"delete":{"confirm":{"one":"Jesteś pewny(-a), że chcesz usunąć ten wpis?","few":"Jesteś pewny(-a), że chcesz usunąć te wszystkie wpisy?","other":"Czy na pewno chcesz usunąć te wszystkie wpisy?"}},"revisions":{"controls":{"first":"Pierwsza wersja","previous":"Poprzednia wersja","next":"Następna wersja","last":"Ostatnia wersja","hide":"Ukryj tę wersję","show":"Pokaż tę wersję","revert":"Przywróć do tej wersji","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Pokaż opublikowaną wersję wraz z elementami dodanymi i usuniętymi w treści.","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Pokaż wersje opublikowane do porównania obok siebie.","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Pokaż porównanie źródeł w formie tekstowej obok siebie","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Tekst"}}}},"category":{"can":"może\u0026hellip; ","none":"(brak kategorii)","all":"Wszystkie kategorie","choose":"Wybierz kategorię\u0026hellip;","edit":"edytuj","edit_long":"Edytuj","view":"Pokaż Tematy w Kategorii","general":"Ogólne","settings":"Ustawienia","topic_template":"Szablon tematu","tags":"Tagi","tags_placeholder":"(Opcjonalnie) lista dozwolonych tagów","tag_groups_placeholder":"(Opcjonalnie) lista dozwolonych grup tagów","delete":"Usuń kategorię","create":"Nowa kategoria","create_long":"Utwórz nową kategorię","save":"Zapisz kategorię","slug":"Slug kategorii","slug_placeholder":"(opcjonalne) słowa-z-myślnikiem dla URLi","creation_error":"Podczas tworzenia tej kategorii wystąpił błąd.","save_error":"Podczas zapisywania tej kategorii wystąpił błąd.","name":"Nazwa kategorii","description":"Opis","topic":"temat kategorii","logo":"Grafika z logo kategorii","background_image":"Grafika z tłem kategorii","badge_colors":"Kolor Etykiety","background_color":"Kolor tła","foreground_color":"Kolor Pierwszego Planu","name_placeholder":"Maksymalnie jedno lub dwa słowa","color_placeholder":"Dowolny kolor sieciowy","delete_confirm":"Czy na pewno chcesz usunąć tę kategorię?","delete_error":"Podczas próby usunięcia tej kategorii wystąpił błąd.","list":"Pokaż kategorie","no_description":"Proszę dodaj opis do tej kategorii.","change_in_category_topic":"Edytuj opis","already_used":"Ten kolor jest używany przez inną kategorię","security":"Bezpieczeństwo","special_warning":"Uwaga: Ta kategoria jest generowana automatycznie i jej ustawienia bezpieczeństwa nie mogą być edytowane. Jeśli nie zamierzasz jej używać, skasuj ją, zamiast zmieniać jej przeznaczenie.","images":"Obrazy","auto_close_label":"Automatycznie zamykaj tematy po:","auto_close_units":"godzin","email_in":"Dedykowany adres email kategorii:","email_in_allow_strangers":"Akceptuj wiadomości email od anonimowych, nieposiadających kont użytkowników ","email_in_disabled":"Tworzenie nowych tematów emailem jest wyłączone w ustawieniach serwisu. ","email_in_disabled_click":"Kliknij tu, aby włączyć.","suppress_from_homepage":"Nie wyświetlaj tej kategorii na stronie głównej.","allow_badges_label":"Włącz przyznawanie odznak na podstawie aktywności w tej kategorii","edit_permissions":"Edytuj uprawnienia","add_permission":"Dodaj uprawnienie","this_year":"ten rok","position":"pozycja","default_position":"Domyślna pozycja","position_disabled":"Kolejność kategorii będzie uzależniona od aktywności. Aby kontrolować ich kolejność,","position_disabled_click":"włącz statyczną kolejność kategorii","parent":"Kategoria rodzica","notifications":{"watching":{"title":"Obserwuj wszystko"},"watching_first_post":{"title":"Oglądasz pierwszy post"},"tracking":{"title":"Śledzona"},"regular":{"title":"Normalny","description":"Dostaniesz powiadomienie jedynie, gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"muted":{"title":"Wyciszone","description":"Nie otrzymasz powiadomień o nowych tematach w tych kategoriach. Nie pojawią się na liście nieprzeczytanych."}}},"flagging":{"title":"Dziękujemy za pomoc w utrzymaniu porządku w naszej społeczności!","action":"Oflaguj wpis","take_action":"Podejmij działanie","notify_action":"Wiadomość","official_warning":"Oficjalne ostrzeżenie","delete_spammer":"Usuń spamera","yes_delete_spammer":"Tak, usuń spamera","ip_address_missing":"(N/D)","hidden_email_address":"(ukryto)","submit_tooltip":"Zapisz prywatną flagę.","take_action_tooltip":"Nie czekaj, aż wpis zostanie zgłoszony przez innych,  natychmiast oflaguj do działania . ","cant":"Przepraszamy, nie możesz oflagować teraz tego wpisu.","formatted_name":{"off_topic":"Jest nie-na-temat","inappropriate":"Jest nieodpowiednie","spam":"Jest odebrane jako spam"},"custom_placeholder_notify_user":"Napisz konkretnie, konstuktywnie i kulturalnie.","custom_placeholder_notify_moderators":"Dlaczego ten wpis wymaga uwagi moderatora? Opisz co konkretnie Cię zaniepokoiło i jeśli to możliwe umieść odpowiednie odnośniki."},"flagging_topic":{"title":"Dziękujemy za pomoc w utrzymaniu porządku w naszej społeczności!","action":"Zgłoś temat","notify_action":"Wiadomość"},"topic_map":{"title":"Podsumowanie tematu","participants_title":"Najczęściej piszą","links_title":"Popularne linki","links_shown":"pokaż więcej linków...","clicks":{"one":"1 kliknięcie","few":"%{count} kliknięć","other":"%{count} kliknięć"}},"topic_statuses":{"warning":{"help":"To jest oficjalne ostrzeżenie."},"bookmarked":{"help":"Temat został dodany do zakładek."},"locked":{"help":"Temat został zamknięty. Dodawanie nowych odpowiedzi nie jest możliwe."},"archived":{"help":"Ten temat został zarchiwizowany i nie można go zmieniać"},"locked_and_archived":{"help":"Ten temat jest zamknięty i zarchiwizowany. Dodawanie odpowiedzi i jego edycja nie są  możliwe."},"unpinned":{"title":"Nieprzypięty","help":"Temat nie jest przypięty w ramach twojego konta. Będzie wyświetlany w normalnej kolejności."},"pinned_globally":{"title":"Przypięty globalnie","help":"Ten temat jest przypięty globalnie. Będzie wyświetlany na początku głównej listy oraz swojej kategorii."},"pinned":{"title":"Przypięty","help":"Temat przypięty dla twojego konta. Będzie wyświetlany na początku swojej kategorii."},"invisible":{"help":"Temat jest niewidoczny: nie będzie wyświetlany na listach tematów a dostęp do niego można uzyskać jedynie poprzez link bezpośredni"}},"posts":"Wpisy","posts_long":"jest {{number}} wpisów w tym temacie","original_post":"Oryginalny wpis","views":"Odsłony","views_lowercase":{"one":"odsłona","few":"odsłony","other":"odsłon"},"replies":"Odpowiedzi","views_long":"ten temat był oglądany {number}} razy","activity":"Aktywność","likes":"Lajki","likes_lowercase":{"one":"lajk","few":"lajki","other":"lajków"},"likes_long":"jest {{number}} lajków w tym temacie","users":"Użytkownicy","users_lowercase":{"one":"użytkownik","few":"użytkownicy","other":"użytkowników"},"category_title":"Kategoria","history":"Historia","changed_by":"przez {{author}}","raw_email":{"title":"Źródło emaila","not_available":"Niedostępne!"},"categories_list":"Lista Kategorii","filters":{"with_topics":"%{filter} tematy","with_category":"%{filter} tematy w %{category} ","latest":{"title":"Aktualne","title_with_count":{"one":"Aktualne (1)","few":"Aktualne ({{count}})","other":"Aktualne ({{count}})"},"help":"tematy z ostatnimi wpisami"},"hot":{"title":"Gorące","help":"wybrane najbardziej gorące tematy"},"read":{"title":"Przeczytane","help":"tematy które przeczytałeś, w kolejności od ostatnio przeczytanych"},"search":{"title":"Wyszukiwanie","help":"szukaj we wszystkich tematach"},"categories":{"title":"Kategorie","title_in":"Kategoria - {{categoryName}}","help":"wszystkie tematy zgrupowane przez kategorię"},"unread":{"title":"Nieprzeczytane","title_with_count":{"one":"Nieprzeczytane (1)","few":"Nieprzeczytane ({{count}})","other":"Nieprzeczytane ({{count}})"},"help":"obserwowane lub śledzone tematy z nieprzeczytanymi wpisami","lower_title_with_count":{"one":"1 nieprzeczytany","few":"{{count}} nieprzeczytane","other":"{{count}} nieprzeczytanych"}},"new":{"lower_title_with_count":{"one":"1 nowa","few":"{{count}} nowe","other":"{{count}} nowych"},"lower_title":"nowe","title":"Nowe","title_with_count":{"one":"Nowe (1)","few":"Nowe ({{count}})","other":"Nowe ({{count}})"},"help":"tematy dodane w ciągu ostatnich kilku dni"},"posted":{"title":"Wysłane","help":"tematy w których pisałeś"},"bookmarks":{"title":"Zakładki","help":"tematy dodane do zakładek"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","few":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"najnowsze tematy w kategorii {{categoryName}}"},"top":{"title":"Popularne","help":"popularne tematy w ubiegłym roku, miesiącu, tygodniu lub dniu","all":{"title":"Cały czas"},"yearly":{"title":"Rocznie"},"quarterly":{"title":"Kwartalnie"},"monthly":{"title":"Miesięcznie"},"weekly":{"title":"Tygodniowo"},"daily":{"title":"Dziennie"},"all_time":"Cały czas","this_year":"Rok","this_quarter":"Kwartał","this_month":"Miesiąc","this_week":"Tydzień","today":"Dzisiaj","other_periods":"zobacz najważniejsze"}},"browser_update":"Niestety \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003etwoja przeglądarka jest zbyt przestarzała, aby obsłużyć ten serwis\u003c/a\u003e. Prosimy \u003ca href=\"http://browsehappy.com\"\u003ezaktualizuj swoją przeglądarkę\u003c/a\u003e.","permission_types":{"full":"tworzyć / odpowiadać / przeglądać","create_post":"odpowiadać / przeglądać","readonly":"przeglądać"},"lightbox":{"download":"pobierz"},"keyboard_shortcuts_help":{"title":"Skróty klawiszowe","jump_to":{"title":"Skocz do","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Strona główna","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Najnowsze","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nowe","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Nieprzeczytane","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategorie","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Zakładki","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Wiadomości"},"navigation":{"title":"Nawigacja","jump":"\u003cb\u003e#\u003c/b\u003e idź do postu #","back":"\u003cb\u003eu\u003c/b\u003e wstecz","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Przesuń zaznaczenie \u0026uarr; \u0026darr;"},"application":{"title":"Aplikacja","create":"\u003cb\u003ec\u003c/b\u003e utwórz nowy temat","notifications":"\u003cb\u003en\u003c/b\u003e otwarte powiadomienia","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Otwórz menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Otwórz menu użytkownika","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Pokaż zaktualizowane tematy","search":"\u003cb\u003e/\u003c/b\u003e Wyszukaj","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e wyczyść listę tematów"},"actions":{"title":"Akcje","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e dodaj/usuń zakładkę na temat","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e przypnij/odepnij temat","share_post":"\u003cb\u003es\u003c/b\u003e Udostępnij post","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Odpowiedz w temacie","reply_post":"\u003cb\u003er\u003c/b\u003e Odpowiedz na post","like":"\u003cb\u003el\u003c/b\u003e Lajkuj post","flag":"\u003cb\u003e!\u003c/b\u003e Oznacz post","edit":"\u003cb\u003ee\u003c/b\u003e Edytuj post","delete":"\u003cb\u003ed\u003c/b\u003e Usuń post","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e śledź temat"}},"badges":{"earned_n_times":{"one":"Otrzymano tą odznakę 1 raz","few":"Otrzymano tą odznakę %{count} razy","other":"Otrzymano tą odznakę %{count} razy"},"granted_on":"Przyznano %{date}","others_count":"Inni użytkownicy z tą odznaką (%{count})","title":"Odznaki","allow_title":"dostępny tytuł","multiple_grant":"przyznana wielokrotnie","more_badges":{"one":"+1 więcej","few":"+%{count} więcej","other":"+%{count} więcej"},"granted":{"one":"1 przyznany","few":"%{count} przyznanych","other":"%{count} przyznanych"},"select_badge_for_title":"Wybierz odznakę do użycia jako twój tytuł","none":"\u003cbrak\u003e","badge_grouping":{"getting_started":{"name":"Pierwsze kroki"},"community":{"name":"Społeczność"},"trust_level":{"name":"Poziom Zaufania"},"other":{"name":"Inne"},"posting":{"name":"Pisanie"}}},"tagging":{"all_tags":"Wszystkie tagi","selector_all_tags":"wszystkie tagi","selector_no_tags":"brak tagów","changed":"zmienione tagi:","tags":"Tagi","choose_for_topic":"Wybierz opcjonalne tagi dla tych tematów:","delete_tag":"Usuń Tag","delete_confirm":"Czy na pewno chcesz usunąć ten tag?","rename_tag":"Zmień nazwę taga","rename_instructions":"Wybierz nową nazwę dla tego taga:","sort_by":"Sortuj po:","sort_by_name":"nazwa","manage_groups":"Zarządzaj grupą tagów","manage_groups_description":"Definiowanie grup do organizowania tagów","filters":{"without_category":"%{filter} %{tag} tematy","with_category":"%{filter} %{tag} tematy w %{category}","untagged_without_category":"%{filter} nieoznaczone tematy","untagged_with_category":"%{filter} nieoznaczone tematy w %{category}"},"notifications":{"watching":{"title":"Obserwowane"},"watching_first_post":{"title":"Oglądasz pierwszy post"},"tracking":{"title":"Śledzenie"},"regular":{"title":"Normalny"},"muted":{"title":"Wyciszony"}},"groups":{"title":"Tagi grup","about":"Dodaj etykiety do grup aby zarządzać nimi łatwiej.","new":"Nowa Grupa","tags_label":"Tagi w tej grupie:","parent_tag_label":"Nadrzędny tag:","parent_tag_placeholder":"Opcjonalnie","new_name":"Nowa grupa tagów","save":"Zapisz","delete":"Usuń"},"topics":{"none":{"unread":"Nie masz nieprzeczytanych tematów.","new":"Nie masz nowych tematów.","read":"Nie przeczytałeś jeszcze żadnych tematów.","posted":"Jeszcze nie zamieściłeś postów w żadnym z tematów.","latest":"Brak najnowszych tematów.","hot":"Brak gorących tematów.","bookmarks":"Nie posiadasz tematów dodanych do zakładek.","top":"Brak najlepszych tematów.","search":"Brak wyników wyszukiwania."},"bottom":{"latest":"Nie ma więcej najnowszych tematów.","hot":"Nie ma więcej gorących tematów.","posted":"Nie ma więcej tematów, w których pisałeś.","read":"Nie ma więcej przeczytanych tematów.","new":"Nie ma więcej nowych tematów.","unread":"Nie ma więcej nieprzeczytanych tematów.","top":"Nie ma już więcej najlepszych tematów.","search":"Nie znaleziono więcej wyników wyszukiwania."}}},"invite":{"custom_message_link":"niestandardowa wiadomość","custom_message_placeholder":"Wpisz swoją niestandardową wiadomość"},"poll":{"voters":{"one":"głosujący","few":"głosujących","other":"głosujących"},"total_votes":{"one":"oddanych głosów","few":"oddanych głosów","other":"oddanych głosów"},"average_rating":"Średnia ocena: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Głosy są jawne."},"multiple":{"help":{"at_least_min_options":{"one":"Wybierz co najmniej \u003cstrong\u003e1\u003c/strong\u003e opcję","few":"Wybierz co najmniej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","other":"Wybierz co najmniej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji"},"up_to_max_options":{"one":"Wybierz co najwyżej \u003cstrong\u003e1\u003c/strong\u003e opcję","few":"Wybierz co najwyżej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","other":"Wybierz co najwyżej \u003cstrong\u003e%{count}\u003c/strong\u003e opcji"},"x_options":{"one":"Wybierz \u003cstrong\u003e1\u003c/strong\u003e opcję","few":"Wybierz \u003cstrong\u003e%{count}\u003c/strong\u003e opcji","other":"Wybierz \u003cstrong\u003e%{count}\u003c/strong\u003e opcji"},"between_min_and_max_options":"Wybierz pomiędzy \u003cstrong\u003e%{min}\u003c/strong\u003e a \u003cstrong\u003e%{max}\u003c/strong\u003e opcjami"}},"cast-votes":{"title":"Oddaj głos","label":"Oddaj głos!"},"show-results":{"title":"Wyświetl wyniki ankiety","label":"Pokaż wyniki"},"hide-results":{"title":"Wróć do oddanych głosów","label":"Ukryj wyniki"},"open":{"title":"Otwórz ankietę","label":"Otwórz","confirm":"Czy na pewno chcesz otworzyć tę ankietę?"},"close":{"title":"Zamknij ankietę","label":"Zamknij","confirm":"Czy na pewno chcesz zamknąć tę ankietę?"},"error_while_toggling_status":"Przepraszamy, wystąpił błąd podczas przełączania statusu w tej ankiecie.","error_while_casting_votes":"Przepraszamy, wystąpił błąd podczas oddawania głosów.","error_while_fetching_voters":"Przepraszamy, wystąpił błąd podczas wyświetlania głosujących.","ui_builder":{"title":"Utwórz ankietę","insert":"Wstaw ankietę","help":{"options_count":"Wprowadź przynajmniej 2 opcje"},"poll_type":{"label":"Typ","regular":"Pojedynczy wybór","multiple":"Wielokrotny wybór","number":"Liczba ocen"},"poll_config":{"max":"Max","min":"Min","step":"Krok"},"poll_public":{"label":"Pokaż kto głosował"},"poll_options":{"label":"Wprowadź jedną opcję ankiety w jednej linii"}}},"type_to_filter":"pisz, aby filtrować…","admin":{"title":"Administrator Discourse","moderator":"Moderator","dashboard":{"title":"Raporty","last_updated":"Ostatnia aktualizacja panelu kontrolnego:","version":"Wersja","up_to_date":"Wersja Aktualna!","critical_available":"Ważna aktualizacja jest dostępna.","updates_available":"Aktualizacje są dostępne.","please_upgrade":"Koniecznie zaktualizuj!","no_check_performed":"Sprawdzanie dostępności aktualizacji nie jest wykonywane. Sprawdź działa czy sidekiq.","stale_data":"Sprawdzanie dostępności aktualizacji nie było ostatnio wykonywane. Sprawdź działa czy sidekiq.","version_check_pending":"Wygląda na to że ostatnio była wykonana aktualizacja. Fantastycznie!","installed_version":"Zainstalowana","latest_version":"Najnowsza","problems_found":"Wykryto pewne problemy w Twojej instalacji Discourse:","last_checked":"Ostatnio sprawdzana","refresh_problems":"Odśwież","no_problems":"Nie znaleziono problemów.","moderators":"Moderatorzy:","admins":"Adminstratorzy:","blocked":"Zablokowani:","suspended":"Zawieszeni:","private_messages_short":"Wiad.","private_messages_title":"Wiadomości","mobile_title":"Mobile","space_free":"{{size}} wolne","uploads":"załączniki","backups":"kopie zapasowe","traffic_short":"Ruch","traffic":"Zapytania do aplikacji","page_views":"Zapytania API","page_views_short":"Zapytania API","show_traffic_report":"Pokaż szczegółowy raport ruchu","reports":{"today":"Dzisiaj","yesterday":"Wczoraj","last_7_days":"Ostatnie 7 dni","last_30_days":"Ostatnie 30 dni","all_time":"Przez cały czas","7_days_ago":"7 dni temu","30_days_ago":"30 dni temu","all":"Wszystkie","view_table":"tabela","refresh_report":"Odśwież raport","start_date":"Data początkowa","end_date":"Data końcowa","groups":"Wszystkie grupy"}},"commits":{"latest_changes":"Ostatnie zmiany: aktualizuj często!","by":"przez"},"flags":{"title":"Flagi","old":"Stare","active":"Aktywność","agree":"Potwierdź","agree_title":"Potwierdź to zgłoszenie jako uzasadnione i poprawne","agree_flag_modal_title":"Potwierdź i…","agree_flag_hide_post":"Potwierdź (ukryj post i wyślij PW)","agree_flag_hide_post_title":"Ukryj ten wpis i automatycznie wyślij użytkownikowi  wiadomość informującą, że wpis wymaga przeredagowania","agree_flag_restore_post":"Zgoda (przywróć wpis)","agree_flag_restore_post_title":"Przywróć ten wpis","agree_flag":"Potwierdź flagę","agree_flag_title":"Potwierdź flagę i zostaw wpis bez zmian","defer_flag":"Zignoruj","defer_flag_title":"Usunięcie flagi z twojej listy, nie wymaga dalszych działań.","delete":"Usuń","delete_title":"Usuń wpis do którego odnosi się flaga.","delete_post_defer_flag":"Usuń wpis i zignoruj flagę","delete_post_defer_flag_title":"Usuń wpis. Jeśli jest pierwszym w temacie, usuń temat.","delete_post_agree_flag":"Usuń post i potwierdź flagę","delete_post_agree_flag_title":"Usuń wpis. Jeśli jest pierwszym w temacie, usuń temat.","delete_flag_modal_title":"Usuń i…","delete_spammer":"Usuń spamera","delete_spammer_title":"Usuwa konto tego użytkownika oraz wszystkie tematy i wpisy jakie nim utworzono.","disagree_flag_unhide_post":"Wycofaj (pokaż wpis)","disagree_flag_unhide_post_title":"Usuń wszystkie flagi z tego wpisu i uczyń go widocznym ponownie.","disagree_flag":"Wycofaj","disagree_flag_title":"Wycofaj nieuzasadnioną flagę.","clear_topic_flags":"Zrobione","clear_topic_flags_title":"Ten temat został sprawdzony i związane z nim problemy zostały rozwiązane. Kliknij Zrobione, aby usunąć flagi.","more":"(więcej odpowiedzi…)","dispositions":{"agreed":"potwierdzono","disagreed":"wycofano","deferred":"zignorowano"},"flagged_by":"Oflagowano przez","resolved_by":"Rozwiązano przez","took_action":"Podjęto działanie","system":"System","error":"Coś poszło nie tak","reply_message":"Odpowiedz","no_results":"Nie ma flag.","topic_flagged":"Ten \u003cstrong\u003etemat\u003c/strong\u003e został oflagowany.","visit_topic":"Odwiedź temat by podjąć działania.","was_edited":"Wpis został zmieniony po pierwszej fladze","previous_flags_count":"Ten wpis został do tej pory oznaczony flagą {{count}} razy.","summary":{"action_type_3":{"one":"nie-na-temat","few":"nie-na-temat x{{count}}","other":"nie-na-temat x{{count}}"},"action_type_4":{"one":"nieodpowiednie","few":"nieodpowiednie x{{count}}","other":"nieodpowiednie x{{count}}"},"action_type_6":{"one":"niestandardowy","few":"niestandardowe x{{count}}","other":"niestandardowych x{{count}}"},"action_type_7":{"one":"niestandardowy","few":"niestandardowe x{{count}}","other":"niestandardowych x{{count}} "},"action_type_8":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"}}},"groups":{"primary":"Główna grupa","no_primary":"(brak podstawowej grupy)","title":"Grupy","edit":"Edytuj grupy","refresh":"Odśwież","new":"Nowa","selector_placeholder":"nazwa użytkownika","name_placeholder":"Nazwa grupy: bez spacji, takie same zasady jak przy nazwie użytkownika","about":"Tu możesz edytować przypisania do grup oraz ich nazwy","group_members":"Członkowie grupy","delete":"Usuń","delete_confirm":"Usunąć tę grupę?","delete_failed":"Nie można usunąć grupy. Jeżeli jest to grupa automatyczna, nie może zostać zniszczona.","delete_member_confirm":"Usunąć '%{username}' z grupy '%{group}' ?","delete_owner_confirm":"Usunąć status właściciela dla  '%{username}'?","name":"Nazwa","add":"Dodaj","add_members":"Dodaj członków","custom":"Niestandardowe","bulk_complete":"Użytkownicy zostali dodani do wskazanej grupy.","bulk":"Dodaj więcej do grupy","bulk_paste":"Podaj listę nazw użytkowników lub adresów e-mail,  każdy w oddzielnej linii:","bulk_select":"(wybierz grupę)","automatic":"Automatyczne","automatic_membership_email_domains":"Użytkownicy rejestrujący się przy pomocy adresu z tej listy zostaną automatycznie przypisani do tej grupy.","automatic_membership_retroactive":"Zastosuj tę regułę domenową do już istniejących użytkowników.","default_title":"Domyślny tytuł użytkowników należących do tej grupy","primary_group":"Automatycznie ustawiaj jako główną grupę","group_owners":"Właściciele","add_owners":"Dodaj właścicieli","incoming_email":"Niestandardowy adres poczty przychodzącej","incoming_email_placeholder":"podaj adres e-mail"},"api":{"generate_master":"Generuj Master API Key","none":"Nie ma teraz aktywnych kluczy API.","user":"Użytkownik","title":"API","key":"Klucz API","generate":"Generuj","regenerate":"Odnów","revoke":"Unieważnij","confirm_regen":"Czy na pewno chcesz zastąpić ten API Key nowym?","confirm_revoke":"Czy na pewno chcesz unieważnić ten klucz?","info_html":"Twoje klucze API dają dostęp do tworzenia i aktualizowania tenatów przez wywołania JSON.","all_users":"Wszyscy użytkownicy","note_html":"Zachowaj ten klucz \u003cstrong\u003ew tajemnicy\u003c/strong\u003e, wszyscy którzy go posiadają mogą tworzyć wpisy jako dowolny użytkownik."},"plugins":{"title":"Wtyczki","installed":"Zainstalowane wtyczki","name":"Nazwa","none_installed":"Brak zainstalowanych wtyczek.","version":"Wersja","enabled":"Włączono?","is_enabled":"T","not_enabled":"N","change_settings":"Zmień ustawienia","change_settings_short":"Ustawienia","howto":"Jak zainstalować wtyczkę?"},"backups":{"title":"Kopie zapasowe","menu":{"backups":"Kopie zapasowe","logs":"Logi"},"none":"Brak kopii zapasowych.","read_only":{"enable":{"title":"Włącz tryb tylko do odczytu","label":"Włącz tylko do odczytu","confirm":"Czy na pewno chcesz włączyć tryb tylko do odczytu?"},"disable":{"title":"Wyłącz tryb tylko do odczytu","label":"Wyłącz tylko do odczytu"}},"logs":{"none":"Póki co brak logów…"},"columns":{"filename":"Nazwa pliku","size":"Rozmiar"},"upload":{"label":"Wyślij","title":"Wyślij kopię zapasową do tej instancji","uploading":"Wysyłanie…","success":"'{{filename}}' został pomyślnie przesłany.","error":"Podczas przesyłania pliku wystąpił błąd '{{filename}}': {{message}}"},"operations":{"is_running":"Proces jest w trakcie działania…","failed":"Proces {{operation}} zakończył się niepowodzeniem. Sprawdź logi.","cancel":{"label":"Anuluj","title":"Anuluj bieżącą operację","confirm":"Czy na pewno chcesz anulować bieżącą operację?"},"backup":{"label":"Kopia zapasowa","title":"Wykonaj kopię zapasową","confirm":"Czy chcesz wykonać kopię zapasową?","without_uploads":"Tak (bez załączników)"},"download":{"label":"Pobierz","title":"Pobierz kopię zapasową"},"destroy":{"title":"Usuń kopię zapasową","confirm":"Czy na pewno chcesz zniszczyć tą kopię zapasową?"},"restore":{"is_disabled":"Przywracanie jest zablokowane w ustawieniach.","label":"Przywróć","title":"Przywróć kopię zapasową","confirm":"Czy na pewno chcesz przywrócić tą kopię zapasową?"},"rollback":{"label":"Wycofaj","title":"Wycofaj bazę danych do poprzedniego poprawnego stanu"}}},"export_csv":{"user_archive_confirm":"Czy na pewno chcesz pobrać swoje wszystkie wpisy?","success":"Rozpoczęto eksport: otrzymasz wiadomość, gdy proces zostanie zakończony.","failed":"Eksport zakończył się niepowodzeniem. Sprawdź logi.","rate_limit_error":"Wpisy mogą być pobierane raz dziennie, spróbuj ponownie jutro.","button_text":"Eksportuj","button_title":{"user":"Eksportuj listę wszystkich użytkowników do formatu CSV.","staff_action":"Eksportuj log zmian wykonanych przez zespół do formatu CSV.","screened_email":"Eksportuj listę monitorowanych adresów email do formatu CSV.","screened_ip":"Eksportuj listę monitorowanych IP do formatu CSV.","screened_url":"Eksportuj listę monitorowanych URLi do formatu CSV."}},"export_json":{"button_text":"Eksport"},"invite":{"button_text":"Wyślij zaproszenia","button_title":"Wysyłanie zaproszeń"},"customize":{"title":"Wygląd","long_title":"Personalizacja strony","css":"CSS","header":"Nagłówki","top":"Nagłówek","footer":"Stopka","embedded_css":"Osadzony CSS","head_tag":{"text":"\u003c/head\u003e","title":"Kod HTML, który zostanie umieszczony przed tagiem \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"Kod HTML, który zostanie umieszczony przed tagiem \u003c/body\u003e."},"override_default":"Nie dołączaj standardowego arkusza stylów","enabled":"Włączone?","preview":"podgląd","undo_preview":"usuń podgląd","rescue_preview":" domyślny styl","explain_preview":"Podejrzyj witrynę z użyciem tego sylesheet'u","explain_undo_preview":"Wróć do aktualnie aktywnego schematu styli","explain_rescue_preview":"Zobacz stronę z domyślnym stylem","save":"Zapisz","new":"Nowy","new_style":"Nowy styl","import":"Import","import_title":"Wybierz plik lub wklej tekst","delete":"Usuń","delete_confirm":"Usunąć tę personalizację?","about":"Zmień arkusze stylów CSS i nagłówki HTML w witrynie. Dodaj własne ustawienie aby rozpocząć.","color":"Kolor","opacity":"Widoczność","copy":"Kopiuj","email_templates":{"title":"Szablony email","subject":"Temat","multiple_subjects":"Ten szablon e-mail zawiera wiele tematów.","body":"Treść","none_selected":"Aby rozpocząć edycję, wybierz szablon wiadomości e-mail. ","revert":"Cofnij zmiany","revert_confirm":"Czy na pewno chcesz wycofać swoje zmiany?"},"css_html":{"title":"CSS, HTML","long_title":"Personalizacja kodu CSS i HTML"},"colors":{"title":"Kolory","long_title":"Schematy kolorów","about":"Zmień kolory strony bez modyfikacji CSS. Dodaj nowy schemat kolorów, aby rozpocząć.","new_name":"Nowy schemat kolorów","copy_name_prefix":"Kopia","delete_confirm":"Usunąć ten schemat kolorów?","undo":"cofnij","undo_title":"Cofnij zmiany tego koloru od ostatniego zapisu","revert":"przywróć","revert_title":"Zresetuj  ten kolor do wartości domyślnej.","primary":{"name":"podstawowy","description":"Większość tekstu, ikon oraz krawędzi."},"secondary":{"name":"drugorzędny","description":"Główny kolor tła oraz kolor tekstu niektórych przycisków."},"tertiary":{"name":"trzeciorzędny","description":"Linki, niektóre przyciski, powiadomienia oraz kolor używany w różnych akcentach."},"quaternary":{"name":"czwartorzędny","description":"Nawigacja"},"header_background":{"name":"tło nagłówka","description":"Kolor tła nagłówka witryny."},"header_primary":{"name":"podstawowy nagłówka","description":"Tekst oraz ikony w nagłówku witryny."},"highlight":{"name":"zaznacz","description":"Kolor tła podświetlonych/zaznaczonych elementów na stronie, takich jak wpisy i tematy."},"danger":{"name":"niebezpieczeństwo","description":"Kolor podświetlenia dla akcji takich jak usuwanie wpisów i tematów."},"success":{"name":"sukces","description":"Używany do oznaczania operacji zakończonych sukcesem."},"love":{"name":"polubienie","description":"Kolor przycisku lajkuj"}}},"email":{"settings":"Ustawienia","templates":"Szablony","preview_digest":"Pokaż zestawienie aktywności","sending_test":"Wysyłanie testowego emaila…","error":"\u003cb\u003eBŁAD\u003c/b\u003e - %{server_error}","test_error":"Wystąpił problem podczas wysyłania testowego maila. Sprawdź ustawienia poczty, sprawdź czy Twój serwer nie blokuje połączeń pocztowych i spróbuj ponownie.","sent":"Wysłane","skipped":"Pominięte","bounced":"Odbite","received":"Otrzymane","rejected":"Odrzucone","sent_at":"Wysłany na","time":"Czas","user":"Użytkownik","email_type":"Typ emaila","to_address":"Na adres","test_email_address":"adres email do testu","send_test":"Wyślij email testowy","sent_test":"wysłany!","delivery_method":"Metoda Dostarczenia","preview_digest_desc":"Podgląd treści zestawienia wysyłanego e-mailem do nieaktywnych użytkowników.","refresh":"Odśwież","format":"Format","html":"html","text":"text","last_seen_user":"Ostatnia ","reply_key":"Klucz odpowiedzi","skipped_reason":"Powód pominięcia","incoming_emails":{"from_address":"Od","to_addresses":"Do","subject":"Temat","error":"Błąd","modal":{"title":"Szczegóły przychodzącego emaila","error":"Błąd","headers":"Nagłówki","subject":"Temat","body":"Treść"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Temat...","error_placeholder":"Błąd"}},"logs":{"none":"Nie znaleziono logów.","filters":{"title":"Filtr","user_placeholder":"nazwa użytkownika","address_placeholder":"nazwa@example.com","type_placeholder":"streszczenie, rejestracja…","reply_key_placeholder":"klucz odpowiedzi","skipped_reason_placeholder":"powód"}}},"logs":{"title":"Logi","action":"Działanie","created_at":"Utworzony","last_match_at":"Ostatnia Zgodność","match_count":"Zgodność","ip_address":"IP","topic_id":"ID tematu","post_id":"ID wpisu","category_id":"ID kategorii","delete":"Usuń","edit":"Edytuj","save":"Zapisz","screened_actions":{"block":"blok","do_nothing":"nic nie rób"},"staff_actions":{"title":"Działania obsługi","instructions":"Klikając nazwę użytkownika i akcję możesz filtrować listę. Kliknij awatary aby przejść na stronę użytkownika.","clear_filters":"Pokaż wszystko","staff_user":"Użytkownik obsługi","target_user":"Użytkownik będący Obiektem","subject":"Temat","when":"Kiedy","context":"Kontekst","details":"Szczegóły","previous_value":"Poprzedni","new_value":"Nowy","diff":"Różnice","show":"Pokaż","modal_title":"Szczegóły","no_previous":"Nie ma wcześniejszej wartości.","deleted":"Nie ma nowej wartości. Zapis został usunięty.","actions":{"delete_user":"usunięcie użytkownika","change_trust_level":"zmiana poziomu zaufania","change_username":"zmień nazwę użytkownika","change_site_setting":"zmiana ustawień serwisu","change_site_customization":"modyfikacja personalizacji serwisu","delete_site_customization":"usunięcie personalizacji strony","change_site_text":"zmiana tekstu serwisu","suspend_user":"zawieszenie użytkownika","unsuspend_user":"odwieszenie użytkownika","grant_badge":"przyznanie odznaki","revoke_badge":"odebranie odznaki","check_email":"sprawdzenie poczty","delete_topic":"usunięcie tematu","delete_post":"usunięcie wpisu","impersonate":"udawanie użytkownika","anonymize_user":"anonimizuj użytkownika","roll_up":"zwiń bloki IP","change_category_settings":"zmiana ustawień kategorii","delete_category":"Usuń kategorię","create_category":"Dodaj nową kategorię","block_user":"zablokuj użytkownika","unblock_user":"odblokuj użytkownika","backup_operation":"operacja tworzenia kopii zapasowej","deleted_tag":"usunięty tag"}},"screened_emails":{"title":"Ekranowane emaile","description":"Kiedy ktoś próbuje założyć nowe konto, jego adres email zostaje sprawdzony i rejestracja zostaje zablokowana, lub inna akcja jest podejmowana.","email":"Adres email","actions":{"allow":"Zezwalaj"}},"screened_urls":{"title":"Ekranowane URLe","description":"URLe wypisane tutaj były używane we wpisach przez użytkowników wykrytych jako spamerzy.","url":"URL","domain":"Domena"},"screened_ips":{"title":"Ekranowane adresy IP","description":"Adres IP który teraz oglądasz. Użyj \"Zezwól\" aby dodać do białej listy adresów IP.","delete_confirm":"Czy na pewno chcesz usunąć regułę dla %{ip_address}?","roll_up_confirm":"Czy na pewno chcesz zgrupować monitorowane IP w podsieci?","rolled_up_some_subnets":"Pomyślnie zwinięto ban IP dla podsieci: %{subnets}.","rolled_up_no_subnet":"Brak pozycji do zwinięcia.","actions":{"block":"Zablokuj","do_nothing":"Zezwól","allow_admin":"Włącz dostęp do panelu admina"},"form":{"label":"Nowy:","ip_address":"Adres IP","add":"Dodaj","filter":"Wyszukaj"},"roll_up":{"text":"Zgrupuj","title":"Tworzy nowy ban dla podsieci jeśli jest co najmniej  'min_ban_entries_for_roll_up' pozycji."}},"logster":{"title":"Logi błędów"}},"impersonate":{"title":"Zaloguj się na to konto","help":"Użyj tego narzędzia, aby logować się jako dowolny użytkownik w celach diagnozy problemów.","not_found":"Wskazany użytkownik nie został znaleziony.","invalid":"Przepraszamy, nie możesz zalogować się jako ten użytkownik."},"users":{"title":"Użytkownicy","create":"Dodaj Administratora","last_emailed":"Ostatnio wysłano email","not_found":"Przepraszamu, taka nazwa użytkowanika nie istnieje w naszym systemie.","id_not_found":"Przepraszamy, ten identyfikator użytkownika nie istnieje w naszym systemie.","active":"Aktywny","show_emails":"Pokaż emaile","nav":{"new":"Nowi","active":"Aktywni","pending":"Oczekujący","staff":"Zespół","suspended":"Zawieszeni","blocked":"Zablokowani","suspect":"Podejrzani"},"approved":"Zatwierdzam?","approved_selected":{"one":"zatwierdź użytkownika","few":"zatwierdź użytkowników ({{count}})","other":"zatwierdź użytkowników ({{count}})"},"reject_selected":{"one":"odrzuć użytkownika(-czkę)","few":"odrzuć użytkowników ({{count}})","other":"odrzuć użytkowników ({{count}})"},"titles":{"active":"Aktywni użytkownicy","new":"Nowi użytkownicy","pending":"Użytkownicy oczekujący na akceptację","newuser":"Użytkownicy na 0 poziomie zaufania (Nowi)","basic":"Użytkownicy na 1 poziomie zaufania (Podstawowi)","member":"Użytkownicy na 2 poziomie zaufania (Zwyczajni)","regular":"Użytkownicy na 3 poziomie zaufania (Regularni)","leader":"Użytkownicy na 4 poziomie zaufania (Weterani)","staff":"Zespół","admins":"Administratorzy","moderators":"Moderatoratorzy","blocked":"Zablokowane konta","suspended":"Zawieszone konta","suspect":"Podejrzani użytkownicy"},"reject_successful":{"one":"Odrzucenie 1 użytkownika(-czki) powiodło się.","few":"Odrzucenie %{count} użytkowników powiodło się.","other":"Odrzucenie %{count} użytkowników powiodło się."},"reject_failures":{"one":"Odrzucenie 1 użytkownika(-czki) nie powiodło się.","few":"Odrzucenie %{count} użytkowników powiodło się.","other":"Odrzucenie %{count} użytkowników nie powiodło się."},"not_verified":"Niezweryfikowany","check_email":{"title":"Wyświetl adres email tego użytkownika","text":"Pokaż"}},"user":{"suspend_failed":"Coś poszło nie tak podczas zawieszania użytkownika {{error}}","unsuspend_failed":"Coś poszło nie tak podczas odwieszania użytkownika {{error}}","suspend_duration":"Jak długo użytkownik ma być zawieszony?","suspend_duration_units":"(dni)","suspend_reason_label":"Dlaczego zawieszasz? Ten tekst \u003cb\u003ebędzie widoczny dla wszystkich\u003c/b\u003e na stronie profilu użytkownika i będzie wyświetlany użytkownikowi gdy ten będzie próbował się zalogować. Zachowaj zwięzłość.","suspend_reason":"Powód","suspended_by":"Zawieszony przez","delete_all_posts":"Usuń wszystkie wpisy","suspend":"Zawieś","unsuspend":"Odwieś","suspended":"Zawieszony?","moderator":"Moderator?","admin":"Admin?","blocked":"Zablokowany?","show_admin_profile":"Admin","edit_title":"Edytuj tytuł","save_title":"Zapisz tytuł","refresh_browsers":"Wymuś odświeżenie przeglądarki","refresh_browsers_message":"Wiadomość wysłana do wszystkich klientów!","show_public_profile":"Pokaż profil publiczny","impersonate":"Zaloguj się na to konto","ip_lookup":"Wyszukiwanie IP","log_out":"Wyloguj","logged_out":"Użytkownik został wylogowany na wszystkich urządzeniach.","revoke_admin":"Odbierz status admina","grant_admin":"Przyznaj status admina","revoke_moderation":"Odbierz status moderatora","grant_moderation":"Przyznaj status moderatora","unblock":"Odblokuj","block":"Blokuj","reputation":"Reputacja","permissions":"Uprawnienia","activity":"Aktywność","like_count":"Lajki dane / otrzymane","last_100_days":"w ostatnich 100 dniach","private_topics_count":"Prywatne tematy","posts_read_count":"Przeczytane wpisy","post_count":"Napisane wpisy","topics_entered":"Widziane tematy","flags_given_count":"Dane flagi","flags_received_count":"Otrzymane flagi","warnings_received_count":"Otrzymane ostrzeżenia","flags_given_received_count":"Flagi przyznane / otrzymane","approve":"Zatwierdź","approved_by":"zatwierdzone przez","approve_success":"Użytkownik zatwierdzony i został wysłany email z instrukcjami aktywacji.","approve_bulk_success":"Sukces! Wszyscy wybrani użytkownicy zostali zatwierdzeni i powiadomieni.","time_read":"Czas czytania","anonymize":"Anonimizacja użytkownika","anonymize_confirm":"Czy na pewno chcesz anonimizować to konto? Zmianie ulegnie nazwa użytkownika, e-mail oraz zawartość profilu.","anonymize_yes":"Tak, anonimizuj to konto.","anonymize_failed":"Wystąpił problem podczas anonimizacji konta.","delete":"Usuń użytkownika","delete_forbidden_because_staff":"Admini i moderatorzy nie mogą zostać usunięci.","delete_posts_forbidden_because_staff":"Nie można usunąć wszystkich wpisów administratorów i moderatorów.","delete_forbidden":{"one":"Użytkownik nie może zostać usunięty jeśli posiada wpisy. Usuń wszystkie jego wpisy przed usunięciem użytkownika. (Nie można usunąć wpisów starszych niż %{count} dzień.)","few":"Użytkownik nie może zostać usunięty jeśli posiada wpisy. Usuń wszystkie jego wpisy przed usunięciem użytkownika. (Nie można usunąć wpisów starszych niż %{count} dni.)","other":"Użytkownik nie może zostać usunięty jeśli posiada wpisy. Usuń wszystkie jego wpisy przed usunięciem użytkownika. (Nie można usunąć wpisów starszych niż %{count} dni.)"},"cant_delete_all_posts":{"one":"Nie można usunąć wszystkich postów. Część z nich ma więcej niż 1 dzień. (Ustawienie delete_user_max_post_age)","few":"Nie można usunąć wszystkich postów. Część z nich ma więcej niż %{count} dni. (Ustawienie delete_user_max_post_age)","other":"Nie można usunąć wszystkich wpisów. Część z nich ma więcej niż %{count} dni. (Ustawienie delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Nie można usunąć wszystkich postów, ponieważ użytkownik ma więcej niż 1 post. (delete_all_posts_max)","few":"Nie można usunąć wszystkich postów, ponieważ użytkownik ma ich więcej niż %{count}. (delete_all_posts_max)","other":"Nie można usunąć wszystkich wpisów, ponieważ użytkownik ma ich więcej niż %{count}. (delete_all_posts_max)"},"delete_confirm":"Czy NA PEWNO chcesz usunąć tego użytkownika? Będzie to nieodwracalne!","delete_and_block":"Usuń i \u003cb\u003ezablokuj\u003c/b\u003e ten email oraz adres IP","delete_dont_block":"Tylko usuń","deleted":"Użytkownik został usunięty.","delete_failed":"Wystąpił błąd podczas usuwania użytkownika. Upewnij się, że wszystkie wpisy zostały usunięte przed przystąpieniem do usuwania użytkownika.","send_activation_email":"Wyślij email aktywacyjny","activation_email_sent":"Email Aktywacyjny został wysłany.","send_activation_email_failed":"Wystąpił problem podczas wysyłania jeszcze jednego emaila aktywacyjnego. %{error}","activate":"Aktywuj Konto","activate_failed":"Wystąpił problem przy aktywacji konta użytkownika.","deactivate_account":"Deaktywuj konto","deactivate_failed":"Wystąpił problem przy deaktywacji konta użytkownika.","unblock_failed":"Wystąpił problem podczaj odblokowania użytkownika.","block_failed":"Wystąpił problem podczas blokowania użytkownika.","block_accept":"Tak, zablokuj tego użytkownika","reset_bounce_score":{"label":"Przywróć"},"deactivate_explanation":"Wymusza ponowne potwierdzenie adresu email tego konta.","suspended_explanation":"Zawieszony użytkownik nie może się logować.","block_explanation":"Zablokowany użytkownik nie może tworzyć wpisów ani zaczynać tematów.","trust_level_change_failed":"Wystąpił problem przy zmianie poziomu zaufania użytkowanika.","suspend_modal_title":"Zawieś użytkownika","trust_level_2_users":"Użytkownicy o 2. poziomie zaufania","trust_level_3_requirements":"Wymagania 3. poziomu zaufania","trust_level_locked_tip":"poziom zaufania jest zablokowany, system nie będzie awansować lub degradować tego użytkownika","trust_level_unlocked_tip":"poziom zaufania jest odblokowany, system może awansować lub degradować tego użytkownika","lock_trust_level":"Zablokuj poziom zaufania","unlock_trust_level":"Odblokuj poziom zaufania","tl3_requirements":{"title":"Wymagania dla osiągnięcia 3. poziomu zaufania","value_heading":"Wartość","requirement_heading":"Wymaganie","visits":"Odwiedziny","days":"dni","topics_replied_to":"Tematy w odpowiedzi do","topics_viewed":"Wyświetlone Tematy","topics_viewed_all_time":"Oglądane Tematy (cały czas)","posts_read":"Przeczytane Wpisy","posts_read_all_time":"Przeczytane Wpisy (cały czas)","flagged_posts":"Zgłoszonych wpisów","flagged_by_users":"Flagujący Użytkownicy ","likes_given":"Lajki dane","likes_received":"Lajki otrzymane","likes_received_days":"Lajki otrzymane: unikalne dni","likes_received_users":"Lajki otrzymane: unikalni użytkownicy","qualifies":"Kwalifikuje się do 3 poziomu zaufania.","does_not_qualify":"Nie kwalifikuje się do 3 poziomu zaufania.","will_be_promoted":"Zostanie awansowany wkrótce.","will_be_demoted":"Zostanie zdegradowany wkrótce.","on_grace_period":"Podlega pod okres ochronny, nie zostanie zdegradowany.","locked_will_not_be_promoted":"Zablokowany poziom zaufania. Nie będzie awansować.","locked_will_not_be_demoted":"Zablokowany poziom zaufania. Nie będzie degradowany."},"sso":{"title":"Single Sign On","external_id":"Zewnętrzny ID","external_username":"Nazwa użytkownika","external_name":"Nazwa","external_email":"Email","external_avatar_url":"URL awatara"}},"user_fields":{"title":"Pola użytkownika","help":"Dodaj pola które użytkownicy mogą wypełnić.","create":"Dodaj pole użytkownika","untitled":"Bez tytułu","name":"Nazwa pola","type":"Typ pola","description":"Opis pola","save":"Zapisz","edit":"Edycja","delete":"Usuń","cancel":"Anuluj","delete_confirm":"Czy na pewno chcesz usunąć to pole?","options":"Opcje","required":{"title":"Wymagane przy rejestracji?","enabled":"wymagane","disabled":"niewymagane"},"editable":{"title":"Edytowalne po rejestracji?","enabled":"edytowalne","disabled":"nieedytowalne"},"show_on_profile":{"title":"Widoczne w publicznym profilu?","enabled":"widoczne w profilu","disabled":"niewidoczne w profilu"},"show_on_user_card":{"title":"Pokaż na karcie użytkownika?","enabled":"pokazany na karcie użytkownika"},"field_types":{"text":"Pole tekstowe","confirm":"Potwierdzenie","dropdown":"Lista rozwijana"}},"site_text":{"description":"Możesz dostosować dowolny tekst na swoim forum. Rozpocznij wyszukując poniżej:","search":"Znajdź etykietę lub tekst który chcesz zmienić","title":"Kontekst","edit":"edytuj","revert":"Cofnij zmiany","revert_confirm":"Czy na pewno chcesz wycofać swoje zmiany?","go_back":"Wróć do wyszukiwania","recommended":"Zalecamy zmianę poniższego tekstu, aby lepiej odpowiadał Twoim potrzebom:","show_overriden":"Pokaż tylko nadpisane"},"site_settings":{"show_overriden":"Pokaż tylko nadpisane","title":"Ustawienia","reset":"przywróć domyślne","none":"żadne","no_results":"Brak wyników wyszukiwania","clear_filter":"Wyczyść","add_url":"dodaj URL","add_host":"dodaj host","categories":{"all_results":"Wszystkie","required":"Wymagane","basic":"Podstawowe","users":"Użytkownicy","posting":"Pisanie","email":"Email","files":"Pliki","trust":"Poziomy zaufania","security":"Bezpieczeństwo","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limity","developer":"Deweloperskie","embedding":"Osadzanie","legal":"Prawne","uncategorized":"Inne","backups":"Kopie zapasowe","login":"Logowanie","plugins":"Wtyczki","user_preferences":"Ustawienia użytk.","tags":"Tagi"}},"badges":{"title":"Odznaki","new_badge":"Nowa odznaka","new":"Nowa","name":"Nazwa","badge":"Odznaka","display_name":"Wyświetlana nazwa","description":"Opis","long_description":"Długi opis","badge_type":"Typ odznaki","badge_grouping":"Grupa","badge_groupings":{"modal_title":"Grupy odznak"},"granted_by":"Przyznana przez","granted_at":"Przyznana","reason_help":"(Link do wpisu lub tematu)","save":"Zapisz","delete":"Usuń","delete_confirm":"Czy na pewno chcesz usunąć tę odznakę?","revoke":"Odbierz","reason":"Powód","expand":"Rozwiń \u0026hellip;","revoke_confirm":"Czy na pewno chcesz odebrać tę odznakę?","edit_badges":"Edytuj odznaki","grant_badge":"Przyznaj odznakę","granted_badges":"Przyznane odznaki","grant":"Przyznaj","no_user_badges":"%{name} nie otrzymał żadnych odznak.","no_badges":"Nie ma odznak, które można by było przyznać.","none_selected":"Wybierz odznakę, aby rozpocząć","allow_title":"Pozwól wykorzystywać odznakę jako tytuł","multiple_grant":"Może być przyznana wielokrotnie","listable":"Wyświetlaj odznakę na publicznych listach odznak","enabled":"Włącz odznakę","icon":"Ikona","image":"Grafika","icon_help":"Użyj jednej z klas Font Awesome lub adresu URL do grafiki","query":"Zapytanie odznaki (SQL) ","target_posts":"Wpisy powiązane z odznaką","auto_revoke":"Codziennie uruchamiaj zapytanie odbierające odznakę","show_posts":"Wyświetlaj wpisy odpowiedzialne za przyznanie odznaki na jej stronie ","trigger":"Aktywacja","trigger_type":{"none":"Automatycznie, raz dziennie","post_action":"Gdy użytkownik reaguje na wpis","post_revision":"Gdy użytkownik edytuje lub tworzy wpis","trust_level_change":"Gdy zmienia się poziom zaufania użytkownika","user_change":"Gdy użytkownik jest edytowany lub tworzony"},"preview":{"link_text":"Podgląd przyznanych odznak","plan_text":"Podgląd zapytania","modal_title":"Podgląd wykonania zapytania odznaki","sql_error_header":"Wystąpił błąd z zapytaniem","error_help":"Zapoznaj się z poniższymi linkami, aby uzyskać pomoc przy pisaniu zapytań dla odznak.","bad_count_warning":{"header":"UWAGA!","text":"Brakuje przykładowych wyników. Zapytanie odznaki zwraca nieistniejące ID użytkowników lub wpisów. Może to spowodować nieoczekiwane rezultaty w przyszłości – sprawdź ponownie swoje zapytanie. "},"no_grant_count":"Brak odznak do przyznania.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e odznaka do przyznania.","few":"\u003cb\u003e%{count}\u003c/b\u003e odznaki do przyznania.","other":"\u003cb\u003e%{count}\u003c/b\u003e odznak do przyznania."},"sample":"Podgląd:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e za wpis w %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e za wpis w %{link} o \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e o \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Dodawanie nowych emoji.  (PROTIP: przeciągnij i upuść wiele plików)","add":"Dodaj nowe Emoji","name":"Nazwa","image":"Grafika","delete_confirm":"Jesteś pewny(-a), że chcesz usunąć emoji :%{name}: ?"},"embedding":{"get_started":"Jeśli chcesz osadzić Discourse na innej stronie, rozpocznij podając jej host.","confirm_delete":"Czy na pewno chcesz usunąć ten host?","sample":"Użyj poniższego kodu HTML na swojej stronie, aby osadzić tematy z Discourse. Zastąp \u003cb\u003eREPLACE_ME\u003c/b\u003e domyślnym adresem URL strony na której osadzasz.","title":"Osadzanie","host":"Dozwolone hosty","edit":"edytuj","category":"Publikuj w kategorii","add_host":"Dodaj host","settings":"Ustawienia osadzania","feed_settings":"Ustawienia kanału","feed_description":"Wprowadzenie kanału RSS/ATOM twojego serwisu ułatwia import treści.","crawling_settings":"Ustawienia crawlera","crawling_description":"Gdy Discourse tworzy tematy reprezentujące twoje wpisy, a kanał RSS/ATOM nie został podany, treść będzie pobierana poprzez parsowanie HTML. Proces ten może okazać się trudny dlatego umożliwiamy podanie dodatkowych reguł CSS, które usprawniają proces parsowania.","embed_by_username":"Użytkownik tworzący tematy","embed_post_limit":"Maksymalna ilość osadzanych wpisów ","embed_username_key_from_feed":"Klucz używany do pobrania nazwy użytkownika z kanału","embed_truncate":"Skracaj treść osadzanych wpisów","embed_whitelist_selector":"Selektor CSS elementów jakie mogą być osadzane","embed_blacklist_selector":"Selektor CSS elementów jakie są usuwane podczas osadzania","embed_classname_whitelist":"Dozwolone nazwy klas CSS","feed_polling_enabled":"Importowanie wpisów via RSS/ATOM","feed_polling_url":"URL kanału RSS/ATOM","save":"Zapisz"},"permalink":{"title":"Permalinki","url":"URL","topic_id":"ID tematu","topic_title":"Temat","post_id":"ID wpisu","post_title":"Wpis","category_id":"ID kategorii","category_title":"Kategoria","external_url":"Zewnętrzny URL","delete_confirm":"Czy na pewno chcesz usunąć ten permalink?","form":{"label":"Nowy:","add":"Dodaj","filter":"Wyszukaj (URL or zewnętrzny URL)"}}}}},"en":{"js":{"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"mailing_list_mode":{"instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n"},"watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email_previous_replies":{"title":"Include previous replies at the bottom of emails"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","summary":{"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"}}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"summary":{"description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"login":{"instagram":{"title":"with Instagram"}},"category_page_style":{"categories_with_featured_topics":"Categories with Featured Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","heading_label":"H","yourself_confirm":{"body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e"},"topics":{"none":{"educate":{"unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"read_more_MF":"There { UNREAD, plural, =0 {} one { is \u003ca href='/unread'\u003e1 unread\u003c/a\u003e } other { are \u003ca href='/unread'\u003e# unread\u003c/a\u003e } } { NEW, plural, =0 {} one { {BOTH, select, true{and } false {is } other{}} \u003ca href='/new'\u003e1 new\u003c/a\u003e topic} other { {BOTH, select, true{and } false {are } other{}} \u003ca href='/new'\u003e# new\u003c/a\u003e topics} } remaining, or {CATEGORY, select, true {browse other topics in {catLink}} false {{latestLink}} other {}}","auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"progress":{"jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"invite_private":{"success_group":"We've invited that group to participate in this message."},"controls":"Topic Controls","merge_posts":{"error":"There was an error merging the selected posts."}},"post":{"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"posts_likes_MF":"This topic has {count, plural, one {1 reply} other {# replies}} {ratio, select,\n  low {with a high like to post ratio}\n  med {with a very high like to post ratio}\n  high {with an extremely high like to post ratio}\n  other {}}\n","search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"jump_to":{"top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top"},"navigation":{"open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"badge_count":{"one":"1 Badge","other":"%{count} Badges"}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"sort_by_count":"count","notifications":{"watching":{"description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"bottom":{"bookmarks":"There are no more bookmarked topics."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"operations":{"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"email":{"title":"Emails","incoming_emails":{"cc_addresses":"Cc","none":"No incoming emails found.","modal":{"rejection_message":"Rejection Mail"}}},"logs":{"staff_actions":{"actions":{"grant_admin":"grant admin","revoke_admin":"revoke admin","grant_moderation":"grant moderation","revoke_moderation":"revoke moderation","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","block_confirm":"Are you sure you want to block this user? They will not be able to create any new topics or posts.","bounce_score":"Bounce Score","reset_bounce_score":{"title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"disabled":"not shown on user card"}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"badges":{"trigger_type":{"post_processed":"After a post is processed"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'pl_PL';
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
//! locale : polish (pl)
//! author : Rafal Hirsz : https://github.com/evoL

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var monthsNominative = 'styczeń_luty_marzec_kwiecień_maj_czerwiec_lipiec_sierpień_wrzesień_październik_listopad_grudzień'.split('_'),
        monthsSubjective = 'stycznia_lutego_marca_kwietnia_maja_czerwca_lipca_sierpnia_września_października_listopada_grudnia'.split('_');
    function plural(n) {
        return (n % 10 < 5) && (n % 10 > 1) && ((~~(n / 10) % 10) !== 1);
    }
    function translate(number, withoutSuffix, key) {
        var result = number + ' ';
        switch (key) {
        case 'm':
            return withoutSuffix ? 'minuta' : 'minutę';
        case 'mm':
            return result + (plural(number) ? 'minuty' : 'minut');
        case 'h':
            return withoutSuffix  ? 'godzina'  : 'godzinę';
        case 'hh':
            return result + (plural(number) ? 'godziny' : 'godzin');
        case 'MM':
            return result + (plural(number) ? 'miesiące' : 'miesięcy');
        case 'yy':
            return result + (plural(number) ? 'lata' : 'lat');
        }
    }

    var pl = moment.defineLocale('pl', {
        months : function (momentToFormat, format) {
            if (format === '') {
                // Hack: if format empty we know this is used to generate
                // RegExp by moment. Give then back both valid forms of months
                // in RegExp ready format.
                return '(' + monthsSubjective[momentToFormat.month()] + '|' + monthsNominative[momentToFormat.month()] + ')';
            } else if (/D MMMM/.test(format)) {
                return monthsSubjective[momentToFormat.month()];
            } else {
                return monthsNominative[momentToFormat.month()];
            }
        },
        monthsShort : 'sty_lut_mar_kwi_maj_cze_lip_sie_wrz_paź_lis_gru'.split('_'),
        weekdays : 'niedziela_poniedziałek_wtorek_środa_czwartek_piątek_sobota'.split('_'),
        weekdaysShort : 'nie_pon_wt_śr_czw_pt_sb'.split('_'),
        weekdaysMin : 'Nd_Pn_Wt_Śr_Cz_Pt_So'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Dziś o] LT',
            nextDay: '[Jutro o] LT',
            nextWeek: '[W] dddd [o] LT',
            lastDay: '[Wczoraj o] LT',
            lastWeek: function () {
                switch (this.day()) {
                case 0:
                    return '[W zeszłą niedzielę o] LT';
                case 3:
                    return '[W zeszłą środę o] LT';
                case 6:
                    return '[W zeszłą sobotę o] LT';
                default:
                    return '[W zeszły] dddd [o] LT';
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'za %s',
            past : '%s temu',
            s : 'kilka sekund',
            m : translate,
            mm : translate,
            h : translate,
            hh : translate,
            d : '1 dzień',
            dd : '%d dni',
            M : 'miesiąc',
            MM : translate,
            y : 'rok',
            yy : translate
        },
        ordinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return pl;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM RRRR'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
