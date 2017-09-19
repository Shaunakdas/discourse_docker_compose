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

MessageFormat.locale.sq = function ( n ) {
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
I18n.translations = {"sq":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} më parë","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1o","other":"%{count}o"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1v","other":"%{count}v"},"over_x_years":{"one":"\u003e 1v","other":"\u003e %{count}v"},"almost_x_years":{"one":"1v","other":"%{count}v"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} mins"},"x_hours":{"one":"1 orë","other":"%{count} orë"},"x_days":{"one":"1 ditë","other":"%{count} ditë"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 min më parë","other":"%{count} min më parë"},"x_hours":{"one":"1 orë më parë","other":"%{count} orë më parë"},"x_days":{"one":"1 ditë më parë","other":"%{count} ditë më parë"}},"later":{"x_days":{"one":"1 ditë më vonë","other":"%{count} ditë më vonë"},"x_months":{"one":"1 muaj më vonë","other":"%{count} muaj më vonë"},"x_years":{"one":"1 vit më vonë","other":"%{count} vjet më vonë"}},"previous_month":"Muaji i kaluar","next_month":"Muaji i ardhshëm"},"share":{"topic":"shpërnda një lidhje tek kjo temë","post":"postim #%{postNumber}","close":"mbylle","twitter":"shpërndaje këtë lidhje në Twitter","facebook":"postojeni këtë lidhje në Facebook","google+":"shpërndaje këtë lidhje në Google+","email":"dërgoje këtë lidhje me email"},"action_codes":{"public_topic":"e bëri këtë temë publike %{when}","private_topic":"e bëri këtë temë private %{when}","split_topic":"ndaje këtë teme %{when}","invited_user":"ka ftuar %{who} %{when}","invited_group":"ka ftuar %{who} %{when}","removed_user":"hequr %{who} %{when}","removed_group":"hequr %{who} %{when}","autoclosed":{"enabled":"mbylli %{when}","disabled":"hapur %{when}"},"closed":{"enabled":"mbyllur %{when}","disabled":"hapur %{when}"},"archived":{"enabled":"arkivoi %{when}","disabled":"paarkivuar %{when}"},"pinned":{"enabled":"ngjitur %{when}","disabled":"çngjitur %{when}"},"pinned_globally":{"enabled":"ngjitur globalisht %{when}","disabled":"çngjitur %{when}"},"visible":{"enabled":"listuar %{when}","disabled":"çlistuar %{when}"}},"topic_admin_menu":"veprimet administrative mbi temën","emails_are_disabled":"Emailat janë çaktivizuar globalisht nga administratori i faqes. Asnjë njoftim me email nuk do të dërgohet. ","bootstrap_mode_enabled":"Për të thjeshtuar nisjen e komunitetit, jeni në formatin \"bootstrap\". Të gjithë anëtarët e rinj do të kenë nivelin e besimit 1 dhe emailat e përditshëm të aktivizuar. Këto opsione do të çaktivizohen automatikisht kur numri total i anëtarëve të kalojë numrin %{min_users}.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)","cn_north_1":"China (Beijing)"}},"edit":"redakto titullin dhe kategorinë e kësaj teme","not_implemented":"Kjo veçori nuk është implementuar akoma, na vjen keq!","no_value":"Jo","yes_value":"Po","generic_error":"Na vjen keq, por sapo ndodhi një gabim.","generic_error_with_reason":"Pati një gabim: %{error}","sign_up":"Regjistrohu","log_in":"Identifikohu","age":"Mosha","joined":"Anëtarësuar","admin_title":"Admin","flags_title":"Sinjalizimet","show_more":"trego më shumë","show_help":"opsione","links":"Lidhjet","links_lowercase":{"one":"lidhje","other":"lidhje"},"faq":"Pyetje të shpeshta","guidelines":"Udhëzimet","privacy_policy":"Politika e Privatësisë","privacy":"Privatësia","terms_of_service":"Kushtet e shërbimit","mobile_view":"Pamja për celular","desktop_view":"Pamja për desktop","you":"Ju","or":"ose","now":"tani","read_more":"lexo më shumë","more":"Më shumë","less":"Më pak","never":"asnjëherë","every_30_minutes":"çdo 30 minuta","every_hour":"çdo orë","daily":"çdo ditë","weekly":"çdo javë","every_two_weeks":"çdo dy javë","every_three_days":"çdo 3 ditë","max_of_count":"max i {{count}}","alternation":"ose","character_count":{"one":"{{count}} shkronjë","other":"{{count}} shkronja"},"suggested_topics":{"title":"Temat e sugjeruara","pm_title":"Mesazhet e sugjeruara"},"about":{"simple_title":"Rreth","title":"Rreth %{title}","stats":"Statistikat e faqjes","our_admins":"Administratorët tanë","our_moderators":"Moderatorët tanë","stat":{"all_time":"Gjithë kohës","last_7_days":"7 ditët e fundit","last_30_days":"30 ditët e fundit"},"like_count":"Pëlqime","topic_count":"Tema","post_count":"Postime","user_count":"Anëtarët e rinj","active_user_count":"Anëtarët aktivë","contact":"Na kontaktoni","contact_info":"Në rast të një problemi madhor ose të një çështjeje urgjente që prek faqen, ju lutemi të kontaktoni %{contact_info}."},"bookmarked":{"title":"Të preferuarat","clear_bookmarks":"Pastro të preferuarat","help":{"bookmark":"Kliko për të shtuar tek të preferuarat e tua postimin e parë të kësaj teme.","unbookmark":"Kliko për të hequr të preferuarat nga kjo temë"}},"bookmarks":{"not_logged_in":"ju duhet të jeni të identifikuar për të ruajtur temën.","created":"ju ruajtët këtë temë tek të preferuarat tuaja","not_bookmarked":"e keni lexuar këtë temë; klikoni për ta ruajtur tek të preferuarat","last_read":"ky është postimi i fundit që keni lexuar; klikoni për t'a shtuar tek të preferuarat","remove":"Hiqeni nga të prefereruarat","confirm_clear":"Jeni të sigurtë se doni të fshini të gjitha të preferuarat nga kjo temë?"},"topic_count_latest":{"one":"{{count}} temë e re ose e përditësuar.","other":"{{count}} tema të reja ose të përditësuara."},"topic_count_unread":{"one":"{{count}} temë e palexuar.","other":"{{count}} tema të palexuara."},"topic_count_new":{"one":"{{count}} temë e re.","other":"{{count}} tema të reja."},"click_to_show":"Kliko për ti shfaqur.","preview":"shiko","cancel":"anulo","save":"Ruaj ndryshimet","saving":"Duke e ruajtur...","saved":"U ruajt!","upload":"Ngarko","uploading":"Duke ngarkuar...","uploading_filename":"Duke ngarkuar {{filename}}...","uploaded":"U ngarkua!","enable":"Aktivizo","disable":"Çaktivizo","undo":"Çbëj","revert":"Rikthe","failed":"Dështoi","switch_to_anon":"Filloni sesionin anonim","switch_from_anon":"Shkëputu nga sesioni anonim","banner":{"close":"Hiq këtë banderolë.","edit":"Modifiko këtë banderolë \u003e\u003e"},"choose_topic":{"none_found":"Asnjë temë nuk u gjet.","title":{"search":"Kërko për një temë sipas titullit, adresës URL apo id:","placeholder":"shkruaj titullin e temës këtu"}},"queue":{"topic":"Tema:","approve":"Aprovo","reject":"Refuzo","delete_user":"Fshij Anëtarin","title":"Tema që kërkojnë aprovim","none":"Nuk ka postime për të redaktuar.","edit":"Redakto","cancel":"Anulo","view_pending":"shiko postimet në pritje","has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval","other":"Kjo temë ka \u003cb\u003e{{count}}\u003c/b\u003e postime që presin aprovimin"},"confirm":"Ruaj ndryshimet","delete_prompt":"Vertet doni ta fshini \u003cb\u003e%{username}\u003c/b\u003e? Ky veprim do të fshijë çdo postim të tyrin dhe do të bllokojë email-in dhe adresën e tyre IP.","approval":{"title":"Postimi ka nevojë për aprovim","description":"Postimi juaj u morr, por duhet të aprovohet nga një moderator para se të shfaqet në faqe. Kini pak durim. ","pending_posts":{"one":"Ju keni \u003cstrong\u003e1\u003c/strong\u003e postim në pritje.","other":"Ju keni \u003cstrong\u003e{{count}}\u003c/strong\u003e postime në pritje."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e postoi \u003ca href='{{topicUrl}}'\u003etemën\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eJu\u003c/a\u003e postuat \u003ca href='{{topicUrl}}'\u003etemën\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e iu përgjigj \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eJu\u003c/a\u003e i jeni përgjigjur \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e iu përgjigj \u003ca href='{{topicUrl}}'\u003etemës\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eJu\u003c/a\u003e i jeni përgjigjur \u003ca href='{{topicUrl}}'\u003etemës\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e përmendi \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e ju ka përmendur \u003ca href='{{user2Url}}'\u003eju\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eJu\u003c/a\u003e keni përmendur \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postuar nga \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postuar nga \u003ca href='{{userUrl}}'\u003eju\u003c/a\u003e","sent_by_user":"Dërguar nga \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Dërguar nga \u003ca href='{{userUrl}}'\u003eju\u003c/a\u003e"},"directory":{"filter_name":"filtro sipas emrit të anëtarit","title":"Anëtarët","likes_given":"Dhënë","likes_received":"Marrë","topics_entered":"Shikuar","topics_entered_long":"Temat e shikuara","time_read":"Koha e leximit","topic_count":"Tema","topic_count_long":"Topics Created","post_count":"Përgjigje","post_count_long":"Replies Posted","no_results":"Nuk u gjet asnjë rezultat.","days_visited":"Vizita","days_visited_long":"Vizita Ditore","posts_read":"Lexuar","posts_read_long":"Postimet e lexuara","total_rows":{"one":"1 anëtar","other":"%{count} anëtarë"}},"groups":{"empty":{"posts":"Nuk ka postim nga anëtarët e këtij grupi.","members":"Nuk ka asnjë anëtar në këtë grup.","mentions":"Nuk ka përmendje për këtë grup.","messages":"Nuk ka mesazhe për këtë grup.","topics":"Nuk ka asnjë temë nga anëtarët e këtij grupi."},"add":"Shto","selector_placeholder":"Shto anëtarë","owner":"autori","visible":"Grupi është i dukshëm për të gjithë përdoruesit","index":"Grupet","title":{"one":"grup","other":"grupe"},"members":"Anëtarë","topics":"Tema","posts":"Postime","mentions":"Përmendje","messages":"Mesazhet","alias_levels":{"title":"Kush mund ti bëjë mesazh dhe @permendje këtij grupi?","nobody":"Asnjëri","only_admins":"Vetëm adminët","mods_and_admins":"Vetëm moderatorët dhe adminët","members_mods_and_admins":"Vetëm anëtarët e grupit, moderatorët dhe adminët","everyone":"Të gjithë"},"trust_levels":{"title":"Niveli i besimit që ju akordohet automatikisht anëtarëve të grupit:","none":"Asnjë"},"notifications":{"watching":{"title":"Në vëzhgim","description":"Ju do të njoftoheni për çdo postim të ri në çdo mesazh, dhe numri i ri i përgjigjeve të reja do të tregohet."},"watching_first_post":{"title":"Postimi i parë nën vëzhgim","description":"Ju do të njoftoheni vetëm për postimin e parë të çdo teme nën këtë etiketë."},"tracking":{"title":"Në gjurmim","description":"Ju do të njoftoheni në qoftë se dikush ju pëmend me @emri ose ju përgjigjet, gjithashtu numri i përgjigjeve të reja do të tregohet."},"regular":{"title":"Normal","description":"Ju do të njoftoheni në qoftë se dikush ju përmend @emrin ose ju përgjigjet."},"muted":{"title":"Pa njoftime","description":"Ju nuk do të njoftoheni asnjëherë për asgjë mbi temat e reja të këtij grupi."}}},"user_action_groups":{"1":"Pëlqime të dhëna","2":"Pëlqime të marra","3":"Të preferuarat","4":"Tema","5":"Përgjigje","6":"Përgjigjet","7":"Përmendje","9":"Citime","11":"Redaktime","12":"Të dërguar","13":"Inbox","14":"Në pritje"},"categories":{"all":"kategoritë","all_subcategories":"të gjitha","no_subcategory":"asnjë","category":"Kategori","category_list":"Trego listën e kategorive","reorder":{"title":"Rendit kategoritë","title_long":"Ri-organizo listën e kategorive","fix_order":"Rregullo pozicionet","fix_order_tooltip":"Jo të gjitha kategoritë kanë një numër pozicioni unik, kjo mund të shkaktojë rezultate të paparashikuara.","save":"Ruaje renditjen","apply_all":"Apliko","position":"Pozicioni"},"posts":"Postime","topics":"Tema","latest":"Të fundit","latest_by":"të fundit sipas","subcategories":"Nënkategori","topic_stat_sentence":{"one":"%{count} temë e re gjatë %{unit} të fundit.","other":"%{count} tema të reja gjatë %{unit} të fundit."}},"ip_lookup":{"title":"Shiko adresën IP","hostname":"Hostname","location":"Vendndodhja","location_not_found":"(i panjohur)","organisation":"Organizata","phone":"Telefoni","other_accounts":"Llogari të tjera me këtë adresë IP:","delete_other_accounts":"Fshi %{count}","username":"emri i përdoruesit","trust_level":"TL","read_time":"koha e leximit","topics_entered":"temat e shikuara","post_count":"# postimeve","confirm_delete_other_accounts":"A jeni të sigurtë që doni të fshini këto llogari?"},"user_fields":{"none":"(zgjidhni një opsion)"},"user":{"said":"{{username}}:","profile":"Profili","mute":"Hesht","edit":"Ndrysho preferencat","download_archive":"Shkarko postimet e mia","new_private_message":"Mesazh i ri","private_message":"Mesazh","private_messages":"Mesazhet","activity_stream":"Aktiviteti","preferences":"Preferencat","expand_profile":"Shpalos","bookmarks":"Të preferuarat","bio":"Rreth meje","invited_by":"Të ftuar nga unë","trust_level":"Niveli i besimit","notifications":"Njoftimet","statistics":"Statistikat","desktop_notifications":{"label":"Njoftimet në desktop","not_supported":"Ky shfletues nuk është i aftë të ruajë njoftimet. ","perm_default":"Aktivizo njoftimet","perm_denied_btn":"Nuk lejohet","perm_denied_expl":"Ju nuk na dhatë të drejtën t'ju dërgojmë njoftime. Njoftimet mund t'i lejoni në rregullimet e shfletuesit tuaj. ","disable":"Çaktivizoni njoftimet","enable":"Aktivizoni njoftimet","each_browser_note":"Shënim: Duhet të ndryshoni këtë rregullim (setting) në çdo shfletues që përdorni. "},"dismiss_notifications":"Hiqini të gjitha","dismiss_notifications_tooltip":"Shëno njoftimet e palexuara si të lexuara","disable_jump_reply":"Mos shko tek postimi im pasi përgjigjem","dynamic_favicon":"Tregoni numrin e temave të reja e azhornuara në ikonën e shfletuesit","external_links_in_new_tab":"Hap të gjitha lidhjet e jashtme në një tab të ri","enable_quoting":"Aktivizo citimin në përgjigje për tekstin e përzgjedhur","change":"ndrysho","moderator":"{{user}} është moderator","admin":"{{user}} është admin","moderator_tooltip":"Ky anëtar është moderator","admin_tooltip":"Ky anëtar është administrator","blocked_tooltip":"Ky anëtar është i bllokuar","suspended_notice":"Ky anëtarë është përjashtuar deri më {{date}}.","suspended_reason":"Arsyeja:","github_profile":"Github","email_activity_summary":"Përmbledhja e aktivitetit","mailing_list_mode":{"daily":"Dërgo njoftime të përditshme","individual":"Dërgo një email për çdo postim të ri","many_per_day":"Më dërgo një email për çdo postim të ri (rreth {{dailyEmailEstimate}} në ditë)","few_per_day":"Më dërgo një email për çdo postim të ri (rreth 2 në ditë)"},"tag_settings":"Etiketat","watched_tags":"Vëzhguar","watched_tags_instructions":"Ju do të vëzhgoni automatikisht të gjitha temat nën këtë etiketë. Do të njoftoheni për çdo postim e temë të re, dhe numri i postimeve të reja të palexuara do të afishohet ngjitur me titullin e temës përgjatë listave të faqes. ","tracked_tags":"Gjurmuar","tracked_tags_instructions":"Ju do të gjurmoni automatikisht të gjitha temat nën këtë etiketë. Numri i përgjigjeve të palexuara do të afishohet ngjitur me titullin e temës. ","muted_tags":"Të heshtur","muted_tags_instructions":"Ju nuk do të njoftoheni për asgjë nga temat e reja të këtyre etiketave, dhe këto tema nuk do të afishohen në faqen \"Më të fundit\" për ju. ","watched_categories":"Shikuar","watched_categories_instructions":"Ju do të vëzhgoni automatikisht të gjitha temat nën këtë kategori. Do të njoftoheni për çdo postim e temë të re, dhe numri i postimeve të reja të palexuara do të afishohet ngjitur me titullin e temës. ","tracked_categories":"Gjurmuar","tracked_categories_instructions":"Ju do të gjurmoni automatikisht të gjitha temat nën këtë kategori. Numri i përgjigjeve të palexuara do të afishohet ngjitur me titullin e temës. ","watched_first_post_categories":"Postimi i parë nën vëzhgim","watched_first_post_categories_instructions":"Ju do të njoftoheni vetëm për postimin e parë të çdo teme nën këto kategori.","watched_first_post_tags":"Postimi i parë nën vëzhgim","watched_first_post_tags_instructions":"Ju do të njoftoheni vetëm për postimin e parë të çdo teme nën këto etiketa.","muted_categories":"Pa njoftime","muted_categories_instructions":"Ju nuk do të njoftoheni për asgjë nga temat e reja të këtyre kategorive, dhe këto tema nuk do të afishohen në faqen \"Më të fundit\" për ju. ","delete_account":"Fshi llogarinë time","delete_account_confirm":"Jeni i sigurtë që dëshironi ta mbyllni përgjithmonë llogarinë tuaj? Ky veprim nuk mund të zhbëhet!","deleted_yourself":"Llogaria juaj u fshi me sukses.","unread_message_count":"Mesazhet","admin_delete":"Fshi","users":"Anëtarët","muted_users":"Të heshtur","muted_users_instructions":"Çaktivizo të gjitha njoftimet nga këta anëtarë.","muted_topics_link":"Trego temat e heshtura","watched_topics_link":"Trego temat e vëzhguara","automatically_unpin_topics":"Çngjiti temat automatikisht kur arrij fundin e faqes.","staff_counters":{"flags_given":"sinjalizime të dobishme","flagged_posts":"postimet e raportuara","deleted_posts":"postimet e fshira","suspensions":"pezullimet","warnings_received":"paralajmërimet"},"messages":{"all":"Të gjitha","inbox":"Inbox","sent":"Të dërguara","archive":"Arkivi","groups":"Grupet e mia","bulk_select":"Zgjidh mesazhet","move_to_inbox":"Transfero në inbox","move_to_archive":"Arkivo","failed_to_move":"Nuk i transferuam dot mesazhet e zgjedhura (ka mundësi që të jeni shkëputur nga rrjeti)","select_all":"Zgjidh të gjitha"},"change_password":{"success":"(emaili u dërgua)","in_progress":"(duke dërguar emailin)","error":"(gabim)","action":"Dërgo email për të rivendosur fjalëkalimin","set_password":"Vendos fjalëkalim"},"change_about":{"title":"Ndrysho Rreth meje","error":"Pati një gabim gjatë ndryshimit të kësaj të dhëne."},"change_username":{"title":"Ndrysho emrin e përdoruesit","confirm":"Nëse ndryshoni emrin e përdoruesit të gjitha citimet e mëparshme dhe përmendjet @emër do të prishen. A jeni 100% të sigurtë që doni të ndryshoni emrin?","taken":"Na vjen keq, por ky emër është i zënë.","error":"Ndodhi një gabim gjatë ndryshimit të emrit.","invalid":"Emri i përdoruesit nuk është i vlefshëm. Duhet të përmbaje vetëm shkronja ose numra"},"change_email":{"title":"Ndrysho email","taken":"Na vjen keq, por ky email nuk është i disponueshëm.","error":"Hasëm një gabim gjatë ndryshimit të adresës email. Mos vallë është në përdorim nga dikush tjetër?","success":"Ju dërguam një email tek adresa që shkruajtët. Ju ftojmë të ndiqni udhëzimet e konfirmimit."},"change_avatar":{"title":"Ndrysho fotografinë e profilit","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, bazur në","gravatar_title":"Ndryshoni avatarin tuaj në faqen web të shërbimit Gravatar","refresh_gravatar_title":"Rifreskoni Gravatarin tuaj","letter_based":"Foto e profilit e caktuar nga sistemi","uploaded_avatar":"Foto e personalizuar","uploaded_avatar_empty":"Shto një foto të personalizuar","upload_title":"Ngarkoni foton tuaj","upload_picture":"Ngarko Foto","image_is_not_a_square":"Vini re: fotoja juaj është përshtatur, pasi nuk ishte katrore.","cache_notice":"Fotografia e profilit tuaj u ndryshua por paraqitja në faqe mund të vonohet, për shkak të ruajtjes në memorjen \"cache\" të shfletuesit tuaj. "},"change_profile_background":{"title":"Sfondi i profilit","instructions":"Sfondi i profilit do të vendoset në qendër dhe do të ketë një gjerësi prej 850px."},"change_card_background":{"title":"Sfondi për skedën e anëtarit","instructions":"Sfondi do të vendoset në qendër dhe do të ketë një gjerësi prej 590px."},"email":{"title":"Email","instructions":"Nuk do të shfaqet asnjëherë publikisht","ok":"Do ju nisim emailin e konfirmimit","invalid":"Ju lutemi të vendosni një email të vlefshëm","authenticated":"Emaili juaj është verifikuar nga {{provider}}","frequency":{"one":"Do t'ju dërgojmë një email vetëm nëse nuk të kemi parë në faqe në minutën e fundit.","other":"Do t'ju dërgojmë një email vetëm nëse nuk të kemi parë në faqe në {{count}} minutat e fundit."}},"name":{"title":"Emri juaj","instructions":"Emri i plotë (fakultativ)","instructions_required":"Emri i plotë","too_short":"Emri juaj është shumë i shkurtër","ok":"Emri duket në rregull"},"username":{"title":"Emri i përdoruesit","instructions":"Unik, pa hapësira, i shkurtër","short_instructions":"Anëtarët e tjerë mund t'ju përmendin si @{{username}}","available":"Emri është i disponueshëm","global_mismatch":"Jeni regjistruar më parë. Provoni {{suggestion}}?","not_available":"Nuk është i disponueshëm. Provoni {{suggestion}}?","too_short":"Emri juaj është shumë i shkurtër","too_long":"Emri juaj është shumë i gjatë","checking":"Duke verifikuar disponibilitetin e emrit të përdoruesit....","enter_email":"Emri i përdoruesit u gjet; vendosni emailin përkatës"},"locale":{"title":"Gjuha e faqes","instructions":"Gjuha e faqes për përdoruesin. Do tue ndryshoj pasi të rifreskoni faqen. ","default":"(paracaktuar)"},"password_confirmation":{"title":"Rishkruani fjalëkalimin"},"last_posted":"Postimi i fundit","last_emailed":"Emaili i fundit","last_seen":"Parë","created":"Regjistruar","log_out":"Shkëputu","location":"Vendndodhja","card_badge":{"title":"Karta e anëtarit"},"website":"Faqja web","email_settings":"Email","like_notification_frequency":{"title":"Njoftimet e pëlqimeve","always":"Gjithmonë","first_time_and_daily":"Herën e parë që një postim pëlqehet, dhe përditë ","first_time":"Herën e parë që një postim pëlqehet","never":"Asnjëherë"},"email_previous_replies":{"unless_emailed":"nëse ishin dërguar më parë","always":"gjithmonë","never":"asnjëherë"},"email_digests":{"title":"Kur nuk vij shpesh në faqe, më dërgoni një përmbledhje me email të diskutimeve më popullore","every_30_minutes":"çdo 30 minuta","every_hour":"çdo orë","daily":"çdo ditë","every_three_days":"çdo 3 ditë","weekly":"çdo javë","every_two_weeks":"çdo 2 javë"},"include_tl0_in_digests":"Përfshini dhe postime nga anëtarët e rinj","email_in_reply_to":"Përfshi një copëz të përgjigjeve ndaj postimit në email","email_direct":"Më dërgo një email kur dikush më citon, i përgjigjet një postimi tim, më përmend me @username, ose më fton në një temë","other_settings":"Tjetër","categories_settings":"Kategoritë","new_topic_duration":{"label":"Konsidero diskutimin të ri kur","not_viewed":"Nuk i kam shikuar akoma","last_here":"krijuar që herën e fundit që isha këtu","after_1_day":"krijuar në ditën e djeshme","after_2_days":"krijuar në 2 ditët e shkuara","after_1_week":"krijuar në javën e shkuar","after_2_weeks":"krijuar në 2 javët e shkuara"},"auto_track_topics":"Ndiq automatikisht temat ku futem","auto_track_options":{"never":"asnjëherë","immediately":"menjëherë","after_30_seconds":"pas 30 sekondash","after_1_minute":"pas 1 minute","after_2_minutes":"pas 2 minutash","after_3_minutes":"pas 3 minutash","after_4_minutes":"pas 4 minutash","after_5_minutes":"pas 5 minutash","after_10_minutes":"pas 10 minutash"},"invited":{"search":"shkruaj për të kërkuar ftesat...","title":"Ftesat","user":"Anëtari i ftuar","sent":"Dërguar","none":"Nuk keni asnjë ftesë në pritje. ","truncated":{"one":"Po afishohet ftesa e parë.","other":"Po afishohen {{count}} ftesat e para."},"redeemed":"Ftesa të Shlyera","redeemed_tab":"Shlyer","redeemed_tab_with_count":"Shlyer ({{count}})","redeemed_at":"Shlyer","pending":"Ftesat në pritje","pending_tab":"Në pritje","pending_tab_with_count":"Në pritje ({{count}})","topics_entered":"Temat e shikuara","posts_read_count":"Postimet e lexuara","expired":"Kjo ftesë ka skaduar.","rescind":"Hiq","rescinded":"Ftesa u hoq","reinvite":"Ridërgo ftesën","reinvite_all":"Ridërgo të gjitha ftesat","reinvited":"Ftesa u ri-dërgua","reinvited_all":"Tê gjitha ftesat u dërguan sërish!","time_read":"Koha e leximit","account_age_days":"Jetëgjatësia e llogarisë (ditë)","create":"Dërgo një ftesë","generate_link":"Kopjo lidhjen e ftesës","generated_link_message":"\u003cp\u003eLidhja e ftesës u krijua!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eKjo ftesë është e vlefshme veto për adresën email: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Ju nuk keni ftuar askënd deri tani. Mund të dërgoni ftesa individuale ose mund të ftoni një grup personash duke \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003engarkuar skedarin\u003c/a\u003e.","text":"Skedari për ftesat në grup","uploading":"Duke ngarkuar..."}},"password":{"title":"Fjalëkalimi","too_short":"Fjalëkalimi është shumë i shkurër.","common":"Ky fjalëkalim është shumë i përdorur.","same_as_username":"Fjalëkalimi është i njëjtë me emrin e përdoruesit.","same_as_email":"Fjalëkalimi është i njëjtë me adresën email.","ok":"Fjalëkalimi është i pranueshëm.","instructions":"Të paktën %{count} shkronja."},"summary":{"title":"Përmbledhja","stats":"Statistikat","time_read":"koha e leximit","topic_count":{"one":"temë e krijuar","other":"tema të krijuara"},"post_count":{"one":"postim i krijuar","other":"postime të krijuara"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dhënë","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e dhënë"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e marrë","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e marrë"},"days_visited":{"one":"ditë që viziton faqen","other":"ditë që viziton faqen"},"posts_read":{"one":"postim i lexuar","other":"postime të lexuar"},"bookmark_count":{"one":"temë e preferuar","other":"tema të preferuara"},"top_replies":"Përgjigjet popullore","no_replies":"Nuk ka ende përgjigje.","more_replies":"Më shumë përgjigje","top_topics":"Temat popullore","no_topics":"Nuk ka ende tema.","more_topics":"Më shumë tema","top_badges":"Stemat Kryesore","no_badges":"Ende asnjë stemë.","more_badges":"Më shumë Stema","top_links":"Lidhjet Top","no_links":"Nuk ka ende lidhje.","most_liked_by":"Pëlqyer më shumë nga","most_liked_users":"Më të pëlqyer","most_replied_to_users":"Me më shumë përgjigje","no_likes":"Nuk ka ende asnjë pëlqim."},"associated_accounts":"Identifikime","ip_address":{"title":"Adresa IP e fundit"},"registration_ip_address":{"title":"Adresa IP e regjistrimit"},"avatar":{"title":"Foto e profilit","header_title":"profili, mesazhet, të preferuarat dhe preferencat"},"title":{"title":"Titulli"},"filters":{"all":"Të gjitha"},"stream":{"posted_by":"Postuar nga","sent_by":"Dërguar nga","private_message":"mesazhi","the_topic":"tema"}},"loading":"Duke ngarkuar...","errors":{"prev_page":"duku u munduar të ngarkohet","reasons":{"network":"Gabim në rrjet","server":"Gabim në server","forbidden":"Ndalohet hyrja","unknown":"Gabim","not_found":"Faqja nuk u gjet"},"desc":{"network":"Ju lutemi, kontrolloni lidhjen me Internetin.","network_fixed":"Duket sikur Interneti u kthye.","server":"Kodi i gabimit: {{status}}","forbidden":"Nuk keni të drejtë të shikoni këtë.","not_found":"Ups, aplikimi tentoi të hapë një URL që nuk ekziston. ","unknown":"Diçka shkoi keq."},"buttons":{"back":"Kthehu mbrapa","again":"Provo përsëri","fixed":"Ngarko faqen"}},"close":"Mbyll","assets_changed_confirm":"Faqja u azhornua. Doni t'a rifreskoni tani për versionin e fundit?","logout":"Ju jeni shkëputur!","refresh":"Rifresko","read_only_mode":{"enabled":"Faqja lejon vetëm leximet per momentin. Mund të vazhdoni të shfletoni, por përgjigjet, pëlqimet dhe veprime të tjera janë të çaktivizuara përkohësisht."},"too_few_topics_and_posts_notice":"Hajt ta nisim \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003embarë diskutimin!\u003c/a\u003e Keni krijuar \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tema dhe \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e postime në faqe. Vizitorët e rinj të faqes kanë nevojë për diskutime në faqe. ","too_few_topics_notice":"Hajt ta nisim \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003embarë diskutimin!\u003c/a\u003e Keni krijuar \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tema. Vizitorët e rinj të faqes kanë nevojë për diskutime në faqe. ","too_few_posts_notice":"Hajt ta nisim \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003embarë diskutimin!\u003c/a\u003e Keni krijuar \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e postime në faqe. Vizitorët e rinj të faqes kanë nevojë për diskutime në faqe. ","logs_error_rate_notice":{"rate":{"one":"1 gabim/%{duration}","other":"%{count} gabime/%{duration}"}},"learn_more":"mëso më shumë...","year":"vit","year_desc":"temat e krijuara në 365 ditët e fundit","month":"muaj","month_desc":"temat e krijuara në 30 ditët e fundit","week":"javë","week_desc":"temat e krijuara në 7 ditët e fundit","day":"ditë","first_post":"Postimi i parë","unmute":"Çaktivizo heshtjen","last_post":"Postimi i fundit","last_reply_lowercase":"përgjigja e fundit","replies_lowercase":{"one":"përgjigje","other":"përgjigje"},"signup_cta":{"sign_up":"Regjistrohu","hide_session":"Më rikujto nesër","hide_forever":"jo faleminderit","hidden_for_session":"OK, do t'ju rikujtojmë nesër. Sidoqoftë, ju mund të përdorni butonin \"Identifikohu\" për të hapur një llogari. ","intro":"Njatjeta! :heart_eyes: Sikur po ju pëlqen diskutimi... po s'jeni anëtarësuar akoma në faqe. ","value_prop":"Kur krijoni një llogari në faqe, sistemi mban mend se çfarë keni lexuar, që të mund të riktheheni aty ku e latë. Ju ofrojmë gjithashtu njoftime në shfletues ose me email, sa herë që ka postime të reja. :heartbeat:"},"summary":{"enabled_description":"Po lexoni një përmbledhje të kësaj teme: postimet më interesante sipas vlerësimit të komunitetit.","description":"Ka \u003cb\u003e{{replyCount}}\u003c/b\u003e përgjigje.","description_time":"Ka \u003cb\u003e{{replyCount}}\u003c/b\u003e përgjigje, do ju duhen rreth \u003cb\u003e{{readingTime}} minuta për t'i lexuar\u003c/b\u003e.","enable":"Përmbidhë këtë temë","disable":"Shfaq të gjithë postimet"},"deleted_filter":{"enabled_description":"Kjo temë përmban postime të fshira, që tani janë fshehur.","disabled_description":"Postimet e fshira në këtë temë janë të dukshme.","enable":"Fshehi postimet e fshira","disable":"Trego postimet e fshira"},"private_message_info":{"title":"Mesazh","invite":"Fto të tjerë...","remove_allowed_group":"Doni me të vërtetë të hiqni {{name}} nga ky mesazh? "},"email":"Email","username":"Emri i përdoruesit","last_seen":"Shikuar","created":"Krijuar","created_lowercase":"krijuar","trust_level":"Niveli i besimit","search_hint":"emri i anëtarit, email ose adresë IP","create_account":{"title":"Regjistrohuni","failed":"Diçka nuk funksionoi siç duhet, mbase kjo adresë emaili është e regjistruar në faqe. Provoni butonin e fjalëkalimit të humbur. "},"forgot_password":{"title":"Rivendos fjalëkalimin","action":"Kam harruar fjalëkalimin","invite":"Shkruani emrin e përdoruesit ose adresen email dhe ne do t'ju nisim një email për të rivendosur një fjalëkalim të ri.","reset":"Rivendos fjalëkalimin"},"login":{"title":"Identifikohu","username":"Anëtari","password":"Fjalëkalimi","email_placeholder":"email ose emri i përdoruesit","caps_lock_warning":"Caps Lock është aktive","error":"Gabim i panjohur","rate_limit":"Ju lutemi të prisni para se të provoni të identifikoheni përsëri. ","blank_username_or_password":"Ju lutem, shkruani adresën email ose emrin e përdoruesit dhe fjalëkalimin.","reset_password":"Rivendos fjalëkalimin","logging_in":"Duke u identifikuar...","or":"Ose","authenticating":"Duke u autorizuar...","awaiting_confirmation":"Llogaria juaj është në pritje të aktivizimit, përdorni butonin e fjalëkalimit të humbur që të merrni një email të ri me kodin e aktivizimit.","awaiting_approval":"Llogaria juaj nuk është aprovuar ende nga një admin. Do t'ju dërgojmë një email kur të aprovohet. ","requires_invite":"Na vjen keq, ky forum është vetëm për anëtarë të ftuar. ","resend_activation_email":"Klikoni këtu për të dërguar sërish email-in e aktivizimit.","to_continue":"Ju lutemi, identifikohuni","forgot":"Nuk i mbaj mend detajet e llogarisë","google":{"title":"me Google"},"google_oauth2":{"title":"me Google"},"twitter":{"title":"me Twitter","message":"Duke u identifikuar me Twitter (çaktivizoni bllokuesit e popupeve, nëse i përdorni)"},"facebook":{"title":"me Facebook","message":"Duke u identifikuar me Facebook (çaktivizoni bllokuesit e popupeve, nëse i përdorni)"},"yahoo":{"title":"me Yahoo"},"github":{"title":"me GitHub"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"më shumë...","options":"Opsione","whisper":"pëshpëritje","unlist":"çlistuar","add_warning":"Ky është një paralajmërim zyrtar.","toggle_whisper":"Hiq pëshpëritjet","posting_not_on_topic":"Cilës temë doni t'i përgjigjeni?","saving_draft_tip":"duke e ruajtur...","saved_draft_tip":"ruajtur","saved_local_draft_tip":"ruajtur lokalisht","similar_topics":"Tema juaj është e ngjashme me...","drafts_offline":"draftet offline","duplicate_link":"Lidhja drejt \u003cb\u003e{{domain}}\u003c/b\u003e duket sikur u postua më par¨´nga \u003cb\u003e@{{username}}\u003c/b\u003e në \u003ca href='{{post_url}}'\u003ekëtë përgjigje {{ago}}\u003c/a\u003e – a doni ta postoni sërish?","error":{"title_missing":"Titulli është i nevojshëm","title_too_short":"Titulli duhet të ketë të paktën {{min} shkronja.","title_too_long":"Titulli nuk mund të ketë më shumë se {{max}} shkronja","post_missing":"Postimi s'mund të jetë bosh","post_length":"Postimi duhet të ketë të paktën {{min} shkronja.","try_like":"A e keni provuar butonin \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e ?","category_missing":"Duhet të zgjidhni një kategori"},"save_edit":"Ruani modifikimet","reply_original":"Përgjigjuni temës origjinale","reply_here":"Përgjigju këtu","reply":"Përgjigju","cancel":"Anulo","create_topic":"Krijo temën","create_pm":"Mesazh","title":"Ose shtyp Ctrl+Enter","users_placeholder":"Shto një anëtar","title_placeholder":"Në një fjali të shkurtër shpjegoni për çfarë bën fjalë tema","edit_reason_placeholder":"pse jeni duke e redaktuar?","show_edit_reason":"(vendosni arsyen e redaktimit)","reply_placeholder":"Shkruani këtu. Mund të përdorni Markdown, BBCode, ose kod HTML për formatimin. Tërhiqni (drag and drop) ose kopjoni dhe ngjisni imazhet. ","view_new_post":"Shikoni postimin tuaj të ri.","saving":"Duke e ruajtur","saved":"U ruajt!","saved_draft":"Keni një postim në shkrim e sipër. Kikoni për të vazhduar. ","uploading":"Duke ngarkuar...","show_preview":"tregoni panelin e parashikimit \u0026raquo;","hide_preview":"\u0026laquo; fshiheni panelin e parashikimit","quote_post_title":"Citoni të gjithë postimin","bold_title":"Trashë","bold_text":"tekst i trashë","italic_title":"Theksuar","italic_text":"tekst i theksuar","link_title":"Lidhje","link_description":"shkruaj përshkrimin e lidhjes këtu","link_dialog_title":"Vendosni një lidhje","link_optional_text":"titull fakultativ","link_url_placeholder":"http://shembull.com","quote_title":"Citim","quote_text":"Citim","code_title":"Tekst i paraformatuar","code_text":"shkruani 4 hapësira (space) për të filluar tekstin e paraformatuar","paste_code_text":"shkruani ose ngjisni kodin këtu","upload_title":"Ngarko","upload_description":"shkruaj përshkrimin e skedarit të ngarkuar këtu","olist_title":"Listë e numëruar","ulist_title":"Listë me pika","list_item":"Element liste","heading_title":"Titull","heading_text":"Titull","hr_title":"Vizë ndarëse horizontale","help":"Ndihmë mbi Markdown","toggler":"trego ose fshih panelin e shkrimit","modal_ok":"OK","modal_cancel":"Anulo","cant_send_pm":"Na vjen keq, nuk mund t'i dërgoni mesazh privat anëtarit %{username}.","yourself_confirm":{"title":"Mos harruat të shtonit marrësit?","body":"Për momentin ky mesazh po ju dërgohet vetëm juve!"},"admin_options_title":"Rregullime opsionale të stafit për këtë temë","auto_close":{"label":"Data e mbylljes automatike të temës:","error":"Ju lutem shkruani një vlerë të vlefshme.","based_on_last_post":"Mos e mbyll derisa postimi i fundit brenda temës të jetë të paktën kaq i vjetër. ","all":{"examples":"Vendosni numrin e orëve (24), orën absolute (17:30) ose një \"timestamp\" (2013-11-22 14:00)."},"limited":{"units":"(# i orëve)","examples":"Vendosni numrin e orëve (24)."}}},"notifications":{"title":"njoftimet për përmendjet @emri, përgjigjet ndaj postime dhe temave, mesazhet, etj.","none":"Nuk i hapëm dot njoftimet.","empty":"Nuk u gjet asnjë njoftim. ","more":"shiko njoftimet e kaluara","total_flagged":"totali i postimeve të sinjalizuar","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='pëlqeu' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='pëlqeu' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='pëlqeu' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} dhe 1 tjetër\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='pëlqeu' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} dhe {{count}} të tjerë\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e pranoi ftesën tuaj\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e transferoi {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eFituar '{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eTemë e re\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} mesazhe në inboxin e {{group_name}}\u003c/p\u003e"},"alt":{"mentioned":"Përmendur nga","quoted":"Cituar nga","replied":"Përgjigjur","posted":"Postim nga","edited":"Redakto postimin tuaj","liked":"Pëlqeu postimin tuaj","private_message":"Mesazh privat nga","invited_to_private_message":"I/e ftuar në një mesazh privat nga","invited_to_topic":"I/e ftuar në temë nga","invitee_accepted":"Ftesa u pranua nga","moved_post":"Postimi juaj u transferua nga","linked":"Lidhja drejt postimit tuaj","granted_badge":"Stema u dhurua","group_message_summary":"Mesazhet në inboxin e grupit"},"popup":{"mentioned":"{{username}} ju përmendi në \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} ju përmendi në \"{{topic}}\" - {{site_title}}","quoted":"{{username}} ju ka cituar në \"{{topic}}\" - {{site_title}}","replied":"{{username}} ju u përgjigj në \"{{topic}}\" - {{site_title}}","posted":"{{username}} postoi në \"{{topic}}\" - {{site_title}}","private_message":"{{username}} ju dërgoi një mesazh privat nga \"{{topic}}\" - {{site_title}}","linked":"{{username}} vendosi një lidhje për postimin tuaj nga \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Shto një imazh","title_with_attachments":"Shto një imazh ose një skedar","from_my_computer":"Nga kompiuteri im","from_the_web":"Nga Interneti","remote_tip":"lidhje tek imazhi","uploading":"Duke ngarkuar","select_file":"Zgjdhni një Skedar"},"search":{"sort_by":"Rendit sipas","most_liked":"Më të pëlqyer","select_all":"Zgjidhni Gjithçka","result_count":{"one":"1 rezultat për \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} rezultate për \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"kërko në faqe","no_results":"Nuk u gjet asnjë rezultat.","searching":"Duke kërkuar...","context":{"user":"Kërko postime nga @{{username}}","category":"Kërkoni kategorinë #{{category}}","topic":"Kërko tek kjo temë"}},"hamburger_menu":"shko tek një kategori ose një listë e re temash","new_item":"e re","go_back":"kthehu mbrapa","topics":{"bulk":{"reset_read":"Reseto leximet","delete":"Fshi temat","dismiss_tooltip":"Hiq veç postimet e reja ose ndalo së ndjekuri temat","dismiss_new":"Hiq të Rejat","actions":"Veprime në masë","change_category":"Ndrysho kategori","close_topics":"Mbyll temat","archive_topics":"Arkivo temat","notification_level":"Ndrysho nivelin e njoftimeve","choose_new_category":"Zgjidhni kategorinë e re për temat: ","selected":{"one":"Keni zgjedhur \u003cb\u003e1\u003c/b\u003e temë.","other":"Keni zgjedhur \u003cb\u003e{{count}}\u003c/b\u003e tema."},"change_tags":"Ndrysho etiketat","choose_new_tags":"Zgjidh etiketa të reja për këto tema:","changed_tags":"Etiketat e temave u ndryshuan. "},"none":{"unread":"Nuk keni tema të palexuara.","new":"Nuk ka tema të reja.","read":"Nuk keni lexuar asnjë temë deri tani.","posted":"Nuk keni shkruajtur tek asnjë temë deri tani.","latest":"Nuk ka tema të fundit. Oh sa keq.","hot":"Nuk ka tema të nxehta.","bookmarks":"Nuk keni ende tema të preferuara. ","category":"Nuk ka tema në: {{category}}.","top":"Nuk ka tema popullore.","educate":{"new":"\u003cp\u003eTemat e reja shfaqen këtu.\u003c/p\u003e\u003cp\u003eAutomatikisht, temat cilësohen si të reja dhe kanë një shënim \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003ei ri\u003c/span\u003e nëse janë krijuar gjatë dy ditëve të fundit.\u003c/p\u003e\u003cp\u003eVizitoni \u003ca href=\"%{userPrefsUrl}\"\u003epreferencat\u003c/a\u003e për t'a ndryshuar këtë parametër.\u003c/p\u003e","unread":"\u003cp\u003eTemat e palexuara shfaqen këtu.\u003c/p\u003e\u003cp\u003eAutomatkisht, temat klasifikohen si të palexuara dhe kanë etiketa me numër \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e nëse ju:\u003c/p\u003e\u003cul\u003e\u003cli\u003ekrijuat temën\u003c/li\u003e\u003cli\u003eiu përgjigjët temës\u003c/li\u003e\u003cli\u003elexuat temën për më shumë se 4 minuta\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOse nëse keni zgjedhur të Gjurmoni ose Vëzhgoni temën duke klikuar në butonin përkatës në fund të çdo teme.\u003c/p\u003e\u003cp\u003eVizitoni \u003ca href=\"%{userPrefsUrl}\"\u003epreferencat tuaja\u003c/a\u003e për të bër ndryshime.\u003c/p\u003e"}},"bottom":{"latest":"Nuk ka më tema të reja.","hot":"Nuk ka më tema të nxehta.","posted":"Nuk ka më tema të publikuara.","read":"Nuk ka më tema të lexuara.","new":"Nuk ka më tema të reja.","unread":"Nuk ka më tema të palexuara.","category":"Nuk ka më tema nga {{category}}.","top":"Nuk ka më tema popullore.","bookmarks":"Nuk ka më tema të preferuara."}},"topic":{"unsubscribe":{"stop_notifications":"Tani ju do të merrni më pak njoftime për \u003cstrong\u003e{{title}}\u003c/strong\u003e"},"create":"Temë e re","create_long":"Hap një temë të re","private_message":"Fillo një mesazh","archive_message":{"help":"Zhvendoseni mesazhin në arkivën tuaj","title":"Arkivoni"},"move_to_inbox":{"title":"Lëviz në Inbox","help":"Riktheje mesazhin në inbox"},"list":"Temat","new":"temë e re","new_topics":{"one":"1 temë e re","other":"{{count}} tema të reja"},"unread_topics":{"one":"1 temë e palexuar","other":"{{count}} tema të palexuara"},"title":"Tema","invalid_access":{"title":"Tema është private","description":"Na vjen keq, por nuk keni akses tek kjo temë. ","login_required":"Duhet të identifikoheni për të parë këtë temë. "},"server_error":{"title":"Temën nuk e hapëm dot","description":"Na vjen keq, nuk arritëm t'a ngarkojmue këtë temë, problem serveri. Provoni përsëri më vonë. Nëse problemi vazhdon, ju lutemi të na njoftoni. "},"not_found":{"title":"Tema nuk u gjet","description":"Na vjen keq, nuk e gjetëm dot temën. Mund të jetë fshirë nga një moderator... "},"total_unread_posts":{"one":"ju keni 1 postim të palexuar në këtë temë","other":"ju keni {{count}} postime të palexuara në këtë temë"},"unread_posts":{"one":"ju keni 1 postim të vjetër të palexuar në këtë temë","other":"ju keni {{count}} postime të vjetra të palexuara në këtë temë"},"new_posts":{"one":"ka 1 postim të ri në këtë temë që nga hera e fundit që ishit këtu","other":"ka {{count}} postime të reja në këtë temë që nga hera e fundit që ishit këtu"},"likes":{"one":"ka 1 pëlqim në këtë temë","other":"ka {{count}} pëlqime në këtë temë"},"back_to_list":"Kthehu tek lista e temave","options":"Opsionet e temës","show_links":"trego lidhjet në këtë temë","toggle_information":"më shumë mbi temën","read_more_in_category":"Dëshironi të lexoni më shumë? Shfleto temat në {{catLink}} ose {{latestLink}}.","read_more":"Dëshironi të lexoni më shumë? {{catLink}} ose {{latestLink}}.","browse_all_categories":"Shfleto kategoritë","view_latest_topics":"shiko temat më të fundit","suggest_create_topic":"Pse nuk hapni një temë të re?","deleted":"Tema është fshirë","auto_close_notice":"Kjo temë do të mbyllet automatikisht %{timeLeft}.","auto_close_notice_based_on_last_post":"Kjo temë do të mbyllet %{duration} pas përgjigjes së fundit. ","auto_close_title":"Rregullimet e Mbylljes Automatike","auto_close_save":"Ruaj","auto_close_remove":"Mos e Mbyll Automatikisht Këtë Temë","timeline":{"back":"Kthehu mbrapa","back_description":"Kthehu mbrapa tek postimi i fundit i palexuar","replies_short":"%{current} / %{total}"},"progress":{"title":"progresi i temës","go_top":"sipër","go_bottom":"poshtë","go":"shko","jump_prompt":"hidhu tek tema","jump_prompt_long":"Tek cila temë doni të shkoni?","total":"totali i postimeve","current":"postimi aktual"},"notifications":{"title":"ndryshoni sa shpesh njoftoheni mbi këtë temë","reasons":{"3_6":"Ju do të merrni njoftime sepse jeni duke vëzhguar këtë kategori. ","3_5":"Ju do të njoftoheni duke qënë se jeni duke gjurmuar këtë temë automatikisht. ","3_2":"Ju do të njoftoheni duke qënë se jeni duke vëzhguar këtë temë. ","3_1":"Ju do të njoftoheni duke qënë se ju jeni autori i kësaj teme. ","3":"Ju do të njoftoheni duke qënë se jeni duke vëzhguar këtë temë. ","2_8":"Ju do të njoftoheni duke qënë se jeni duke gjurmuar këtë kategori. ","2_4":"Ju do të njoftoheni duke qënë se keni dërguar një përgjigje në këtë temë. ","2_2":"Ju do të njoftoheni duke qënë se jeni duke gjurmuar këtë temë. ","2":"Ju do të merrni njoftime sepse e keni \u003ca href=\"/users/{{username}}/preferences\"\u003elexuar këtë temë\u003c/a\u003e.","1_2":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. ","1":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. ","0_7":"Ju nuk do të merrni asnjë njoftim për temat në këtë kategori. ","0_2":"Ju nuk do të merrni asnjë njoftim për këtë temë. ","0":"Ju nuk do të merrni asnjë njoftim për këtë temë. "},"watching_pm":{"title":"Në vëzhgim","description":"Ju do të njoftoheni për çdo përgjigje të re në këtë mesazh, dhe numri i përgjigjeve të reja do të shfaqet. "},"watching":{"title":"Në vëzhgim","description":"Ju do të njoftoheni për çdo postim të ri në këtë temë, dhe numri i ri i përgjigjeve të reja do të tregohet."},"tracking_pm":{"title":"Në gjurmim","description":"Numri i përgjigjeve të reja do të afishohet për këtë mesazh. Do të njoftoheni vetëm nëse dikush ju përmend @emrin apo nëse dikush ju përgjigjet juve. "},"tracking":{"title":"Në gjurmim","description":"Numri i përgjigjeve të reja në këtë temë do të afishohet në listat e faqes. Do të njoftoheni nëse dikush ju përmend @emrin ose ju përgjigjet. "},"regular":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. "},"regular_pm":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. "},"muted_pm":{"title":"Pa njoftime","description":"Ju nuk do të njoftoheni kurrë mbi këtë mesazh. "},"muted":{"title":"Pa njoftime","description":"Ju nuk do të njoftoheni për asgjë mbi këtë temë, dhe tema nuk do të shfaqet në listën e temave më të fundit. "}},"actions":{"recover":"Rivendos temën","delete":"Fshi temën","open":"Hap temën","close":"Mbyll temën","multi_select":"Përzgjidhni Postimet...","auto_close":"Mbylle Automatikisht...","pin":"Ngjite temën...","unpin":"Çngjite temën...","unarchive":"Çarkivoje temën","archive":"Arkivoje temën","invisible":"Hiqeni nga Listat","visible":"Listojeni","make_public":"Bëje temën publike","make_private":"Bëje mesazh privat"},"feature":{"pin":"Ngjite temën","unpin":"Çngjite temën","pin_globally":"Ngjite temën globalisht","make_banner":"Temë banderolë","remove_banner":"Çaktivizo temën banderolë"},"reply":{"title":"Përgjigju","help":"shkruaj një përgjigje tek kjo temë"},"clear_pin":{"help":"Hiqeni statusin \"e ngjitur\" të kësaj teme që të mos afishohet më në majë të listës së temave"},"share":{"title":"Shpërndaje","help":"shpërndani një lidhje mbi temën"},"flag_topic":{"title":"Sinjalizo","help":"sinjalizo privatisht këtë temë ose dërgo një njoftim privat","success_message":"Sinjalizimi juaj i kësaj teme u krye me sukses. "},"feature_topic":{"title":"Temë në plan të parë","confirm_pin":"Ju tashmë keni {{count}} tema të përzgjedhura. Shumë tema të përzgjedhura mund të bëhen barrë për përdorues të rinj dhe anonimë. A jeni i sigurtë që dëshironi ta përzgjidhni një temë tjetër në këtë kategori?","not_pinned":"Nuk ka tema të përzgjedhura në {{categoryLink}}.","already_pinned":{"one":"Temat kryesore të momentit në {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Temat kryesore të momentit në {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"confirm_pin_globally":"Ju tashmë keni {{count}} tema të përzgjedhura. Shumë tema të përzgjedhura mund të bëhen barrë për përdorues të rinj dhe anonimë. A jeni i sigurtë që dëshironi ta përzgjidhni një temë tjetër të gjithanëshme?","not_pinned_globally":"Nuk ka tema të përzgjedhura kudo.","already_pinned_globally":{"one":"Të gjitha temat kryesore të momentit: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Të gjitha temat kryesore të momentit: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"banner_exists":"Për momentin \u003cstrong class='badge badge-notification unread'\u003eka\u003c/strong\u003e një temë parrullë."},"invite_private":{"title":"Ftoje në këtë mesazh","email_or_username":"Emaili ose emri i përdoruesit të të ftuarit","action":"Ftoni","success":"Anëtari u ftua të marrë pjesë në këtë mesazh. ","group_name":"emri grupit"},"invite_reply":{"title":"Ftoni","username_placeholder":"emri i përdoruesit","action":"Dërgoni ftesën","help":"ftoni të tjerë në këtë temë nëpërmjet emailit ose njoftimeve","to_forum":"Do të dërgojmë një email të shkurtër që do ta lejojë mikun tuaj të regjistrohet menjëherë duke klikuar një lidhje, pa kërkuar hyrjen në sistem.","sso_enabled":"Vendosni emrin e përdoruesit që dëshironi të ftoni në këtë temë","to_topic_blank":"Vendosni emrin e përdoruesit ose adresën email të personit që dëshironi të ftoni në këtë temë","to_topic_email":"Ju keni shtuar një adresë email. Ne do t'i dërgojmë një ftesë në email që do ta lejojë mikun tuaj t'i përgjigjet menjëherë kësaj teme.","to_topic_username":"Ju shtuat një emër përdoruesi. Ne do t'i dërgojmë një njoftim me një lidhje duke i ftuar ata në këtë temë.","to_username":"Vendosni emrin e përdoruesit që dëshironi të ftoni. Sistemi do i dërgojë një njoftim me një lidhje drejt kësaj teme. ","email_placeholder":"emri@adresa.com","success_email":"Sistemi dërgoi një ftesë për \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Do t'ju njoftojmë kur ftesa të jetë pranuar. Shikoni edhe faqen Ftesat nën profilin tuaj të anëtarit për të parë statusin e ftesave. ","success_username":"Ky anëtar u ftua të marrë pjesë në këtë temë. ","error":"Nuk e ftuam dot këtë person. A ka mundësi që të jetë ftuar më parë?"},"login_reply":"Identifikohu për t'u përgjigjur","filters":{"n_posts":{"one":"1 postim","other":"{{count}} postime"},"cancel":"Hiq filtrin"},"split_topic":{"instructions":{"one":"Jeni duke krijuar një temë të re dhe duke e populluar atë me postimin që keni përzgjedhur.","other":"Jeni duke krijuar një temë të re dhe duke e populluar atë me \u003cb\u003e{{count}}\u003c/b\u003e postimet që keni përzgjedhur."}},"merge_posts":{"title":"Bashkoni Postimet e Përzgjedhura","action":"bashkoni postimet e përzgjedhura","error":"Ndodhi një gabim ndërsa po bashkoheshin postimet e përzgjedhura."},"change_owner":{"title":"Ndrysho autorin e postimeve","action":"ndrysho zotëruesin","error":"Pati një gabim gjatë ndryshimit të autorit të postimeve.","label":"Autori i ri i postimeve","placeholder":"emri i përdoruesit të autorit"},"change_timestamp":{"title":"Ndrysho Datën","action":"ndrysho datën","invalid_timestamp":"Data nuk mund të jetë në të ardhmen.","error":"Hasëm në një gabim gjatë ndryshimit të datës së temës. ","instructions":"Ju lutem zgjidhni një datë postimi për temën. Postimet në temë do të përditësohen për të patur të njëjtën diferencë kohore."},"multi_select":{"select":"zgjidh","delete":"fshij të përzgjedhurat","cancel":"anulo përzgjedhjen","select_all":"përzgjidhi të gjitha","description":{"one":"Keni përzgjedhur \u003cb\u003e1\u003c/b\u003e postim.","other":"Keni përzgjedhur \u003cb\u003e{{count}}\u003c/b\u003e postime."}}},"post":{"quote_reply":"cito përgjigjen","edit":"Duke modifikuar {{link}} {{replyAvatar}} {{username}}","edit_reason":"Arsyeja:","post_number":"postimi {{number}}","last_edited_on":"redaktimi i fundit u krye më","reply_as_new_topic":"Përgjigju në një temë të re të ndërlidhur","continue_discussion":"Vazhdim i diskutimit nga tema {{postLink}}:","show_full":"Shfaq postimin e plotë","show_hidden":"Shfaq materialin e fshehur.","deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","other":"(postim i tërhequr nga autori, do të fshihet automatikisht në %{count} orë nëse nuk sinjalizohet)"},"gap":{"one":"shiko 1 përgjigje të fshehur","other":"shiko {{count}} përgjigje të fshehura"},"unread":"Postimi është i palexuar","has_replies":{"one":"{{count}} Përgjigje","other":"{{count}} përgjigje"},"has_likes":{"one":"{{count}} Pëlqim","other":"{{count}} pëlqime"},"has_likes_title":{"one":"1 person pëlqeu këtë postim","other":"{{count}} vetë pëlqyen këtë postim"},"has_likes_title_only_you":"ju pëlqeni këtë postim","has_likes_title_you":{"one":"ju dhe 1 person tjetër pëlqyet këtë postim","other":"ju dhe {{count}} të tjerë pëlqyen këtë postim"},"errors":{"create":"Na vjen keq, por ndodhi një gabim gjatë hapjes së temës. Provojeni përsëri.","edit":"Na vjen keq, ndodhi një gabim gjatë redaktimit të temës. Provojeni përsëri.","file_too_large":"Na vjen keq, skedari është shumë i madh (maksimumi i lejuar është {{max_size_kb}}kb). Mund t'a vendosni këtë skedar të madh në një faqe tjetër dhe të vendosni këtu vetëm lidhjen.","too_many_uploads":"Na vjen keq, por duhet t'i ngarkoni skedarët një nga një."},"abandon":{"no_value":"Jo, mbaji","yes_value":"Po, braktise"},"via_email":"ky postim u dërgua me email","via_auto_generated_email":"ky postim u krijua nga një email automatik","archetypes":{"save":"Ruaj opsionet"},"few_likes_left":"Ju falenderojmë! Ju kanë ngelur edhe disa pëlqime për sot.","controls":{"reply":"shkruaj një përgjigje tek ky diskutim","like":"pëlqeje postimin","has_liked":"ju pëlqeni këtë postim","undo_like":"anulo pëlqimin","edit":"redakto këtë postim","edit_anonymous":"Na vjen keq, ju duhet të jeni të identifikuar për të redaktuar këtë postim. ","flag":"sinjalizojeni privatisht këtë postim për të tërhequr vëmendjen e adminëve","delete":"fshini këtë postim","undelete":"anuloni fshirjen e postimit","share":"shpërndani një link tek ky postim","more":"Më shumë","delete_replies":{"confirm":{"one":"A doni të fshini edhe 1 përgjigje direkte ndaj këtij postimi?","other":"A doni të fshini edhe {{count}} përgjigjet direkte ndaj këtij postimi?"},"yes_value":"Po, fshi edhe përgjigjet","no_value":"Jo, vetëm këtë postim"},"admin":"veprimet administrative mbi postimin","wiki":"Bëje Wiki","unwiki":"Hiqe Wiki","convert_to_moderator":"Shto ngjyrë stafi","revert_to_regular":"Hiq ngjyrën e stafit","rebake":"Rindërtoni HTML","change_owner":"Ndrysho zotëruesin"},"actions":{"flag":"Sinjalizoni","undo":{"bookmark":"Hiqe nga të preferuarat","like":"Anulo pëlqimin","vote":"Rikthe votën"},"people":{"like":"pëlqyen këtë"},"by_you":{"like":"Ju e pëlqyet këtë"},"by_you_and_others":{"like":{"one":"Ju dhe 1 person tjetër pëlqyet këtë ","other":"Ju dhe {{count}} të tjerë pëlqyen këtë postim"}},"by_others":{"like":{"one":"1 person pëlqeu këtë postim","other":"{{count}} vetë pëlqyen këtë postim"}}},"merge":{"confirm":{"one":"Jeni i sigurtë që dëshironi t'i bashkoni këto postime?","other":"Jeni i sigurtë që dëshironi t'i bashkoni këto {{count}} postime?"}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"}}}},"category":{"can":"mund\u0026hellip; ","none":"(pa kategori)","all":"Të gjitha kategoritë","choose":"Zgjidhni një kategori\u0026hellip;","edit":"redakto","edit_long":"Redakto","view":"Shiko temat në kategorinë","general":"Karakteristika të përgjithshme","settings":"Rregullimet","topic_template":"Shabllon i Temës","tags":"Etiketat","delete":"Fshini kategorinë","create":"Krijo kategorinë e re","create_long":"Krijo një kategori të re","save":"Ruaj kategorinë","name":"Emri i kategorisë","description":"Përshkrimi","badge_colors":"Ngjyrat e stemës","background_color":" Ngjyra e sfondit","color_placeholder":"Çdo ngjyrë web","delete_confirm":"Jeni i sigurtë që dëshironi ta fshini këtë kategori?","list":"Shfaq kategoritë","change_in_category_topic":"Redakto përshkrimin","security":"Siguria","images":"Imazhet","auto_close_label":"Mbylle automatikisht temën pas:","auto_close_units":"orë","allow_badges_label":"Lejo të jepen stemat në këtë kategori","edit_permissions":"Ndryshoni autorizimet","add_permission":"Shtoni autorizim","this_year":"këtë vit","position":"pozicion","notifications":{"watching":{"title":"Në vëzhgim"},"watching_first_post":{"title":"Postimi i parë nën vëzhgim","description":"Ju do të njoftoheni vetëm për postimin e parë të çdo teme nën këto kategori."},"tracking":{"title":"Në gjurmim"},"regular":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose nëse dikush ju përgjigjet. "},"muted":{"title":"Pa njoftime","description":"Ju nuk do të njoftoheni për asgjë nga temat e reja të këtyre kategorive, dhe këto tema nuk do të afishohen në faqen \"Më të fundit\" për ju. "}}},"flagging":{"title":"Faleminderit për ndihmën që i jepni këtij komuniteti!","action":"Sinjalizo postimin","take_action":"Vepro","notify_action":"Mesazh","official_warning":"Paralajmërim zyrtar","delete_spammer":"Elimino Spammer","yes_delete_spammer":"Po, Elimino Spammer","ip_address_missing":"(N/A)","hidden_email_address":"(fshehur)","submit_tooltip":"Dërgoni sinjalizimin privatisht","take_action_tooltip":"Kaloni direkt tek pragu i sinjalizimeve (dmth, mos prisni për sinjalizime të tjera nga komuniteti)","cant":"Na vjen keq, nuk mund të sinjalizoni këtë postim tani. ","notify_staff":"Njoftoni stafin privatisht","formatted_name":{"off_topic":"Është jashtë teme","inappropriate":"Është e papërshtatshme","spam":"Është Spam"},"custom_placeholder_notify_user":"Jini specifikë, konstruktiv dhe gjithmonë të sjellshëm.","custom_placeholder_notify_moderators":"Na thoni specifikisht se çfarë ju shqetëson dhe na jepni lidhje dhe shembuj konkretë brenda mundësive. "},"flagging_topic":{"title":"Faleminderit për ndihmën që i jepni këtij komuniteti!","action":"Raporto Temën","notify_action":"Message"},"topic_map":{"title":"Përmbledhja e Temës","participants_title":"Postues të Shpeshtë","links_title":"Lidhje Aktive","links_shown":"trego më shumë lidhje...","clicks":{"one":"1 klik","other":"%{count} klikime"}},"post_links":{"title":{"one":"edhe 1","other":"edhe %{count}"}},"topic_statuses":{"warning":{"help":"Ky është një paralajmërim zyrtar."},"locked":{"help":"Kjo temë është mbyllur; nuk pranon më përgjigje"},"archived":{"help":"Kjo temë është arkivuar; nuk mund të bëhen ndryshime "},"locked_and_archived":{"help":"Kjo temë është mbyllur dhe arkivuar; nuk pranohen përgjigje apo ndryshime"},"unpinned":{"title":"Jo e përzgjedhur","help":"Kjo temë është e çngjitur për ju; do të paraqitet në renditje normale"},"pinned_globally":{"title":"E përzgjedhur Kudo","help":"Kjo temë është e ngjitur globalisht; do të paraqitet në majë të postimeve të reja dhe të kategorisë përkatëse"},"pinned":{"title":"E përzgjedhur","help":"Kjo temë është e ngjitur për ju; do të paraqitet në majë të kategorisë përkatëse"},"invisible":{"help":"Kjo temë nuk është e listuar, pra nuk do të paraqitet nue listat e temave të faqes dhe mund të shikohet vetëm me lidhje direkte"}},"posts":"Postime","posts_long":"ka {{number}} postime në temë","original_post":"Postimi Origjinal","views":"Shikimet","replies":"Përgjigjet","views_long":"kjo temë është parë {{number}} herë","activity":"Aktiviteti","likes":"Pëlqimet","likes_lowercase":{"one":"like","other":"pëlqime"},"likes_long":"ka {{number}} pëlqime në këtë temë","users":"Anëtarët","users_lowercase":{"one":"anëtar","other":"anëtarët"},"category_title":"Kategoria","history":"Historia","changed_by":"nga {{author}}","raw_email":{"title":"Raw Email"},"categories_list":"Lista Kategorive","filters":{"with_topics":"Temat nga %{filter}","with_category":"Temat nga: %{filter}, %{category}","latest":{"title":"Më të fundit","title_with_count":{"one":"Më të fundit (1) ","other":"Më të fundit ({{count}}) "},"help":"temat me postime të fundit"},"hot":{"title":"Të nxehta","help":"disa nga temat më të nxehta"},"read":{"title":"Lexo","help":"temat që keni lexuar, radhitur sipas datës më të fundit të leximit"},"search":{"title":"Kërko","help":"kërko të gjitha temat"},"categories":{"title":"Kategoritë","title_in":"Kategoria - {{categoryName}}","help":"të gjitha temat të grupuara sipas kategorisë"},"unread":{"title":"Të palexuara","title_with_count":{"one":"Të palexuara (1)","other":"Të palexuara ({{count}})"},"help":"topics you are currently watching or tracking with unread posts","lower_title_with_count":{"one":"1 e palexuar","other":"{{count}} të palexuara"}},"new":{"lower_title_with_count":{"one":"1 e re","other":"{{count}} të reja"},"lower_title":"e re","title":"Të reja","title_with_count":{"one":"Të reja (1)","other":"Të reja ({{count}})"},"help":"temat e krijuar gjatë ditëve të fundit"},"posted":{"title":"Postimet e mia","help":"temat ku keni dërguar pêrgjigje"},"bookmarks":{"title":"Të preferuarat","help":"tema që keni preferuar"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"temat e fundit në kategorinë {{categoryName}}"},"top":{"title":"Popullore","help":"temat më aktive të vitit, muajit, javës apo ditës së shkuar","all":{"title":"Gjithë Kohës"},"yearly":{"title":"Vjetore"},"quarterly":{"title":"Tremujorsh"},"monthly":{"title":"Mujore"},"weekly":{"title":"Javore"},"daily":{"title":"Ditore"},"all_time":"Gjithë kohës","this_year":"Këtë vit","this_quarter":"Këtë tremujor","this_month":"Këtë muaj","this_week":"Këtë javë","today":"Sot","other_periods":"shiko më  populloret"}},"browser_update":"Fatkeqësisht, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eshfletuesi juaj është shumë i vjetër për këtë faqe\u003c/a\u003e. Ju lutemi, \u003ca href=\"http://browsehappy.com\"\u003eazhornoni shfletuesin\u003c/a\u003e.","permission_types":{"full":"Krijo / Përgjigju / Shiko","create_post":"Përgjigju / Shiko","readonly":"Shiko"},"lightbox":{"download":"shkarko"},"search_help":{"title":"Kërko faqet e ndihmës"},"keyboard_shortcuts_help":{"title":"Shkurtimet e tastierës ","jump_to":{"title":"Kalo tek","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Faqja e parë","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Më të fundit","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Të rejat","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Të palexuarat","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategoritë","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Populloret","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Të preferuarat","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profili","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mesazhet"},"navigation":{"title":"Shfletimi","jump":"\u003cb\u003e#\u003c/b\u003e Shko tek postimi #","back":"\u003cb\u003eu\u003c/b\u003e Mbrapa"},"application":{"create":"\u003cb\u003ec\u003c/b\u003e Hap një temë të re","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Hiq Të Rejat/Postimet"},"actions":{"mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Bëje temë të heshtur"}},"badges":{"earned_n_times":{"one":"Kjo stemë është fituar 1 herë","other":"Kjo stemë është fituar %{count} herë"},"others_count":"Të tjerë me këtë stemë (%{count})","title":"Stema","badge_count":{"one":"1 Stemë","other":"%{count} Stema"},"select_badge_for_title":"Zgjidhni një shenjë dalluese për ta përdorur si titullin tuaj","badge_grouping":{"trust_level":{"name":"Niveli i besimit"},"other":{"name":"Tjetër"}}},"tagging":{"all_tags":"Të gjitha etiketat","selector_all_tags":"të gjitha etiketat","selector_no_tags":"asnjë etiketë","changed":"etiketat e ndryshuara:","tags":"Etiketat","choose_for_topic":"zgjidhni etiketat fakultative për këtë temë","delete_tag":"Fshi etiketën","delete_confirm":"Jeni të sigurtë që doni të fshini këtë etiketë?","rename_tag":"Riemëro etiketën","rename_instructions":"Zgjidhni një emër të ri për këtë etiketë","sort_by":"Rendit sipas:","sort_by_count":"numri","sort_by_name":"emër","filters":{"without_category":"%{filter} %{tag} temat","with_category":"%{filter} %{tag} temat në %{category}","untagged_without_category":"%{filter} temat pa etiketë","untagged_with_category":"%{filter} temat pa etiketë në %{category}"},"notifications":{"watching":{"title":"Në vëzhgim","description":"Ju do të vëzhgoni automatikisht të gjitha temat nën këtë etiketë. Do të njoftoheni për çdo postim e temë të re, dhe numri i postimeve të reja të palexuara do të afishohet ngjitur me titullin e temës përgjatë listave të faqes. "},"watching_first_post":{"title":"Postimi i parë nën vëzhgim","description":"Ju do të njoftoheni vetëm për postimin e parë të çdo teme nën këtë etiketë."},"tracking":{"title":"Në gjurmim","description":"Ju do të gjurmoni automatikisht të gjitha temat nën këtë etiketë. Numri i përgjigjeve të palexuara do të afishohet ngjitur me titullin e temës në listat e faqes. "},"regular":{"title":"Normal","description":"Ju do të njoftoheni nëse dikush përmend @emrin tuaj ose i përgjigjet postimeve tuaja. "},"muted":{"title":"Të heshtur"}},"groups":{"title":"Grupe etiketash","about":"Organizoni etiketat nëpër grupe për të thjeshtuar mirëmbajtjen.","new":"Grup i ri","tags_label":"Etiketat në këtë grup:","parent_tag_label":"Etiketa prind:","parent_tag_placeholder":"Fakultative","parent_tag_description":"Etiketat nga ky grup mund të përdoren vetëm në etiketa prind është prezente.","one_per_topic_label":"Vetëm 1 etiketë për temë nga ky grup","new_name":"Grup i ri etiketash","save":"Ruaj","confirm_delete":"Jeni të sigurtë që doni të fshini këtë grup etiketash?"},"topics":{"none":{"unread":"Nuk keni tema të palexuara.","new":"Nuk ka tema të reja.","read":"Nuk keni lexuar asnjë temë deri tani.","posted":"Nuk keni shkruajtur tek asnjë temë deri tani.","latest":"Nuk ka tema të reja.","hot":"Nuk ka tema të nxehta.","bookmarks":"Nuk keni ende tema të preferuara. ","top":"Nuk ka tema popullore.","search":"Kërkimi nuk ka asnjë rezultat."},"bottom":{"latest":"Nuk ka më tema të reja.","hot":"Nuk ka më tema të nxehta.","posted":"Nuk ka më tema të publikuara.","read":"Nuk ka më tema të lexuara.","new":"Nuk ka më tema të reja.","unread":"Nuk ka më tema të palexuara.","top":"Nuk ka më tema popullore.","bookmarks":"Nuk ka më tema të preferuara.","search":"Kërkimi nuk ka më rezultate."}}},"invite":{"custom_message":"Personalizojeni ftesën paksa duke shkruar një","custom_message_link":"mesazh të veçantë","custom_message_placeholder":"Vendosni mesazhin","custom_message_template_forum":"Hej, hajde bashkoju këtij forumi!","custom_message_template_topic":"Hej, besoj se do të të pelqejë kjo temë!"},"poll":{"voters":{"one":"votues","other":"votuesit"},"total_votes":{"one":"total vota","other":"totali votave"},"average_rating":"Vlerësimi mesatar: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Votat janë publike."},"multiple":{"help":{"at_least_min_options":{"one":"Zgjidhni të paktën \u003cstrong\u003e1\u003c/strong\u003e alternativë","other":"Zgjidhni të paktën \u003cstrong\u003e%{count}\u003c/strong\u003e alternativa"},"up_to_max_options":{"one":"Zgjidhni deri në \u003cstrong\u003e1\u003c/strong\u003e alternativë","other":"Zgjidhni deri në \u003cstrong\u003e%{count}\u003c/strong\u003e alternativa"},"x_options":{"one":"Zgjidhni \u003cstrong\u003e1\u003c/strong\u003e alternativë","other":"Zgjidhni \u003cstrong\u003e%{count}\u003c/strong\u003e alternativa"},"between_min_and_max_options":"Zgjidhni midis \u003cstrong\u003e%{min}\u003c/strong\u003e dhe \u003cstrong\u003e%{max}\u003c/strong\u003e alternativash"}},"cast-votes":{"title":"Jepni votën tuaj","label":"Voto Tani"},"show-results":{"title":"Display the poll results","label":"Shfaq rezultatet"},"hide-results":{"title":"Back to your votes","label":"Fshihni rezultatet"},"open":{"title":"Fillo një Sondazh","label":"Fillo","confirm":"Jeni të sigurt për të hapur këtë sondazh?"},"close":{"title":"Mbyll sondazhin","label":"Mbyll","confirm":"Jeni të sigurt për të mbyllur këtë sondazh?"},"error_while_toggling_status":"Ndjesë, u has në një gabim kur u ndryshua gjendja e këtij sondazhi.","error_while_casting_votes":"Ndjesë, u has në një gabim duke mbledhur votat tuaja.","error_while_fetching_voters":"Ndjesë, u has në një gabim duke shfaqur votuesit.","ui_builder":{"title":"Krijo Sondazh","insert":"Shto Sondazh","help":{"options_count":"Zgjidh të paktën 2 alternativa"},"poll_type":{"label":"Lloji","regular":"Pa Alternativa","multiple":"Me Alternativa","number":"Vlerësim Numrash"},"poll_config":{"max":"Maksimumi","min":"Minimumi","step":"Hapi"},"poll_public":{"label":"Shfaq votuesit"},"poll_options":{"label":"Shto një alternativë për çdo rresht"}}},"type_to_filter":"shkruaj për kërkim","admin":{"title":"Administrator","moderator":"Moderator","dashboard":{"title":"Paneli i kontrollit","version":"Versioni","up_to_date":"Jeni të azhurnuar!","critical_available":"Përditësim i rëndësishëm.","updates_available":"Ka përditësime.","please_upgrade":"Ju lutem, azhornoje!","version_check_pending":"Me sa shohim keni rinovuar faqen se fundmi. Fantastike!","installed_version":"Instaluar","latest_version":"Të fundit","refresh_problems":"Rifresko","no_problems":"Nuk u gjet asnjë gabim.","moderators":"Moderatorët:","admins":"Administratorët:","blocked":"Bllokuar:","suspended":"Përjashtuar:","private_messages_short":"Msgs","private_messages_title":"Mesazhet","mobile_title":"Mobile","space_free":"{{size}} lirë","uploads":"ngarkime","traffic_short":"Trafik","reports":{"today":"Sot","yesterday":"Dje","last_7_days":"7 Ditët e Fundit","last_30_days":"30 Ditët e Fundit","all_time":"Gjithë Kohës","7_days_ago":"7 Ditë më parë","30_days_ago":"30 Ditë më parë","all":"Të Gjithë","view_table":"tabelë","view_graph":"grafik"}},"commits":{"by":"nga"},"flags":{"old":"Të Vjetra","active":"Aktive","agree":"Pranoj","agree_flag_modal_title":"Prano dhe...","agree_flag_restore_post_title":"Rikthe këtë postim","agree_flag_title":"Dakord me sinjalizimin dhe lini postimin të pandryshuar","delete":"Fshij","delete_title":"Fshini postimin e sinjalizuar.","delete_post_defer_flag":"Fshini postimin dhe shtyni për më vonë sinjalizimin","delete_post_agree_flag":"Fshini postimin dhe bini dakord me sinjalizimin","delete_spammer":"Elimino Spammer","delete_spammer_title":"Fshijeni përdoruesin dhe të gjitha temat e postimet nga ky përdorues.","disagree_flag_unhide_post_title":"Hiqni të gjitha sinjalizimet mbi këtë postim dhe ripublikojeni postimin","clear_topic_flags":"U krye","more":"(më shumë përgjigje...)","dispositions":{"agreed":"dakort"},"resolved_by":"Zgjidhur nga","system":"Sistemi","reply_message":"Përgjigju","no_results":"Nuk ka sinjalizime.","topic_flagged":"Kjo \u003cstrong\u003etemë\u003c/strong\u003e është sinjalizuar.","was_edited":"Postimi është redaktuar pas sinjalizimit të parë","previous_flags_count":"Ky postim është sinjalizuar {{count}} herë.","summary":{"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Grupi Parësor","title":"Grupet","edit":"Redakto Grup","refresh":"Rifresko","new":"I Ri","group_members":"Anëtarët e grupit","delete":"Fshij","name":"Emri","add":"Shto","add_members":"Shto Anëtar","bulk_select":"(zgjidhni një grup)","automatic":"Automatik"},"api":{"generate_master":"Gjenero Master API Key","user":"Anëtarë","title":"API","key":"API Key","generate":"Gjenero","regenerate":"Rigjenero","revoke":"Revoko","all_users":"Gjithë Anëtarët"},"plugins":{"title":"Pluginet","installed":"Pluginet e instaluar","name":"Emri","none_installed":"Nuk keni instaluar asnjë plugin. ","version":"Versioni","enabled":"Aktivizuar?","is_enabled":"Y","not_enabled":"N","change_settings":"Ndrysho Rregullimet","change_settings_short":"Rregullimet","howto":"Si mund të instaloj një plugin?"},"backups":{"title":"Rezervat","menu":{"backups":"Rezervat","logs":"Logs"},"columns":{"filename":"Filename"},"upload":{"uploading":"Duke ngarkuar..."},"operations":{"cancel":{"label":"Anulo"},"backup":{"label":"Backup","confirm":"Do you want to start a new backup?"},"download":{"label":"Shkarko"},"restore":{"label":"Rikthe"}}},"export_csv":{"user_archive_confirm":"Vërtet doni t'i shkarkoni postimet tuaja?","failed":"Eksporti dështoi. Kontrolloni log-et. ","button_text":"Eksporto","button_title":{"user":"Eksporto listën e plotë të anëtarëve në CSV. ","staff_action":"Eksporto logun e veprimeve të stafit në format CSV. ","screened_email":"Eksporto listën e plotë të emailave në format CSV. ","screened_ip":"Eksporto listën e plotë të adresave IP në format CSV. ","screened_url":"Eksporto listën e plotë të URLve në format CSV. "}},"export_json":{"button_text":"Eksporto"},"invite":{"button_text":"Dërgo ftesa","button_title":"Dërgo ftesa"},"customize":{"title":"Personalizo","css":"CSS","top":"Popullore","head_tag":{"text":"\u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e"},"enabled":"Aktivizuar?","save":"Ruaj","new":"E Re","new_style":"Veshje e Re","delete":"Fshij","color":"Ngjyra","opacity":"Opaciteti","copy":"Kopjo","email_templates":{"none_selected":"Zgjidhni një shabllon emaili për të filluar redaktimin. "},"css_html":{"title":"CSS/HTML"},"colors":{"title":"Ngjyrat","copy_name_prefix":"Kopje e","undo":"rikthe","revert":"rikthe","primary":{"name":"parësor"},"secondary":{"name":"dytësor"},"danger":{"name":"rrezik"},"success":{"name":"sukses"},"love":{"description":"Ngjyra e butonit të pëlqimeve."}}},"email":{"settings":"Rregullimet","error":"\u003cb\u003eERROR\u003c/b\u003e - %{server_error}","sent":"Dërguar","time":"Koha","sent_test":"u dërgua!","refresh":"Rifresko","format":"Formati","html":"html","text":"tekst","incoming_emails":{"none":"Nuk u gjetën emaila hyrës.","filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Subjekti...","error_placeholder":"Gabim"}},"logs":{"filters":{"address_placeholder":"emri@shembull.com","skipped_reason_placeholder":"arsye"}}},"logs":{"title":"Ditari","created_at":"Krijuar","ip_address":"IP","delete":"Fshij","edit":"Redakto","save":"Ruaj","screened_actions":{"block":"blloko"},"staff_actions":{"title":"Veprime Stafi","when":"Kur","details":"Detaje","new_value":"I Ri","modal_title":"Detaje","actions":{"change_trust_level":"ndrysho nivelin e besimit","grant_badge":"dhuro stemë","revoke_badge":"tërhiq stemë","deleted_tag":"etiketë e fshirë","renamed_tag":"etiketë e riemëruar"}},"screened_emails":{"title":"Kontroll Email-ash","actions":{"allow":"Lejo"}},"screened_urls":{"title":"Kontroll URL-sh","url":"URL","domain":"Domain"},"screened_ips":{"title":"Kontroll IP-sh","actions":{"block":"Blloko","do_nothing":"Lejo"},"form":{"label":"E Re:","ip_address":"Adresa IP","add":"Shto","filter":"Kërko"}},"logster":{"title":"Ditar Gabimesh"}},"impersonate":{"title":"Personifiko"},"users":{"active":"Aktivë","show_emails":"Trego adresat email","nav":{"new":"E Re","active":"Aktiv","pending":"Pezulluar","staff":"Stafi"},"approved":"Aprovuar?","titles":{"active":"Anëtarët aktivë","new":"Anëtarët e rinj","newuser":"Anëtarët me nivel besimi 0 (anëtar i ri)","basic":"Anëtarët me nivel besimi 1 (anëtar bazë)","member":"Anëtarët me nivel besimi 2 (member)","regular":"Anëtarët me nivel besimi 3 (të rregullt)","leader":"Anëtarët me nivel besimi 4 (lidera)","staff":"Stafi","admins":"Administratorë","moderators":"Moderatorë","blocked":"Anëtarët e bllokuar","suspended":"Anëtarët e pezulluar","suspect":"Anëtarët e dyshimtë"},"not_verified":"I pa verifikuar","check_email":{"text":"Shfaq"}},"user":{"suspend_duration_units":"(ditë)","suspend_reason":"Arsye","suspended_by":"Përjashtuar nga:","delete_all_posts":"Fshi gjithë postimet","admin":"Admin?","blocked":"Bllokuar?","show_admin_profile":"Admin","edit_title":"Redakto Titullin","save_title":"Ruaj Titullin","refresh_browsers":"Forco rifreskimin e shfletuesit","refresh_browsers_message":"Mesazhi u dërgua tek të gjithë klientët!","show_public_profile":"Shfaq Profilin Publik","ip_lookup":"Shiko IP","log_out":"Shkëputu","revoke_admin":"Revoko Admin","block":"Blloko","activity":"Aktiviteti","like_count":"Pëlqime të dhëna / të marra","last_100_days":"në 100 ditët e fundit","private_topics_count":"Diskutime Private","approve":"Aprovo","approved_by":"aprovuar nga","time_read":"Koha e Leximit","delete":"Fshij Anëtarë","delete_confirm":"E SIGURT që doni ta fshini këtë përdorues? Kjo është e përhershme!","delete_and_block":"Fshijeni dhe \u003cb\u003ebllokoni\u003c/b\u003e këtë email dhe adresë IP","delete_dont_block":"Vetëm fshijeni","deleted":"Anëtari u fshi.","send_activation_email":"Dërgo Emailin e Aktivizimit","activate":"Aktivizoni llogarinë","block_confirm":"A jeni të sigurtë që doni të bllokoni këtë anëtar? Anëtari nuk do të ketë më të drejtën të krijojë postime ose tema të reja.","block_accept":"Po, blloko anëtarin","trust_level_change_failed":"Nuk e ndryshuam dot nivelin e këtij anëtari. ","tl3_requirements":{"value_heading":"Vlera","visits":"Vizita","days":"ditë","flagged_posts":"Postimet e sinjalizuara","likes_given":"Pëlqime të dhëna","likes_received":"Pëlqime të marra","likes_received_days":"Pëlqime të marra: ditë unike","likes_received_users":"Pëlqime të marra: anëtarë unikë"},"sso":{"title":"Single Sign On","external_username":"Emri i përdoruesit","external_name":"Emri","external_email":"Email"}},"user_fields":{"untitled":"Pa Titull","save":"Ruaj","edit":"Redakto","delete":"Fshij","cancel":"Anulo","options":"Opsione","required":{"enabled":"i nevojshëm","disabled":"fakultativ"},"show_on_user_card":{"title":"Trego në kartën e anëtarit?","enabled":"e treguar në kartën e anëtarit","disabled":"nuk tregohet në kartën e anëtarit"}},"site_text":{"description":"Mund të adaptoni çdo tekst në këtë faqe. Filloni duke bërë një kërkim më poshtë: ","search":"Kërkoni për tekstin që dëshironi të redaktoni","edit":"redakto","revert":"Rikthe ndryshimet","revert_confirm":"A jeni të sigurtë se doni të riktheni mbrapsht ndryshimet e bëra?","go_back":"Kthehu tek kërkimi","recommended":"Ju rekomandojmë të ndryshoni tekstin më poshtë sipas nevojave tuaja: ","show_overriden":"Shfaq vetëm të ndryshuarat"},"site_settings":{"show_overriden":"Shfaq vetëm të ndryshuarat","title":"Rregullimet","reset":"reseto","none":"asnjë","no_results":"Nuk u gjet asnjë rezultat.","clear_filter":"Pastro","categories":{"users":"Përdoruesit","email":"Email","files":"Skedarë","trust":"Nivelet e besimit","security":"Siguria","onebox":"Onebox","seo":"SEO","spam":"Spam","developer":"Developer","embedding":"Embedding","legal":"Legale","uncategorized":"Të tjerë","backups":"Rezervat","login":"Identifikohu","plugins":"Pluginet","user_preferences":"Rregullimet e përdoruesit","tags":"Etiketat"}},"badges":{"title":"Stema","new_badge":"Stemë e Re","new":"I Ri","name":"Emri","badge":"Stemë","display_name":"Emri Shfaqur","long_description":"Përshkrim i gjatë","badge_type":"Lloj Steme","badge_grouping":"Grupi","badge_groupings":{"modal_title":"Grupime Steme"},"save":"Ruaj","delete":"Fshij","delete_confirm":"Jeni i sigurtë që doni ta fshini këtë stemë?","reason":"Arsye","revoke_confirm":"Jeni i sigurtë që doni ta tërhiqni këtë stemë?","edit_badges":"Ndryshoni Stemat","grant_badge":"Dhuroni Stemë","granted_badges":"Stema të Dhuruara","no_user_badges":"%{name} nuk ka marrë ende ndonjë stemë.","no_badges":"Nuk ka stema që mund të dhurohen.","none_selected":"Si fillim zgjidhni një stemë","allow_title":"Lejoni stemën të përdoret si titull","listable":"Shfaqni stemën në faqen publike të stemave","enabled":"Aktivizoni stemën","image":"Imazh","query":"Query Steme (SQL)","trigger_type":{"trust_level_change":"Kur një përdorues ndryshon nivelin e besimit"},"preview":{"link_text":"Shikim paraprak i stemave të dhuruara","modal_title":"Shikim paraprak Pyetësori Stemash","bad_count_warning":{"header":"KUJDES!"},"no_grant_count":"Asnjë stemë për t'u dhënë.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e stemë për t'u dhënë.","other":"\u003cb\u003e%{count}\u003c/b\u003e stema për t'u dhënë."},"sample":"Shëmbull:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","name":"Emri","image":"Imazh"},"embedding":{"edit":"redakto"},"permalink":{"url":"URL","topic_id":"ID e temës","topic_title":"Temë","post_id":"ID e postimit","post_title":"Postim","category_id":"ID e kategorisë","category_title":"Kategoria","external_url":"URL e jashtme","form":{"label":"E Re:"}}}}},"en":{"js":{"bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","categories":{"toggle_ordering":"toggle ordering control","topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n"},"delete_yourself_not_allowed":"You cannot delete your account right now. Contact an admin to do delete your account for you.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","email":{"frequency_immediately":"We'll email you immediately if you haven't read the thing we're emailing you about."},"username":{"global_match":"Email matches the registered username","prefilled":"Email matches this registered username"},"email_previous_replies":{"title":"Include previous replies at the bottom of emails"},"email_private_messages":"Send me an email when someone messages me","email_always":"Send me email notifications even when I am active on the site","invited":{"days_visited":"Days Visited","bulk_invite":{"success":"File uploaded successfully, you will be notified via message when the process is complete.","error":"There was an error uploading '{{filename}}': {{message}}"}}},"read_only_mode":{"login_disabled":"Login is disabled while the site is in read only mode.","logout_disabled":"Logout is disabled while the site is in read only mode."},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}."},"mute":"Mute","private_message_info":{"remove_allowed_user":"Do you really want to remove {{name}} from this message?"},"forgot_password":{"complete_username":"If an account matches the username \u003cb\u003e%{username}\u003c/b\u003e, you should receive an email with instructions on how to reset your password shortly.","complete_email":"If an account matches \u003cb\u003e%{email}\u003c/b\u003e, you should receive an email with instructions on how to reset your password shortly.","complete_username_found":"We found an account that matches the username \u003cb\u003e%{username}\u003c/b\u003e, you should receive an email with instructions on how to reset your password shortly.","complete_email_found":"We found an account that matches \u003cb\u003e%{email}\u003c/b\u003e, you should receive an email with instructions on how to reset your password shortly.","complete_username_not_found":"No account matches the username \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"No account matches \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"not_activated":"You can't log in yet. We previously sent an activation email to you at \u003cb\u003e{{sentTo}}\u003c/b\u003e. Please follow the instructions in that email to activate your account.","not_allowed_from_ip_address":"You can't login from that IP address.","admin_not_allowed_from_ip_address":"You can't log in as admin from that IP address.","sent_activation_email_again":"We sent another activation email to you at \u003cb\u003e{{currentEmail}}\u003c/b\u003e. It might take a few minutes for it to arrive; be sure to check your spam folder.","preferences":"You need to be logged in to change your user preferences.","google":{"message":"Authenticating with Google (make sure pop up blockers are not enabled)"},"google_oauth2":{"message":"Authenticating with Google (make sure pop up blockers are not enabled)"},"instagram":{"title":"with Instagram","message":"Authenticating with Instagram (make sure pop up blockers are not enabled)"},"yahoo":{"message":"Authenticating with Yahoo (make sure pop up blockers are not enabled)"},"github":{"message":"Authenticating with GitHub (make sure pop up blockers are not enabled)"}},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"upload_selector":{"remote_tip_with_attachments":"link to image or file {{authorized_extensions}}","local_tip":"select images from your device","local_tip_with_attachments":"select images or files from your device {{authorized_extensions}}","hint":"(you can also drag \u0026 drop into the editor to upload them)","hint_for_supported_browsers":"you can also drag and drop or paste images into the editor","image_link":"link your image will point to"},"search":{"relevance":"Relevance","latest_post":"Latest Post","most_viewed":"Most Viewed","clear_all":"Clear All","too_short":"Your search term is too short.","no_more_results":"No more results found.","search_help":"Search help","post_format":"#{{post_number}} by {{username}}","context":{"private_messages":"Search messages"}},"not_logged_in_user":"user page with summary of current activity and preferences","current_user":"go to your user page","topics":{"bulk":{"unlist_topics":"Unlist Topics","dismiss":"Dismiss","dismiss_read":"Dismiss all unread","dismiss_button":"Dismiss…","also_dismiss_topics":"Stop tracking these topics so they never show up as unread for me again","toggle":"toggle bulk selection of topics"},"none":{"search":"There are no search results."},"bottom":{"search":"There are no more search results."}},"topic":{"unsubscribe":{"change_notification_state":"Your current notification state is "},"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"unread":"unread","read_more_MF":"There { UNREAD, plural, =0 {} one { is \u003ca href='/unread'\u003e1 unread\u003c/a\u003e } other { are \u003ca href='/unread'\u003e# unread\u003c/a\u003e } } { NEW, plural, =0 {} one { {BOTH, select, true{and } false {is } other{}} \u003ca href='/new'\u003e1 new\u003c/a\u003e topic} other { {BOTH, select, true{and } false {are } other{}} \u003ca href='/new'\u003e# new\u003c/a\u003e topics} } remaining, or {CATEGORY, select, true {browse other topics in {catLink}} false {{latestLink}} other {}}","jump_reply_up":"jump to earlier reply","jump_reply_down":"jump to later reply","auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"progress":{"jump_bottom":"jump to last post","jump_bottom_with_number":"jump to post %{post_number}"},"notifications":{"reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"reset_read":"Reset Read Data"},"clear_pin":{"title":"Clear pin"},"feature_topic":{"pin":"Make this topic appear at the top of the {{categoryLink}} category until","unpin":"Remove this topic from the top of the {{categoryLink}} category.","unpin_until":"Remove this topic from the top of the {{categoryLink}} category or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Users can unpin the topic individually for themselves.","pin_validation":"A date is required to pin this topic.","pin_globally":"Make this topic appear at the top of all topic lists until","unpin_globally":"Remove this topic from the top of all topic lists.","unpin_globally_until":"Remove this topic from the top of all topic lists or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Users can unpin the topic individually for themselves.","make_banner":"Make this topic into a banner that appears at the top of all pages.","remove_banner":"Remove the banner that appears at the top of all pages.","banner_note":"Users can dismiss the banner by closing it. Only one topic can be bannered at any given time.","no_banner_exists":"There is no banner topic."},"inviting":"Inviting...","automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"email_or_username_placeholder":"email address or username","success_group":"We've invited that group to participate in this message.","error":"Sorry, there was an error inviting that user."},"controls":"Topic Controls","split_topic":{"title":"Move to New Topic","action":"move to new topic","topic_name":"New Topic Name","error":"There was an error moving posts to the new topic."},"merge_topic":{"title":"Move to Existing Topic","action":"move to existing topic","error":"There was an error moving posts into that topic.","instructions":{"one":"Please choose the topic you'd like to move that post to.","other":"Please choose the topic you'd like to move those \u003cb\u003e{{count}}\u003c/b\u003e posts to."}},"change_owner":{"instructions":{"one":"Please choose the new owner of the post by \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Please choose the new owner of the {{count}} posts by \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Note that any notifications about this post will not be transferred to the new user retroactively.\u003cbr\u003eWarning: Currently, no post-dependent data is transferred over to the new user. Use with caution."},"multi_select":{"selected":"selected ({{count}})","select_replies":"select +replies","deselect_all":"deselect all"}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","follow_quote":"go to the quoted post","expand_collapse":"expand/collapse","errors":{"upload":"Sorry, there was an error uploading that file. Please try again.","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time.","upload_not_authorized":"Sorry, the file you are trying to upload is not authorized (authorized extension: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Sorry, new users can not upload images.","attachment_upload_not_allowed_for_new_user":"Sorry, new users can not upload attachments.","attachment_download_requires_login":"Sorry, you need to be logged in to download attachments."},"abandon":{"confirm":"Are you sure you want to abandon your post?"},"whisper":"this post is a private whisper for moderators","wiki":{"about":"this post is a wiki"},"controls":{"unhide":"Unhide"},"actions":{"defer_flags":{"one":"Defer flag","other":"Defer flags"},"undo":{"off_topic":"Undo flag","spam":"Undo flag","inappropriate":"Undo flag"},"people":{"off_topic":"flagged this as off-topic","spam":"flagged this as spam","inappropriate":"flagged this as inappropriate","notify_moderators":"notified moderators","notify_user":"sent a message","bookmark":"bookmarked this","vote":"voted for this"},"by_you":{"off_topic":"You flagged this as off-topic","spam":"You flagged this as spam","inappropriate":"You flagged this as inappropriate","notify_moderators":"You flagged this for moderation","notify_user":"You sent a message to this user","bookmark":"You bookmarked this post","vote":"You voted for this post"},"by_you_and_others":{"off_topic":{"one":"You and 1 other flagged this as off-topic","other":"You and {{count}} other people flagged this as off-topic"},"spam":{"one":"You and 1 other flagged this as spam","other":"You and {{count}} other people flagged this as spam"},"inappropriate":{"one":"You and 1 other flagged this as inappropriate","other":"You and {{count}} other people flagged this as inappropriate"},"notify_moderators":{"one":"You and 1 other flagged this for moderation","other":"You and {{count}} other people flagged this for moderation"},"notify_user":{"one":"You and 1 other sent a message to this user","other":"You and {{count}} other people sent a message to this user"},"bookmark":{"one":"You and 1 other bookmarked this post","other":"You and {{count}} other people bookmarked this post"},"vote":{"one":"You and 1 other voted for this post","other":"You and {{count}} other people voted for this post"}},"by_others":{"off_topic":{"one":"1 person flagged this as off-topic","other":"{{count}} people flagged this as off-topic"},"spam":{"one":"1 person flagged this as spam","other":"{{count}} people flagged this as spam"},"inappropriate":{"one":"1 person flagged this as inappropriate","other":"{{count}} people flagged this as inappropriate"},"notify_moderators":{"one":"1 person flagged this for moderation","other":"{{count}} people flagged this for moderation"},"notify_user":{"one":"1 person sent a message to this user","other":"{{count}} sent a message to this user"},"bookmark":{"one":"1 person bookmarked this post","other":"{{count}} people bookmarked this post"},"vote":{"one":"1 person voted for this post","other":"{{count}} people voted for this post"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?","other":"Are you sure you want to delete all those posts?"}},"revisions":{"controls":{"first":"First revision","previous":"Previous revision","next":"Next revision","last":"Last revision","hide":"Hide revision","show":"Show revision","revert":"Revert to this revision"},"displays":{"inline":{"title":"Show the rendered output with additions and removals inline"},"side_by_side":{"title":"Show the rendered output diffs side-by-side"},"side_by_side_markdown":{"title":"Show the raw source diffs side-by-side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Raw"}}}},"category":{"tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","slug":"Category Slug","slug_placeholder":"(Optional) dashed-words for url","creation_error":"There has been an error during the creation of the category.","save_error":"There was an error saving the category.","topic":"category topic","logo":"Category Logo Image","background_image":"Category Background Image","foreground_color":"Foreground color","name_placeholder":"One or two words maximum","delete_error":"There was an error deleting the category.","no_description":"Please add a description for this category.","already_used":"This color has been used by another category","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","email_in":"Custom incoming email address:","email_in_allow_strangers":"Accept emails from anonymous users with no accounts","email_in_disabled":"Posting new topics via email is disabled in the Site Settings. To enable posting new topics via email, ","email_in_disabled_click":"enable the \"email in\" setting.","suppress_from_homepage":"Suppress this category from the homepage.","default_position":"Default Position","position_disabled":"Categories will be displayed in order of activity. To control the order of categories in lists, ","position_disabled_click":"enable the \"fixed category positions\" setting.","parent":"Parent Category","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"post_links":{"about":"expand more links for this post"},"topic_statuses":{"bookmarked":{"help":"You bookmarked this topic"}},"posts_likes_MF":"This topic has {count, plural, one {1 reply} other {# replies}} {ratio, select,\n  low {with a high like to post ratio}\n  med {with a very high like to post ratio}\n  high {with an extremely high like to post ratio}\n  other {}}\n","views_lowercase":{"one":"view","other":"views"},"raw_email":{"not_available":"Not available!"},"keyboard_shortcuts_help":{"navigation":{"up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"granted_on":"Granted %{date}","allow_title":"available title","multiple_grant":"awarded multiple times","more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","notifications":{"muted":{"description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"delete":"Delete"}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"last_updated":"Dashboard last updated:","no_check_performed":"A check for updates has not been performed. Ensure sidekiq is running.","stale_data":"A check for updates has not been performed lately. Ensure sidekiq is running.","problems_found":"Some problems have been found with your installation of Discourse:","last_checked":"Last checked","backups":"backups","traffic":"Application web requests","page_views":"API Requests","page_views_short":"API Requests","show_traffic_report":"Show Detailed Traffic Report","reports":{"refresh_report":"Refresh Report","start_date":"Start Date","end_date":"End Date","groups":"All groups"}},"commits":{"latest_changes":"Latest changes: please update often!"},"flags":{"title":"Flags","agree_title":"Confirm this flag as valid and correct","agree_flag_hide_post":"Agree (hide post + send PM)","agree_flag_hide_post_title":"Hide this post and automatically send the user a message urging them to edit it","agree_flag_restore_post":"Agree (restore post)","agree_flag":"Agree with flag","defer_flag":"Defer","defer_flag_title":"Remove this flag; it requires no action at this time.","delete_post_defer_flag_title":"Delete post; if the first post, delete the topic","delete_post_agree_flag_title":"Delete post; if the first post, delete the topic","delete_flag_modal_title":"Delete and...","disagree_flag_unhide_post":"Disagree (unhide post)","disagree_flag":"Disagree","disagree_flag_title":"Deny this flag as invalid or incorrect","clear_topic_flags_title":"The topic has been investigated and issues have been resolved. Click Done to remove the flags.","dispositions":{"disagreed":"disagreed","deferred":"deferred"},"flagged_by":"Flagged by","took_action":"Took action","error":"Something went wrong","visit_topic":"Visit the topic to take action","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"inappropriate","other":"inappropriate x{{count}}"},"action_type_6":{"one":"custom","other":"custom x{{count}}"},"action_type_7":{"one":"custom","other":"custom x{{count}}"}}},"groups":{"no_primary":"(no primary group)","selector_placeholder":"enter username","name_placeholder":"Group name, no spaces, same as username rule","about":"Edit your group membership and names here","delete_confirm":"Delete this group?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed.","delete_member_confirm":"Remove '%{username}' from the '%{group}' group?","delete_owner_confirm":"Remove owner privilege for '%{username}'?","custom":"Custom","bulk_complete":"The users have been added to the group.","bulk":"Bulk Add to Group","bulk_paste":"Paste a list of usernames or emails, one per line:","automatic_membership_email_domains":"Users who register with an email domain that exactly matches one in this list will be automatically added to this group:","automatic_membership_retroactive":"Apply the same email domain rule to add existing registered users","default_title":"Default title for all users in this group","primary_group":"Automatically set as primary group","group_owners":"Owners","add_owners":"Add owners","incoming_email":"Custom incoming email address","incoming_email_placeholder":"enter email address","flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"api":{"none":"There are no active API keys right now.","confirm_regen":"Are you sure you want to replace that API Key with a new one?","confirm_revoke":"Are you sure you want to revoke that key?","info_html":"Your API key will allow you to create and update topics using JSON calls.","note_html":"Keep this key \u003cstrong\u003esecret\u003c/strong\u003e, all users that have it may create arbitrary posts as any user."},"backups":{"none":"No backup available.","read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"logs":{"none":"No logs yet..."},"columns":{"size":"Size"},"upload":{"label":"Upload","title":"Upload a backup to this instance","success":"'{{filename}}' has successfully been uploaded.","error":"There has been an error while uploading '{{filename}}': {{message}}"},"operations":{"is_running":"An operation is currently running...","failed":"The {{operation}} failed. Please check the logs.","cancel":{"title":"Cancel the current operation","confirm":"Are you sure you want to cancel the current operation?"},"backup":{"title":"Create a backup","without_uploads":"Yes (do not include files)"},"download":{"title":"Download the backup"},"destroy":{"title":"Remove the backup","confirm":"Are you sure you want to destroy this backup?"},"restore":{"is_disabled":"Restore is disabled in the site settings.","title":"Restore the backup","confirm":"Are you sure you want to restore this backup?"},"rollback":{"label":"Rollback","title":"Rollback the database to previous working state","confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"export_csv":{"success":"Export initiated, you will be notified via message when the process is complete.","rate_limit_error":"Posts can be downloaded once per day, please try again tomorrow."},"customize":{"long_title":"Site Customizations","header":"Header","footer":"Footer","embedded_css":"Embedded CSS","head_tag":{"title":"HTML that will be inserted before the \u003c/head\u003e tag"},"body_tag":{"title":"HTML that will be inserted before the \u003c/body\u003e tag"},"override_default":"Do not include standard style sheet","preview":"preview","undo_preview":"remove preview","rescue_preview":"default style","explain_preview":"See the site with this custom stylesheet","explain_undo_preview":"Go back to the currently enabled custom stylesheet","explain_rescue_preview":"See the site with the default stylesheet","import":"Import","import_title":"Select a file or paste text","delete_confirm":"Delete this customization?","about":"Modify CSS stylesheets and HTML headers on the site. Add a customization to start.","email_templates":{"title":"Email Templates","subject":"Subject","multiple_subjects":"This email template has multiple subjects.","body":"Body","revert":"Revert Changes","revert_confirm":"Are you sure you want to revert your changes?"},"css_html":{"long_title":"CSS and HTML Customizations"},"colors":{"long_title":"Color Schemes","about":"Modify the colors used on the site without writing CSS. Add a scheme to start.","new_name":"New Color Scheme","delete_confirm":"Delete this color scheme?","undo_title":"Undo your changes to this color since the last time it was saved.","revert_title":"Reset this color to Discourse's default color scheme.","primary":{"description":"Most text, icons, and borders."},"secondary":{"description":"The main background color, and text color of some buttons."},"tertiary":{"name":"tertiary","description":"Links, some buttons, notifications, and accent color."},"quaternary":{"name":"quaternary","description":"Navigation links."},"header_background":{"name":"header background","description":"Background color of the site's header."},"header_primary":{"name":"header primary","description":"Text and icons in the site's header."},"highlight":{"name":"highlight","description":"The background color of highlighted elements on the page, such as posts and topics."},"danger":{"description":"Highlight color for actions like deleting posts and topics."},"success":{"description":"Used to indicate an action was successful."},"love":{"name":"love"}}},"email":{"title":"Emails","templates":"Templates","preview_digest":"Preview Digest","sending_test":"Sending test Email...","test_error":"There was a problem sending the test email. Please double-check your mail settings, verify that your host is not blocking mail connections, and try again.","skipped":"Skipped","bounced":"Bounced","received":"Received","rejected":"Rejected","sent_at":"Sent At","user":"User","email_type":"Email Type","to_address":"To Address","test_email_address":"email address to test","send_test":"Send Test Email","delivery_method":"Delivery Method","preview_digest_desc":"Preview the content of the digest emails sent to inactive users.","last_seen_user":"Last Seen User:","reply_key":"Reply Key","skipped_reason":"Skip Reason","incoming_emails":{"from_address":"From","to_addresses":"To","cc_addresses":"Cc","subject":"Subject","error":"Error","modal":{"title":"Incoming Email Details","error":"Error","headers":"Headers","subject":"Subject","body":"Body","rejection_message":"Rejection Mail"}},"logs":{"none":"No logs found.","filters":{"title":"Filter","user_placeholder":"username","type_placeholder":"digest, signup...","reply_key_placeholder":"reply key"}}},"logs":{"action":"Action","last_match_at":"Last Matched","match_count":"Matches","topic_id":"Topic ID","post_id":"Post ID","category_id":"Category ID","screened_actions":{"do_nothing":"do nothing"},"staff_actions":{"instructions":"Click usernames and actions to filter the list. Click profile pictures to go to user pages.","clear_filters":"Show Everything","staff_user":"Staff User","target_user":"Target User","subject":"Subject","context":"Context","previous_value":"Previous","diff":"Diff","show":"Show","no_previous":"There is no previous value.","deleted":"No new value. The record was deleted.","actions":{"delete_user":"delete user","change_username":"change username","change_site_setting":"change site setting","change_site_customization":"change site customization","delete_site_customization":"delete site customization","change_site_text":"change site text","suspend_user":"suspend user","unsuspend_user":"unsuspend user","check_email":"check email","delete_topic":"delete topic","delete_post":"delete post","impersonate":"impersonate","anonymize_user":"anonymize user","roll_up":"roll up IP blocks","change_category_settings":"change category settings","delete_category":"delete category","create_category":"create category","block_user":"block user","unblock_user":"unblock user","grant_admin":"grant admin","revoke_admin":"revoke admin","grant_moderation":"grant moderation","revoke_moderation":"revoke moderation","backup_operation":"backup operation","revoke_email":"revoke email"}},"screened_emails":{"description":"When someone tries to create a new account, the following email addresses will be checked and the registration will be blocked, or some other action performed.","email":"Email Address"},"screened_urls":{"description":"The URLs listed here were used in posts by users who have been identified as spammers."},"screened_ips":{"description":"IP addresses that are being watched. Use \"Allow\" to whitelist IP addresses.","delete_confirm":"Are you sure you want to remove the rule for %{ip_address}?","roll_up_confirm":"Are you sure you want to roll up commonly screened IP addresses into subnets?","rolled_up_some_subnets":"Successfully rolled up IP ban entries to these subnets: %{subnets}.","rolled_up_no_subnet":"There was nothing to roll up.","actions":{"allow_admin":"Allow Admin"},"roll_up":{"text":"Roll up","title":"Creates new subnet ban entries if there are at least 'min_ban_entries_for_roll_up' entries."}}},"impersonate":{"help":"Use this tool to impersonate a user account for debugging purposes. You will have to log out once finished.","not_found":"That user can't be found.","invalid":"Sorry, you may not impersonate that user."},"users":{"title":"Users","create":"Add Admin User","last_emailed":"Last Emailed","not_found":"Sorry, that username doesn't exist in our system.","id_not_found":"Sorry, that user id doesn't exist in our system.","nav":{"suspended":"Suspended","blocked":"Blocked","suspect":"Suspect"},"approved_selected":{"one":"approve user","other":"approve users ({{count}})"},"reject_selected":{"one":"reject user","other":"reject users ({{count}})"},"titles":{"pending":"Users Pending Review"},"reject_successful":{"one":"Successfully rejected 1 user.","other":"Successfully rejected %{count} users."},"reject_failures":{"one":"Failed to reject 1 user.","other":"Failed to reject %{count} users."},"check_email":{"title":"Reveal this user's email address"}},"user":{"suspend_failed":"Something went wrong suspending this user {{error}}","unsuspend_failed":"Something went wrong unsuspending this user {{error}}","suspend_duration":"How long will the user be suspended for?","suspend_reason_label":"Why are you suspending? This text \u003cb\u003ewill be visible to everyone\u003c/b\u003e on this user's profile page, and will be shown to the user when they try to log in. Keep it short.","delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","suspend":"Suspend","unsuspend":"Unsuspend","suspended":"Suspended?","moderator":"Moderator?","staged":"Staged?","impersonate":"Impersonate","logged_out":"User was logged out on all devices","grant_admin":"Grant Admin","revoke_moderation":"Revoke Moderation","grant_moderation":"Grant Moderation","unblock":"Unblock","reputation":"Reputation","permissions":"Permissions","posts_read_count":"Posts Read","post_count":"Posts Created","topics_entered":"Topics Viewed","flags_given_count":"Flags Given","flags_received_count":"Flags Received","warnings_received_count":"Warnings Received","flags_given_received_count":"Flags Given / Received","approve_success":"User approved and email sent with activation instructions.","approve_bulk_success":"Success! All selected users have been approved and notified.","anonymize":"Anonymize User","anonymize_confirm":"Are you SURE you want to anonymize this account? This will change the username and email, and reset all profile information.","anonymize_yes":"Yes, anonymize this account","anonymize_failed":"There was a problem anonymizing the account.","delete_forbidden_because_staff":"Admins and moderators can't be deleted.","delete_posts_forbidden_because_staff":"Can't delete all posts of admins and moderators.","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)","other":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} days old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)","other":"Can't delete all posts. Some posts are older than %{count} days old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)","other":"Can't delete all posts because the user has more than %{count} posts.  (delete_all_posts_max)"},"delete_failed":"There was an error deleting that user. Make sure all posts are deleted before trying to delete the user.","activation_email_sent":"An activation email has been sent.","send_activation_email_failed":"There was a problem sending another activation email. %{error}","activate_failed":"There was a problem activating the user.","deactivate_account":"Deactivate Account","deactivate_failed":"There was a problem deactivating the user.","unblock_failed":"There was a problem unblocking the user.","block_failed":"There was a problem blocking the user.","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"deactivate_explanation":"A deactivated user must re-validate their email.","suspended_explanation":"A suspended user can't log in.","block_explanation":"A blocked user can't post or start topics.","staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"suspend_modal_title":"Suspend User","trust_level_2_users":"Trust Level 2 Users","trust_level_3_requirements":"Trust Level 3 Requirements","trust_level_locked_tip":"trust level is locked, system will not promote or demote user","trust_level_unlocked_tip":"trust level is unlocked, system will may promote or demote user","lock_trust_level":"Lock Trust Level","unlock_trust_level":"Unlock Trust Level","tl3_requirements":{"title":"Requirements for Trust Level 3","table_title":{"one":"In the last day:","other":"In the last %{count} days:"},"requirement_heading":"Requirement","topics_replied_to":"Topics Replied To","topics_viewed":"Topics Viewed","topics_viewed_all_time":"Topics Viewed (all time)","posts_read":"Posts Read","posts_read_all_time":"Posts Read (all time)","flagged_by_users":"Users Who Flagged","qualifies":"Qualifies for trust level 3.","does_not_qualify":"Doesn't qualify for trust level 3.","will_be_promoted":"Will be promoted soon.","will_be_demoted":"Will be demoted soon.","on_grace_period":"Currently in promotion grace period, will not be demoted.","locked_will_not_be_promoted":"Trust level locked. Will never be promoted.","locked_will_not_be_demoted":"Trust level locked. Will never be demoted."},"sso":{"external_id":"External ID","external_avatar_url":"Profile Picture URL"}},"user_fields":{"title":"User Fields","help":"Add fields that your users can fill out.","create":"Create User Field","name":"Field Name","type":"Field Type","description":"Field Description","delete_confirm":"Are you sure you want to delete that user field?","required":{"title":"Required at signup?"},"editable":{"title":"Editable after signup?","enabled":"editable","disabled":"not editable"},"show_on_profile":{"title":"Show on public profile?","enabled":"shown on profile","disabled":"not shown on profile"},"field_types":{"text":"Text Field","confirm":"Confirmation","dropdown":"Dropdown"}},"site_text":{"title":"Text Content"},"site_settings":{"add_url":"add URL","add_host":"add host","categories":{"all_results":"All","required":"Required","basic":"Basic Setup","posting":"Posting","rate_limits":"Rate Limits","user_api":"User API","search":"Search"}},"badges":{"description":"Description","granted_by":"Granted By","granted_at":"Granted At","reason_help":"(A link to a post or topic)","revoke":"Revoke","expand":"Expand \u0026hellip;","grant":"Grant","multiple_grant":"Can be granted multiple times","icon":"Icon","icon_help":"Use either a Font Awesome class or URL to an image","target_posts":"Query targets posts","auto_revoke":"Run revocation query daily","show_posts":"Show post granting badge on badge page","trigger":"Trigger","trigger_type":{"none":"Update daily","post_action":"When a user acts on post","post_revision":"When a user edits or creates a post","user_change":"When a user is edited or created","post_processed":"After a post is processed"},"preview":{"plan_text":"Preview with query plan","sql_error_header":"There was an error with the query.","error_help":"See the following links for help with badge queries.","bad_count_warning":{"text":"There are missing grant samples. This happens when the badge query returns user IDs or post IDs that do not exist. This may cause unexpected results later on - please double-check your query."},"grant":{"with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link} at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"help":"Add new emoji that will be available to everyone. (PROTIP: drag \u0026 drop multiple files at once)","add":"Add New Emoji","delete_confirm":"Are you sure you want to delete the :%{name}: emoji?"},"embedding":{"get_started":"If you'd like to embed Discourse on another website, begin by adding its host.","confirm_delete":"Are you sure you want to delete that host?","sample":"Use the following HTML code into your site to create and embed discourse topics. Replace \u003cb\u003eREPLACE_ME\u003c/b\u003e with the canonical URL of the page you are embedding it on.","title":"Embedding","host":"Allowed Hosts","path_whitelist":"Path Whitelist","category":"Post to Category","add_host":"Add Host","settings":"Embedding Settings","feed_settings":"Feed Settings","feed_description":"Providing an RSS/ATOM feed for your site can improve Discourse's ability to import your content.","crawling_settings":"Crawler Settings","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"Username for topic creation","embed_post_limit":"Maximum number of posts to embed","embed_username_key_from_feed":"Key to pull discourse username from feed","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_truncate":"Truncate the embedded posts","embed_whitelist_selector":"CSS selector for elements that are allowed in embeds","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","embed_classname_whitelist":"Allowed CSS class names","feed_polling_enabled":"Import posts via RSS/ATOM","feed_polling_url":"URL of RSS/ATOM feed to crawl","save":"Save Embedding Settings"},"permalink":{"title":"Permalinks","delete_confirm":"Are you sure you want to delete this permalink?","form":{"add":"Add","filter":"Search (URL or External URL)"}}}}}};
I18n.locale = 'sq';
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
//! locale : Albanian (sq)
//! author : Flakërim Ismani : https://github.com/flakerimi
//! author: Menelion Elensúle: https://github.com/Oire (tests)
//! author : Oerd Cukalla : https://github.com/oerd (fixes)

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var sq = moment.defineLocale('sq', {
        months : 'Janar_Shkurt_Mars_Prill_Maj_Qershor_Korrik_Gusht_Shtator_Tetor_Nëntor_Dhjetor'.split('_'),
        monthsShort : 'Jan_Shk_Mar_Pri_Maj_Qer_Kor_Gus_Sht_Tet_Nën_Dhj'.split('_'),
        weekdays : 'E Diel_E Hënë_E Martë_E Mërkurë_E Enjte_E Premte_E Shtunë'.split('_'),
        weekdaysShort : 'Die_Hën_Mar_Mër_Enj_Pre_Sht'.split('_'),
        weekdaysMin : 'D_H_Ma_Më_E_P_Sh'.split('_'),
        weekdaysParseExact : true,
        meridiemParse: /PD|MD/,
        isPM: function (input) {
            return input.charAt(0) === 'M';
        },
        meridiem : function (hours, minutes, isLower) {
            return hours < 12 ? 'PD' : 'MD';
        },
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[Sot në] LT',
            nextDay : '[Nesër në] LT',
            nextWeek : 'dddd [në] LT',
            lastDay : '[Dje në] LT',
            lastWeek : 'dddd [e kaluar në] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'në %s',
            past : '%s më parë',
            s : 'disa sekonda',
            m : 'një minutë',
            mm : '%d minuta',
            h : 'një orë',
            hh : '%d orë',
            d : 'një ditë',
            dd : '%d ditë',
            M : 'një muaj',
            MM : '%d muaj',
            y : 'një vit',
            yy : '%d vite'
        },
        ordinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return sq;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
