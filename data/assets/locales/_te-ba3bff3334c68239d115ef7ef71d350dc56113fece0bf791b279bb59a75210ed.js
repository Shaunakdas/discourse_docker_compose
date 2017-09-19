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

MessageFormat.locale.te = function ( n ) {
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
I18n.translations = {"te":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"బైటు","other":"బైట్లు"},"gb":"జీబీ","kb":"కేబీ","mb":"యంబీ","tb":"టీబీ"}}}},"dates":{"time":"h:mm a","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","tiny":{"half_a_minute":"\u003c 1ని","less_than_x_seconds":{"one":"\u003c 1సె","other":"\u003c %{count}సె"},"x_seconds":{"one":"1సె","other":"%{count}సె"},"x_minutes":{"one":"1ని","other":"%{count}ని"},"about_x_hours":{"one":"1గ","other":"%{count}గం"},"x_days":{"one":"1రో","other":"%{count}రో"},"about_x_years":{"one":"1సం","other":"%{count}సం"},"over_x_years":{"one":"\u003e 1సం","other":"\u003e %{count}సం"},"almost_x_years":{"one":"1సం","other":"%{count}సం"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 నిమిషం","other":"%{count} నిమిషాలు"},"x_hours":{"one":"1 గంట","other":"%{count} గంటలు"},"x_days":{"one":"1 రోజు","other":"%{count} రోజులు"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 నిమిషం ముందు","other":"%{count} నిమిషాలు ముందు"},"x_hours":{"one":"1 గంట క్రితం","other":"%{count} గంటల ముందు"},"x_days":{"one":"1 రోజు ముందు","other":"%{count} రోజుల ముందు"}}},"share":{"topic":"ఈ విషయానికి ఒక లంకెను పంచండి","post":"#%{postNumber} టపా","close":"మూసివేయి","twitter":"ట్విట్టరుపై లంకెను పంచు","facebook":"ఫేస్ బుక్ పై లంకెను పంచు","google+":"గూగుల్ ప్లస్ పై లంకెను పంచు","email":"ఈ లంకెను ఈమెయిల్ ద్వారా పంచు"},"topic_admin_menu":"విషయపు అధికార చర్యలు","emails_are_disabled":"బయటకు వెళ్లే అన్ని ఈమెయిల్లూ అధికారి నిశేధించాడు. ఇప్పుడు ఎటువంటి ఈమెయిల్ ప్రకటనలూ పంపవీలవదు.","edit":"ఈ విషయపు శీర్షిక మరియు వర్గం సవరించు","not_implemented":"ఈ ఫీచరు ఇంకా ఇంప్లిమెటు చేయలేదు. క్షమాపణలు!","no_value":"లేదు","yes_value":"అవును","generic_error":"క్షమించాలి, ఒక దోషం తలెత్తింది","generic_error_with_reason":"ఒక దోషం జరిగింది: %{error}","sign_up":"సైన్ అప్","log_in":"లాగిన్","age":"వయసు","joined":"చేరినారు","admin_title":"అధికారి","flags_title":"కేతనాలు","show_more":"మరింత చూపు","links":"లంకెలు","links_lowercase":{"one":"లంకె","other":"లంకెలు"},"faq":"తవసం","guidelines":"మార్గదర్శకాలు","privacy_policy":"అంతరంగికతా విధానం","privacy":"అంతరంగికత","terms_of_service":"సేవా నిబంధనలు ","mobile_view":"చర సందర్శనం","desktop_view":"డెస్క్ టాప్ సందర్శనం","you":"మీరు","or":"లేదా","now":"ఇప్పుడే","read_more":"మరింత చదువు","more":"మరింత","less":"తక్కువ","never":"ఎప్పటికీ వద్దు","daily":"ప్రతిరోజూ","weekly":"ప్రతీవారం","every_two_weeks":"రెండువారాలకోసారి","every_three_days":"ప్రతి మూడు రోజులకీ","max_of_count":"{{count}} గరిష్టం","character_count":{"one":"{{count}} అక్షరం","other":"{{count}} అక్షరాలు"},"suggested_topics":{"title":"సూచించే విషయాలు"},"about":{"simple_title":"గురించి","title":"%{title} గురించి","stats":"సైటు గణాంకాలు","our_admins":"మా అధికారులు","our_moderators":"మా నిర్వాహకులు","stat":{"all_time":"ఆల్ టైమ్","last_7_days":"గత ఏడు రోజులు","last_30_days":"గత 30 రోజులు"},"like_count":"ఇష్టాలు","topic_count":"విషయాలు","post_count":"టపాలు","user_count":"కొత్త సభ్యులు","active_user_count":"క్రియాశీల సభ్యులు","contact":"మమ్ము సంప్రదించండి","contact_info":"ఈ సంధర్భంలో క్లిష్టమైన సమస్య లేదా అత్యవసర విషయం సైట్ ను ప్రభావితం చేస్తుంది, దయచేసి మమ్మల్ని సంప్రదించండి %{contact_info}."},"bookmarked":{"title":"పేజీక","clear_bookmarks":"పేజీక లను తుడిచివేయి","help":{"bookmark":"ఈ అంశంపై మొదటి టపాకి పేజీకలను పెట్టండి","unbookmark":"ఈ అంశంపై అన్ని పేజీకలను తొలగించడానికి నొక్కండి"}},"bookmarks":{"not_logged_in":"క్షమించాలి. విషయాలకు పేజీక ఉంచడానికి లాగిన్ అయి ఉండాలి","created":"ఈ టపాకు పేజీక ఉంచారు","not_bookmarked":"ఈ టపాను చదివారు; పేజీక ఉంచుటకు నొక్కండి","last_read":"మీరు చివరాఖరుగా చదివిన టపా ఇది; పేజీక ఉంచుటకు నొక్కండి","remove":"పేజీక తొలగించండి"},"topic_count_latest":{"one":"{{count}} కొత్త లేదా ఉన్నతీకరించిన విషయం","other":"{{count}} కొత్త లేదా ఉన్నతీకరించిన విషయాలు"},"topic_count_unread":{"one":"{{count}} చదవని విషయం.","other":"{{count}} చదవని విషయాలు."},"topic_count_new":{"one":"{{count}} కొత్త విషయం.","other":"{{count}} కొత్త విషయాలు."},"click_to_show":"చూపుటకు ఇక్కడ నొక్కండి","preview":"మునుజూపు","cancel":"రద్దు","save":"మార్పులు భద్రపరచండి","saving":"భద్రపరుస్తున్నాం...","saved":"భద్రం!","upload":"ఎగుమతించు","uploading":"ఎగుమతవుతోంది...","uploaded":"ఎగుమతైంది!","enable":"చేతనం","disable":"అచేతనం","undo":"రద్దు","revert":"తిద్దు","failed":"విఫలం","banner":{"close":"బ్యానరు తుడువు"},"choose_topic":{"none_found":"ఎటువంటి విషయాలూ కనపడలేదు.","title":{"search":"పేరు, యూఆర్ యల్, ఐడీ లను బట్టి విషయాన్ని వెతుకు.","placeholder":"ఇక్కడ విషయపు శీర్షిక రాయండి"}},"queue":{"cancel":"రద్దుచేయి","approval":{"ok":"సరే"}},"user_action":{"user_posted_topic":"\u003ca href='{{topicUrl}}'\u003eవిషయాన్ని\u003c/a\u003e \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e రాసారు ","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e  \u003ca href='{{topicUrl}}'\u003eవిషయాన్ని\u003c/a\u003e రాసారు","user_replied_to_post":"\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e కు \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e  జవాబిచ్చారు","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e  \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e కు జవాబిచ్చారు","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003eకు \u003ca href='{{topicUrl}}'\u003eవిషయానికి\u003c/a\u003e జవాబిచ్చారు","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e కు \u003ca href='{{topicUrl}}'\u003eవిషయానికి\u003c/a\u003e జవాబిచ్చారు","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e,  \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e ను ప్రస్తావించారు","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e, \u003ca href='{{user2Url}}'\u003eమిమ్ము\u003c/a\u003e ప్రస్తావించారు","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eమీరు\u003c/a\u003e, \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e ను ప్రస్తావించారు","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e రాసారు","posted_by_you":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e రాసారు","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e పంపారు","sent_by_you":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e పంపారు"},"directory":{"title":"వాడుకరులు"},"groups":{"visible":"గుంపు అందరు సభ్యులకు కనిపిస్తుంది","title":{"one":"గుంపు","other":"గుంపులు"},"members":"సభ్యులు","posts":"టపాలు","alias_levels":{"nobody":"ఎవరూకాదు","only_admins":"కేవలం అధికారులే","mods_and_admins":"కేవలం అధికారులు మరియు నిర్వాహకులు మాత్రమే","members_mods_and_admins":"కేవలం గుంపు సభ్యులు, నిర్వాహకులు మరియు అధికారులు","everyone":"అందరూ"}},"user_action_groups":{"1":"ఇచ్చిన ఇష్టాలు ","2":"వచ్చిన ఇష్టాలు","3":"పేజీకలు","4":"విషయాలు","7":"ప్రస్తావనలు","9":"కోట్ లు","11":"సవరణలు","12":"పంపిన అంశాలు","13":"ఇన్ బాక్స్"},"categories":{"all":"అన్ని వర్గాలు","all_subcategories":"అన్నీ","no_subcategory":"ఏదీకాదు","category":"వర్గం","posts":"టపాలు","topics":"విషయాలు","latest":"తాజా","latest_by":"నుండి తాజా","toggle_ordering":"వరుస నియంత్రణను అటుఇటుచేయి","subcategories":"ఉప వర్గాలు","topic_stat_sentence":{"one":"%{unit} కాలంలో %{count} ఒక కొత్త టపా.","other":" %{unit} గతంలో %{count} కొత్త విషయాలు."}},"ip_lookup":{"title":"ఐపీ చిరునామా లుకప్","hostname":"అతిథిపేరు","location":"ప్రాంతం","location_not_found":"(తెలీని)","organisation":"సంస్థ","phone":"ఫోన్","other_accounts":"ఈ ఐపీ చిరునామాతో ఇతర ఖాతాలు:","delete_other_accounts":"%{count} తొలగించు","username":"సభ్యనామం","trust_level":"టీయల్","read_time":"చదువు సమయం","topics_entered":"రాసిన విషయాలు ","post_count":"# టపాలు","confirm_delete_other_accounts":"మీరు నిజ్జంగా ఈ ఖాతాలు తొలగించాలనుకుంటున్నారా?"},"user":{"said":"{{username}}:","profile":"ప్రవర","mute":"నిశ్శబ్దం","edit":"అభిరుచులు సవరించు","download_archive":"నా టపాలు దిగుమతించు","private_messages":"సందేశాలు","activity_stream":"కలాపం","preferences":"అభిరుచులు","bookmarks":"పేజీకలు","bio":"నా గురించి","invited_by":"ఆహ్వానిచినవారు","trust_level":"నమ్మకపు స్థాయి","notifications":"ప్రకటనలు","dismiss_notifications_tooltip":"అన్ని చదవని ప్రకటనలూ చదివినట్టు గుర్తించు","disable_jump_reply":"నేను జవాబిచ్చాక నా టపాకు వెళ్లవద్దు","external_links_in_new_tab":"అన్ని బాహ్య లంకెలనూ కొత్త ట్యాబులో తెరువు","enable_quoting":"హైలైట్ అయిన పాఠ్యానికి కోట్ జవాబు చేతనం చేయి","change":"మార్చు","moderator":"{{user}} ఒక నిర్వాహకుడు","admin":"{{user}} ఒక అధికారి","moderator_tooltip":"ఈ సభ్యుడు ఒక నిర్వాహకుడు","admin_tooltip":"ఈ సభ్యుడు ఒక అధికారి","suspended_notice":"ఈ సభ్యుడు {{date}} వరకూ సస్పెండయ్యాడు","suspended_reason":"కారణం:","github_profile":"గిట్ హబ్","watched_categories":"ఒకకన్నేసారు","tracked_categories":"గమనించారు","muted_categories":"నిశ్శబ్దం","delete_account":"నా ఖాతా తొలగించు","delete_account_confirm":"నిజ్జంగా మీరు మీ ఖాతాను శాస్వతంగా తొలగించాలనుకుంటున్నారా? ఈ చర్య రద్దుచేయలేరు సుమా! ","deleted_yourself":"మీ ఖాతా విజయవంతంగా తొలగించబడింది. ","delete_yourself_not_allowed":"మీ ఖాతాను ఇప్పుడు తొలగించలేరు. మీ ఖాతాను తొలగించడానికి అధికారిని సంప్రదించండి. ","unread_message_count":"సందేశాలు","admin_delete":"తొలగించు","users":"వాడుకరులు","staff_counters":{"flags_given":"సహాయకారి కేతనాలు","flagged_posts":"కేతనించిన టపాలు","deleted_posts":"తొగలించిన టపాలు","suspensions":"సస్పెన్షన్లు","warnings_received":"హెచ్చరికలు"},"messages":{"all":"అన్నీ"},"change_password":{"success":"(ఈమెయిల్ పంపిన)","in_progress":"(ఈమెయిల్ పంపుతోన్నాం)","error":"(దోషం)","action":"సంకేతపద రీసెట్ ఈమెయిల్ పంపు","set_password":"సంకేతపదం అమర్చు"},"change_about":{"title":"నా గురించి మార్చు"},"change_username":{"title":"సభ్యనామం మార్చు","taken":"క్షమించాలి, ఆ సభ్యనామం వేరొకరు తీసుకున్నారు.","error":"మీ సభ్యనామం మార్చడంలో దోషం.","invalid":"ఆ సభ్యనామం చెల్లనిది. కేవలం సంఖ్యలు, అక్షరాలు మాత్రమే కలిగి ఉండాలి. "},"change_email":{"title":"ఈమెయిల్ మార్చు","taken":"క్షమించాలి. ఆ ఈమెయిల్ అందుబాటులో లేదు.","error":"మీ ఈమెయిల్ మార్చడంలో దోషం. బహుశా ఆ చిరునామా ఇప్పటికే ఈ సైటులో వాడుకలో ఉందేమో? ","success":"ఆ చిరునామాకు మేము వేగు పంపాము. అందులోని సూచనలు అనుసరించండి. "},"change_avatar":{"title":"మీ ప్రవర బొమ్మ మార్చండి.","gravatar":"ఆధారపడిన \u003ca href='//gravatar.com/emails' target='_blank'\u003eగ్రావతారం\u003c/a\u003e","refresh_gravatar_title":"మీ గ్రావతారం తాజాపరుచు","letter_based":"వ్యవస్థ కేటాయించిన ప్రవర బొమ్మ","uploaded_avatar":"అనురూప బొమ్మ","uploaded_avatar_empty":"అనురూప బొమ్మను కలపండి","upload_title":"మీ బొమ్మను కలపండి","upload_picture":"బొమ్మను ఎగుమతించండి"},"change_profile_background":{"title":"ప్రవర వెనుతలం","instructions":"ప్రవర వెనుతలాలు కేంద్రీకరించబడతాయి మరియు అప్రమేయ వెడల్పు 850 పిక్సెలు ఉంటాయి."},"change_card_background":{"title":"సభ్య కార్డు వెనుతలం","instructions":"వెనుతలం బొమ్మలు కేంద్రీకరించబడతాయి మరియు అప్రమేయ వెడల్పు 590 పిక్సెలు ఉంటాయి."},"email":{"title":"ఈమెయిల్","instructions":"జనాలకు ఎప్పుడూ చూపవద్దు","ok":"ద్రువపరుచుటకు మీకు ఈమెయిల్ పంపాము","invalid":"దయచేసి చెల్లుబాటులోని ఈమెయిల్ చిరునామా రాయండి","authenticated":"మీ ఈమెయిల్  {{provider}} చేత ద్రువీకరించబడింది"},"name":{"title":"పేరు","instructions":"మీ పూర్తి పేరు (ఐచ్చికం)","too_short":"మీ పేరు మరీ చిన్నది","ok":"మీ పేరు బాగుంది"},"username":{"title":"వాడుకరి పేరు","instructions":"ఏకైకం, జాగాలేని, పొట్టి","short_instructions":"జనాలు మిమ్మల్ని @{{username}} అని ప్రస్తావించవచ్చు","available":"మీ సభ్యనామం అందుబాటులో ఉంది.","global_match":"ఈమెయిల్ రిజిస్టరు అయిన సభ్యనామంతో సరిపోతోంది.","global_mismatch":"ఇప్పటికే రిజిస్టరు అయింది. {{suggestion}} ప్రయత్నించండి? ","not_available":"అందుబాటులో లేదు. {{suggestion}} ప్రయత్నించండి?","too_short":"మీ సభ్యనామం మరీ చిన్నది","too_long":"మీ సభ్యనామం మరీ పొడుగు","checking":"సభ్యనామం అందుబాటు పరిశీలిస్తున్నాం...","enter_email":"సభ్యనామం కనిపించింది; సరిపోలు ఈమెయిల్ రాయండి","prefilled":"ఈమెయిల్ రిజిస్టరు అయిన సభ్యనామంతో సరిపోతోంది"},"locale":{"title":"ఇంటర్ఫేస్ భాష","instructions":"యూజర్ ఇంటర్ఫేస్ భాష. పుట తాజాపరిస్తే ఇది మారుతుంది. ","default":"(అప్రమేయ)"},"password_confirmation":{"title":"సంకేతపదం మరలా"},"last_posted":"చివరి టపా","last_emailed":"చివరగా ఈమెయిల్ చేసింది","last_seen":"చూసినది","created":"చేరినది","log_out":"లాగవుట్","location":"ప్రాంతం","card_badge":{"title":"సభ్యు బ్యాడ్జి కార్డు"},"website":"వెబ్ సైటు","email_settings":"ఈమెయిల్","email_digests":{"daily":"ప్రతీరోజు","every_three_days":"ప్రతి మూడు రోజులకీ","weekly":"ప్రతీవారం","every_two_weeks":"ప్రతి రెండు వారాలకీ"},"other_settings":"ఇతర","categories_settings":"వర్గాలు","new_topic_duration":{"label":"విషయాలు కొత్తగా భావించు, ఎప్పుడంటే","not_viewed":"నేను వాటిని ఇంకా చూడనప్పుడు","last_here":"నేను చివరిసారి ఇక్కడికి వచ్చిన తర్వాత సృష్టించినవి"},"auto_track_topics":"నేను రాసే విషయాలు ఆటోమేటిగ్గా గమనించు","auto_track_options":{"never":"ఎప్పటికీ వద్దు"},"invited":{"search":"ఆహ్వానాలను వెతకడానికి రాయండి ... ","title":"ఆహ్వానాలు","user":"ఆహ్వానించిన సభ్యుడు","redeemed":"మన్నించిన ఆహ్వానాలు","redeemed_at":"మన్నించిన","pending":"పెండింగులోని ఆహ్వానాలు","topics_entered":"చూసిన విషయాలు","posts_read_count":"చదివిన టపాలు","expired":"ఈ ఆహ్వానం కాలాతీతమైంది.","rescind":"తొలగించు","rescinded":"ఆహ్వానం తొలగించారు","reinvite":"ఆహ్వానం మరలా పంపు","reinvited":"ఆహ్వానం మరలా పంపారు","time_read":"చదువు సమయం","days_visited":"దర్శించిన రోజులు","account_age_days":"రోజుల్లో ఖాతా వయసు","create":"ఒక ఆహ్వానం పంపు","bulk_invite":{"none":"మీరు ఇంకా ఎవరినీ ఆహ్వానించలేదు. మీరు వ్యక్తిగత ఆహ్వానాలు పంపవచ్చు, లేదా కొంతమందికి ఒకేసారి \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eఆహ్వాన దస్త్రం ఎగుమతించుట ద్వారా\u003c/a\u003e పంపవచ్చు.","text":"దస్త్రం నుండి బహుళ ఆహ్వానాలు","uploading":"ఎగుమతవుతోంది...","error":"'{{filename}}' ఎగుమతించుటలో దోషం: {{message}}"}},"password":{"title":"సంకేతపదం","too_short":"మీ సంకేతపదం మరీ చిన్నది.","common":"ఆ సంకేతపదం మరీ సాధారణం.","same_as_username":"మీ సంకేతపదం మీ వినియోగదారుపేరు ని పోలి ఉంది.","same_as_email":"మీ సంకేతపదం మీ ఈమెయిల్ ను పోలి ఉంది.","ok":"మీ సంకేతపదం బాగుంది.","instructions":"కనీసం %{count}  అక్షరాలు ఉండాలి."},"associated_accounts":"లాగిన్లు","ip_address":{"title":"చివరి ఐపీ చిరునామా"},"registration_ip_address":{"title":"రిజిస్ట్రేషన్ ఐపీ చిరునామా"},"avatar":{"title":"ప్రవర బొమ్మ"},"title":{"title":"శీర్షిక"},"filters":{"all":"అన్నీ"},"stream":{"posted_by":"టపా రాసినవారు","sent_by":"పంపినవారు","the_topic":"విషయం"}},"loading":"లోడవుతోంది...","errors":{"prev_page":"ఎక్కించుట ప్రయత్నిస్తున్నప్పుడు","reasons":{"network":"నెట్వర్క్ దోషం","server":"సేవిక దోషం","forbidden":"అనుమతి నిరాకరించబడింది","unknown":"దోషం"},"desc":{"network":"దయచేసి మీ కనక్షన్ సరిచూడండి. ","network_fixed":"ఇప్పుడు మరలా పనిచేస్తుంది.","server":"దోష కోడు:  {{status}}","forbidden":"దాన్ని చూడటానికి మీకు అనుమతి లేదు","unknown":"ఏదో తేడా జరిగింది."},"buttons":{"back":"వెనక్కు వెళ్లండి","again":"మళ్ళీ ప్రయత్నించండి","fixed":"పుట ఎక్కించండి"}},"close":"మూసివేయి","assets_changed_confirm":"ఈ సైటు ఇప్పుడే ఉన్నతీకరించబడింది. కొత్త రూపాంతరం చూడటానికి తాజాపరచండి?","logout":"మీరు లాగవుట్ అయ్యారు.","refresh":"తాజాపరుచు","read_only_mode":{"login_disabled":"సేటు కేవలం చదివే రీతిలో ఉన్నప్పుడు లాగిన్ వీలవదు."},"learn_more":"మరింత తెలుసుకోండి...","year":"సంవత్సరం","year_desc":"గత 365 రోజులలో సృష్టించిన విషయాలు","month":"నెల","month_desc":"గత 30 రోజులలో సృష్టించిన విషయాలు","week":"వారం","week_desc":"గత 7 రోజులలో సృష్టించిన విషయాలు","day":"రోజు","first_post":"తొలి టపా","mute":"నిశ్శబ్దం","unmute":"వినిశ్శబ్దం","last_post":"చివరి టపా","summary":{"enabled_description":"మీరు ఈ విషయపు సారాంశము చదువుతున్నారు. ఆసక్తికర టపాలు కమ్యునిటీ ఎంచుకుంటుంది. ","enable":"ఈ విషయాన్ని సంగ్రహించు","disable":"అన్ని టపాలూ చూపు"},"deleted_filter":{"enabled_description":"ఈ విషయం తొలగించిన టపాలు కలిగి ఉంది. అవి దాయబడ్డాయి.","disabled_description":"ఈ విషయంలోని తొలగించిన టపాలు చూపుతున్నాము.","enable":"తొలగించిన టపాలు దాయు","disable":"తొలగించిన టపాలు చూపు"},"private_message_info":{"invite":"ఇతరులను ఆహ్వానించు"},"email":"ఈమెయిల్","username":"వాడుకరి పేరు","last_seen":"చూసిన","created":"సృష్టించిన","created_lowercase":"సృష్టించిన","trust_level":"నమ్మకపు స్థాయి","search_hint":"సభ్యనామం, ఈమెయిల్ మరియు ఐపీ చిరునామా","create_account":{"title":"కొత్త ఖాతా సృష్టించు","failed":"ఏదో తేడా జరిగింది. బహుశా ఈమెయిల్ ఇప్పటికే ఈసైటులో రిజిస్టరు అయి ఉందేమో, సంకేతపదం మర్చిపోయా లంకె ప్రయత్నించు."},"forgot_password":{"action":"నేను నా సంకేతపదాన్ని మర్చిపోయాను","invite":"మీ సభ్యనామం లేదా ఈమెయిల్ చిరునామా రాయండి, మేము మీ సంకేతపదం మార్చే విధం మీకు ఈమెయిల్ చేస్తాము.","reset":"రీసెట్ సంకేతపదం","complete_username":"సభ్యనామం  \u003cb\u003e%{username}\u003c/b\u003e తో ఈ ఖాతా సరిపోతే మీకు సంకేతపదం రీసెట్ చేసే సూచనలు ఈమెయిల్ ద్వారా వస్తాయి. ","complete_email":"ఈమెయిల్  \u003cb\u003e%{email}\u003c/b\u003e తో ఈ ఖాతా సరిపోతే మీకు సంకేతపదం రీసెట్ చేసే సూచనలు ఈమెయిల్ ద్వారా వస్తాయి. ","complete_username_found":"మేము ఈ సభ్యనామం \u003cb\u003e%{username}\u003c/b\u003e తో సరిపోయే ఒక ఖాతా కనుగొన్నాము, మీకు అతి త్వరలో సంకేతపదం రీసెట్ చేసే సూచనలతో కూడిన ఈమెయిల్ వస్తుంది.","complete_email_found":"మేము ఈ ఈమెయిల్ \u003cb\u003e%{email}\u003c/b\u003e తో సరిపోయే ఒక ఖాతా కనుగొన్నాము, మీకు అతి త్వరలో సంకేతపదం రీసెట్ చేసే సూచనలతో కూడిన ఈమెయిల్ వస్తుంది.","complete_username_not_found":"మీ సభ్యనామం \u003cb\u003e%{username}\u003c/b\u003e తో ఏ ఖాతా సరిపోవడంలేదు.","complete_email_not_found":"\u003cb\u003e%{email}\u003c/b\u003e తో ఏ ఖాతా సరిపోవడంలేదు"},"login":{"title":"లాగిన్","username":"వాడుకరి","password":"సంకేతపదం","email_placeholder":"ఈమెయిల్ లేదా సభ్యనామం","caps_lock_warning":"క్యాప్స్ లాక్ ఆన్ అయి ఉంది","error":"తెలీని దోషం","blank_username_or_password":"దయచేసి మీ ఈమెయిల్ లేదా సభ్యనామం మరియు సంకేతపదం రాయండి","reset_password":"రీసెట్ సంకేతపదం","logging_in":"ప్రవేశపెడ్తోన్నాం","or":"లేదా","authenticating":"ద్రువీకరిస్తున్నాము...","awaiting_confirmation":"మీ ఖాతా చేతనం కోసం ఎదురుచూస్తుంది. సంకేతపదం మర్చిపోయా లంకెను వాడు మరో చేతన ఈమెయిల్ పొందండి.","awaiting_approval":"మీ ఖాతా ఇంకా సిబ్బంది ఒప్పుకొనలేదు. సిబ్బంది ఒప్పుకోగానే మీకు ఒక ఈమెయిల్ వస్తుంది.","requires_invite":"క్షమించాలి. ఈ పోరమ్ ప్రవేశం కేవలం ఆహ్వానితులకు మాత్రమే.","not_activated":"మీరప్పుడే లాగిన్ అవ్వలేరు. గతంలో మేము మీకు చేతన ఈమెయల్ \u003cb\u003e{{sentTo}}\u003c/b\u003e కు పంపాము. దయచేసి ఆ వేగులోని సూచనలు పాటించి మీ ఖాతాను చేతనం చేసుకోండి.","not_allowed_from_ip_address":"ఆ ఐపీ చిరునామా నుండి మీరు లాగిన్ అవ్వలేరు.","admin_not_allowed_from_ip_address":"మీరు ఆ IP చిరునామా నుండి నిర్వాహకుని వలె లాగిన్ కాలేరు.","resend_activation_email":"చేతన ఈమెయిల్ మరలా పంపడానికి ఇక్కడ నొక్కండి.","sent_activation_email_again":"మీకు \u003cb\u003e{{currentEmail}}\u003c/b\u003e మరో చేతన ఈమెయిల్ పంపాము. అది చేరుకోడానికి కొద్ది నిమిషాలు పట్టవచ్చు. ఇంకా స్పామ్ ఫోల్డరు చూడటం మర్చిపోకండి సుమా. ","google":{"title":"గూగుల్ తో","message":"గూగుల్ ద్వారా లాగిన్ (పాపప్ లు అనుమతించుట మర్చిపోకండి)"},"google_oauth2":{"title":"గూగుల్ తో","message":"గూగుల్ ద్వారా లాగిన్ (పాపప్ లు అనుమతించుట మర్చిపోకండి)"},"twitter":{"title":"ట్విట్టరు తో","message":"ట్విట్టరు ద్వారా లాగిన్ (పాపప్ లు అనుమతించుట మర్చిపోకండి)"},"facebook":{"title":"ఫేస్ బుక్ తో","message":"ఫేస్ బుక్ ద్వారా లాగిన్ (పాపప్ లు అనుమతించుట మర్చిపోకండి)"},"yahoo":{"title":"యాహూ తో","message":"యాహూ ద్వారా లాగిన్ (పాపప్ లు అనుమతించుట మర్చిపోకండి)"},"github":{"title":"గిట్ హబ్ తో","message":"గిట్ హబ్ ద్వారా లాగిన్ (పాపప్ లు అనుమతించుట మర్చిపోకండి)"}},"composer":{"add_warning":"ఇది ఒక అధికారిక హెచ్చరిక","posting_not_on_topic":"ఏ విషయానికి మీరు జవాబివ్వాలనుకుంటున్నారు? ","saved_draft_tip":"భద్రం","saved_local_draft_tip":"స్థానికంగా భద్రం","similar_topics":"మీ విషయం దీని వలె ఉంది...","drafts_offline":"చిత్తుప్రతులు ఆఫ్లైను.","error":{"title_missing":"శీర్షిక తప్పనిసరి","title_too_short":"శీర్షిక కనీసం  {{min}} అక్షరాలు ఉండాలి","title_too_long":"శీర్షిక {{max}} అక్షరాలకు మించి ఉండకూడదు","post_missing":"టపా ఖాళీగా ఉండకూడదు","post_length":"టపా కనీసం {{min}} అక్షరాలు కలిగి ఉండాలి","category_missing":"మీరు ఒక వర్గాన్ని ఎంచుకోవాలి"},"save_edit":"దాచి సవరించు","reply_original":"మూల విషయంకు జవాబివ్వు","reply_here":"ఇక్కడ జవాబివ్వు","reply":"జవాబు","cancel":"రద్దుచేయి","title":"లేదా కంట్రోల్ + ఎంటర్ నొక్కు","users_placeholder":"ఒక సభ్యుడిని కలుపు","title_placeholder":"ఈ చర్చ దేనిగురించో ఒక లైనులో చెప్పండి?","edit_reason_placeholder":"మీరెందుకు సవరిస్తున్నారు?","show_edit_reason":"(సవరణ కారణం రాయండి)","view_new_post":"మీ కొత్త టపా చూడండి","saved":"భద్రం!","saved_draft":"టపా చిత్తుప్రతి నడుస్తోంది. కొనసాగించుటకు ఎంచుకోండి.","uploading":"ఎగుమతవుతోంది...","show_preview":"మునుజూపు చూపు \u0026raquo;","hide_preview":"\u0026laquo; మునుజూపు దాచు","quote_post_title":"మొత్తం టపాను కోట్ చేయి","bold_title":"బొద్దు","bold_text":"బొద్దు పాఠ్యం","italic_title":"వాలు","italic_text":"వాలు పాఠ్యం","link_title":"హైపర్ లంకె","link_description":"లంకె వివరణ ఇక్కడ రాయండి","link_dialog_title":"హైపర్ లంకె చొప్పించండి","link_optional_text":"ఐచ్చిక శీర్షిక","quote_title":"బ్లాక్ కోట్","quote_text":"బ్లాక్ కోట్","code_title":"ముందే అలంకరించిన పాఠ్యం","code_text":"ముందే అలంకరించిన పాఠ్యాన్ని 4 జాగాలు జరుపు","upload_title":"ఎగుమతించు","upload_description":"ఎగుమతి వివరణ ఇక్కడ రాయండి","olist_title":"సంఖ్యా జాబితా","ulist_title":"చుక్కల జాబితా","list_item":"జాబితా అంశం","heading_title":"తలకట్టు","heading_text":"తలకట్టు","hr_title":"అడ్డు గీత","help":"మార్క్ డైన్ సవరణ సహాయం","toggler":"దాచు లేదా చూపు కంపోజరు ఫలకం","admin_options_title":"ఈ విషయానికి ఐచ్చిక సిబ్బంది అమరికలు","auto_close":{"label":"విషయపు స్వీయ ముగింపు కాలం:","error":"దయచేసి చెల్లే విలువ రాయండి","based_on_last_post":"ఈ విషయంలో చివరి టపా కనీసం ఇంత వయసు వచ్చేంతవరకూ విషయాన్ని మూయకు.","all":{"examples":"గంటలు (24), సమయం(17:30) లేదా కాలముద్రణ (2013-11-22 14:00) రాయండి."},"limited":{"units":"(# గంటలు)","examples":"గంటల సంఖ్య(24)ను రాయండి."}}},"notifications":{"none":"ఈ సమయంలో ప్రకటనలు చూపలేకున్నాము.","more":"పాత ప్రకటనలు చూడు","total_flagged":"మొత్తం కేతనించిన టపాలు","quoted":"\u003ci title='కోట్ చేసారు' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='జవాబిచ్చారు' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title=' సవరించారు' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='ఇష్టపడ్డారు' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='ప్రైవేటు సందేశం' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='ప్రైవేటు సందేశం' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='మీ ఆహ్వానాన్ని మన్నించారు' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='టపా జరిపారు' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='బ్యాడ్జ్ ప్రసాదించారు' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eEarned '{{description}}'\u003c/p\u003e"},"upload_selector":{"title":"ఒక బొమ్మ కలుపు","title_with_attachments":"ఒక బొమ్మ లేదా దస్త్రం కలుపు","from_my_computer":"నా పరికరం నుండి","from_the_web":"జాలం నుండి","remote_tip":"బొమ్మకు లంకె","hint":"(మీరు వాటిని ఎడిటరులోకి లాగి వదిలెయ్యటు ద్వారా కూడా ఎగుమతించవచ్చు)","uploading":"ఎగుమతవుతోంది","image_link":"మీ బొమ్మ చూపే లంకె"},"search":{"title":"విషయాలు, టపాలు, సభ్యులు లేదా వర్గాలు వెతుకు","no_results":"ఎటువంటి ఫలితాలు దొరకలేదు.","searching":"వెతుకుతున్నామ్...","post_format":"{{username}} నుండి #{{post_number}}","context":{"user":"@{{username}} యొక్క విషయాలు వెతుకు","topic":"ఈ విషయంలో వెతుకు"}},"go_back":"వెనక్కు మరలు","not_logged_in_user":"సభ్యుని ప్రస్తుత కలాపాల మరియు అభిరూపాల సారాంశ పుట","current_user":"మీ సభ్యపుటకు వెళ్లు","topics":{"bulk":{"reset_read":"రీలోడ్ రీసెట్","delete":"విషయాలు తొలగించు","dismiss_new":"కొత్తవి తుడువు","toggle":"విషయాల బహుళ ఎంపికలు అటుఇటుచేయి","actions":"బహుళ చర్యలు","change_category":"వర్గం మార్చు","close_topics":"విషయాలు మూయు","archive_topics":"విషయాలు కట్టకట్టు","notification_level":"ప్రకటన స్థాయి మార్చు","choose_new_category":"విషయం కొరకు కొత్త వర్గం ఎంచుకొండి:","selected":{"one":"మీరు \u003cb\u003e1\u003c/b\u003e  విషయం ఎంచుకున్నారు.","other":" మీరు \u003cb\u003e{{count}}\u003c/b\u003e విషయాలు ఎంచుకున్నారు."}},"none":{"unread":"మీరు చదవని విషయాలు లేవు","new":"మీకు కొత్త విషయాలు లేవు","read":"మీరింకా ఏ విషయాలూ చదవలేదు.","posted":"మీరింకా ఏ విషయాలూ రాయలేదు.","latest":"కొత్త విషయాలు లేవు. అహో ఎంతటి విపరిణామం.","hot":"వేడివేడి విషయాలు లేవు.","bookmarks":"మీకింకా ఎట్టి పేజీక విషయాలూ లేవు.","category":"ఎట్టి {{category}}  విషయాలూ లేవు","top":"ఎట్టి అగ్ర విషయాలూ లేవు."},"bottom":{"latest":"ఇంకా కొత్త విషయాలు లేవు.","hot":"ఇంకా వేడివేడి విషయాలు లేవు.","posted":"ఇంకా రాసిన విషయాలు లేవు.","read":"ఇంకా చదవని విషయాలు లేవు.","new":"కొత్త విషయాలు లేవు.","unread":"ఇంకా చదవని విషయాలు లేవు.","category":"ఇంకా {{category}}  విషయాలు లేవు.","top":"ఇంకా అగ్ర విషయాలు లేవు.","bookmarks":"ఇంకా పేజీక విషయాలు లేవు."}},"topic":{"create":"కొత్త విషయం","create_long":"కొత్త విషయం సృష్టించు","list":"విషయాలు","new":"కొత్త విషయం","unread":"చదవని","new_topics":{"one":"1 కొత్త విషయం","other":"{{count}} కొత్త విషయాలు"},"unread_topics":{"one":"1 చదవని విషయం","other":"{{count}} చదవని విషయాలు"},"title":"విషయం","invalid_access":{"title":"విషయం ప్రైవేటు","description":"క్షమించాలి, ఆ విషయానికి మీకు అనుమతి లేదు!","login_required":"ఆ విషయం చదవడానికి మీరు లాగిన్ అయి ఉండాలి."},"server_error":{"title":"విషయాలు చూపుట విఫలమైంది","description":"క్షమించాలి. ఆ విషయం చూపలేకున్నాము. బహుశా కనక్షను సమస్య వల్ల అనుకుంటాను.దయచేసి మరలా ప్రయత్నించండి. సమస్య కొనసాగితే మాకు తెలియపర్చండి."},"not_found":{"title":"విషయం కనిపించలేదు","description":"క్షమించాలి. ఆ విషయం మేము కనుగొనలేకున్నాము. బహుశా నిర్వాహకులు దాన్ని తొలగించారేమో?"},"total_unread_posts":{"one":"మీకు ఈ విషయంలో 1 చదవని టపా ఉంది","other":"మీకు ఈ విషయంలో {{count}} చదవని టపాలు ఉన్నాయి"},"unread_posts":{"one":"మీకు ఈ విషయంలో 1 చదవని పాత టపా ఉంది","other":"మీకు ఈ విషయంలో {{count}} చదవని పాత టపాలు ఉన్నాయి"},"new_posts":{"one":"మీరు చివరసారి చదివాక ఈ విషయంలో  1 కొత్త టపా వచ్చింది","other":"మీరు చివరసారి చదివాక ఈ విషయంలో  {{count}} కొత్త టపాలు వచ్చాయి"},"likes":{"one":"ఈ విషయానికి 1 ఇష్టం ఉంది","other":"ఈ విషయానికి {{count}} ఇష్టాలు ఉన్నాయి"},"back_to_list":"విషయాల జాబితాకు మరలు","options":"విషయపు ఐచ్చికాలు","show_links":"ఈ విషయంలో లంకెలు చూపు","toggle_information":"విషయపు వివరాలు అటుఇటుచేయి","read_more_in_category":"మరింత చదవాలనుకుంటున్నారా? {{catLink}} లేదా {{latestLink}} లో ఇతర విషయాలు చూడు.","read_more":"మరిన్ని చదవాలనుకుంటున్నారా? {{catLink}} లేదా {{latestLink}}.","browse_all_categories":"అన్ని వర్గాలూ జల్లించు","view_latest_topics":"తాజా విషయాలు చూడు","suggest_create_topic":"ఓ విషయమెందుకు సృష్టించకూడదూ?","jump_reply_up":"పాత జవాబుకు వెళ్లు","jump_reply_down":"తరువాతి జవాబుకు వెళ్లు","deleted":"ఈ విషయం తొలగించబడింది","auto_close_notice":"ఈ విషయం %{timeLeft} తర్వాత స్వీయంగా మూయబడుతుంది.","auto_close_notice_based_on_last_post":"చివరి జవాబు తర్వాత %{duration}కు ఈ విషయం స్వీయ మూయబడుతుంది","auto_close_title":"స్వీయ ముగింపు అమరికలు","auto_close_save":"దాచు","auto_close_remove":"ఈ విషయాన్ని స్వీయ ముగించవద్దు","progress":{"title":"విషయపు పురోగతి","go_top":"అగ్ర","go_bottom":"అడుగు","go":"వెళ్లు","jump_bottom_with_number":"%{post_number} టపాకు వళ్లు","total":"అన్ని టపాలు","current":"ప్రస్తుత టపా"},"notifications":{"reasons":{"3_6":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే మీరు ఈ వర్గాంపై కన్నేసారు","3_5":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే ఈ విషయం స్వీయ కన్నేసారు. ","3_2":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే మీరు ఈ విషయంపై కన్నేసారు.","3_1":"మీకు ప్రకటనలు వస్తాయి ఎందుకంటే మీరు ఈ విషయాన్ని సృష్టించారు.","3":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే మీరు ఈ విషయంపై కన్నేసారు.","2_8":"మీకు ప్రకటనలు వస్తాయి ఎందుకంటే మీరు ఈ వర్గాన్ని గమనిస్తున్నారు.","2_4":"మీకు ప్రకటనలు వస్తాయి ఎందుకంటే మీరు ఈ విషయానికి జవాబిచ్చారు.","2_2":"మీకు ప్రకటనలు వస్తాయి ఎందుకంటే మీరు ఈ విషయాన్ని గమనిస్తున్నారు.","2":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే \u003ca href=\"/users/{{username}}/preferences\"\u003eమీరు ఈ విషయాన్ని చదివారు\u003c/a\u003e.","0_7":"ఈ వర్గంలోని అన్ని ప్రకటనలనూ మీరు విస్మరిస్తున్నారు.","0_2":"ఈ విషయంలోని అన్ని ప్రకటనలనూ మీరు విస్మరిస్తున్నారు.","0":"ఈ విషయంలోని అన్ని ప్రకటనలనూ మీరు విస్మరిస్తున్నారు."},"watching_pm":{"title":"కన్నేసారు"},"watching":{"title":"కన్నేసారు"},"tracking_pm":{"title":"గమనిస్తున్నారు"},"tracking":{"title":"గమనిస్తున్నారు"},"muted_pm":{"title":"నిశ్శబ్దం"},"muted":{"title":"నిశ్శబ్దం"}},"actions":{"recover":"విషయం తొలగింపు రద్దుచేయి","delete":"విషయం తొలగించు","open":"విషయం తెరువు","close":"విషయం మూయు","unarchive":"విషయాన్ని కట్టవిప్పు","archive":"విషయాన్ని కట్టకట్టు","invisible":"అజ్జాబితాగా గుర్తించు","visible":"జాబితాగా గుర్తించు","reset_read":"చదివిన గణాంకాలను రీసెట్ చేయి"},"reply":{"title":"జవాబు","help":"ఈ విషయానికి జవాబివ్వుట ప్రారంభించు"},"clear_pin":{"title":"గుచ్చు శుభ్రపరుచు","help":"ఈ విషయపు గుచ్చు స్థితి శుభ్రపరుచు. తద్వారా అది ఇహ అగ్ర భాగాన కనిపించదు"},"share":{"title":"పంచు","help":"ఈ విషయపులంకెను పంచు"},"flag_topic":{"title":"కేతనం","help":"ఈ విషయాన్ని ప్రైవేటుగా కేతనించు లేదా ప్రైవేటు ప్రకటన పంపు","success_message":"ఈ విషయాన్ని మీరు కేతనించారు"},"inviting":"ఆహ్వానిస్తున్నామ్...","invite_private":{"email_or_username":"ఆహ్వానితుని ఈమెయిల్ లేదా సభ్యనామం","email_or_username_placeholder":"ఈమెయిల్ చిరునామా లేదా సభ్యనామం","action":"ఆహ్వానించు","error":"క్షమించాలి. ఆ సభ్యుడిని ఆహ్వానించుటలో దోషం.","group_name":"గుంపు పేరు"},"invite_reply":{"title":"ఆహ్వానించు","username_placeholder":"వాడుకరి పేరు","to_forum":"మేము మీ స్నేహితునికి ఒక ఈమెయిల్ పంపుతాము. అందులోని లంకె ద్వారా వారు లాగిన్ అవసరం లేకుండానే నేరుగా ఈ చర్చలో పాల్గొనవచ్చు, జవాబివ్వవచ్చు.","email_placeholder":"name@example.com"},"login_reply":"జవాబివ్వడానికి లాగిన్ అవ్వండి","filters":{"n_posts":{"one":"1 టపా","other":"{{count}} టపాలు"},"cancel":"జల్లెడ తొలగించు"},"split_topic":{"title":"కొత్త విషయానికి జరుపు","action":"కొత్త విషయానికి జరుపు","topic_name":"కొత్త విషయపు పేరు","error":"టపాలను కొత్త విషయానికి జరిపేటప్పుడు దోషం తలెత్తింది","instructions":{"one":"మీరు కొత్త విషయం సృష్టించి దాన్ని మీరు ఈ  టపాతో నింపబోతున్నారు.","other":"మీరు కొత్త విషయం సృష్టించి దాన్ని \u003cb\u003e{{count}}\u003c/b\u003e  టపాలతో నింపబోతున్నారు."}},"merge_topic":{"title":"ఇప్పటికే ఉన్న విషయానికి జరుపు","action":"ఇప్పటికే ఉన్న విషయానికి జరుపు","error":" ఆ విషయంలోకి టపాలను జరపడంలో దోషం.","instructions":{"one":"ఈ  టపాలు జరపాలనుకున్న విషయాన్ని ఎంచుకోండి.","other":"ఈ  \u003cb\u003e{{count}}\u003c/b\u003e టపాలను జరపాలనుకున్న విషయాన్ని ఎంచుకోండి."}},"change_owner":{"title":"టపాల యజమానిని మార్చండి","action":"యజమానిని మార్చు","error":"ఆ టపాల యజమానిని మార్చేప్పుడు దోషం జరిగింది.","label":"టపాల కొత్త యజమాని","placeholder":"కొత్త యజమాని సభ్యనామం","instructions":{"one":"\u003cb\u003e{{old_user}}\u003c/b\u003e యొక్క టపాకు కొత్త యజమానిని ఎంచుకోండి.","other":"\u003cb\u003e{{old_user}}\u003c/b\u003e యొక్క {{count}} టపాల కొత్త యజమానిని ఎంచుకోండి."},"instructions_warn":"ఈ పోస్ట్ గురించిన ఏ గత ప్రకటనలైనా కొత్త వినియోగదారునికి బదిలీకావని గమనించండి.\u003cbr\u003eహెచ్చరిక: ప్రస్తుతం,ఏ ఆధారిత సమాచారం కొత్త వినియోగదారుకి బదిలీ చేయబడదు.ముందుజాగ్రత్త తో వినియోగించండి."},"multi_select":{"select":"ఎంచుకో","selected":"ఎంచుకున్నవి  ({{count}})","select_replies":"ఎంచుకున్నవి +జవాబులు","delete":"ఎంచుకున్నవి తొలగించు","cancel":"ఎంపిక రద్దు","select_all":"అన్నీ ఎంచుకో","deselect_all":"అన్నీ వియెంచుకో","description":{"one":"మీరు \u003cb\u003e1\u003c/b\u003e టపా ఎంచుకున్నారు","other":"మీరు \u003cb\u003e{{count}}\u003c/b\u003e టపాలు ఎంచుకున్నారు"}}},"post":{"quote_reply":"కోట్ జవాబు","edit_reason":"కారణం:","post_number":"టపా {{number}}","last_edited_on":"టపా చివర సవరించిన కాలం","reply_as_new_topic":"లంకె విషయంగా జవాబివ్వు","continue_discussion":"{{postLink}} నుండి చర్చ కొనసాగుతుంది;","follow_quote":"కోటెడ్ టపాకు వెళ్లు","show_full":"పూర్తి టపా చూపు","show_hidden":"దాగిన విషయం చూపు","deleted_by_author":{"one":" (టపా రచయిత ద్వారా తొలగింపబడింది , స్వతస్సిధ్దంగా తొలగింపబ[ది %{count} కాకపోతే సమయం కేతనించలేదు)","other":"(టపా రచయిత ద్వారా ఉపసంహరించబడింది , స్వతసిధ్ధంగా తొలగించబడతాయి %{count} కాకపోతే సమయం కేతనించలేదు)"},"expand_collapse":"పెంచు/తుంచు","unread":"టపా చదవనిది","errors":{"create":"క్షమించాలి. మీ టపా సృష్టించుటలో దోషం. దయచేసి మరలా ప్రయత్నించండి. ","edit":"క్షమించాలి. మీ టపా సవరించుటలో దోషం. మరలా ప్రయత్నించండి","upload":"క్షమించాలి. దస్త్రం ఎగుమతించుటలో దోషం. దయచేసి మరలా ప్రయత్నించండి. ","too_many_uploads":"క్షమించాలి. మీరు ఒకసారి ఒక దస్త్రం మాత్రమే ఎగుమతించగలరు","upload_not_authorized":"క్షమించాలి. మీరు ఎగుమతించాలనుకుంటున్న దస్త్రం అధీకృతమైనది కాదు. (అధీకృత పొడిగింతలు:{{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"క్షమించాలి. కొత్త సభ్యులు బొమ్మలు ఎగుమతి చేయలేరు.","attachment_upload_not_allowed_for_new_user":"క్షమించాలి. కొత్త సభ్యులు జోడింపులు ఎగుమతి చేయలేరు.","attachment_download_requires_login":"క్షమించాలి. జోడింపులు దిగుమతి చేసుకోవడానికి మీరు లాగిన్ అయి ఉండాలి."},"abandon":{"confirm":"మీరు నిజంగానే మీ టపాను వదిలేద్దామనుకుంటున్నారా?","no_value":"లేదు, ఉంచండి","yes_value":"అవును. వదిలేయండి"},"via_email":"ఈ టపా ఈమెయిల్ ద్వారా వచ్చింది","archetypes":{"save":"భద్రపరుచు ఐచ్చికాలు"},"controls":{"reply":"ఈ టపాకు జవాబు రాయుట మొదలుపెట్టండి","like":"ఈ టపాను ఇష్టపడు","has_liked":"మీరు ఈ టపాను ఇష్టపడ్డారు","undo_like":"ఇష్టాన్ని రద్దుచేయి","edit":"ఈ టపాను సవరించు","edit_anonymous":"క్షమించాలి. ఈ టపాను సవరించడానికి మీరు లాగిన్ అయి ఉండాలి. ","flag":"దృష్టికొరకు ఈ టపాను ప్రైవేటుగా కేతనించు లేదా దీని గురించి ప్రైవేటు ప్రకటన పంపు","delete":"ఈ టపాను తొలగించు","undelete":"ఈ టపాను పునస్తాపించు","share":"ఈ టపా లంకెను పంచు","more":"మరింత","delete_replies":{"confirm":{"one":"ఈ టపా యొక్క నేరు జవాబు కూడా తొలగించాలనుకుంటున్నారా?","other":"ఈ టపా యొక్క {{count}} నేరు జవాబులు కూడా తొలగించాలనుకుంటున్నారా?"},"yes_value":"అవును, జవాబులు కూడా తొలగించు.","no_value":"లేదు, కేవలం ఈ టపానే"},"admin":"టపా అధికారి చర్యలు","wiki":"వికీ చేయి","unwiki":"వికీ తొలగించు","convert_to_moderator":"సిబ్బంది రంగు కలుపు","revert_to_regular":"సిబ్బంది రంగు తొలగించు","rebake":"హెచే టీ యం యల్ పునర్నిర్మించు","unhide":"చూపు"},"actions":{"flag":"కేతనం","defer_flags":{"one":"కేతనం వాయిదావేయి","other":"కేతనాలు వాయిదావేయి"},"undo":{"off_topic":"కేతనం రద్దు","spam":"కేతనం రద్దు","inappropriate":"కేతనం రద్దు","bookmark":"పేజీక రద్దు","like":"ఇష్టం రద్దు","vote":"ఓటు రద్దు"},"by_you":{"off_topic":"మీరు దీన్ని విషయాంతరంగా కేతనించారు","spam":"మీరు దీన్ని స్పాముగా కేతనించారు","inappropriate":"మీరు దీన్ని అసమంజసంగా కేతనించారు","notify_moderators":"మీరు దీన్ని నిర్వాహకుల దృష్టికి తెచ్చారు","bookmark":"మీరు దీనికి పేజీక ఉంచారు","like":"మీరు దీన్ని ఇష్టపడ్డారు","vote":"మీరు ఈ టపాకు ఓటు వేశారు"},"by_you_and_others":{"off_topic":{"one":"మీరు మరియు ఇంకొకరు దీన్ని విషయాంతరంగా కేతనించారు. ","other":"మీరు మరియు [[count]] ఇతర జనులు దీన్ని విషయాంతరంగా కేతనించారు. "},"spam":{"one":"మీరు మరియు ఇంకొకరు దీన్ని స్పాముగా కేతనించారు. ","other":"మీరు మరియు [[count]] ఇతర జనులు దీన్ని స్పాముగా కేతనించారు. "},"inappropriate":{"one":"మీరు మరియు ఇంకొకరు దీన్ని అసమంజసమైనదిగా కేతనించారు. ","other":"మీరు మరియు [[count]] ఇతర జనులు దీన్ని అసమంజసమైనదిగా కేతనించారు. "},"notify_moderators":{"one":"మీరు మరియు ఇంకొకరు దీన్ని నిర్వాహకుల దృష్టికి తెచ్చారు.","other":"మీరు మరియు [[count]] ఇతర జనులు దీన్ని నిర్వాహకుల దృష్టికి తెచ్చారు."},"bookmark":{"one":"మీరు మరియు ఇంకొకరు దీనికి పేజీక ఉంచారు.","other":"మీరు మరియు {{count}} ఇతరులు దీనికి పేజీక ఉంచారు."},"like":{"one":"మీరు మరొకరు దీన్ని ఇష్టపడ్డారు","other":"మీరు మరియు {{count}} గురు దీన్ని ఇష్టపడ్డారు"},"vote":{"one":"మీరు మరియొకరు ఈ టపాకు వోటు వేసారు","other":"మీరు మరియు {{count}} గురు ఈ టపాకు ఓటు వేసారు."}},"by_others":{"off_topic":{"one":"ఒకరు దీన్ని విషయాంతరంగా కేతనించారు","other":"{{count}} గురు దీన్ని విషయాంతరంగా కేతనించారు"},"spam":{"one":"ఒకరు దీన్ని స్పాముగా కేతనించారు","other":"{{count}} గురు దీన్ని స్పాముగా కేతనించారు"},"inappropriate":{"one":"ఒకరు దీన్ని అసమంజసంగా కేతనించారు","other":"{{count}} గురు దీన్ని అసమంజసంగా కేతనించారు"},"notify_moderators":{"one":"ఒకరు దీన్ని నిర్వాహకుల దృష్టికి తెచ్చారు","other":"{{count}} గురు దీన్ని నిర్వాహకుల దృష్టికి తెచ్చారు"},"bookmark":{"one":"ఒకరు ఈ టపాకు పేజీక ఉంచారు","other":"{{count}} గురు ఈ విషయానికి పేజీక ఉంచారు"},"like":{"one":"ఒకరు దీన్ని ఇష్టపడ్డారు","other":"{{count}} గురు దీన్నిఇష్టపడ్డారు."},"vote":{"one":"ఒకరు దీనికి ఓటు వేశారు","other":"{{count}} గురు దీనికి ఓటు వేసారు"}}},"delete":{"confirm":{"one":"మీరు నిజ్జంగా ఈ టపాను తొలగించాలనుకుంటున్నారా?","other":"మీరు నిజ్జంగానే ఈ టపాలన్నీ తొలగించాలనుకుంటున్నారా?"}},"revisions":{"controls":{"first":"తొలి దిద్దుబాటు","previous":"గత దిద్దుబాటు","next":"తరువాతి దిద్దుబాటు","last":"చివరి దిద్దుబాటు","hide":"దిద్దుబాటు దాచు","show":"దిద్దుబాటు చూపు"},"displays":{"inline":{"title":"వ్యవకలనాలు మరియు సంకలనాలను సాలు మధ్యలో చూపుతూ మొత్తం చూపు","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e హెచ్ టీ యం టల్"},"side_by_side":{"title":"పక్క పక్కన తేడాలు చూపుతూ మొత్తం చూపు","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e హెచ్ టీయంయల్"},"side_by_side_markdown":{"title":"ముడి మూల తేడాను పక్కపక్కన చూపు","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e ముడి"}}}},"category":{"can":"can\u0026hellip;","none":"(ఏ వర్గం లేదు)","choose":"వర్గం ఎంచుకో\u0026hellip;","edit":"సవరించు","edit_long":"సవరించు","view":"ఈ వర్గంలోని విషయాలు చూడు","general":"సాధారణ","settings":"అమరికలు","delete":"వర్గం తొలగించు","create":"కొత్త వర్గం","save":"వర్గం దాచు","slug":"వర్గం స్లగ్","slug_placeholder":"(ఐచ్చికం) వెబ్ చిరునామాలో పేరు డాష్ లతో","creation_error":"ఈ వర్గం సృష్టించేప్పుడు దోషం","save_error":"ఈ వర్గం భద్రపరిచేప్పుడు దోషం","name":"వర్గం పేరు","description":"వివరణ","topic":"వర్గం విషయం","logo":"వర్గం లోగో బొమ్మ","background_image":"వర్గం వెనుతలపు బొమ్మ","badge_colors":"బ్యాడ్జి రంగులు","background_color":"వెనుతలపు రంగు","foreground_color":"మునుతలపు రంగు","name_placeholder":"గరిష్టం ఒకటి లేదా రెండు పదాలు","color_placeholder":"ఏదేనీ జాల రంగు","delete_confirm":"మీరు నిజంగా ఈ వర్గాన్ని తొలగించాలనుకుంటున్నారా?","delete_error":"ఈ వర్గం తొలగించేప్పుడు దొషం.","list":"వర్గాల జాబితా చూపు","no_description":"ఈ వర్గానికి వివరణ రాయండి","change_in_category_topic":"వివరణ సవరించు","already_used":"ఈ రంగు వేరే వర్గం వాడింది","security":"సంరక్షణ","images":"బొమ్మలు","auto_close_label":"ఇంత కాలం తర్వాత ఈ విషయం స్వీయ మూయు:","auto_close_units":"గంటలు","email_in":"అనురూప లోపలికి వచ్చే ఈమెయిల్ చిరునామా:","email_in_allow_strangers":"ఎటువంటి ఖాతాలు లేని అనామక సభ్యుల నుండి వచ్చే ఈమెయిల్లు అంగీకరించు","email_in_disabled":"సైటు అమరికల్లో ఈమెయిల్ ద్వారా కొత్త విషయాలు రాయుడ అచేతనమైంది. ఈమెయిల్ ద్వారా కొత్త విషయాలు రాయుట చేతనం చేయుటకు,","email_in_disabled_click":"\"ఈమెయిల్ ఇన్\" అమరికను చేతనం చేయి.","allow_badges_label":"ఈ వర్గంలో బ్యాడ్జిలు బహూకరించుట అనుమతించు","edit_permissions":"అనుమతులు సవరించు","add_permission":"అనుమతి కలుపు","this_year":"ఈ సంవత్సరం","position":"స్థానం","default_position":"అప్రమేయ స్థానం","position_disabled":"వర్గాలు కలాపం వరుసలో చూపబడతాయి. జాబితాల్లో వర్గాల వరుసను నియంత్రించడానికి,","position_disabled_click":"\"స్థిర వర్గ స్థాయిలు\" అమరికను చేతనం చేయండి","parent":"తండ్రి వర్గం","notifications":{"watching":{"title":"కన్నేసారు"},"tracking":{"title":"గమనిస్తున్నారు"},"muted":{"title":"నిశ్శబ్దం"}}},"flagging":{"title":"మా కమ్యునిటీని నాగరికంగా ఉంచుటలో సహాయానికి ధన్యవాదములు","action":"టపాను కేతనించు","take_action":"చర్య తీసుకో","delete_spammer":"స్పామరును తొలగించు","yes_delete_spammer":"అవులు, స్పామరును తొలగించు","ip_address_missing":"వర్తించదు","hidden_email_address":"(దాయబడింది)","submit_tooltip":"ఒక ప్రైవేటు కేతనం అందించు","take_action_tooltip":"మరిన్ని కమ్యునిటీ కేతనాల కోసం ఎదురు చూడకుండా ఇప్పుడే కేతన గట్టు చేరు","cant":"క్షమించాలి. ఇప్పుడు ఈ టపాను కేతనిచంలేరు.","formatted_name":{"off_topic":"ఇది విషయాంతరం","inappropriate":"ఇది అసమంజసం","spam":"ఇది స్పాము"},"custom_placeholder_notify_user":"నిక్కచ్చిగా ఉండు, నిర్మాణాత్మకంగా ఉండు మరియు ఎల్లప్పుడూ దయతో ఉండు","custom_placeholder_notify_moderators":"మీరు ఏ విషయంలో ఇబ్బందిపడుతున్నారో మాకు తెలియజేయండి. ఉదాహరణలు, లంకెలు మరియు సంబంధిత సమాచారం పొందుపరచండి. "},"flagging_topic":{"title":"మా కమ్యునిటీని నాగరికంగా ఉంచుటలో సహాయానికి ధన్యవాదములు!","action":"విషయాన్ని కేతనించు"},"topic_map":{"title":"విషయ సారం","clicks":{"one":"ఒక నొక్కు","other":"%{count} నొక్కులు"}},"topic_statuses":{"warning":{"help":"ఇది అధికారిక హెచ్చరిక"},"bookmarked":{"help":"ఈ విషయానికి పేజీక ఉంచారు"},"locked":{"help":"ఈ విషయం ముగిసింది. కొత్త జవాబులు అంగీకరించదు. "},"archived":{"help":"ఈ విషయం కట్టకట్టబడింది. ఇది గడ్డకట్టుకుంది ఇహ మార్చయిత కాదు"},"unpinned":{"title":"అగ్గుచ్చిన","help":"ఈ విషయం మీకు అగ్గుచ్చబడింది. ఇది ఇహ క్రమ వరుసలోనే కనిపిస్తుంది"},"pinned_globally":{"title":"సార్వత్రికంగా గుచ్చారు"},"pinned":{"title":"గుచ్చారు","help":"ఈ విషయం మీకు గుచ్చబడింది. దాని వర్గంలో అది అగ్రభాగాన కనిపిస్తుంది."},"invisible":{"help":"ఈ విషయం జాబితాలనుండి తొలగించబడింది. ఇహ కేవలం నేరు లంకె ద్వారా మాత్రమే చూడగలరు."}},"posts":"టపాలు","posts_long":"ఈ విషయానికి {{number}}  టపాలు ఉన్నాయి. ","original_post":"మూల టపా","views":"చూపులు","replies":"జవాబులు","views_long":"ఈ విషయం  {{number}}  సార్లు చూడబడింది.","activity":"కలాపం","likes":"ఇష్టాలు","likes_long":"ఈ విషయానికి  {{number}}  ఇష్టాలు ఉన్నాయి","users":"సభ్యులు","category_title":"వర్గం","history":"చరిత్ర","changed_by":" {{author}} రాసిన","raw_email":{"title":"ముడి ఈమెయిల్","not_available":"అందుబాటులో లేదు!"},"categories_list":"వర్గాల జాబితా","filters":{"with_topics":"%{filter} విషయాలు","with_category":"%{filter} %{category} విషయాలు","latest":{"help":"ఇటీవలి టపాలతోని విషయాలు"},"hot":{"title":"వేడివేడి","help":"ఎంపికైన వేడివేడి విషయాలు"},"read":{"title":"చదివిన","help":"మీరు చదివిన విషయాలు, మీరు చివరిసారి చదివిన వరుసలో"},"categories":{"title":"వర్గాలు","title_in":"వర్గం - {{categoryName}}","help":"వర్గాల వారీగా జట్టు కట్టిన అన్ని విషయాలూ"},"unread":{"help":"మీరు ప్రస్తుతం కన్నేసిన లేదా గమనిస్తున్న చదవని టపాలతో ఉన్న  విషయాలు "},"new":{"lower_title":"కొత్త","help":"గత కొద్ది రోజులలో సృష్టించిన టపాలు"},"posted":{"title":"నా టపాలు","help":"మీరు టపా రాసిన విషయాలు"},"bookmarks":{"title":"పేజీకలు","help":"మీరు పేజీక ఉంచిన విషయాలు"},"category":{"help":"{{categoryName}} వర్గంలోని కొత్త విషయాలు"},"top":{"title":"అగ్ర","help":"గత సంవత్సరం, నెల, వారం లేదా రోజులోని అత్యంత క్రియాశీల విషయాలు","today":"ఈ రోజు"}},"browser_update":"దురదృష్టవశాత్తు, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eఈ సైట్ లో పనిచేయడానికి మీ బ్రౌజర్ చాలా పాతది \u003c/a\u003e. దయచేసి \u003ca href=\"http://browsehappy.com\"\u003eమీ బ్రౌజర్ ని నవీకరించండి\u003c/a\u003e.","permission_types":{"full":"సృష్టించి / జవాబివ్వు / చూడు","create_post":"జవాబివ్వు / చూడు","readonly":"చూడు"},"type_to_filter":"జల్లించుటకు రాయి...","admin":{"title":"డిస్కోర్సు అధికారి","moderator":"నిర్వాహకుడు","dashboard":{"title":"రంగస్థలం","last_updated":"రంగస్థలం చివరగా నవీకరించినది:","version":"రూపాంతరం","up_to_date":"మీరు తాజాగా ఉన్నారు! ","critical_available":"ఒక క్రిటికల్ ఉన్నతీకరణ అందుబాటులో ఉంది.","updates_available":"ఉన్నతీకరణలు అందుబాటులో ఉన్నాయి.","please_upgrade":"దయచేసి ఉన్నతీకరించు!","no_check_performed":"ఉన్నతీకరణల కోసం పరికింపు జరగలేదు. sidekiq నడుస్తున్నట్టు సరిచూడండి.","stale_data":"ఉన్నతీకరణల కోసం పరికింపు జరగలేదు. sidekiq నడుస్తున్నట్టు సరిచూడండి.","version_check_pending":"మీరు ఇటీవలే ఉన్నతీకరించినట్టున్నారు. అద్భుతం!","installed_version":"ప్రతిష్టించబడింది","latest_version":"తాజా","problems_found":"మీ డిస్కోర్సు ప్రతిష్టాపనతో కొన్ని సమస్యలు కనిపించాయి.","last_checked":"చివరగా సరిచూసినది","refresh_problems":"తాజాపరుచు","no_problems":"ఎటువంటి సమస్యలూ కనిపించలేదు","moderators":"నిర్వాహకులు:","admins":"అధికారులు:","blocked":"నిలిపిన:","suspended":"సస్పెండయిన:","space_free":"{{size}} ఖాలీ","uploads":"ఎగుమతులు","backups":"బ్యాకప్లు","traffic_short":"ట్రాఫిక్","traffic":"అనువర్తన జాల రిక్వెస్టులు","page_views":"API అభ్యర్ధనలు","page_views_short":"API అభ్యర్ధనలు","show_traffic_report":"సవివరణ ట్రాఫిక్ రిపోర్టు చూపు","reports":{"today":"ఈరోజు","yesterday":"నిన్న","last_7_days":"చివరి ఏడు రోజులు","last_30_days":"చివరి ముప్పై రోజులు","all_time":"ఆల్ టైమ్","7_days_ago":"ఏడు రోజుల క్రితం","30_days_ago":"ముప్పై రోజుల క్రితం","all":"అన్ని","view_table":"టేబుల్","refresh_report":"రిపోర్టు తాజాపరుచు","start_date":"ఆరంభ తేదీ","end_date":"ముగింపు తేదీ"}},"commits":{"latest_changes":"తాజా మార్పులు: దయచేసి తరచూ ఉన్నతీకరించండి!","by":"నుండి"},"flags":{"title":"కేతనాలు","old":"పాత","active":"చేతన","agree":"ఒప్పుకోండి","agree_title":"ఈ కేతనం సరైనదిగా చెప్పండి","agree_flag_modal_title":"ఒప్పుకొను మరియు","agree_flag_hide_post":"ఒప్పుకొని (టపా దాచు మరియు ప్రైవేటు సందేశం పంపు)","agree_flag_restore_post":"ఒప్పుకొను (టపా పునస్తాపించు)","agree_flag_restore_post_title":"ఈ టపా పునస్తాపించు","agree_flag":"కేతనంతో ఒప్పుకో","agree_flag_title":"కేతనంతో ఒప్పుకో మరియు టపాను మార్చకుండా ఉంచు","defer_flag":"వాయిదావేయి","defer_flag_title":"ఈ కేతనం తొలగించు; ఇప్పుడు ఎటువంటి చర్య అవసరంలేదు.","delete":"తొలగించు","delete_title":"ఈ కేతనం వర్తించే టపా తొలగించు","delete_post_defer_flag":"టపా తొలగించు మరియు కేతనం వాయిదా వేయి","delete_post_defer_flag_title":"టపా తొలగించు; ఇదే తొలి టపా అయితే ఈ విషయాన్ని తొలగించు","delete_post_agree_flag":"టపా తొలగించు మరియు కేతనంతో అంగీకరించు","delete_post_agree_flag_title":"టపా తొలగించు; తొలగి టపా అయితే, విషయాన్ని కూడా తొలగించు","delete_flag_modal_title":"తొలగించు మరియు...","delete_spammer":"స్పామరును తొలగించు","delete_spammer_title":"ఈ సభ్యుడిని తొలగించు మరియు ఇతని అన్ని టపాలు, విషయాలూ కూడా తొలగించు. ","disagree_flag_unhide_post":"ఒప్పుకోకు (టపా దాచు)","disagree_flag_unhide_post_title":"ఈ టపాకు ఉన్న అన్ని కేతనాలూ తొలగించు మరియు టపాను మరలా సందర్శనీయం చేయి","disagree_flag":"ఒప్పుకోకు","disagree_flag_title":"ఈ కేతనాన్ని చెల్లనిదిగా లేదా తప్పుగా  నిరాకరించు","clear_topic_flags":"ముగిసింది","clear_topic_flags_title":"ఈ విషయం పరిశీలించబడింది మరియు అన్ని సమస్యలూ సరిచేయబడ్డాయి. ముగిసింది నొక్కి అన్ని కేతనాలూ తొలగించు.","more":"(మరిన్ని జవాబులు...)","dispositions":{"agreed":"ఒప్పుకున్నారు","disagreed":"ఒప్పుకోలేదు","deferred":"వాయిదా వేసారు"},"flagged_by":"కేతనించినవారు","resolved_by":"సరిచేసినవారు","took_action":"చర్య తీసుకున్నారు","system":"వ్యవస్థ","error":"ఏదే తేడా జరిగింది","reply_message":"జవాబు","no_results":"ఎట్టి కేతనాలూ లేవు","topic_flagged":"ఈ \u003cstrong\u003eవిషయం\u003c/strong\u003e కేతనించబడింది.","visit_topic":"చర్య తీసుకోడానికి విషయం దర్శించు","was_edited":"తొలి కేతనం తర్వాత టపా సవరించబడింది","previous_flags_count":"ఈ టపా ఇప్పటికే {{count}}  కేతనించబడింది.","summary":{"action_type_3":{"one":"విషయాంతరం","other":"విషయాంతరం x{{count}}"},"action_type_4":{"one":"అసమంజసం ","other":"అసమంజసం x{{count}}"},"action_type_6":{"one":"అనురూపం","other":"అనురూప x{{count}}"},"action_type_7":{"one":"అనురూపం","other":"అనురూపం x{{count}}"},"action_type_8":{"one":"స్పాము","other":"స్పామ్ x{{count}}"}}},"groups":{"primary":"ప్రాథమిక గుంపు","no_primary":"(ప్రాథమిక గుంపు లేదు)","title":"గుంపులు","edit":"గుంపులు సవరించు","refresh":"తాజా పరుచు","new":"కొత్త","selector_placeholder":"సభ్యనామం రాయండి","name_placeholder":"గంపు పేరు, జాగా లేకుండా, సభ్యనామం వలె","about":"మీ గుంపు మెంబర్షిప్పు మరియు పేర్లు ఇక్కడ సవరించండి","group_members":"గుంపు సభ్యులు","delete":"తొలగించు","delete_confirm":"ఈ గుంపును తొలగించాలనుకుంటున్నారా? ","delete_failed":"గుంపును తొలగించలేకున్నాము. ఇది స్వీయ గుంపు అయితే దీన్ని నాశనం చేయలేరు.","delete_member_confirm":" '%{group}' గుంపు నుండి '%{username}' ను తొలగించాలా?","name":"పేరు","add":"కలుపు","add_members":"సభ్యులను కలుపు","automatic_membership_email_domains":"వినియోగదారుడు ఏ ఈ-మెయిల్ డొమైన్ తో నమోదు చేసుకున్నాడో అది ఖచ్చితంగా  ఈ జాబితాలో ఒక దానిని పోలి స్వయంసిధ్ధంగా గ్రూప్ కి కలుస్తాయి:","automatic_membership_retroactive":"ఇప్పటికే నమోదిత వినియోగదారులను జోడించడానికి అదే ఇమెయిల్ డొమైన్ రూల్ వర్తిస్తుంది"},"api":{"generate_master":"మాస్టరు ఏపీఐ కీ ఉత్తపత్తించు","none":"ప్రస్తుతం చేతన ఏపీఐ కీలు లేవు.","user":"సభ్యుడు","title":"ఏపీఐ","key":"ఏపీఐ కీ","generate":"ఉత్పత్తించు","regenerate":"పునరుత్పత్తించు","revoke":"రివోక్","confirm_regen":"మీరు నిజంగా పాత ఏపీఐ కీని కొత్త దానితో రీప్లేస్ చెయ్యాలనుకుంటున్నారా?","confirm_revoke":"మీరు నిజంగా ఆ కీని రివోకే చెయ్యాలనుకుంటున్నారా? ","info_html":"మీ ఏపీఐ కీ జేసన్ వాడి విషయాలు సృష్టించుట, ఉన్నతీకరించుటకు దోహదం చేస్తుంది.","all_users":"అందరు సభ్యులు","note_html":"ఈ కీ ని \u003cstrong\u003e రహస్యంగా ఉంచండి \u003c/strong\u003e, అది కలిగివున్న అందరూ వినియోగదారులు ఏ వినియోగదారునిలా నైనా ఏకపక్ష టపాలు సృష్టించవచ్చు."},"plugins":{"title":"చొప్పింతలు","installed":"ప్రతిష్టించిన చొప్పింతలు","name":"పేరు","none_installed":"ఎటువంటి చొప్పింతలు ప్రతిష్టించిలేవు.","version":"సంచిక","change_settings":"అమరికలు మార్చు","howto":"పొడిగింతలు నేను ఎలా ప్రతిష్టించగలను?"},"backups":{"title":"బ్యాకప్పులు","menu":{"backups":"బ్యాకప్పులు","logs":"లాగ్స్"},"none":"ఎట్టి బ్యాకప్పులూ లేవు","logs":{"none":"ఇంకా లాగులు లేవు..."},"columns":{"filename":"దస్త్రం పేరు","size":"పరిమాణం"},"upload":{"uploading":"ఎగుమతవుతోంది...","success":"'{{filename}}' విజయవంతంగా ఎగుమతయింది.","error":"'{{filename}}' ఎగుమతించుటలో దోషం: {{message}}"},"operations":{"is_running":"ఒక కార్యం ప్రస్తుతం నడుస్తోంది...","failed":"కార్యం విఫలమైంది. దయచేసి లాగులు చూడండి.","cancel":{"title":"ప్రస్తుత కార్యం రద్దుచేయి","confirm":"మీరు నిజంగానే ప్రస్తుత కార్యం రద్దుచేయాలనుకుంటున్నారా?"},"backup":{"title":"బ్యాకప్ సృష్టించు","confirm":"మీరు కొత్త బ్యాకప్ మొదలుపెట్టాలనుకుంటున్నారా?","without_uploads":"అవులు (దస్త్రాలు కాకుండా)"},"download":{"title":"బ్యాకప్ దిగుమతించు"},"destroy":{"title":"బ్యాకప్ తొలగించు","confirm":"మీరు నిజంగానే బ్యాకప్ ను నాశనం చేయాలనుకుంటున్నారా?"},"restore":{"is_disabled":"సైటు అమరికల్లో రీస్టోరు అచేతనమైంది. ","title":"బ్యాకప్ ను రీస్టోరు చేయి"},"rollback":{"title":"డాటాబేసును గత పనిచేసే స్థితికి రోల్ బ్యాక్ చేయి"}}},"export_csv":{"user_archive_confirm":"మీరు నిజంగా మీ టపాల దిగుమతి కోరుకుంటున్నారా ?","failed":"ఎగుమతి విఫలమైంది. దయచేసి లాగులు చూడంది. ","rate_limit_error":"టపాలు కేవలం రోజుకు ఒకసారి మాత్రమే దిగుమతించుకోగలరు. దయచేసి రేపు ప్రయత్నించండి.","button_text":"ఎగుమతి","button_title":{"user":"పూర్తి సభ్యుల జాబితా సీయస్వీ రూపులో ఎగుమతించండి","staff_action":"పూర్తి సిబ్బంది చర్యా లాగు సీయస్వీ రూపులో ఎగుమతించండి.","screened_email":"వడకట్టిన ఈమెయిల్ల పూర్తి జాబితా సీయస్వీ రూపులో ఎగుమతించు","screened_ip":"వడకట్టిన ఐపీల పూర్తి జాబితా సియస్వీ రూపులో ఎగుమతించు","screened_url":"వడకట్టిన యూఆర్ యల్ల పూర్తి జాబితాను సీయస్వీ రూపులో ఎగుమతించు"}},"invite":{"button_text":"ఆహ్వానాలు పంపు","button_title":"ఆహ్వానాలు పంపు"},"customize":{"title":"కస్టమైజ్","long_title":"సైట్ కస్టమైజేషనులు","css":"సీయస్ యస్","header":"హెడర్","top":"అగ్ర","footer":"ఫుటరు","head_tag":{"text":"\u003c/head\u003e","title":"\u003c/head\u003e కొస ముందు ఉంచే హెచ్ టీ యం యల్"},"body_tag":{"text":"\u003c/body\u003e","title":"\u003c/body\u003e కొస ముందు ఉంచే హెచ్ టీ యం యల్"},"override_default":"స్టాండర్డ్ సైల్ షీట్ ఉంచకు","enabled":"చేతమైందా?","preview":"మునుజూపు","undo_preview":"మునుజూపు తొలగించు","rescue_preview":"అప్రమేయ స్టైలు","explain_preview":"సైటును అనురూప స్టైల్షీటుతో దర్శించు","explain_undo_preview":"ప్రస్తుతం చేతనం చేసిఉన్న కస్టమ్ స్టైల్ షీటుకు మరలు","explain_rescue_preview":"సైటును అప్రమేయ స్టైల్ షీటుతో చూడు","save":"భద్రపరుచు","new":"కొత్త","new_style":"కొత్త స్టైలు","delete":"తొలగించు","delete_confirm":"ఈ కస్టమైజేషనులు తొలగించు? ","about":"సైట్లో CSS స్టైల్‌షీట్స్ and HTML హెడర్స్ మార్చండి.స్టార్ట్‌కి కస్టమైజేషన్ కలపండి.","color":"రంగు","opacity":"అపారదర్శకత","copy":"నకలు","css_html":{"title":"సీయస్ యస్ / హెచ్ టీ యం యల్","long_title":"సీ యస్ యస్ మరియు హెచ్ టీ యం యల్ కస్టమైజేషనులు"},"colors":{"title":"రంగులు","long_title":"రంగు స్కీములు","about":"సైట్లో వాడే రంగులు CSS వ్రాయకుండా మార్చండి.స్కీమ్ ను స్టార్ట్ కు కలపండి.","new_name":"కొత్త రంగు స్కీము","copy_name_prefix":"దీనికి నకలు","delete_confirm":"ఈ రంగు స్కీము తొలగించు?","undo":"రద్దు","undo_title":"చివరిసారి భధ్రపరచినప్పటి నుండి మీ రంగుల మార్పులు తిరగదోడండి.","revert":"తిద్దు","revert_title":"డిస్కోర్సు అప్రమేయ రంగు స్కీముకు రంగులను రీసెట్ చేయి","primary":{"name":"ప్రాథమిక","description":"పాఠ్యం, చిహ్నాలు మరియు సరిహద్దులు."},"secondary":{"name":"ద్వితీయ","description":"ప్రధాన వెనుతలం రంగు మరియు కొన్ని మీటల పాఠ్యం రంగు."},"tertiary":{"name":"తృతీయ","description":"లంకెలు, కొన్ని మీటలు, ప్రకటనలు, మరియు ఎసెంట్ రంగు."},"quaternary":{"name":"చతుర్థీ","description":"నావిగేషను లంకెలు"},"header_background":{"name":"హెడరు వెనుతలం","description":"సైటు హెడరు వెనుతలం రంగు."},"header_primary":{"name":"హెడరు ప్రాథమిక","description":"సైటు హెడరు పాఠ్యం మరియు చిహ్నాలు"},"highlight":{"name":"హైలైట్","description":"ఒక పుటలో వెనుతల రంగు ప్రత్యేకతగా కల్గిన అంశాలు, టపాలు మరియు విషయాలు అయి ఉంటాయి."},"danger":{"name":"ప్రమాదం","description":"తొలగించిన టపాలు మరియు విషయాల వంటి చర్యలకు రంగులు అద్దారు."},"success":{"name":"విజయం","description":"ఒక చర్య విజయవంతమైందని చూపడానికి వాడబడేది"},"love":{"name":"ప్రేమ","description":"ఇష్ఠ బటను రంగు."}}},"email":{"settings":"అమరికలు","preview_digest":"డైజెస్టు మునుజూపు","sending_test":"పరీక్షా ఈమెయిల్ పంపుతున్నామ్...","error":"\u003cb\u003eదోషం\u003c/b\u003e - %{server_error}","test_error":"టెస్ట్ మెయిల్ పంపడంలో  ఒక సమస్య ఉంది.దయచేసి మీ మెయిల్ సెట్టింగ్స్ రెండోసారి తనిఖీ చేసి,మీ హోస్ట్ మెయిల్ కనెక్షన్ నిరోధించుటలేదని నిర్ధారించుకోండి, మరియు తిరిగి ప్రయత్నించండి.","sent":"పంపిన","skipped":"వదిలిన","sent_at":"వద్ద పంపారు","time":"కాలం","user":"సభ్యుడు","email_type":"ఈమెయిల్ టైపు","to_address":"చిరునామాకు","test_email_address":"పరీక్షించుటు ఈమెయిల్ ","send_test":"పరీక్షా  మెయిల్ పంపారు","sent_test":"పంపారు!","delivery_method":"డెలివరీ పద్దతి","refresh":"తాజాపరుచు","format":"రూపు","html":"హెచ్ టీయంయల్","text":"పాఠ్యం","last_seen_user":"చివరగా చూసిన సభ్యుడు:","reply_key":"జవాబు కీ","skipped_reason":"వదిలిన కారణం","logs":{"none":"ఎట్టి లాగులు కనిపించలేదు","filters":{"title":"జల్లెడ","user_placeholder":"సభ్యనామం","address_placeholder":"name@example.com","type_placeholder":"డైజెస్ట్, సైనప్...","reply_key_placeholder":"జవాబు కీ","skipped_reason_placeholder":"కారణం"}}},"logs":{"title":"లాగులు","action":"చర్య","created_at":"సృష్టించినది","last_match_at":"చివరగా జతైనది","match_count":"సరిపోతుంది","ip_address":"ఐపీ","topic_id":"విషయపు ఐడీ","post_id":"టపా ఐడీ","delete":"తొలగించు","edit":"సవరణ","save":"భద్రపరుచు","screened_actions":{"block":"నిలుపు","do_nothing":"ఏమీ చేయకు"},"staff_actions":{"title":"సిబ్బింది చర్యలు","instructions":"వినియోగదారు పేరు మరియు చర్యల వడపోత చిట్టాను నొక్కండి.చిత్రాలు వినియోగదారు పుట కి వెళతాయి.","clear_filters":"మొత్తం చూపు","staff_user":"సిబ్బంది సభ్యుడు","target_user":"లక్షిత సభ్యుడు","subject":"సబ్జెక్టు","when":"ఎప్పుడు","context":"సందర్భం","details":"వివరాలు","previous_value":"గత","new_value":"కొత్త","diff":"తేడా","show":"చూపు","modal_title":"వివరాలు","no_previous":"గత విలువ లేదు","deleted":"కొత్త విలువ లేదు. రికార్డు తొలగించబడింది","actions":{"delete_user":"సభ్యుడిని తొలగించు","change_trust_level":"నమ్మకపు స్థాయి మార్చు","change_username":"సభ్యనామం మార్చు","change_site_setting":"సైటు అమరిక మార్చు","change_site_customization":"సైట్ కస్టమైజేషను మార్చు","delete_site_customization":"సైటు కస్టమైజేషను తొలగించు","suspend_user":"సభ్యుడిని సస్పెండు చేయి","unsuspend_user":"సస్పెండు కాని సభ్యుడు","grant_badge":"బ్యాడ్జ్ ఇవ్వు","revoke_badge":"బ్యాడ్జ్ తొలగించు","check_email":"ఈమెయిల్ చూడు","delete_topic":"విషయం తొలగించు","delete_post":"విషయం తొలగించు","impersonate":"పరకాయప్రవేశించు"}},"screened_emails":{"title":"స్క్రీన్ చేసిన ఈమెయిల్లు","email":"ఈమెయిల్ చిరునామా","actions":{"allow":"అనుమతించు"}},"screened_urls":{"title":"స్క్రీన్ చేసిన యూఆర్ యల్ లు","description":"ఇక్కడ టపాలో ఉపయోగించిన URLల జాబితా వినియోగదారులు స్పామర్లుగా గుర్తించారు.","url":"యూఆర్ యల్","domain":"డొమైన్"},"screened_ips":{"title":"స్క్రీన్ చేసిన ఐపీలు","description":"IP చిరునామాలు చూస్తారు.IP చిరునామాల \"అనుమతి\"లో మంచివరుస పాటించండి.","delete_confirm":"మీరు నిజంగా %{ip_address} కు ఈ నియమాన్ని తొలగించాలనుకుంటున్నారా? ","rolled_up_some_subnets":"IP నిషేధిత ప్రవేశాలు ఈ సబ్‌నెట్స్‌కు విజయవంతంగా చేర్చారు: %{subnets}.","rolled_up_no_subnet":"రోల్ అప్ చేయుటకు ఏమీ లేదు.","actions":{"block":"ఖండం","do_nothing":"అనుమతించు","allow_admin":"అధికారిని అనుమతించు"},"form":{"label":"కొత్త:","ip_address":"ఐపీ చిరునామా","add":"కలుపు","filter":"వెతుకు"},"roll_up":{"text":"రోల్ అప్","title":"కనీస ప్రవేశాలు ఉంటే కొత్త సబ్‌నెట్ నిషేధిత ప్రవేశాలు 'min_ban_entries_for_roll_up' సృష్టిస్తుంది."}},"logster":{"title":"దోష లాగులు"}},"impersonate":{"title":"పరకాయప్రవేశించు","help":"అనుకరించిన వినియోగదారుని ఖాతా దోషవిశ్లేషణ ప్రయోజనాలకు ఈ ఉపకరణం వినియోగించండి.పూర్తి అయిన తర్వాత మీరు లాగవుట్ చేయండి."},"users":{"title":"సభ్యులు","create":"అధికారి సభ్యుడిని కలుపు","last_emailed":"చివరగా ఈమెయిల్ చేసినది","not_found":"క్షమించాలి, ఆ సభ్యనామం మా వ్వవస్థలో లేదు.","id_not_found":"క్షమించాలి, ఆ సభ్య ఐడీ మా వ్యవస్థలో లేదు","active":"క్రియాశీల","show_emails":"ఈమెయిల్లు చూపు","nav":{"new":"కొత్త","active":"క్రియాశీల","pending":"పెండింగు","staff":"సిబ్బంది","suspended":"సస్పెడయ్యాడు","blocked":"నిలిపాడు","suspect":"అనుమానించు"},"approved":"అంగీకరించు","approved_selected":{"one":"సభ్యుడిని అంగీకరించు","other":"({{count}}) సభ్యులను అంగీకరించు"},"reject_selected":{"one":"సభ్యుడిని నిరాకరించు","other":"({{count}}) సభ్యులను నిరాకరించు"},"titles":{"active":"క్రియాశీల సభ్యులు","new":"కొత్త సభ్యులు","pending":"రివ్యూ పెండింగులో ఉన్న సభ్యులు","newuser":"నమ్మకం స్థాయి 0 సభ్యులు (కొత్త సభ్యుడు)","basic":"నమ్మకపు స్థాయి 1 వినియోగదారులు (ప్రాధమిక వినియోగదారు)","staff":"సిబ్బంది","admins":"అధికారి సభ్యులు","moderators":"నిర్వాహకులు","blocked":"నిలిపిన సభ్యులు","suspended":"సస్పెండయిన సభ్యులు","suspect":"అనుమానిత సభ్యులు"},"reject_successful":{"one":"వినియోగదారులు విజయవంతంగా ","other":"వినియోగదారులు విజయవంతంగా %{సంఖ్య} తిరస్కరింపబడ్డారు.."},"reject_failures":{"one":"వినియోగదారులు 1 ని తిరస్కరించుటలో వైఫల్యం."},"not_verified":"ద్రువీకరించలేదు","check_email":{"title":"ఈ సభ్యుని ఈమెయిల్ చూపు","text":"చూపు"}},"user":{"suspend_failed":"ఈ సభ్యుడిని సస్పెండ్ చేసేప్పుడు ఏదో తేడా జరిగింది.  {{error}}","unsuspend_failed":"ఈ వినియోగదారు వలన ఏదో తొలగింపబడని తప్పు జరిగింది {{దోషం}}","suspend_duration":"వినియోగదారు ఎంతకాలం నిలిపివేయబడ్డాడు?","suspend_duration_units":"(రోజులు)","suspend_reason_label":"మీరు ఎందుకు తొలగించబడ్డారు? ఈ పాఠ్యం \u003cb\u003e వినియోగదారును ప్రొఫైల్ పుట మీద ప్రతివారికి \u003c/b\u003e కనబడుతుంది, మరియు వినియోగదారుడు లాగిన్‌కు ప్రయత్నించినపుడు చూస్తారు.చిన్నదిగా ఉంచండి.","suspend_reason":"కారణం","suspended_by":"సస్పెండు చేసినవారు","delete_all_posts":"అన్ని టపాలూ తొలగించు","suspend":"సస్పెండు","unsuspend":"సస్పెండు తొలగించు","suspended":"సస్పెండయ్యాడా? ","moderator":"నిర్వాహకుడు?","admin":"అధికారి?","blocked":"నిలిపిన?","show_admin_profile":"అధికారి","edit_title":"శీర్షిక సవరించు","save_title":"శీర్షిక భద్రపరుచు","refresh_browsers":"బ్రౌజరు తాజాకరణ బలవంతంచేయి","refresh_browsers_message":"అన్ని క్లైంటులకు సందేశం పంపబడింది!","show_public_profile":"ప్రజా ప్రవర చూపు","impersonate":"పరకాయప్రవేశం చేయి","ip_lookup":"ఐపీ లుకప్","log_out":"లాగవుట్","logged_out":"వినియోగదారుడు అన్ని పరికరాలు లాగవుట్ చేశారు","revoke_admin":"నిర్వాహకులు తొలగించారు","grant_admin":"నిర్వాహకులు సమ్మతించారు","revoke_moderation":"సమన్వయం నిలిపివేశారు","grant_moderation":"సమన్వయం అనుమతించారు","unblock":"అడ్డగింపలేదు","block":"నిలుపు","reputation":"ప్రసిధ్ధ","permissions":"అనుమతులు","activity":"కలాపం","like_count":"ఇష్టాలు ఇచ్చినవి/స్వీకరించినవి","last_100_days":"గత నూరు రోజుల్లో","private_topics_count":"ప్రైవేటు విషయాలు","posts_read_count":"చదివిన టపాలు","post_count":"టపాలు సృష్టించిన","topics_entered":"సందర్శించిన విషయాలు ","flags_given_count":"ఇచ్చిన కేతనాలు ","flags_received_count":"వచ్చిన కేతనాలు","warnings_received_count":"అందిన హెచ్చరికలు","flags_given_received_count":"ఇచ్చిన కేతనాలు","approve":"అనుమతించు","approved_by":"అనుమతించినవారు","approve_success":"యాక్టివేషన్ సూచనలతో పాటు వినియోగదారు ఆమోదం మరియు ఈ-మెయిల్ పంపుతారు.","approve_bulk_success":"విజయవంతం! ఎంచుకున్న వినియోగదారులందరినీ ఆమోదించారు మరియు ప్రకటన చేశారు.","time_read":"చదువు సమయం","delete":"సభ్యుడిని తొలగించు","delete_forbidden_because_staff":"అధికారులు మరియు నిర్వాహకులను తొలగించలేరు","delete_posts_forbidden_because_staff":"నిర్వాహకుల మరియు పరిశీలకుల అన్ని టపాలు తొలగించలేము.","delete_confirm":"మీరు నిజంగా ఈ వినియోగదారుని తొలగిద్దాం అనుకుంటున్నారా ? ఇది శాశ్వతం!","delete_and_block":"ఈ ఈ-మెయిల్ మరియు IP అడ్రస్ ను తొలగించండి మరియు \u003cb\u003eనిరోధించండి\u003c/b\u003e","delete_dont_block":"తొలగింపు మాత్రమే","deleted":"ఈ సభ్యుడు తొలగించబడ్డాడు","delete_failed":"వినియోగదారుని తొలగించుటలో ఒక దోషం ఉంది.వినియోగదారుని తొలగించడానికి   ప్రయత్నించకముందే టపాలు అన్ని తొలగించండి.","send_activation_email":"చేతన ఈమెయిల్ పంపు","activation_email_sent":"ఒక చేతన ఈమెయిల్ పంపాము.","send_activation_email_failed":"చేతన ఈమెయిల్ పంపుటలో దోషం  %{error}","activate":"ఖాతా క్రియాశీలం చేయి","activate_failed":"సభ్యుడిని చేతనం చేయుటలో దోషం","deactivate_account":"ఖాతా అక్రియాశీలం చేయి","deactivate_failed":"వినియోగదారుని నిర్వీర్యం చేసే ఒక సమస్య ఉంది.","unblock_failed":"వినియోగదారుని అనుమతించడంలో ఒక సమస్య ఉంది.","block_failed":"వినియోగదారుని ఒక సమస్య నిరోధిస్తుంది.","deactivate_explanation":"క్రియారహిత వినియోగదారు తప్పనిసరిగా వారి ఈ-మెయిల్ ను సరిదిద్దాలి.","suspended_explanation":"నిలిపివేయబడ్డ వినియోగదారు లాగిన్ కాలేరు.","block_explanation":"అడ్డగింపబడ్డ వినియోగదారు టపాలు చేయలేరు లేదా విషయాలు మొదలుపెట్టలేరు.","trust_level_change_failed":"వినియోగదారు నమ్మకపు స్థాయి మార్చడానికి సమస్య ఉంది.","suspend_modal_title":"సభ్యుడిని సస్పెండు చేయి","trust_level_2_users":"నమ్మకం స్థాయి 2 సభ్యులు","trust_level_3_requirements":"నమ్మకపు స్థాయి 3 అవసరాలు","trust_level_locked_tip":"నమ్మకపు స్థాయి బంధింపబడిఉంది, వ్యవస్థ వినియోగదారుని ప్రోత్సాహించలేదు లేదా స్థాయి తగ్గించలేదు","trust_level_unlocked_tip":"నమ్మకపు స్థాయి బంధింపబడలేదు, వ్యవస్థ వినియోగదారుని ప్రోత్సాహించవచ్చు లేదా స్థాయి తగ్గించవచ్చు","lock_trust_level":"నమ్మకపు స్థాయి ని బంధించు","unlock_trust_level":"నమ్మకపు స్థాయిని వదిలేయి","tl3_requirements":{"title":"నమ్మకపు స్థాయి 3 అవసరాలు","value_heading":"విలువ","requirement_heading":"అవసరం","visits":"సందర్శనాలు","days":"రోజులు","topics_replied_to":"విషయాలు సమాధానంగా","topics_viewed":"చూసిన విషయాలు ","topics_viewed_all_time":"చూసిన విషయాలు (అన్ని వేళలా)","posts_read":"చదివిన టపాలు","posts_read_all_time":"చదివిన టపాలు (అన్ని వేళలా)","flagged_posts":"కేతనించిన టపాలు","flagged_by_users":"ఏ వినియోగదారులు కేతనించారు","likes_given":"ఇచ్చిన ఇష్టాలు","likes_received":"అందుకున్న ఇష్టాలు","likes_received_days":"స్వీకరించిన ఇష్టాలు:ప్రత్యేకమైన రోజులు","likes_received_users":"స్వీకరించిన ఇష్టాలు:ప్రత్యేకమైన వినియోగదారులు","qualifies":"నమ్మకపు స్థాయి 3 కు అర్హత .","does_not_qualify":"నమ్మకపు స్థాయి 3 కు అర్హత లేదు.","will_be_promoted":"త్వరలో స్థాయి పెరుగును.","will_be_demoted":"త్వరలో స్థాయి తగ్గును.","on_grace_period":"ప్రస్తుతం స్థాయి పెరుగుదల అదనపుకాలంలో ఉంది, స్థాయి తగ్గింపు జరగదు.","locked_will_not_be_promoted":"నమ్మకపు స్థాయి బంధించబడి ఉంది. స్థాయి పెరుగుదల ఉండదు.","locked_will_not_be_demoted":"నమ్మకపు స్థాయి బంధించబడి ఉంది.ఎప్పటికీ స్థానాన్ని తగ్గించలేరు."},"sso":{"title":"ఒక సైన్ ఆన్","external_id":"బాహ్య ఐడీ","external_username":"సభ్యనామం","external_name":"పేరు","external_email":"ఈమెయిల్","external_avatar_url":"ప్రవర బొమ్మ యూఆర్ యల్"}},"user_fields":{"title":"సభ్య క్షేత్రాలు","help":"వినియోగదారులు పూర్తి చేసిన వాటిని జోడించండి.","create":"సభ్య క్షేత్రం సృష్టించు","untitled":"పేరులేని","name":"క్షేత్రం పేరు","type":"క్షేత్రం టైపు","description":"క్షేత్రం వివరణ","save":"భద్రపరచు","edit":"సవరణ","delete":"తొలగించు","cancel":"రద్దుచేయి","delete_confirm":"మీరు నిజంగా ఈ సభ్య క్షేత్రం తొలగించాలనుకుంటున్నారా?","required":{"title":"సైన్అప్ అవసరమా?","enabled":"కావాలి","disabled":"అవసరంలేదు"},"editable":{"title":"సైన్అప్ తరువాత సవరించగలమా?","enabled":"సవరించదగిన","disabled":"సవరించలేని"},"show_on_profile":{"title":"ప్రజా ప్రవరపై చూపు?","enabled":"ప్రవరపై చూపు","disabled":"ప్రవరపై చూపబడలేదు"},"field_types":{"text":"పాఠ్య క్షేత్రం","confirm":"ఖాయము"}},"site_text":{"title":"పాఠ్య కాంటెంటు"},"site_settings":{"show_overriden":"ప్రాబల్యం ఉన్న వాటిని మాత్రమే చూపించు","title":"అమరికలు","reset":"రీసెట్","none":"ఏదీకాదు","no_results":"ఏ ఫలితాలూ కనిపించలేదు.","clear_filter":"శుభ్రపరుచు","add_url":"URL కలుపు","categories":{"all_results":"అన్నీ","required":"కావాలి","basic":"ప్రాథమిక సెటప్","users":"వాడుకరులు","posting":"రాస్తున్నారు","email":"మెయిల్","files":"దస్త్రాలు","trust":"నమ్మకపు స్థాయిలు","security":"సెక్యూరిటీ","onebox":"ఒకపెట్టె","seo":"యస్ ఈ ఓ","spam":"స్పాము","rate_limits":"రోట్ హద్దులు","developer":"డవలపరు","embedding":"దేనిలోనైనా ఒదుగు","legal":"న్యాయ","uncategorized":"ఇతర","backups":"బ్యాకప్పులు","login":"లాగిన్","plugins":"చొప్పింతలు"}},"badges":{"title":"బ్యాడ్జీలు","new_badge":"కొత్త బ్యాడ్జీ","new":"కొత్త ","name":"పేరు","badge":"బ్యాడ్జీ","display_name":"ప్రదర్శించు పేరు","description":"వివరణ","badge_type":"బ్యాడ్జి టైపు","badge_grouping":"గుంపు","badge_groupings":{"modal_title":"బ్యాడ్జ్ గ్రూపులు"},"granted_by":"ఇచ్చిన వారు","granted_at":"ఇచ్చిన సమయం","reason_help":"(టపాకి లేదా విషయానికి లంకె )","save":"భద్రపరచు","delete":"తొలగించు","delete_confirm":"మీరు నిజంగా ఈ బ్యాడ్జి తొలగించాలనుకుంటున్నారా?","revoke":"రివోక్","reason":"కారణం","revoke_confirm":"మీరు నిజంగా ఈ బ్యాడ్జిని రివోక్ చేయాలనుకుంటున్నారా? ","edit_badges":"బ్యాడ్జీలు సవరించు","grant_badge":"బ్యాడ్జి ఇవ్వు","granted_badges":"ఇచ్చిన బ్యాడ్జీలు","grant":"ఇవ్వు","no_user_badges":"%{పేరు} ఏ చిహ్నాలు మంజూరు చేయలేదు.","no_badges":"మంజూరు చేసే చిహ్నాలు లేవు.","none_selected":"ఆరంభించడానికి ఒక బ్యాడ్జీని ఎంచుకోండి.","allow_title":"చిహ్నాన్ని శీర్షికగా వాడుకోవడానికి అనుమతి ఇవ్వండి.","multiple_grant":"అనేకసార్లు మంజూరు చేయవచ్చు","listable":"బహిరంగ చిహ్నాల పుటలో చూపండి","enabled":"బ్యాడ్జి చేతనం చేయి","icon":"ఐకాన్","image":"బొమ్మ","icon_help":"చిత్రానికి బ్రహ్మాండమైన ఫాంట్  లేదా URL గాని ఉపయోగించండి","target_posts":"టపాలు లక్ష్యంగా ప్రశ్న","show_posts":"చిహ్నాల పుటలో మంజూరు అయిన చిహ్నాన్ని చూపండి","trigger":"ట్రిగ్గరు","trigger_type":{"none":"రోజు ఉన్నతీకరించు","post_action":"వినియోగదారుడు టపాపై పనిచేసినపుడు","post_revision":"వినియోగదారుడు టపా సృష్టిస్తున్నప్పుడు లేదా సవరిస్తున్నప్పుడు","trust_level_change":"వినియోగదారుడు నమ్మకపుస్థాయి మార్చినప్పుడు","user_change":"వినియోగదారుడు సవరిస్తున్నపుడు లేదా సృష్టిస్తున్నపుడు"},"preview":{"sql_error_header":"ప్రశ్నతో దోషం ఉంది.","bad_count_warning":{"header":"హెచ్చరిక!"},"sample":"నమూనా:","grant":{"with":"\u003cspan class=\"username\"\u003e%{వినియోగదారు పేరు}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{వినియోగదారు పేరు}\u003c/span\u003e టపా కొరకు%{లంకె}","with_post_time":"\u003cspan class=\"సభ్యుల పేరు\"\u003e%{username}\u003c/span\u003e for post in %{link} at \u003cspan class=\"సమయం\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"ఇమోజి","add":"కొత్త ఇమోజి కలుపు","name":"పేరు","image":"బొమ్మ","delete_confirm":"మీరు నిజంగా %{పేరు}: ఎమోజీ ని తొలగించాలనుకుంటున్నారా ?"}}}},"en":{"js":{"number":{"format":{"separator":".","delimiter":","},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"timeline_date":"MMM YYYY","full_no_year_no_time":"MMMM Do","full_with_year_no_time":"MMMM Do, YYYY","wrap_ago":"%{date} ago","later":{"x_days":{"one":"1 day later","other":"%{count} days later"},"x_months":{"one":"1 month later","other":"%{count} months later"},"x_years":{"one":"1 year later","other":"%{count} years later"}},"previous_month":"Previous Month","next_month":"Next Month"},"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}","split_topic":"split this topic %{when}","invited_user":"invited %{who} %{when}","invited_group":"invited %{who} %{when}","removed_user":"removed %{who} %{when}","removed_group":"removed %{who} %{when}","autoclosed":{"enabled":"closed %{when}","disabled":"opened %{when}"},"closed":{"enabled":"closed %{when}","disabled":"opened %{when}"},"archived":{"enabled":"archived %{when}","disabled":"unarchived %{when}"},"pinned":{"enabled":"pinned %{when}","disabled":"unpinned %{when}"},"pinned_globally":{"enabled":"pinned globally %{when}","disabled":"unpinned %{when}"},"visible":{"enabled":"listed %{when}","disabled":"unlisted %{when}"}},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)","cn_north_1":"China (Beijing)"}},"show_help":"options","every_30_minutes":"every 30 minutes","every_hour":"every hour","alternation":"or","suggested_topics":{"pm_title":"Suggested Messages"},"bookmarks":{"confirm_clear":"Are you sure you want to clear all the bookmarks from this topic?"},"uploading_filename":"Uploading {{filename}}...","switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","banner":{"edit":"Edit this banner \u003e\u003e"},"queue":{"topic":"Topic:","approve":"Approve","reject":"Reject","delete_user":"Delete User","title":"Needs Approval","none":"There are no posts to review.","edit":"Edit","view_pending":"view pending posts","has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval","other":"This topic has \u003cb\u003e{{count}}\u003c/b\u003e posts awaiting approval"},"confirm":"Save Changes","delete_prompt":"Are you sure you want to delete \u003cb\u003e%{username}\u003c/b\u003e? This will remove all of their posts and block their email and IP address.","approval":{"title":"Post Needs Approval","description":"We've received your new post but it needs to be approved by a moderator before it will appear. Please be patient.","pending_posts":{"one":"You have \u003cstrong\u003e1\u003c/strong\u003e post pending.","other":"You have \u003cstrong\u003e{{count}}\u003c/strong\u003e posts pending."}}},"directory":{"filter_name":"filter by username","likes_given":"Given","likes_received":"Received","topics_entered":"Viewed","topics_entered_long":"Topics Viewed","time_read":"Time Read","topic_count":"Topics","topic_count_long":"Topics Created","post_count":"Replies","post_count_long":"Replies Posted","no_results":"No results were found.","days_visited":"Visits","days_visited_long":"Days Visited","posts_read":"Read","posts_read_long":"Posts Read","total_rows":{"one":"1 user","other":"%{count} users"}},"groups":{"empty":{"posts":"There is no post by members of this group.","members":"There is no member in this group.","mentions":"There is no mention of this group.","messages":"There is no message for this group.","topics":"There is no topic by members of this group."},"add":"Add","selector_placeholder":"Add members","owner":"owner","index":"Groups","topics":"Topics","mentions":"Mentions","messages":"Messages","alias_levels":{"title":"Who can message and @mention this group?"},"trust_levels":{"title":"Trust level automatically granted to members when they're added:","none":"None"},"notifications":{"watching":{"title":"Watching","description":"You will be notified of every new post in every message, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."},"tracking":{"title":"Tracking","description":"You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"regular":{"title":"Normal","description":"You will be notified if someone mentions your @name or replies to you."},"muted":{"title":"Muted","description":"You will never be notified of anything about new topics in this group."}}},"user_action_groups":{"5":"Replies","6":"Responses","14":"Pending"},"categories":{"category_list":"Display category list","reorder":{"title":"Reorder Categories","title_long":"Reorganize the category list","fix_order":"Fix Positions","fix_order_tooltip":"Not all categories have a unique position number, which may cause unexpected results.","save":"Save Order","apply_all":"Apply","position":"Position"},"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user_fields":{"none":"(select an option)"},"user":{"new_private_message":"New Message","private_message":"Message","expand_profile":"Expand","statistics":"Stats","desktop_notifications":{"label":"Desktop Notifications","not_supported":"Notifications are not supported on this browser. Sorry.","perm_default":"Turn On Notifications","perm_denied_btn":"Permission Denied","perm_denied_expl":"You denied permission for notifications. Allow notifications via your browser settings.","disable":"Disable Notifications","currently_enabled":"","enable":"Enable Notifications","currently_disabled":"","each_browser_note":"Note: You have to change this setting on every browser you use."},"dismiss_notifications":"Dismiss All","dynamic_favicon":"Show new / updated topic count on browser icon","blocked_tooltip":"This user is blocked","email_activity_summary":"Activity Summary","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","muted_categories_instructions":"You will not be notified of anything about new topics in these categories, and they will not appear in latest.","muted_users":"Muted","muted_users_instructions":"Suppress all notifications from these users.","muted_topics_link":"Show muted topics","watched_topics_link":"Show watched topics","automatically_unpin_topics":"Automatically unpin topics when I reach the bottom.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","messages":{"inbox":"Inbox","sent":"Sent","archive":"Archive","groups":"My Groups","bulk_select":"Select messages","move_to_inbox":"Move to Inbox","move_to_archive":"Archive","failed_to_move":"Failed to move selected messages (perhaps your network is down)","select_all":"Select All"},"change_about":{"error":"There was an error changing this value."},"change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"change_avatar":{"gravatar_title":"Change your avatar on Gravatar's website","image_is_not_a_square":"Warning: we've cropped your image; width and height were not equal.","cache_notice":"You've successfully changed your profile picture but it might take some time to appear due to browser caching."},"email":{"frequency_immediately":"We'll email you immediately if you haven't read the thing we're emailing you about.","frequency":{"one":"We'll only email you if we haven't seen you in the last minute.","other":"We'll only email you if we haven't seen you in the last {{count}} minutes."}},"name":{"instructions_required":"Your full name"},"like_notification_frequency":{"title":"Notify when liked","always":"Always","first_time_and_daily":"First time a post is liked and daily","first_time":"First time a post is liked","never":"Never"},"email_previous_replies":{"title":"Include previous replies at the bottom of emails","unless_emailed":"unless previously sent","always":"always","never":"never"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies","every_30_minutes":"every 30 minutes","every_hour":"hourly"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","email_direct":"Send me an email when someone quotes me, replies to my post, mentions my @username, or invites me to a topic","email_private_messages":"Send me an email when someone messages me","email_always":"Send me email notifications even when I am active on the site","new_topic_duration":{"after_1_day":"created in the last day","after_2_days":"created in the last 2 days","after_1_week":"created in the last week","after_2_weeks":"created in the last 2 weeks"},"auto_track_options":{"immediately":"immediately","after_30_seconds":"after 30 seconds","after_1_minute":"after 1 minute","after_2_minutes":"after 2 minutes","after_3_minutes":"after 3 minutes","after_4_minutes":"after 4 minutes","after_5_minutes":"after 5 minutes","after_10_minutes":"after 10 minutes"},"invited":{"sent":"Sent","none":"There are no pending invites to display.","truncated":{"one":"Showing the first invite.","other":"Showing the first {{count}} invites."},"redeemed_tab":"Redeemed","redeemed_tab_with_count":"Redeemed ({{count}})","pending_tab":"Pending","pending_tab_with_count":"Pending ({{count}})","reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!","generate_link":"Copy Invite Link","generated_link_message":"\u003cp\u003eInvite link generated successfully!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eInvite link is only valid for this email address: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"success":"File uploaded successfully, you will be notified via message when the process is complete."}},"summary":{"title":"Summary","stats":"Stats","time_read":"read time","topic_count":{"one":"topic created","other":"topics created"},"post_count":{"one":"post created","other":"posts created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"top_replies":"Top Replies","no_replies":"No replies yet.","more_replies":"More Replies","top_topics":"Top Topics","no_topics":"No topics yet.","more_topics":"More Topics","top_badges":"Top Badges","no_badges":"No badges yet.","more_badges":"More Badges","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."},"avatar":{"header_title":"profile, messages, bookmarks and preferences"},"stream":{"private_message":"message"}},"errors":{"reasons":{"not_found":"Page Not Found"},"desc":{"not_found":"Oops, the application tried to load a URL that doesn't exist."}},"read_only_mode":{"enabled":"This site is in read only mode. Please continue to browse, but replying, likes, and other actions are disabled for now.","logout_disabled":"Logout is disabled while the site is in read only mode."},"too_few_topics_and_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics and \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","too_few_topics_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics. New visitors need some conversations to read and respond to.","too_few_posts_notice":"Let's \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eget this discussion started!\u003c/a\u003e There are currently \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e posts. New visitors need some conversations to read and respond to.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"last_reply_lowercase":"last reply","replies_lowercase":{"one":"reply","other":"replies"},"signup_cta":{"sign_up":"Sign Up","hide_session":"Remind me tomorrow","hide_forever":"no thanks","hidden_for_session":"OK, I'll ask you tomorrow. You can always use 'Log In' to create an account, too.","intro":"Hey there! :heart_eyes: Looks like you're enjoying the discussion, but you're not signed up for an account.","value_prop":"When you create an account, we remember exactly what you've read, so you always come right back where you left off. You also get notifications, here and via email, whenever new posts are made. And you can like posts to share the love. :heartbeat:"},"summary":{"description":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies.","description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"private_message_info":{"title":"Message","remove_allowed_user":"Do you really want to remove {{name}} from this message?","remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"forgot_password":{"title":"Password Reset"},"login":{"rate_limit":"Please wait before trying to log in again.","to_continue":"Please Log In","preferences":"You need to be logged in to change your user preferences.","forgot":"I don't recall my account details","instagram":{"title":"with Instagram","message":"Authenticating with Instagram (make sure pop up blockers are not enabled)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"more...","options":"Options","whisper":"whisper","unlist":"unlisted","toggle_whisper":"Toggle Whisper","toggle_unlisted":"Toggle Unlisted","saving_draft_tip":"saving...","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","error":{"try_like":"Have you tried the \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e button?"},"create_topic":"Create Topic","create_pm":"Message","reply_placeholder":"Type here. Use Markdown, BBCode, or HTML to format. Drag or paste images.","saving":"Saving","bold_label":"B","italic_label":"I","link_url_placeholder":"http://example.com","paste_code_text":"type or paste code here","heading_label":"H","modal_ok":"OK","modal_cancel":"Cancel","cant_send_pm":"Sorry, you can't send a message to %{username}.","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"title":"notifications of @name mentions, replies to your posts and topics, messages, etc","empty":"No notifications found.","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"},"alt":{"mentioned":"Mentioned by","quoted":"Quoted by","replied":"Replied","posted":"Post by","edited":"Edit your post by","liked":"Liked your post","private_message":"Private message from","invited_to_private_message":"Invited to a private message from","invited_to_topic":"Invited to a topic from","invitee_accepted":"Invite accepted by","moved_post":"Your post was moved by","linked":"Link to your post","granted_badge":"Badge granted","group_message_summary":"Messages in group inbox"},"popup":{"mentioned":"{{username}} mentioned you in \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mentioned you in \"{{topic}}\" - {{site_title}}","quoted":"{{username}} quoted you in \"{{topic}}\" - {{site_title}}","replied":"{{username}} replied to you in \"{{topic}}\" - {{site_title}}","posted":"{{username}} posted in \"{{topic}}\" - {{site_title}}","private_message":"{{username}} sent you a private message in \"{{topic}}\" - {{site_title}}","linked":"{{username}} linked to your post from \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"remote_tip_with_attachments":"link to image or file {{authorized_extensions}}","local_tip":"select images from your device","local_tip_with_attachments":"select images or files from your device {{authorized_extensions}}","hint_for_supported_browsers":"you can also drag and drop or paste images into the editor","select_file":"Select File"},"search":{"sort_by":"Sort by","relevance":"Relevance","latest_post":"Latest Post","most_viewed":"Most Viewed","most_liked":"Most Liked","select_all":"Select All","clear_all":"Clear All","too_short":"Your search term is too short.","result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} results for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"no_more_results":"No more results found.","search_help":"Search help","context":{"category":"Search the #{{category}} category","private_messages":"Search messages"}},"hamburger_menu":"go to another topic list or category","new_item":"new","topics":{"bulk":{"unlist_topics":"Unlist Topics","dismiss":"Dismiss","dismiss_read":"Dismiss all unread","dismiss_button":"Dismiss…","dismiss_tooltip":"Dismiss just new posts or stop tracking topics","also_dismiss_topics":"Stop tracking these topics so they never show up as unread for me again","change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."},"none":{"search":"There are no search results.","educate":{"new":"\u003cp\u003eYour new topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered new and will show a \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e indicator if they were created in the last 2 days.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e","unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}},"bottom":{"search":"There are no more search results."}},"topic":{"unsubscribe":{"stop_notifications":"You will now receive less notifications for \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Your current notification state is "},"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"private_message":"Start a message","archive_message":{"help":"Move message to your archive","title":"Archive"},"move_to_inbox":{"title":"Move to Inbox","help":"Move message back to Inbox"},"read_more_MF":"There { UNREAD, plural, =0 {} one { is \u003ca href='/unread'\u003e1 unread\u003c/a\u003e } other { are \u003ca href='/unread'\u003e# unread\u003c/a\u003e } } { NEW, plural, =0 {} one { {BOTH, select, true{and } false {is } other{}} \u003ca href='/new'\u003e1 new\u003c/a\u003e topic} other { {BOTH, select, true{and } false {are } other{}} \u003ca href='/new'\u003e# new\u003c/a\u003e topics} } remaining, or {CATEGORY, select, true {browse other topics in {catLink}} false {{latestLink}} other {}}","auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_bottom":"jump to last post","jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic.","1_2":"You will be notified if someone mentions your @name or replies to you.","1":"You will be notified if someone mentions your @name or replies to you."},"watching_pm":{"description":"You will be notified of every new reply in this message, and a count of new replies will be shown."},"watching":{"description":"You will be notified of every new reply in this topic, and a count of new replies will be shown."},"tracking_pm":{"description":"A count of new replies will be shown for this message. You will be notified if someone mentions your @name or replies to you."},"tracking":{"description":"A count of new replies will be shown for this topic. You will be notified if someone mentions your @name or replies to you. "},"regular":{"title":"Normal","description":"You will be notified if someone mentions your @name or replies to you."},"regular_pm":{"title":"Normal","description":"You will be notified if someone mentions your @name or replies to you."},"muted_pm":{"description":"You will never be notified of anything about this message."},"muted":{"description":"You will never be notified of anything about this topic, and it will not appear in latest."}},"actions":{"multi_select":"Select Posts…","auto_close":"Auto Close…","pin":"Pin Topic…","unpin":"Un-Pin Topic…","make_public":"Make Public Topic","make_private":"Make Private Message"},"feature":{"pin":"Pin Topic","unpin":"Un-Pin Topic","pin_globally":"Pin Topic Globally","make_banner":"Banner Topic","remove_banner":"Remove Banner Topic"},"feature_topic":{"title":"Feature this topic","pin":"Make this topic appear at the top of the {{categoryLink}} category until","confirm_pin":"You already have {{count}} pinned topics. Too many pinned topics may be a burden for new and anonymous users. Are you sure you want to pin another topic in this category?","unpin":"Remove this topic from the top of the {{categoryLink}} category.","unpin_until":"Remove this topic from the top of the {{categoryLink}} category or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Users can unpin the topic individually for themselves.","pin_validation":"A date is required to pin this topic.","not_pinned":"There are no topics pinned in {{categoryLink}}.","already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Make this topic appear at the top of all topic lists until","confirm_pin_globally":"You already have {{count}} globally pinned topics. Too many pinned topics may be a burden for new and anonymous users. Are you sure you want to pin another topic globally?","unpin_globally":"Remove this topic from the top of all topic lists.","unpin_globally_until":"Remove this topic from the top of all topic lists or wait until \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Users can unpin the topic individually for themselves.","not_pinned_globally":"There are no topics pinned globally.","already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Make this topic into a banner that appears at the top of all pages.","remove_banner":"Remove the banner that appears at the top of all pages.","banner_note":"Users can dismiss the banner by closing it. Only one topic can be bannered at any given time.","no_banner_exists":"There is no banner topic.","banner_exists":"There \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e currently a banner topic."},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"title":"Invite to Message","success":"We've invited that user to participate in this message.","success_group":"We've invited that group to participate in this message."},"controls":"Topic Controls","invite_reply":{"action":"Send Invite","help":"invite others to this topic via email or notifications","sso_enabled":"Enter the username of the person you'd like to invite to this topic.","to_topic_blank":"Enter the username or email address of the person you'd like to invite to this topic.","to_topic_email":"You've entered an email address. We'll email an invitation that allows your friend to immediately reply to this topic.","to_topic_username":"You've entered a username. We'll send a notification with a link inviting them to this topic.","to_username":"Enter the username of the person you'd like to invite. We'll send a notification with a link inviting them to this topic.","success_email":"We mailed out an invitation to \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. We'll notify you when the invitation is redeemed. Check the invitations tab on your user page to keep track of your invites.","success_username":"We've invited that user to participate in this topic.","error":"Sorry, we couldn't invite that person. Perhaps they have already been invited? (Invites are rate limited)"},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_timestamp":{"title":"Change Timestamp","action":"change timestamp","invalid_timestamp":"Timestamp cannot be in the future.","error":"There was an error changing the timestamp of the topic.","instructions":"Please select the new timestamp of the topic. Posts in the topic will be updated to have the same time difference."}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","edit":"Editing {{link}} {{replyAvatar}} {{username}}","gap":{"one":"view 1 hidden reply","other":"view {{count}} hidden replies"},"has_replies":{"one":"{{count}} Reply","other":"{{count}} Replies"},"has_likes":{"one":"{{count}} Like","other":"{{count}} Likes"},"has_likes_title":{"one":"1 person liked this post","other":"{{count}} people liked this post"},"has_likes_title_only_you":"you liked this post","has_likes_title_you":{"one":"you and 1 other person liked this post","other":"you and {{count}} other people liked this post"},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","whisper":"this post is a private whisper for moderators","wiki":{"about":"this post is a wiki"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","controls":{"change_owner":"Change Ownership"},"actions":{"people":{"off_topic":"flagged this as off-topic","spam":"flagged this as spam","inappropriate":"flagged this as inappropriate","notify_moderators":"notified moderators","notify_user":"sent a message","bookmark":"bookmarked this","like":"liked this","vote":"voted for this"},"by_you":{"notify_user":"You sent a message to this user"},"by_you_and_others":{"notify_user":{"one":"You and 1 other sent a message to this user","other":"You and {{count}} other people sent a message to this user"}},"by_others":{"notify_user":{"one":"1 person sent a message to this user","other":"{{count}} sent a message to this user"}}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"}}},"category":{"all":"All categories","topic_template":"Topic Template","tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","create_long":"Create a new category","special_warning":"Warning: This category is a pre-seeded category and the security settings cannot be edited. If you do not wish to use this category, delete it instead of repurposing it.","suppress_from_homepage":"Suppress this category from the homepage.","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."},"regular":{"title":"Normal","description":"You will be notified if someone mentions your @name or replies to you."},"muted":{"description":"You will never be notified of anything about new topics in these categories, and they will not appear in latest."}}},"flagging":{"notify_action":"Message","official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"flagging_topic":{"notify_action":"Message"},"topic_map":{"participants_title":"Frequent Posters","links_title":"Popular Links","links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"topic_statuses":{"locked_and_archived":{"help":"This topic is closed and archived; it no longer accepts new replies and cannot be changed"},"pinned_globally":{"help":"This topic is pinned globally; it will display at the top of latest and its category"}},"posts_likes_MF":"This topic has {count, plural, one {1 reply} other {# replies}} {ratio, select,\n  low {with a high like to post ratio}\n  med {with a very high like to post ratio}\n  high {with an extremely high like to post ratio}\n  other {}}\n","views_lowercase":{"one":"view","other":"views"},"likes_lowercase":{"one":"like","other":"likes"},"users_lowercase":{"one":"user","other":"users"},"filters":{"latest":{"title":"Latest","title_with_count":{"one":"Latest (1)","other":"Latest ({{count}})"}},"search":{"title":"Search","help":"search all topics"},"unread":{"title":"Unread","title_with_count":{"one":"Unread (1)","other":"Unread ({{count}})"},"lower_title_with_count":{"one":"1 unread","other":"{{count}} unread"}},"new":{"lower_title_with_count":{"one":"1 new","other":"{{count}} new"},"title":"New","title_with_count":{"one":"New (1)","other":"New ({{count}})"}},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"}},"top":{"all":{"title":"All Time"},"yearly":{"title":"Yearly"},"quarterly":{"title":"Quarterly"},"monthly":{"title":"Monthly"},"weekly":{"title":"Weekly"},"daily":{"title":"Daily"},"all_time":"All Time","this_year":"Year","this_quarter":"Quarter","this_month":"Month","this_week":"Week","other_periods":"see top"}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"voters":{"one":"voter","other":"voters"},"total_votes":{"one":"total vote","other":"total votes"},"average_rating":"Average rating: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Votes are public."},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"cast-votes":{"title":"Cast your votes","label":"Vote now!"},"show-results":{"title":"Display the poll results","label":"Show results"},"hide-results":{"title":"Back to your votes","label":"Hide results"},"open":{"title":"Open the poll","label":"Open","confirm":"Are you sure you want to open this poll?"},"close":{"title":"Close the poll","label":"Close","confirm":"Are you sure you want to close this poll?"},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"private_messages_short":"Msgs","private_messages_title":"Messages","mobile_title":"Mobile","reports":{"view_graph":"graph","groups":"All groups"}},"flags":{"agree_flag_hide_post_title":"Hide this post and automatically send the user a message urging them to edit it"},"groups":{"delete_owner_confirm":"Remove owner privilege for '%{username}'?","custom":"Custom","bulk_complete":"The users have been added to the group.","bulk":"Bulk Add to Group","bulk_paste":"Paste a list of usernames or emails, one per line:","bulk_select":"(select a group)","automatic":"Automatic","default_title":"Default title for all users in this group","primary_group":"Automatically set as primary group","group_owners":"Owners","add_owners":"Add owners","incoming_email":"Custom incoming email address","incoming_email_placeholder":"enter email address","flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"plugins":{"enabled":"Enabled?","is_enabled":"Y","not_enabled":"N","change_settings_short":"Settings"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"upload":{"label":"Upload","title":"Upload a backup to this instance"},"operations":{"cancel":{"label":"Cancel"},"backup":{"label":"Backup"},"download":{"label":"Download"},"restore":{"label":"Restore","confirm":"Are you sure you want to restore this backup?"},"rollback":{"label":"Rollback","confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"export_csv":{"success":"Export initiated, you will be notified via message when the process is complete."},"export_json":{"button_text":"Export"},"customize":{"embedded_css":"Embedded CSS","import":"Import","import_title":"Select a file or paste text","email_templates":{"title":"Email Templates","subject":"Subject","multiple_subjects":"This email template has multiple subjects.","body":"Body","none_selected":"Select an email template to begin editing.","revert":"Revert Changes","revert_confirm":"Are you sure you want to revert your changes?"}},"email":{"title":"Emails","templates":"Templates","bounced":"Bounced","received":"Received","rejected":"Rejected","preview_digest_desc":"Preview the content of the digest emails sent to inactive users.","incoming_emails":{"from_address":"From","to_addresses":"To","cc_addresses":"Cc","subject":"Subject","error":"Error","none":"No incoming emails found.","modal":{"title":"Incoming Email Details","error":"Error","headers":"Headers","subject":"Subject","body":"Body","rejection_message":"Rejection Mail"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Subject...","error_placeholder":"Error"}}},"logs":{"category_id":"Category ID","staff_actions":{"actions":{"change_site_text":"change site text","anonymize_user":"anonymize user","roll_up":"roll up IP blocks","change_category_settings":"change category settings","delete_category":"delete category","create_category":"create category","block_user":"block user","unblock_user":"unblock user","grant_admin":"grant admin","revoke_admin":"revoke admin","grant_moderation":"grant moderation","revoke_moderation":"revoke moderation","backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}},"screened_emails":{"description":"When someone tries to create a new account, the following email addresses will be checked and the registration will be blocked, or some other action performed."},"screened_ips":{"roll_up_confirm":"Are you sure you want to roll up commonly screened IP addresses into subnets?"}},"impersonate":{"not_found":"That user can't be found.","invalid":"Sorry, you may not impersonate that user."},"users":{"titles":{"member":"Users at Trust Level 2 (Member)","regular":"Users at Trust Level 3 (Regular)","leader":"Users at Trust Level 4 (Leader)"},"reject_failures":{"other":"Failed to reject %{count} users."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","anonymize":"Anonymize User","anonymize_confirm":"Are you SURE you want to anonymize this account? This will change the username and email, and reset all profile information.","anonymize_yes":"Yes, anonymize this account","anonymize_failed":"There was a problem anonymizing the account.","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)","other":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} days old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)","other":"Can't delete all posts. Some posts are older than %{count} days old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)","other":"Can't delete all posts because the user has more than %{count} posts.  (delete_all_posts_max)"},"block_confirm":"Are you sure you want to block this user? They will not be able to create any new topics or posts.","block_accept":"Yes, block this user","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"options":"Options","show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"},"field_types":{"dropdown":"Dropdown"}},"site_text":{"description":"You can customize any of the text on your forum. Please start by searching below:","search":"Search for the text you'd like to edit","edit":"edit","revert":"Revert Changes","revert_confirm":"Are you sure you want to revert your changes?","go_back":"Back to Search","recommended":"We recommend customizing the following text to suit your needs:","show_overriden":"Only show overridden"},"site_settings":{"add_host":"add host","categories":{"user_api":"User API","user_preferences":"User Preferences","tags":"Tags","search":"Search"}},"badges":{"long_description":"Long Description","expand":"Expand \u0026hellip;","query":"Badge Query (SQL)","auto_revoke":"Run revocation query daily","trigger_type":{"post_processed":"After a post is processed"},"preview":{"link_text":"Preview granted badges","plan_text":"Preview with query plan","modal_title":"Badge Query Preview","error_help":"See the following links for help with badge queries.","bad_count_warning":{"text":"There are missing grant samples. This happens when the badge query returns user IDs or post IDs that do not exist. This may cause unexpected results later on - please double-check your query."},"no_grant_count":"No badges to be assigned.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned.","other":"\u003cb\u003e%{count}\u003c/b\u003e badges to be assigned."},"grant":{"with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"help":"Add new emoji that will be available to everyone. (PROTIP: drag \u0026 drop multiple files at once)"},"embedding":{"get_started":"If you'd like to embed Discourse on another website, begin by adding its host.","confirm_delete":"Are you sure you want to delete that host?","sample":"Use the following HTML code into your site to create and embed discourse topics. Replace \u003cb\u003eREPLACE_ME\u003c/b\u003e with the canonical URL of the page you are embedding it on.","title":"Embedding","host":"Allowed Hosts","path_whitelist":"Path Whitelist","edit":"edit","category":"Post to Category","add_host":"Add Host","settings":"Embedding Settings","feed_settings":"Feed Settings","feed_description":"Providing an RSS/ATOM feed for your site can improve Discourse's ability to import your content.","crawling_settings":"Crawler Settings","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"Username for topic creation","embed_post_limit":"Maximum number of posts to embed","embed_username_key_from_feed":"Key to pull discourse username from feed","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_truncate":"Truncate the embedded posts","embed_whitelist_selector":"CSS selector for elements that are allowed in embeds","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","embed_classname_whitelist":"Allowed CSS class names","feed_polling_enabled":"Import posts via RSS/ATOM","feed_polling_url":"URL of RSS/ATOM feed to crawl","save":"Save Embedding Settings"},"permalink":{"title":"Permalinks","url":"URL","topic_id":"Topic ID","topic_title":"Topic","post_id":"Post ID","post_title":"Post","category_id":"Category ID","category_title":"Category","external_url":"External URL","delete_confirm":"Are you sure you want to delete this permalink?","form":{"label":"New:","add":"Add","filter":"Search (URL or External URL)"}}}}}};
I18n.locale = 'te';
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
//! locale : telugu (te)
//! author : Krishna Chaitanya Thota : https://github.com/kcthota

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var te = moment.defineLocale('te', {
        months : 'జనవరి_ఫిబ్రవరి_మార్చి_ఏప్రిల్_మే_జూన్_జూలై_ఆగస్టు_సెప్టెంబర్_అక్టోబర్_నవంబర్_డిసెంబర్'.split('_'),
        monthsShort : 'జన._ఫిబ్ర._మార్చి_ఏప్రి._మే_జూన్_జూలై_ఆగ._సెప్._అక్టో._నవ._డిసె.'.split('_'),
        monthsParseExact : true,
        weekdays : 'ఆదివారం_సోమవారం_మంగళవారం_బుధవారం_గురువారం_శుక్రవారం_శనివారం'.split('_'),
        weekdaysShort : 'ఆది_సోమ_మంగళ_బుధ_గురు_శుక్ర_శని'.split('_'),
        weekdaysMin : 'ఆ_సో_మం_బు_గు_శు_శ'.split('_'),
        longDateFormat : {
            LT : 'A h:mm',
            LTS : 'A h:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY, A h:mm',
            LLLL : 'dddd, D MMMM YYYY, A h:mm'
        },
        calendar : {
            sameDay : '[నేడు] LT',
            nextDay : '[రేపు] LT',
            nextWeek : 'dddd, LT',
            lastDay : '[నిన్న] LT',
            lastWeek : '[గత] dddd, LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s లో',
            past : '%s క్రితం',
            s : 'కొన్ని క్షణాలు',
            m : 'ఒక నిమిషం',
            mm : '%d నిమిషాలు',
            h : 'ఒక గంట',
            hh : '%d గంటలు',
            d : 'ఒక రోజు',
            dd : '%d రోజులు',
            M : 'ఒక నెల',
            MM : '%d నెలలు',
            y : 'ఒక సంవత్సరం',
            yy : '%d సంవత్సరాలు'
        },
        ordinalParse : /\d{1,2}వ/,
        ordinal : '%dవ',
        meridiemParse: /రాత్రి|ఉదయం|మధ్యాహ్నం|సాయంత్రం/,
        meridiemHour : function (hour, meridiem) {
            if (hour === 12) {
                hour = 0;
            }
            if (meridiem === 'రాత్రి') {
                return hour < 4 ? hour : hour + 12;
            } else if (meridiem === 'ఉదయం') {
                return hour;
            } else if (meridiem === 'మధ్యాహ్నం') {
                return hour >= 10 ? hour : hour + 12;
            } else if (meridiem === 'సాయంత్రం') {
                return hour + 12;
            }
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 4) {
                return 'రాత్రి';
            } else if (hour < 10) {
                return 'ఉదయం';
            } else if (hour < 17) {
                return 'మధ్యాహ్నం';
            } else if (hour < 20) {
                return 'సాయంత్రం';
            } else {
                return 'రాత్రి';
            }
        },
        week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        }
    });

    return te;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
