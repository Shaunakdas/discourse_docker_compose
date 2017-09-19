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
I18n._compiledMFs = {"posts_likes_MF" : function(){ return "Invalid Format: SyntaxError: Expected [a-zA-Z$_] but \"%u0641\" found.";}};

MessageFormat.locale.ar = function(n) {
  if (n === 0) {
    return 'zero';
  }
  if (n == 1) {
    return 'one';
  }
  if (n == 2) {
    return 'two';
  }
  if ((n % 100) >= 3 && (n % 100) <= 10 && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 100) >= 11 && (n % 100) <= 99 && n == Math.floor(n)) {
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
I18n.translations = {"ar":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n% u","units":{"byte":{"zero":"بايت","one":"بايت","two":"بايت","few":"بايت","many":"بايت","other":"بايت"},"gb":"غ.بايت","kb":"ك.بايت","mb":"م.بايت","tb":"ت.بايت"}}},"short":{"thousands":"{{number}} ألف","millions":"{{number}} مليون"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"D MMM h:mm a","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"D MMM YYYY h:mm a","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"D MMM YYYY","long_date_with_year":"D MMM YYYY، LT","long_date_without_year":"D MMM، LT","long_date_with_year_without_time":"D MMM YYYY","long_date_without_year_with_linebreak":"D MMM\u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM YYYY \u003cbr/\u003eLT","wrap_ago":"منذ %{date}","tiny":{"half_a_minute":"\u003c 1دق","less_than_x_seconds":{"zero":"\u003c %{count}ث","one":"\u003c %{count}ث","two":"\u003c %{count}ث","few":"\u003c %{count}ث","many":"\u003c %{count}ث","other":"\u003c %{count}ث"},"x_seconds":{"zero":"%{count}ث","one":"%{count}ث","two":"%{count}ث","few":"%{count}ث","many":"%{count}ث","other":"%{count}ث"},"x_minutes":{"zero":"%{count}دق","one":"%{count}دق","two":"%{count}دق","few":"%{count}دق","many":"%{count}دق","other":"%{count}دق"},"about_x_hours":{"zero":"%{count}سا","one":"%{count}سا","two":"%{count}سا","few":"%{count}سا","many":"%{count}سا","other":"%{count}سا"},"x_days":{"zero":"%{count}ي","one":"%{count}ي","two":"%{count}ي","few":"%{count}ي","many":"%{count}ي","other":"%{count}ي"},"about_x_years":{"zero":"%{count}س","one":"%{count}س","two":"%{count}س","few":"%{count}س","many":"%{count}س","other":"%{count}س"},"over_x_years":{"zero":"\u003e %{count}س","one":"\u003e %{count}س","two":"\u003e %{count}س","few":"\u003e %{count}س","many":"\u003e %{count}س","other":"\u003e %{count}س"},"almost_x_years":{"zero":"%{count}س","one":"%{count}س","two":"%{count}س","few":"%{count}س","many":"%{count}س","other":"%{count}س"},"date_month":"D MMM","date_year":"MMM YYYY"},"medium":{"x_minutes":{"zero":"أقل من دقيقة","one":"دقيقة واحدة","two":"دقيقتان","few":"%{count} دقائق","many":"%{count} دقيقة","other":"%{count} دقيقة"},"x_hours":{"zero":"أقل من ساعة","one":"ساعة واحدة","two":"ساعتان","few":"%{count} ساعات","many":"%{count} ساعة","other":"%{count} ساعة"},"x_days":{"zero":"أقل من يوم","one":"يوم واحد","two":"يومان","few":"%{count} أيام","many":"%{count} يوما","other":"%{count} يوم"},"date_year":"D MMM، YYYY"},"medium_with_ago":{"x_minutes":{"zero":"قبل أقل من دقيقة","one":"قبل دقيقة واحدة","two":"قبل دقيقتين","few":"قبل %{count} دقائق","many":"قبل %{count} دقيقة","other":"قبل %{count} دقيقة"},"x_hours":{"zero":"قبل أقل من ساعة","one":"قبل ساعة واحدة","two":"قبل ساعتين","few":"قبل %{count} ساعات","many":"قبل %{count} ساعة","other":"قبل %{count} ساعة"},"x_days":{"zero":"قبل أقل من يوم","one":"قبل يوم واحد","two":"قبل يومين","few":"قبل %{count} أيام","many":"قبل %{count} يوما","other":"قبل %{count} يوما"}},"later":{"x_days":{"zero":"بعد أقل من يوم","one":"بعد يوم واحد","two":"بعد يومين","few":"بعد %{count} أيام","many":"بعد %{count} يوما","other":"بعد %{count} يوم"},"x_months":{"zero":"بعد أقل من شهر","one":"بعد شهر واحد","two":"بعد شهرين","few":"بعد %{count} أشهر","many":"بعد %{count} شهرا","other":"بعد %{count} شهر"},"x_years":{"zero":"بعد أقل من سنة","one":"بعد سنة واحدة","two":"بعد سنتين","few":"بعد %{count}  سنوات","many":"بعد %{count}  سنة","other":"بعد %{count}  سنة"}},"previous_month":"الشهر السابق","next_month":"الشهر التالي"},"share":{"topic":"شارك رابط هذا الموضوع","post":"المشاركة رقم %{postNumber}","close":"أغلق","twitter":"شارك هذا الرابط في تويتر","facebook":"شارك هذا الرابط في فيس بوك","google+":"شارك هذا الرابط في جوجل+","email":"شارك هذا الرابط في بريد إلكتروني"},"action_codes":{"public_topic":"جعل هذا الموضوع عامًّا في %{when}","private_topic":"جعل هذا الموضوع خاصًّا في %{when}","split_topic":"قسم هذا الموضوع في %{when}","invited_user":"دعى %{who} %{when}","invited_group":"دعى %{who} %{when}","removed_user":"أزال %{who} في %{when}","removed_group":"أزال %{who} في %{when}","autoclosed":{"enabled":"أُغلق في %{when}","disabled":"فُتح في %{when}"},"closed":{"enabled":"أغلقه في %{when}","disabled":"فتحه في %{when}"},"archived":{"enabled":"أرشفه في %{when}","disabled":"أزال أرشفته في %{when}"},"pinned":{"enabled":"ثبّته في %{when}","disabled":"أزال تثبيته في %{when}"},"pinned_globally":{"enabled":"ثبّته عموميا في %{when}","disabled":"أزال تثبيته في %{when}"},"visible":{"enabled":"أدرجه في %{when}","disabled":"أزال إدراجه في %{when}"}},"topic_admin_menu":"عمليات المدير","emails_are_disabled":"لقد عطّل أحد المدراء الرّسائل الصادرة للجميع. لن تُرسل إشعارات عبر البريد الإلكتروني أيا كان نوعها.","bootstrap_mode_enabled":"الموقع اﻷن مفعل بالطريقة التمهيدية لكى تتمكن من اطلاق موقعك الجديد بسهولة. سيسجل كل الأعضاء الجدد بمستوى ثقة 1 وسيكون اختيار ارسال الملخص اليومى عن طريق البريد الالكترونى مفعل. سيتم الغاء تفعيل الطريقة التمهيدية تلقائيا عندما يتخطى عدد اﻷعضاء {min_users}% عضو.","bootstrap_mode_disabled":"سيتم الغاء تفعيل الطريقة التمهيدية خلال ال 24 ساعة القادمة","s3":{"regions":{"us_east_1":"شرق الولايات المتحدة (فرجينيا الشمالية)","us_west_1":"غرب الولايات المتحدة (كاليفورنيا الشمالية)","us_west_2":"غرب الولايات المتحدة (أوريغون)","us_gov_west_1":"إستضافة أمازون الحسابية الحكومية (الولايات المتحدة الأمريكية)","eu_west_1":"الاتحاد الأوروبي (أيرلندا)","eu_central_1":"الاتحاد الأوروبي (فرانكفورت)","ap_southeast_1":"آسيا والمحيط الهادئ (سنغافورة)","ap_southeast_2":"آسيا والمحيط الهادئ (سيدني)","ap_south_1":"آسيا والمحيط الهادئ (مومباي)","ap_northeast_1":"آسيا والمحيط الهادئ (طوكيو)","ap_northeast_2":"آسيا والمحيط الهادئ ( سيول)","sa_east_1":"أمريكا الجنوبية (ساو باولو)","cn_north_1":"الصين (بكين)"}},"edit":"عدّل عنوان هذا الموضوع وفئته","not_implemented":"لم تُنجز هذه الميزة بعد، آسفون!","no_value":"لا","yes_value":"نعم","generic_error":"آسفون، حدث خطأ ما.","generic_error_with_reason":"حدث خطأ ما: %{error}","sign_up":"سجّل حسابا","log_in":"لِج","age":"العمر","joined":"انضم في","admin_title":"المدير","flags_title":"بلاغات","show_more":"أظهر المزيد","show_help":"خيارات","links":"روابط","links_lowercase":{"zero":"الروابط","one":"الروابط","two":"الروابط","few":"الروابط","many":"الروابط","other":"الروابط"},"faq":"الأسئلة الشائعة","guidelines":"توجيهات ","privacy_policy":"سياسة الخصوصية ","privacy":"الخصوصية ","terms_of_service":"شروط الخدمة","mobile_view":"نسخة الهواتف","desktop_view":"نسخة سطح المكتب","you":"انت","or":"أو","now":"منذ لحظات","read_more":"اطلع على المزيد","more":"أكثر","less":"أقل","never":"أبدا","every_30_minutes":"كل 30 دقيقة","every_hour":"كل ساعة","daily":"يوميا","weekly":"أسبوعيا","every_two_weeks":"كل أسبوعين","every_three_days":"كل ثلاثة أيام","max_of_count":"أقصى عدد هو {{count}}","alternation":"أو","character_count":{"zero":"لا محارف","one":"محرف واحد","two":"محرفان","few":"{{count}} محارف","many":"{{count}} محرفا","other":"{{count}} محرف"},"suggested_topics":{"title":"مواضيع مقترحة","pm_title":"رسائل مقترحة "},"about":{"simple_title":"عنّا","title":"عن %{title}","stats":"إحصائيات الموقع ","our_admins":"مدراؤنا","our_moderators":"مشرفونا","stat":{"all_time":"يوم التأسيس","last_7_days":"آخر 7 أيام ","last_30_days":"آخر 30 يوما"},"like_count":"الإعجابات","topic_count":"المواضيع","post_count":"المشاركات","user_count":"المستخدمون الجدد","active_user_count":"المستخدمون النشطون","contact":"اتصل بنا","contact_info":"في حال حدوث مشكلة حرجة أو أمر عاجل يؤثّر على الموقع، من فضلك راسلنا على %{contact_info}."},"bookmarked":{"title":"إلى المفضّلة","clear_bookmarks":"أزل من المفضّلة","help":{"bookmark":"انقر لإضافة أول منشور في هذا الموضوع إلى المفضّلة","unbookmark":"انقر لإزالة كل المفضّلات في هذا الموضوع"}},"bookmarks":{"not_logged_in":"آسفون، عليك تسجيل الدخول لتفضيل المنشورات","created":"لقد أضفت هذا المنشور إلى المفضّلة","not_bookmarked":"لقد قرأت هذا المنشور، انقر لإضافته إلى المفضّلة","last_read":"هذا آخر منشور قرأته، انقر لإضافته إلى المفضّلة","remove":"أزل من المفضّلة","confirm_clear":"أتريد حقا إزالة كل ما أضفته إلى المفضّلة في هذا الموضوع؟"},"topic_count_latest":{"zero":"لا مواضيع جديدة أو محدّثة.","one":"موضوع واحد جديد أو محدّث.","two":"موضوعان جديدان أو محدّثان.","few":"{{count}} مواضيع جديدة أو محدّثة.","many":"{{count}} موضوعا جديدا أو محدّثا.","other":"{{count}} موضوع جديد أو محدّث."},"topic_count_unread":{"zero":"لا مواضيع غير مقروءة","one":"موضوع واحد غير مقروء.","two":"موضوعان غير مقروءان.","few":"{{count}} مواضيع غير مقروءة.","many":"{{count}} موضوعا غير مقروء.","other":"{{count}} موضوع غير مقروء."},"topic_count_new":{"zero":"لا مواضيع جديدة.","one":"موضوع واحد جديد.","two":"موضوعان جديدان.","few":"{{count}} مواضيع جديدة.","many":"{{count}} موضوعا جديدا.","other":"{{count}} موضوع جديد."},"click_to_show":"انقر للعرض.","preview":"معاينة","cancel":"ألغ","save":"احفظ التعديلات","saving":"يحفظ...","saved":"حُفظت!","upload":"ارفع","uploading":"يرفع...","uploading_filename":"يرفع {{filename}}...","uploaded":"رُفع!","enable":"فعّل","disable":"عطّل","undo":"تراجع","revert":"اعكس","failed":"فشل","switch_to_anon":"ادخل وضع التّخفي","switch_from_anon":"اخرج من وضع التّخفي","banner":{"close":"تجاهل هذا الإعلان.","edit":"حرر هذا الإعلان \u003e\u003e"},"choose_topic":{"none_found":"لا مواضيع.","title":{"search":"ابحث عن موضوع باسمه أو عنوانه أو معرّفه:","placeholder":"اكتب عنوان الموضوع هنا"}},"queue":{"topic":"الموضوع:","approve":"وافق","reject":"ارفض","delete_user":"احذف المستخدم","title":"تحتاج موافقة","none":"لا مشاركات لمراجعتها.","edit":"حرر","cancel":"ألغِ","view_pending":"اعرض المشاركات المعلّقة","has_pending_posts":{"zero":"ليس في هذا الموضوع \u003cb\u003eأيّة\u003c/b\u003e مشاركات تحتاج مراجعة","one":"في هذا الموضوع \u003cb\u003eمشاركة واحدة\u003c/b\u003e تحتاج مراجعة","two":"في هذا الموضوع \u003cb\u003eمشاركتين\u003c/b\u003e تحتاج مراجعة","few":"في هذا الموضوع \u003cb\u003e{{count}}\u003c/b\u003e مشاركات تحتاج مراجعة","many":"في هذا الموضوع \u003cb\u003e{{count}}\u003c/b\u003e مشاركة تحتاج مراجعة","other":"في هذا الموضوع \u003cb\u003e{{count}}\u003c/b\u003e مشاركة تحتاج مراجعة"},"confirm":"احفظ التعديلات","delete_prompt":"أمتأكد من حذف \u003cb\u003e%{username}\u003c/b\u003e؟ ستُحذف كل مشاركاته وسيُمنع بريده الإلكتروني وعنوان IP.","approval":{"title":"المشاركة تحتاج موافقة","description":"لقد وصلتنا مشاركتك لكنها تحتاج موافقة المشرف قبل ظهورها. نرجو منك الصبر.","pending_posts":{"zero":"\u003cstrong\u003eلا\u003c/strong\u003e مشاركات معلّقة.","one":"لديك \u003cstrong\u003eمشاركة واحدة\u003c/strong\u003e معلّقة.","two":"لديك \u003cstrong\u003eمشاركتين\u003c/strong\u003e معلّقتين.","few":"لديك \u003cstrong\u003e{{count}}\u003c/strong\u003e مشاركات معلّقة.","many":"لديك \u003cstrong\u003e{{count}}\u003c/strong\u003e مشاركة معلّقة.","other":"لديك \u003cstrong\u003e{{count}}\u003c/strong\u003e مشاركة معلّقة."},"ok":"حسنا"}},"user_action":{"user_posted_topic":"نشر \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","you_posted_topic":"نشرت \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","user_replied_to_post":"ردّ \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e على \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"رددت \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e على \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"ردّ \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e على \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","you_replied_to_topic":"رددت \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e على \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","user_mentioned_user":"أشار \u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e إلى \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"أشار \u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003eإليك\u003c/a\u003e","you_mentioned_user":"أشرت \u003ca href='{{user1Url}}'\u003eأنت\u003c/a\u003e إلى \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"شاركها \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"شاركتها \u003ca href='{{userUrl}}'\u003eانت\u003c/a\u003e","sent_by_user":"أرسله \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"أرسلته \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e"},"directory":{"filter_name":"رشّح باسم المستخدم","title":"الأعضاء","likes_given":"المعطاة","likes_received":"المستلمة","topics_entered":"المعروضة","topics_entered_long":"المواضيع المعروضة","time_read":"وقت القراءة","topic_count":"المواضيع","topic_count_long":"المواضيع المنشأة","post_count":"الردود","post_count_long":"الردود المنشورة","no_results":"لا نتائج.","days_visited":"الزيارات","days_visited_long":"أيام الزيارة","posts_read":"المقروءة","posts_read_long":"المشاركات المقروءة","total_rows":{"zero":"لا أعضاء","one":"عضو واحد","two":"عضوان","few":"%{count} أعضاء","many":"%{count} عضوًا","other":"%{count} عضو"}},"groups":{"empty":{"posts":"لا مشاركات من أعضاء هذه المجموعة.","members":"لا أعضاء في هذه المجموعة.","mentions":"لم يُشر أحد إلى هذه المجموعة.","messages":"لا رسائل لهذه المجموعة.","topics":"لا مواضيع لأعضاء هذه المجموعة."},"add":"أضف","selector_placeholder":"أضف أعضاء","owner":"المالك","visible":"المجموعة مرئية لكل المستخدمين","index":"المجموعات","title":{"zero":"مجموعات","one":"مجموعات","two":"مجموعات","few":"مجموعات","many":"مجموعات","other":"مجموعات"},"members":"الأعضاء","topics":"المواضيع","posts":"المشاركات","mentions":"الإشارات","messages":"الرسائل","alias_levels":{"title":"من يستطيع ارسال رسالة و تنبيه لهذه المجموعة ؟","nobody":"لا أحد","only_admins":"المدراء فقط","mods_and_admins":"المدراء والمشرفون فقط","members_mods_and_admins":"أعضاء المجموعة والمدراء والمشرفون فقط","everyone":"الكل"},"trust_levels":{"title":"مستوى الثقة الذي يُعطى للأعضاء آليا عندما يضافون:","none":"لا شيء"},"notifications":{"watching":{"title":"جاري المشاهدة","description":"سنرسل لك إشعارا عن كل مشاركة لكل رسالة، كما وسترى عددًا من الردود الجديدة."},"watching_first_post":{"title":"المراقبة فيها أول مشاركة","description":"سنرسل لك إشعارا فقط لأول مشاركة في كل موضوع جديد في هذه المجموعة."},"tracking":{"title":"جاري المتابعة","description":"سنرسل لك إشعارا إن أشار أحد إلى اسمك أو ردّ عليك، كما ويترى عددًا من الردود الجديدة."},"regular":{"title":"طبيعي","description":"سنرسل لك إشعارا إن أشار أحد إليك أو ردّ عليك."},"muted":{"title":"مكتوم","description":"لن نرسل لك أي إشعار لأي من المواضيع الجديدة في هذه المجموعة."}}},"user_action_groups":{"1":"الإعجابات المعطاة","2":"الإعجابات المستلمة","3":"المفضلة","4":"المواضيع","5":"الردود","6":"الردود","7":"الإشارات","9":"الاقتباسات","11":"التعديلات","12":"العناصر المرسلة","13":"البريد الوارد","14":"قيد الانتظار"},"categories":{"all":"كل الفئات","all_subcategories":"جميع","no_subcategory":"لا شيء","category":"تصنيف","category_list":"أعرض قائمة الأقسام.","reorder":{"title":"إعادة ترتيب الفئات","title_long":"إعادة تنظيم قائمة الفئة","fix_order":"تثبيت الأماكن","fix_order_tooltip":"ليس كل الفئات لديها رقم مكان فريد، ربما يسبب نتيجة غير متوقعة.","save":"حفظ الترتيب","apply_all":"تطبيق","position":"مكان"},"posts":"مشاركات","topics":"المواضيع","latest":"آخر","latest_by":"الاحدث بـ","toggle_ordering":"تبديل التحكم في الترتيب","subcategories":"تصنيفات فرعية","topic_stat_sentence":{"zero":"لا مواضيع جديدة في ال%{unit} الماضي.","one":"موضوع واحد جديد في ال%{unit} الماضي.","two":"موضوعان جديدان في ال%{unit} الماضي.","few":"%{count} مواضيع جديدة في ال%{unit} الماضي.","many":"%{count} موضوعًا جديدًا في ال%{unit} الماضي.","other":"%{count} موضوع جديد في ال%{unit} الماضي."}},"ip_lookup":{"title":"جدول العناوين ","hostname":"اسم المضيف","location":"الموقع","location_not_found":"(غيرمعرف)","organisation":"المنظمات","phone":"هاتف","other_accounts":"حساب آخر بنفس العنوان","delete_other_accounts":"حذف %{count}","username":"إسم المستخدم","trust_level":"TL","read_time":"وقت القراءة","topics_entered":" مواضيع شوهدت","post_count":"# مشاركات","confirm_delete_other_accounts":"أمتأكد من حذف هذه الحسابات؟"},"user_fields":{"none":"(إختر خيار )"},"user":{"said":"{{username}}:","profile":"الصفحة الشخصية","mute":"كتم","edit":"تعديل التفضيلات","download_archive":"تحميل مواضيعي","new_private_message":"رسالة جديدة","private_message":"رسالة","private_messages":"الرسائل","activity_stream":"النشاط","preferences":" التفضيلات","expand_profile":"توسيع","bookmarks":"المفضلة","bio":"معلومات عنّي","invited_by":"مدعو بواسطة","trust_level":"مستوى الثقة","notifications":"الاشعارات","statistics":"احصائيات","desktop_notifications":{"label":"إشعارات سطح المكتب","not_supported":"آسفون، لا يدعم المتصفح الإشعارات.","perm_default":"تفعيل الإشعارات","perm_denied_btn":"الوصول مرفوض","perm_denied_expl":"لقد رفضت صلاحية عرض الإشعارات. اسمح بظهور الإشعارات وذلك من إعدادات المتصفح.","disable":"عطّل الإشعارات","enable":"فعّل الإشعارات","each_browser_note":"ملاحظة: عليك تغيير هذا الإعداد في كل متصفح تستخدمه."},"dismiss_notifications":"تجاهل الكل","dismiss_notifications_tooltip":"جعل جميع اشعارات غيرمقروء الى مقروء","disable_jump_reply":"لا تنتقل إلى مشاركتي بعد ما أردّ","dynamic_favicon":"إعرض عدد المواضيع الجديدة والمحدثة في أيقونة المتصفح","external_links_in_new_tab":"فتح الروابط الخارجية في ألسنة جديدة","enable_quoting":"فعل خاصية إقتباس النصوص المظللة","change":"تغيير","moderator":"{{user}} مشرف","admin":"{{user}} مدير","moderator_tooltip":"هذا المستخدم مشرف","admin_tooltip":"هذا المستخدم مدير","blocked_tooltip":"هذا المستخدم محظور","suspended_notice":"هذا المستخدم موقوف حتى تاريخ  {{date}}","suspended_reason":"السبب:","github_profile":"Github","email_activity_summary":"ملخص النشاط","mailing_list_mode":{"label":"وضع القائمة البريدية","enabled":"فعّل وضع القائمة البريدية","instructions":"يمحي هذا الإعداد إعداد \"ملخص النشاط\".\u003cbr /\u003e\nهذه الرسائل لا تشمل المواضيع والفئات المكتومة.\n","daily":"أرسل تحديثات يومية","individual":"أرسل لي بريدا لكل مشاركة جديدة","many_per_day":"أرسل لي بريدا لكل مشاركة جديدة (تقريبا {{dailyEmailEstimate}} يوميا)","few_per_day":"أرسل لي بريدا لكل مشاركة جديدة (تقريبا إثنتان يوميا)"},"tag_settings":"الوسوم","watched_tags":"المراقبة","watched_tags_instructions":"ستراقب آليا كل مواضيع هذه الوسوم. ستصلك إشعارات للمشاركات والمواضيع الجديدة، وسيظهر أيضا عدّاد للمشاركات الجديدة بجانب الموضوع.","tracked_tags":"المتابعة","tracked_tags_instructions":"ستتابع آليا كل مواضيع هذه الوسوم. سيظهر عدّاد للمشاركات الجديدة بجانب الموضوع.","muted_tags":"المكتومة","muted_tags_instructions":"لن يتم إشعارك بأي جديد عن المواضيع الجديدة في هذه التصنيفات، ولن تظهر مواضيع هذه التصنيفات في قائمة المواضيع المنشورة مؤخراً.","watched_categories":"المراقبة","watched_categories_instructions":"ستراقب آليا كل مواضيع هذه الفئات. ستصلك إشعارات للمشاركات والمواضيع الجديدة، وسيظهر أيضا عدّاد للمشاركات الجديدة بجانب الموضوع.","tracked_categories":"المتابعة","tracked_categories_instructions":"ستتابع آليا كل مواضيع هذه الفئة. سيظهر عدّاد للمشاركات الجديدة بجانب الموضوع.","watched_first_post_categories":"المراقبة فيها أول مشاركة","watched_first_post_categories_instructions":"سيصلك إشعارا لأول مشاركة لكل موضوع في هذه الفئات.","watched_first_post_tags":"المراقبة فيها أول مشاركة","watched_first_post_tags_instructions":"سيصلك إشعارا لأول مشاركة لكل موضوع موسوم بهذه الفئات.","muted_categories":"المكتومة","muted_categories_instructions":"لن يتم إشعارك بأي جديد عن المواضيع الجديدة في هذه التصنيفات، ولن تظهر مواضيع هذه التصنيفات في قائمة المواضيع المنشورة مؤخراً.","delete_account":"حذف الحساب","delete_account_confirm":"هل انت متاكد من انك تريد حذف حسابك نهائيا؟ لايمكن التراجع عن هذا العمل!","deleted_yourself":"تم حذف حسابك بنجاح","delete_yourself_not_allowed":"لايمكنك حذف حسابك الان , تواصل مع المدير ليحذف حسابك ","unread_message_count":"الرسائل","admin_delete":"حذف","users":"الأعضاء","muted_users":"المكتومون","muted_users_instructions":"تجاهل الإشعارات من هؤلاء المستخدمين.","muted_topics_link":"أظهر المواضيع المكتومة","watched_topics_link":"أظهر المواضيع المراقبة","automatically_unpin_topics":"ألغِ تثبيت المواضيع آليا عندما أصل إلى أسفلها.","staff_counters":{"flags_given":"علامات مساعدة","flagged_posts":"# مشاركات","deleted_posts":"حذف جميع المشاركات","suspensions":"موقوف","warnings_received":"تحذيرات"},"messages":{"all":"الكل","inbox":"البريد الوارد","sent":"مرسلة","archive":"الارشيف","groups":"مجموعاتي","bulk_select":"إختيار رسائل","move_to_inbox":"الذهاب إلى الرسائل الواردة","move_to_archive":"الارشيف","failed_to_move":"فشل في نقل الرسائل المحددة (ربما يكون اتصالك ضعيفاً)","select_all":"إختيار الكل"},"change_password":{"success":"(تم ارسال الرسالة)","in_progress":"(يتم ارسال رسالة)","error":"(خطأ)","action":"ارسال اعادة ضبط كلمة المرور على البريد الالكتروني","set_password":" إعادة تعين الرمز السري"},"change_about":{"title":"تعديل معلومات عنّي","error":"حدث خطأ عند تغيير هذه القيمة."},"change_username":{"title":"تغيير اسم المستخدم","confirm":"إن غيّرت اسم المستخدم فستعطب كلّ اقتباسات مشاركاتك إضافة إلى الإشارات إلى @اسمك. أواثق تمام الثقة من ذلك؟","taken":"نأسف، اسم المستخدم مأخوذ.","error":"حدث خطأ عند تغيير اسم المستخدم.","invalid":"اسم المستخدم غير صالح. يجب ان يحتوي على ارقام وحروف فقط "},"change_email":{"title":"تغيير البريد الالكتروني","taken":"نأسف، البريد الالكتروني غير متاح.","error":"حدث خطأ عند تغيير البريد الالكتروني. ربما يكون هذا البريد مستخدم من قبل؟","success":"لقد أرسلنا بريدا إلى هذا البريد. من فضلك اتّبع تعليمات التأكيد."},"change_avatar":{"title":"غير صورتك الشخصية","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eغرافاتار/Gravatar\u003c/a\u003e، من","gravatar_title":"غير صورتك الشخصية على موقع  Gravatar's.","refresh_gravatar_title":"أنعش صورة غرافاتار","letter_based":"الصورة الافتراضية ","uploaded_avatar":"تخصيص صورة","uploaded_avatar_empty":"اضافة صورة ","upload_title":"رفع صورتك ","upload_picture":"رفع الصورة","image_is_not_a_square":"تحذير: لقد قصصنا الصورة، إذ أن عرضها وارتفاعها لا يتطابقان.","cache_notice":"لقد غيّرت صورة ملفك بنجاح، ولكنه قد تأخذ وقتا حتى تظهر بسبب خبيئة المتصفح."},"change_profile_background":{"title":"لون خلفية الحساب","instructions":"سيتم وضع خلفية الحساب في المنتصف بعرض 850px"},"change_card_background":{"title":"خلفية المستخدم","instructions":"سيتم وضع الخلفية في المنتصف بعرض 590px"},"email":{"title":"البريد الإلكتروني","instructions":"لا يظهر للعموم","ok":"سنرسل لك بريدا للتأكيد","invalid":"من فضلك أدخل بريدا إلكترونيا صالحا","authenticated":"تم توثيق بريدك الإلكتروني بواسطة {{provider}}","frequency_immediately":"سيتم ارسال رسالة الكترونية فورا في حال أنك لم الرسائل السابقة","frequency":{"zero":"سنراسلك على بريدك فقط في حال لم تكن متصلا على الموقع في آخر {{count}} دقيقة .","one":"سنراسلك على بريدك فقط في حال لم تكن متصلا على الموقع في آخر دقيقة .","two":"سنراسلك على بريدك فقط في حال لم تكن متصلا على الموقع في آخر دقيقتين .","few":"سنراسلك على بريدك فقط في حال لم تكن متصلا على الموقع في {{count}} دقائق  .","many":"سنراسلك على بريدك فقط في حال لم تكن متصلا على الموقع في {{count}} دقيقة  .","other":"سنراسلك على بريدك فقط في حال لم تكن متصلا على الموقع في {{count}} دقيقة  ."}},"name":{"title":"الاسم","instructions":"اسمك الكامل (اختياري)","instructions_required":"اسمك كاملا","too_short":"اسمك قصير جدا","ok":"يبدو اسمك جيدا"},"username":{"title":"اسم المستخدم","instructions":"فريد دون مسافات وقصير","short_instructions":"يمكن للناس بمنادتك بـ @{{username}}.","available":"اسم المستخدم متاح.","global_match":"البريد الالكتروني مطابق لـ اسم المستخدم المسّجل.","global_mismatch":"مسجل مسبقا ، جرّب {{suggestion}} ؟","not_available":"غير متاح. جرّب {{suggestion}} ؟","too_short":"اسم المستخدم قصير جداً","too_long":"اسم المستخدم طويل جداً","checking":"يتم التاكد من توفر اسم المستخدم...","enter_email":"تم العثور على اسم المستخدم. ادخل البريد الالكتروني المطابق.","prefilled":"البريد الالكتروني مطابق لـ اسم المستخدم المسّجل."},"locale":{"title":"لغة الواجهة","instructions":"لغة الواجهة الرسومية. ستتغير عندما تنعش الصفحة.","default":"(الافتراضية)"},"password_confirmation":{"title":"اعد كلمة المرور"},"last_posted":" أخر موضوع","last_emailed":"أخر مراسلة","last_seen":"شوهد","created":"إنضم","log_out":"تسجيل الخروج","location":"الموقع","card_badge":{"title":"وسام بطاقة المستخدم"},"website":"موقع الكتروني","email_settings":"بريد الكتروني","like_notification_frequency":{"title":"أرسل إشعارا عند الإعجاب","always":"دوما","first_time_and_daily":"أول إعجاب بالمشاركة ويوميا","first_time":"أول إعجاب بالمشاركة","never":"أبدا"},"email_previous_replies":{"title":"تضمين مشاركات سابقة في أسفل البريد المرسل","unless_emailed":"الا اذا تم ارساله موخراً","always":"دائماً","never":"ابداً"},"email_digests":{"title":"إرسال رسالة إلكترونية تحتوي على جديد الموقع عندما لا أزور الموقع","every_30_minutes":"بعد 30 دقيقه","every_hour":"كل ساعه ","daily":"يومي","every_three_days":"كل ثلاثة أيام","weekly":"اسبوعي","every_two_weeks":"كل أسبوعين"},"include_tl0_in_digests":"ارفق المشاركات للاعضاء الجدد في ملخص المراسلات","email_in_reply_to":"ارفق مقتبسات الرد على المنشور في رسائل البريد","email_direct":"تلقي رسالة إلكترونية عند اقتباس مشاركة لك  أو الرد على عليها أو في حالة ذكر اسمك @username","email_private_messages":"إرسال إشعار بالبريد الإلكتروني عندما يرسل لك شخصاً رسالة خاصة","email_always":"نبهني بوجود رسائل جديدة حتى لو كنت متصل على الموقع .","other_settings":"اخرى","categories_settings":"الفئات","new_topic_duration":{"label":"اعتبر المواضيع جديدة إن","not_viewed":"لم أراها بعد","last_here":"أُنشئت مذ كنت هنا","after_1_day":"أُنشئت في اليوم الماضي","after_2_days":"أُنشئت في اليومين الماضيين","after_1_week":"أُنشئت في الأسبوع الماضي","after_2_weeks":"أُنشئت في الأسبوعين الماضيين"},"auto_track_topics":"تابع آليا المواضيع التي أدخلها","auto_track_options":{"never":"ابداً","immediately":"حالاً","after_30_seconds":"بعد 30 ثانية","after_1_minute":"بعد 1 دقيقة","after_2_minutes":"بعد 2 دقائق","after_3_minutes":"بعد 3 دقائق","after_4_minutes":"بعد 4 دقائق","after_5_minutes":"بعد 5 دقائق","after_10_minutes":"بعد 10 دقائق"},"invited":{"search":"نوع البحث عن الدعوات","title":"دعوة","user":"المستخدمين المدعويين","sent":"تم الإرسال","none":"لا توجد دعوات معلقة لعرضها.","truncated":{"zero":"لا يوجد دعوات لعرضها.","one":"عرض الدعوة الأولى.","two":"عرض الدعوتان الأولتان.","few":"عرض الدعوات الأولية.","many":"عرض الدعوات {{count}} الأولى.","other":"عرض الدعوات  {{count}} الأولى."},"redeemed":"دعوات مستخدمة","redeemed_tab":"محررة","redeemed_tab_with_count":"({{count}}) محررة","redeemed_at":"مستخدمة","pending":"دعوات قيد الإنتضار","pending_tab":"قيد الانتظار","pending_tab_with_count":"معلق ({{count}})","topics_entered":" مواضيع شوهدت","posts_read_count":"مشاركات شوهدت","expired":"الدعوة انتهت صلاحيتها ","rescind":"حذف","rescinded":"الدعوة حذفت","reinvite":"اعادة ارسال الدعوة","reinvite_all":"أعد إرسال كل الدعوات","reinvited":"اعادة ارسال الدعوة","reinvited_all":"كل الدعوات تمت اعادة ارسالها","time_read":"وقت القراءة","days_visited":"أيام الزيارة","account_age_days":"عمر الحساب بالأيام","create":"أرسل دعوة","generate_link":"انسخ رابط الدعوة","generated_link_message":"\u003cp\u003eرابط الدعوة منح بنجاح!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eرابط الدعوة صالح فقط لعنوان البريد الإلكتروني هذا: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"لم تقم بدعوة اي احد حتى الان. تستطيع ارسال دعوة , أو ارسال عدة دعوات عن طريق\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003euploading a bulk invite file\u003c/a\u003e.","text":"الدعوة من ملف","uploading":"يرفع...","success":"رُفع الملف بنجاح. سيصلك إشعارا عبر رسالة عند اكتمال العملية.","error":"حدثت مشكلة في رفع '{{filename}}': {{message}}"}},"password":{"title":"كلمة المرور","too_short":"كلمة المرور قصيرة جدا.","common":"كلمة المرور هذه شائعة.","same_as_username":"كلمة المرور مطابقة لاسم المستخدم.","same_as_email":"كلمة المرور مطابقة للبريد الإلكتروني.","ok":"تبدو كلمة المرور جيدة.","instructions":"على الاقل %{count} حرف"},"summary":{"title":"ملخص","stats":"إحصائيات","time_read":"وقت القراءة","top_replies":"أفضل الردود","no_replies":"لا ردود بعد.","more_replies":"ردود أخرى","top_topics":"أفضل المواضيع","no_topics":"لا مواضيع بعد.","more_topics":"مواضيع أخرى","top_badges":"افضل الاوسمه","no_badges":"لا أوسمة حتى الآن.","more_badges":"المزيد من الاوسمه","top_links":"أفضل الروابط","no_links":"لا روابط بعد.","most_liked_by":"أكثر المعجبين به","most_liked_users":"أكثر من أعجبهم","most_replied_to_users":"أكثر من رد عليهم","no_likes":"لا إعجابات بعد."},"associated_accounts":"جلسات الولوج","ip_address":{"title":"أخر عنوان أيبي"},"registration_ip_address":{"title":"ايبي مسجل"},"avatar":{"title":"صورة الملف الشخصي","header_title":"الملف الشخصي، والرسائل، والعناوين والتفضيلات"},"title":{"title":"عنوان"},"filters":{"all":"الكل"},"stream":{"posted_by":"ارسلت بواسطة","sent_by":" أرسلت بواسطة","private_message":"رسالة خاصة","the_topic":"موضوع جديد"}},"loading":"يتم التحميل...","errors":{"prev_page":"محاولة تحميل","reasons":{"network":"خطأ في الشبكة","server":"خطأ في السيرفر","forbidden":"غير مصرح","unknown":"خطأ","not_found":"الصفحة غير متوفرة"},"desc":{"network":"من فضلك تحقق من اتصالك.","network_fixed":"يبدوا أنه رجع","server":"رمز الخطأ: {{status}}","forbidden":"ليس لديك الصلاحية","not_found":"آخ! حاول التطبيق تحميل عنوان غير موجود.","unknown":"حدث خطب ما."},"buttons":{"back":"الرجوع","again":"أعد المحاولة","fixed":"تحميل"}},"close":"اغلاق","assets_changed_confirm":"حُدّث الموقع لتوّه. أتريد إنعاشه ورؤية أحدث إصدارة؟","logout":"لقد خرجت.","refresh":"تحديث","read_only_mode":{"enabled":"هذا الموقع في وضع القراءة فقط. نأمل أن تتابع تصفّحه، ولكن الرد، والإعجاب والإجراءات الأخرى معطلة الآن.","login_disabled":"الولوج معطّل في حال كان الموقع في وضع القراءة فقط.","logout_disabled":"الخروج معطّل في حال كان الموقع في وضع القراءة فقط."},"too_few_topics_and_posts_notice":"دعونا \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eالحصول على هذه المناقشة بدأت!\u003c/a\u003e يوجد حاليا\u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e المواضيع و \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e المشاركات. الزوار الجدد بحاجة إلى بعض الأحاديث لقراءة والرد على.","too_few_topics_notice":"دعونا \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eالحصول على هذه المناقشة التي!\u003c/a\u003e وهناك حاليا \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e المواضيع. الزوار الجديدة بحاجة إلى بعض الأحاديث قراءة والرد عليها.","too_few_posts_notice":"دعونا \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eالحصول على هذه المناقشة التي بدأت!\u003c/a\u003e يوجد حاليا \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e مشاركات. الزوار الجديدة بحاجة إلى بعض الأحاديث قراءة والرد عليها.","learn_more":"تعلم المزيد...","year":"عام","year_desc":"المواضيع المكتوبة خلال 365 يوم الماضية","month":"شهر","month_desc":"المواضيع المكتوبة خلال 30 يوم الماضية","week":"أسبوع","week_desc":" المواضيع التي كتبت خلال 7 أيام الماضية","day":"يوم","first_post":"الموضوع الأول","mute":"كتم","unmute":"إلغاء الكتم","last_post":"أخر مشاركة","last_reply_lowercase":"آخر رد","replies_lowercase":{"zero":"الردود","one":"الردود","two":"الردود","few":"الردود","many":"الردود","other":"الردود"},"signup_cta":{"sign_up":"إشترك","hide_session":"ذكرني غدا","hide_forever":"لا شكرا","hidden_for_session":"لا بأس، سأسلك غدا. يمكنك دوما استخدام 'لِج' لإنشاء حساب.","intro":"يا مرحبا! :heart_eyes: يبدو أنك مستمتع بقراءة هذا النقاش، ولكنك لم تسجل حسابا بعد.","value_prop":"عندما تنتهي من إنشاء الحساب، سترجع إلى حيث توقفت، فنحن نتذكر المكان الذي توقفت عنده دائما. يمكنك أيضا استقبال الإشعارات عبر الموقع والبريد الإلكتروني متى ما نُشرت مشاركات جديدة. يمكنك أيضا إبداء إعجابك بالمشاركات لمشاركة ما تحبّ. :heartbeat:"},"summary":{"enabled_description":"أنت تطالع ملخصا لهذا الموضوع: أكثر المشاركات المهمة حسب تقييم المجتمع.","description":"يوجد \u003cb\u003e{{replyCount}}\u003c/b\u003e مشاركة.","description_time":"يوجد \u003cb\u003e{{replyCount}}\u003c/b\u003e مشاركة, والوقت المقدر للقراءة \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e دقيقة.","enable":"لخّص هذا الموضوع","disable":"عرض جميع المشاركات"},"deleted_filter":{"enabled_description":"هذا الموضوع يحوي على مشاركات محذوفة تم اخفائها ","disabled_description":"المشاركات المحذوفة في هذا الموضوع  ممكن مشاهدتها ","enable":"إخفاء المشاركات المحذوفة","disable":"عرض المشاركات المحذوفة"},"private_message_info":{"title":" رسالة خاصة","invite":" إدعو اخرين","remove_allowed_user":"هل تريد حقا ازالة  {{name}} من الرسائل الخاصة ؟","remove_allowed_group":"هل تريد حقا ازالة  {{name}} من هذه الرسالة ?"},"email":"البريد الإلكتروني","username":"إسم المستخدم","last_seen":"شوهدت","created":"مكتوبة","created_lowercase":"أُنشئ في","trust_level":"مستوى التقة","search_hint":"اسم مستخدم او بريد الكتروني او عنوان ايبي","create_account":{"title":"إنشاء حساب جديد","failed":"حدث خطأ ما, ربما بريدك الالكتروني مسجل مسبقا, جرب رابط نسيان كلمة المرور "},"forgot_password":{"title":" إعادة تعيين كلمة المرور","action":"نسيت كلمة المرور","invite":"ادخل اسم مستخدمك او بريدك الالكتروني وسنقوم بإرسال اعاذة ضبط كلمة المرور على بريدك","reset":" إعادة تعين الرمز السري","complete_username":"اذا كان اسم المسنخدم موجود  \u003cb\u003e%{username}\u003c/b\u003e, سيتم ارسال رسالة لبريدك لإعادة ضبط كلمة المرور ","complete_email":"اذا كان الحساب متطابق \u003cb\u003e%{email}\u003c/b\u003e, سوف تستلم بريد الالكتروني يحوي على التعليمات لإعادة ضبط كلمة المرور","complete_username_found":"وجدنا حساب متطابق مع المستخدم  \u003cb\u003e%{username}\u003c/b\u003e, سوف تستلم بريد الالكتروني يحوي على التعليمات لإعادة ضبط كلمة المرور","complete_email_found":"وجدنا حساب متطابق مع  \u003cb\u003e%{email}\u003c/b\u003e, سوف تستلم بريد الالكتروني يحوي على التعليمات لإعادة ضبط كلمة المرور","complete_username_not_found":"لايوجد حساب متطابق مع هذا المستخدم  \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"لايوجد حساب متطابق مع  \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"لِج","username":"المستخدم","password":"كلمة المرور","email_placeholder":"البريد الإلكتروني أو اسم المستخدم","caps_lock_warning":"قافل الحالة يعمل","error":"خطأ مجهول","rate_limit":"من فضلك انتظر قبل أن تلج مرة أخرى.","blank_username_or_password":"من فضلك أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور.","reset_password":"صفّر كلمة المرور","logging_in":"...تسجيل الدخول ","or":"أو ","authenticating":"يستوثق...","awaiting_confirmation":"ما زال حسابك غير مفعّل، استخدم رابط نسيان كلمة المرور لإرسال بريد إلكتروني تفعيلي آخر.","awaiting_approval":"لم يوافق أحد أعضاء الطاقم على حسابك بعد. سيُرسل إليك بريد حالما يتم ذلك.","requires_invite":"آسفون، التسجيل في هذا المنتدى يتم بالدعوة فقط.","not_activated":"لا يمكنك تسجيل الدخول. لقد سبق و أن أرسلنا بريد إلكتروني إلى \u003cb\u003e{{sentTo}}\u003c/b\u003e لتفعيل حسابك. الرجاء اتباع التعليمات المرسلة لتفعيل الحساب.","not_allowed_from_ip_address":"لا يمكنك الولوج من عنوان IP هذا.","admin_not_allowed_from_ip_address":"لا يمكنك الولوج كمدير من عنوان IP هذا.","resend_activation_email":"اضغط هنا لإرسال رسالة إلكترونية أخرى لتفعيل الحساب.","sent_activation_email_again":"لقد سبق وأن تم إرسال رسالة إلكترونية إلى \u003cb\u003e{{currentEmail}}\u003c/b\u003e لتفعيل حسابك. تأكد من مجلد السبام في بريدك.","to_continue":"من فضلك لِج","preferences":"عليك الولوج لتغيير تفضيلاتك الشخصية.","forgot":"لا أذكر معلومات حسابي","google":{"title":"مع غوغل","message":"يستوثق مع غوغل (تأكد من أن مانعات المنبثقات معطلة)"},"google_oauth2":{"title":"مع غوغل","message":"يستوثق مع غوغل (تأكد من أن مانعات المنبثقات معطلة)"},"twitter":{"title":"مع تويتر","message":"يستوثق مع تويتر (تأكد من أن مانعات المنبثقات معطلة)"},"instagram":{"title":"مع إنستغرام","message":"يستوثق مع إنستغرام (تأكد من أن مانعات المنبثقات معطلة)"},"facebook":{"title":"مع فيس‌بوك","message":"يستوثق مع فيس‌بوك (تأكد من أن مانعات المنبثقات معطلة)"},"yahoo":{"title":"مع ياهو","message":"يستوثق مع ياهو (تأكد من أن مانعات المنبثقات معطلة)"},"github":{"title":"مع غِت‌هَب","message":"يستوثق مع غِت‌هَب (تأكد من أن مانعات المنبثقات معطلة)"}},"emoji_set":{"apple_international":"آبل/عالمي","google":"غوغل","twitter":"تويتر","emoji_one":"إموجي واحد","win10":"وندوز10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"الإيموجي :)","more_emoji":"أكثر...","options":"خيارات","whisper":"همس","unlist":"غير مدرج","add_warning":"هذا تحذير رسمي","toggle_whisper":"تبديل الهمس","toggle_unlisted":"تبديل الغير مدرج","posting_not_on_topic":"أي موضوع تود الرد عليه؟","saving_draft_tip":"يحفظ...","saved_draft_tip":"حُفظ","saved_local_draft_tip":"حُفظ محليا","similar_topics":"موضوعك يشابه...","drafts_offline":"مسودات محفوظة ","duplicate_link":"يبدو أن الرابط المشير إلى \u003cb\u003e{{domain}}\u003c/b\u003e قد نشره \u003cb\u003e@{{username}}\u003c/b\u003e في الموضوع في \u003ca href='{{post_url}}'\u003eرد له {{ago}}\u003c/a\u003e – أمتأكد من نشره مجددا؟","error":{"title_missing":"العنوان مطلوب","title_too_short":"العنوان يجب أن يكون اكثر  {{min}} حرف","title_too_long":"العنوان يجب أن لا يكون أكثر من  {{max}} حرف","post_missing":"لا يمكن للمشاركة أن تكون خالية","post_length":"التعليق يجب أن يكون أكثر  {{min}} حرف","try_like":"هل جربت زر \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e ؟","category_missing":"يجب عليك اختيارتصنيف"},"save_edit":"حفظ التحرير","reply_original":"التعليق على الموضوع الاصلي","reply_here":"الرد هنا","reply":"الرد","cancel":"إلغاء","create_topic":"إنشاء موضوع","create_pm":"رسالة","title":"او اضغط على Ctrl+Enter","users_placeholder":"أضف مستخدما","title_placeholder":"بجملة واحدة، ما الذي تود النقاش عنه؟","edit_reason_placeholder":"لماذا تعدّل النص؟","show_edit_reason":"(أضف سبب التعديل)","reply_placeholder":"اكتب ما تريد هنا. استخدم Markdown، أو BBCode، أو HTML للتنسيق. اسحب الصور أو ألصقها.","view_new_post":"الاطلاع على أحدث مشاركاتك","saving":"يحفظ","saved":"حُفظ!","saved_draft":"جاري إضافة المسودة. اضغط للاستئناف","uploading":"يرفع...","show_preview":"أظهر المعاينة \u0026raquo;","hide_preview":"\u0026laquo; أخفِ المعاينة","quote_post_title":"اقتبس كامل المشاركة","bold_title":"عريض","bold_text":"نص عريض","italic_title":"مائل","italic_text":"نص مائل","link_title":"الرابط","link_description":"ادخل وصف الرابط هنا ","link_dialog_title":"اضف الرابط","link_optional_text":"عنوان اختياري","link_url_placeholder":"http://example.com","quote_title":"اقتباس فقرة","quote_text":"اقتباس فقرة","code_title":"المحافظة على التنسيق","code_text":"اضف 4 مسافات اول السطر قبل النص المنسق","paste_code_text":"اطبع أو الصق الكود هنا","upload_title":"رفع","upload_description":"ادخل وصف الرفع هنا","olist_title":"قائمة مرقمة","ulist_title":"قائمة ","list_item":"قائمة العناصر","heading_title":"عنوان","heading_text":"عنوان","hr_title":"خط افقي","help":"مساعدة في رموز التنسيق","toggler":"اخف او اظهر صندوق التحرير","modal_ok":"حسنا","modal_cancel":"ألغِ","cant_send_pm":"آسفون، لا يمكنك إرسال الرسائل إلى %{username} .","yourself_confirm":{"title":"هل نسيت أن تضيف المرسل اليهم؟","body":"حاليا هذة الرسالة مرسلة اليك فقط!"},"admin_options_title":"اختياري اضافة اعدادات الموضوع","auto_close":{"label":"وقت الإغلاق التلقائي للموضوع","error":"من فضلك أدخل قيمة صالحة.","based_on_last_post":"لاتغلق الموضوع حتى تكون آخر مشاركة بهذا القدم ","all":{"examples":"أدخل عدد الساعات (24)، أو الوقت (17:30) أو الطابع الزمني (2013-11-22 14:00)."},"limited":{"units":"(# من الساعات)","examples":"أدخل الساعة (24)"}}},"notifications":{"title":"الإشعار عندما يتم ذكر @name , أو الردود على مواضيعك أو مشاركاتك أو الرسالة الخاصة ...إلخ","none":"تعذر تحميل الإشعارات الآن.","empty":"لا إشعارات.","more":"اعرض الإشعارات الأقدم من هذه","total_flagged":"مجموع المشاركات المعلّم عليها","mentioned":"\u003ci title='إشارة إليك' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='إشارة إلى مجموعة' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='اقتباس لكلامك' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='ردّ عليك' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e نقل{{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eاستحق'{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eموضوع جديد\u003c/span\u003e {{description}}\u003c/p\u003e","alt":{"mentioned":"مؤشرة بواسطة","quoted":"مقتبسة بواسطة","replied":"مجاب","posted":"مشاركة بواسطة","edited":"تم تعديل مشاركتك بواسطة","liked":"تم الإعجاب بمشاركتك","private_message":"رسالة خاصة من","invited_to_private_message":"تمت الدعوة لرسالة خاصة من ","invited_to_topic":"تمت الدعوة لموضوع من ","invitee_accepted":"قبلت الدعوة بواسطة","moved_post":"مشاركتك نقلت بواسطة","linked":"رابط لمشاركتك","granted_badge":"تم منح الوسام","group_message_summary":"الرسائل في صندوق رسائل  المجموعه"},"popup":{"mentioned":"أشار {{username}} إليك في \"{{topic}}\" - {{site_title}}","group_mentioned":"أشار {{username}} إليك في \"{{topic}}\" - {{site_title}}","quoted":"اقتبس {{username}} كلامك في \"{{topic}}\" - {{site_title}}","replied":"ردّ {{username}} عليك في \"{{topic}}\" - {{site_title}}","posted":"شارك {{username}} في \"{{topic}}\" - {{site_title}}","private_message":"أرسل {{username}} إليك رسالة خاصة في \"{{topic}}\" - {{site_title}}","linked":"{{username}} رتبط بمشاركتك من \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"اضف صورة","title_with_attachments":"اضف صورة او ملف","from_my_computer":"عن طريق جهازي","from_the_web":"عن طريق الويب","remote_tip":"رابط لصورة","remote_tip_with_attachments":"رابط لصورة أو ملف {{authorized_extensions}}","local_tip":"إختر صور من جهازك .","local_tip_with_attachments":"حدّد صورا أو ملفات من جهازك {{authorized_extensions}}","hint":"(يمكنك أيضا السحب والإفلات على المحرر لرفعها)","hint_for_supported_browsers":"يمكنك أيضا سحب وإفلات الصور أو لصقها في المحرر","uploading":"يرفع","select_file":"اختر ملفا","image_link":"رابط ستشير له الصورة"},"search":{"sort_by":"ترتيب حسب","relevance":"أهمية","latest_post":"آخر مشاركات","most_viewed":"الأكثر مشاهدة","most_liked":"الأكثر إعجابا","select_all":"أختر الكل","clear_all":"إلغ إختيار الكل","too_short":"مصطلح البحث قصير جدا.","result_count":{"zero":"لا نتائج ل‍ \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","one":"نتيجة واحدة ل‍ \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","two":"نتيجتان ل‍ \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","few":"{{count}} نتائج ل‍ \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","many":"{{count}} نتيجة ل‍ \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} نتيجة ل‍ \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"ابحث في المواضيع أو المشاركات أو المستخدمين أو الفئات","no_results":"لا نتائج.","no_more_results":"لا نتائج أخرى.","search_help":"بحث عن المساعدة","searching":"يبحث...","post_format":"#{{post_number}} بواسطة {{username}}","context":{"user":"البحث عن مواضيع @{{username}}","category":"ابحث في فئة #{{category}}","topic":"ابحث في هذا الموضوع","private_messages":"البحث في الرسائل الخاصة"}},"hamburger_menu":"انتقل إلى قائمة مواضيع أو فئة أخرى","new_item":"جديد","go_back":"الرجوع","not_logged_in_user":"صفحة المستخدم مع ملخص عن نشاطه و إعداداته","current_user":"الذهاب إلى صفحتك الشخصية","topics":{"bulk":{"unlist_topics":"ازالة المواضيع من القائمة","reset_read":"تصفير القراءات","delete":"المواضيع المحذوفة","dismiss":"إخفاء","dismiss_read":"تجاهل المشاركات غير المقروءة","dismiss_button":"تجاهل...","dismiss_tooltip":"تجاهل فقط المشاركات الجديدة او توقف عن تتبع المواضيع","also_dismiss_topics":"التوقف عن متابعه المواضيع حتي لا تظهر كغير مقروء مره اخرى ","dismiss_new":"إخفاء الجديد","toggle":"إيقاف/تشغيل الاختيار المتعدد للمواضيع","actions":"عمليات تنفذ دفعة واحدة","change_category":"تغيير التصنيف","close_topics":"إغلاق المواضيع","archive_topics":"أرشفة المواضيع","notification_level":"غيّر مستوى الإشعار","choose_new_category":"اختر الفئة الجديدة للمواضيع:","selected":{"zero":"لم تحدد شيئا.","one":"حددت موضوع \u003cb\u003eواحد\u003c/b\u003e.","two":"حددت \u003cb\u003eموضوعين\u003c/b\u003e.","few":"حددت \u003cb\u003e{{count}}\u003c/b\u003e مواضيع.","many":"حددت \u003cb\u003e{{count}}\u003c/b\u003e موضوعا.","other":"حددت \u003cb\u003e{{count}}\u003c/b\u003e موضوع."},"change_tags":"غيّر الوسوم","choose_new_tags":"اختر وسوم جديدة لهذه المواضيع:","changed_tags":"تغيرت وسوم هذه المواضيع."},"none":{"unread":"ليست هناك مواضيع غير مقروءة.","new":"ليست هناك مواضيع جديدة.","read":"لم تقرأ أيّ موضوع بعد.","posted":"لم تشارك في أيّ موضوع بعد.","latest":"لا مواضيع حديثة. يا للأسف.","hot":"الهدوء يعم المكان.","bookmarks":"لا مواضيع مفضّلة بعد.","category":"لا مواضيع في الفئة \"{{category}}\".","top":"لا يوجد مواضيع تستحق أن تكون ضمن الأفضل مع الأسف.","search":"لا نتائج للبحث.","educate":{"new":"\u003cp\u003eستظهر المواضيع الجديدة هنا\u003c/p\u003e\u003cp\u003eتُعتبر المواضيع (افتراضيا) جديدة وتعرض مؤشّر \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eجديد\u003c/span\u003e إن أُنشئت في اليومين الماضيين.\u003c/p\u003e\u003cp\u003eزُر \u003ca href=\"%{userPrefsUrl}\"\u003eالتفضيلات\u003c/a\u003e لتغيير هذا السلوك.\u003c/p\u003e","unread":"\u003cp\u003eستظهر المواضيع غير المقروءة هنا.\u003c/p\u003e\u003cp\u003eتُعتبر المواضيع (افتراضيا) غير مقروءة بإظهار عدّاد \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e في حال:\u003c/p\u003e\u003cul\u003e\u003cli\u003eأنشأت الموضوع\u003c/li\u003e\u003cli\u003eرددت على الموضوع\u003c/li\u003e\u003cli\u003eقرأت الموضوع لأكثر من 4 دقاق\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eأو إن ضبطت الموضوع ليُراقب أو يُتابع عبر التحكم بالإشعارات أسفل كل موضوع.\u003c/p\u003e\u003cp\u003eزُر \u003ca href=\"%{userPrefsUrl}\"\u003eالتفضيلات\u003c/a\u003e لتغيير هذا السلوك.\u003c/p\u003e"}},"bottom":{"latest":"ليست هناك مواضيع حديثة أخرى.","hot":"هذه كل المواضيع التي عليها إقبال عالي حتى هذه اللحظة","posted":"لا يوجد مواضيع أخرى.","read":"ليست هناك مواضيع مقروءة أخرى.","new":"ليست هناك مواضيع جديدة أخرى.","unread":"ليست هناك مواضيع غير مقروءة أخرى.","category":"ليست هناك مواضيع أخرى في فئة \"{{category}}\".","top":"لقد اطلعت على كل المواضيع المميزة حتى هذه اللحظة.","bookmarks":"لايوجد المزيد من المواضيع في المفضلة","search":"ليست هناك نتائج بحث أخرى."}},"topic":{"unsubscribe":{"stop_notifications":"ستستقبل الأن إشعارات أقل لـ\u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"حالة إشعارك الحالي هي "},"create":"موضوع جديد","create_long":"كتابة موضوع جديد","private_message":"أرسل رسالة خاصة","archive_message":{"help":"انقل الرسالة للأرشيف لديك","title":"إلى الأرشيف"},"move_to_inbox":{"title":"انقل إلى البريد الوارد","help":"انقل الرسالة للبريد الوارد"},"list":"المواضيع","new":"موضوع جديد","unread":"غير مقروء","new_topics":{"zero":"لا مواضيع جديدة","one":"موضوع واحد جديد","two":"موضوعان جديدان","few":"{{count}} مواضيع جديدة","many":"{{count}} موضوعًا جديدًا","other":"{{count}} موضوع جديد"},"unread_topics":{"zero":"لا مواضيع غير مقروءة","one":"موضوع واحد غير مقروء","two":"موضوعان غير مقروءان","few":"{{count}} مواضيع غير مقروءة","many":"{{count}} موضوعًا غير مقروء","other":"{{count}} موضوع غير مقروء"},"title":"موضوع","invalid_access":{"title":"الموضوع خاص","description":"لا تملك صلاحيات للوصول لهذا الموضوع","login_required":"عليك الولوج لمشاهدة هذا الموضوع."},"server_error":{"title":"فشل تحميل الموضوع","description":"آسفون، تعذر علينا تحميل هذا الموضوع، قد يرجع ذلك إلى مشكلة بالاتصال. من فضلك حاول مجددا. أخبرنا بالمشكلة إن استمر حدوثها."},"not_found":{"title":"لم يتم العثور على الموضوع","description":"آسفون، لم نجد هذا الموضوع. ربما أزاله أحد المشرفين؟"},"total_unread_posts":{"zero":"لا مشاركات غير مقروءة في هذا الموضوع","one":"لديك مشاركة واحدة غير مقروءة في هذا الموضوع","two":"لديك مشاركتين غير مقروءتين في هذا الموضوع","few":"لديك {{count}} مشاركات غير مقروءة في هذا الموضوع","many":"لديك {{count}} مشاركة غير مقروءة في هذا الموضوع","other":"لديك {{count}} مشاركة غير مقروءة في هذا الموضوع"},"unread_posts":{"zero":"لا مشاركات قديمة غير مقروءة في هذا الموضوع","one":"لديك مشاركة واحدة قديمة غير مقروءة في هذا الموضوع","two":"لديك مشاركتين قديمتين غير مقروءتين في هذا الموضوع","few":"لديك {{count}} مشاركات قديمة غير مقروءة في هذا الموضوع","many":"لديك {{count}} مشاركة قديمة غير مقروءة في هذا الموضوع","other":"لديك {{count}} مشاركة قديمة غير مقروءة في هذا الموضوع"},"new_posts":{"zero":"لا مشاركات جديدة في هذا الموضوع منذ قرأته","one":"هناك مشاركة جديدة واحدة في هذا الموضوع منذ قرأته","two":"هناك مشاركتين جديدتين في هذا الموضوع منذ قرأته","few":"هناك {{count}} مشاركات جديدة في هذا الموضوع منذ قرأته","many":"هناك {{count}} مشاركة جديدة في هذا الموضوع منذ قرأته","other":"هناك {{count}} مشاركة جديدة في هذا الموضوع منذ قرأته"},"likes":{"zero":"لا إعجابات في هذا الموضوع","one":"هناك إعجاب واحد في هذا الموضوع","two":"هناك إعجابين في هذا الموضوع","few":"هناك {{count}} إعجابات في هذا الموضوع","many":"هناك {{count}} إعجابا في هذا الموضوع","other":"هناك {{count}} إعجاب في هذا الموضوع"},"back_to_list":"العودة لقائمة المواضيع","options":"خيارات الموضوع","show_links":"إظهار الروابط في هذا الموضوع","toggle_information":"إظهار/إخفاء تفاصيل الموضوع","read_more_in_category":"أتريد قراءة المزيد؟ تصفح المواضيع الأخرى في {{catLink}} أو {{latestLink}}.","read_more":"أتريد قراءة المزيد؟ {{catLink}} أو {{latestLink}}.","browse_all_categories":"تصفّح كل الفئات","view_latest_topics":"اعرض أحدث المواضيع","suggest_create_topic":"لمَ لا تكتب موضوعًا؟","jump_reply_up":"الذهاب إلى أول رد","jump_reply_down":"الذهاب إلى آخر رد","deleted":"الموضوع محذوف","auto_close_notice":"سيُغلق الموضوع آليا %{timeLeft}.","auto_close_notice_based_on_last_post":"سيُغلق الموضوع بعد %{duration} من آخر رد.","auto_close_title":"إعدادات الإغلاق الآلي","auto_close_save":"احفظ","auto_close_remove":"لا تغلق هذا الموضوع آليا","timeline":{"back":"الرجوع","back_description":"عُد إلى آخر مشاركة غير مقروءة","replies_short":"%{current} / %{total}"},"progress":{"title":"حالة الموضوع","go_top":"أعلى","go_bottom":"أسفل","go":"اذهب","jump_bottom":"انتقل لآخر مشاركة","jump_prompt":"اقفز الى المشاركة","jump_prompt_long":"إلى أي مشاركة تريد الانتقال؟","jump_bottom_with_number":"انتقل إلى المشاركة %{post_number}","total":"مجموع المشاركات","current":"المشاركة الحالية"},"notifications":{"title":"غير عدد مرات اشعارك عن هذا الموضوع","reasons":{"mailing_list_mode":"وضع القائمة البريدية لديك مفعّل، لذلك ستصلك إشعارات الردود على هذا الموضوع عبر البريد الإلكتروني.","3_10":"ستصلك إشعارات لأنك تراقب وسما وُسم به هذا الموضوع.","3_6":"ستصلك إشعارات لأنك تراقب هذه الفئة.","3_5":"ستصلك إشعارات لأنك بدأت بمراقبة هذا الموضوع آليا.","3_2":"ستصلك إشعارات لأنك تراقب هذا الموضوع.","3_1":"ستصلك إشعارات لأنك أنشأت هذا الموضوع.","3":"ستصلك إشعارات لأنك تراقب هذا الموضوع.","2_8":"ستصلك إشعارات لأنك تتابع هذه الفئة.","2_4":"ستصلك إشعارات لأنك نشرت ردا في هذا الموضوع.","2_2":"ستصلك إشعارات لأنك تتابع هذا الموضوع.","2":"ستصلك إشعارات لأنك \u003ca href=\"/users/{{username}}/preferences\"\u003eقرأت هذا الموضوع\u003c/a\u003e.","1_2":"سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك.","1":"سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك.","0_7":"أنت تتجاهل إشعارات هذه الفئة.","0_2":"أنت تتجاهل إشعارات هذا الموضوع.","0":"أنت تتجاهل إشعارات هذا الموضوع."},"watching_pm":{"title":"مُراقب","description":"سيصلك إشعار لكل رد جديد لهذه الرسالة، وسيظهر عدد الردود الجديدة."},"watching":{"title":"مُراقب","description":"سيصلك إشعار لكل رد جديد لهذا الموضوع، وسيظهر عدد الردود الجديدة."},"tracking_pm":{"title":"مُتابع","description":"سيظهر عدد الردود الجديدة لهذه الرسالة. سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك."},"tracking":{"title":"مُتابع","description":"سيظهر عدد الردود الجديدة لهذا الموضوع. سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك."},"regular":{"title":"منتظم","description":"سيصلك إشعارا إن أشار أحد إلى @اسمك أو رد عليك."},"regular_pm":{"title":"منتظم","description":"سيصلك إشعارا إن أشار أحد إلى @اسمك أو رد عليك."},"muted_pm":{"title":"كتم","description":"لن تصلك أية إشعارات لهذه الرسالة."},"muted":{"title":"مكتوم","description":"لن تصلك أية إشعارات لهذا الموضوع، ولن يظهر في المواضيع الأخيرة."}},"actions":{"recover":"استرجاع الموضوع","delete":"حذف الموضوع","open":"كتابة موضوع","close":"إغلاق الموضوع","multi_select":"حدد مشاركات...","auto_close":"إغلاق تلقائي","pin":"تثبيت الموضوع","unpin":"إلغاء تثبيت الموضوع","unarchive":"التراجع عن أرشفة الموضوع","archive":"أرشفة الموضوع","invisible":"إزالة من القائمة","visible":"إضافة ضمن القائمة","reset_read":"تصفير القراءات","make_public":"اجغل الموضوع عاماً","make_private":"اجعل الرسالة خاصة"},"feature":{"pin":"تثبيت مواضيع","unpin":"إلغاء تثبيت مواضيع","pin_globally":"تثبيت الموضوع على عموم الموقع","make_banner":"موضوع دعائي","remove_banner":"إزالة موضوع دعائي"},"reply":{"title":"ردّ","help":"ابدأ بكتابة رد على هذا الموضوع"},"clear_pin":{"title":"إلغاء التثبيت","help":"إلغاء تثبيت الموضوع حتى لا يظهر في أعلى القائمة"},"share":{"title":"مشاركة","help":"شارك برابط يشير لهذا الموضوع"},"flag_topic":{"title":"إبلاغ","help":"قم بمتابعة هذا الموضوع بشكل خاص حيث سيصلك تنبيهات عليها ","success_message":"تم الإبلاغ عن الموضوع"},"feature_topic":{"title":"ترشيح هذا الموضوع","pin":"جعل هذا الموضوع يظهر في أعلى فئة {{categoryLink}} حتى ","confirm_pin":"لديك مسبقاً {{count}} مواضيع معلقة. قد تكون كثرة المواضيع المعلقة عبئاً على لمستخدمين الجدد والزوار. هل أنت متأكد أنك تريد تعليق موضوع آخر في هذه الفئة؟","unpin":"أزل هذا الموضوع من أعلى فئة \"{{categoryLink}}\".","unpin_until":"أزل هذا الموضوع من أعلى فئة \"{{categoryLink}}\" أو انتظر حتى \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"المستخدمون يستطعون إزالة تثبيت الموضوع بشكل خاص بهم.","pin_validation":"التاريخ مطلوب لتثبيت هذا الموضوع.","not_pinned":"لا مواضيع مثبتة في {{categoryLink}}.","already_pinned":{"zero":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","one":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","two":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","few":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":" جعل هذا الموضوع يظهر في أعلى جميع القوائم الموضوع.","confirm_pin_globally":"لديك  {{count}} مواضيع مثبتة على المستوى الكلى للموقع مما قد يشكل عبئ على الأعضاء الجدد أو الغير مسجلين. هل أنت واثق أنك تريد تثبيت موضوع أخر على المستوى الكلى للموقع؟","unpin_globally":"أزل هذا الموضوع من أعلى كل قوائم المواضيع.","unpin_globally_until":"أزل هذا الموضوع من أعلى قوائم الموضوعات أو انتظر حتى \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"يمكن للمستخدمين بفصل موضوع على حدة لأنفسهم. ","not_pinned_globally":"لا مواضيع مثبتة للعموم.","already_pinned_globally":{"zero":"مواضيع مثبتة حاليا : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","one":"مواضيع مثبتة حاليا : \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","two":"مواضيع مثبتة حاليا : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","few":"مواضيع مثبتة حاليا : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"مواضيع مثبتة حاليا : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"المواضيع المثبتة للعموم حاليا: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"اجعل هذا الموضوع إعلانا يظهر أعلى كل الصفحات.","remove_banner":"أزل الإعلان الذي يظهر أعلى كل الصفحات.","banner_note":"المستخدمون يستطعون إبعاد الشعار بأغلاقه. موضوع واحد فقط يبقى كشعار لأي وقت معطى.","no_banner_exists":"لا يوجد اشعار للموضوع","banner_exists":"شعار الموضوع \u003cstrong class='badge badge-notification unread'\u003eهناك\u003c/strong\u003e حاليا."},"inviting":"دعوة...","automatically_add_to_groups":"هذه الدعوة تشتمل ايضا الوصول الى هذه المجموعات:","invite_private":{"title":"رسالة دعوة","email_or_username":"دعوات عن طريق اسم المستخدم او البريد الالكتروني","email_or_username_placeholder":"البريد الإلكتروني أو إسم المستخدم","action":"دعوة","success":"لقد دعونا ذلك المستخدم للمشاركة في هذه الرسالة.","success_group":"لقد دعونا تلك المجموعة للمشاركة في هذه الرسالة.","error":"آسفون، حدثت مشكلة في دعوة المستخدم.","group_name":"اسم المجموعة"},"controls":"خصائص  الموضوع","invite_reply":{"title":"دعوة","username_placeholder":"اسم المستخدم","action":"أرسل دعوة","help":"دعوة المستخدمين لهذا الموضوع عن طرق البريد الإلكتروني أو الأشعارات","to_forum":"سيتم ارسال رسالة بريد الكتروني ﻷصدقائك للمشاركة في الموقع , هذه العملية لا تتطلب تسجيل الدخول .","sso_enabled":"أدخل اسم مَن تريد دعوته إلى هذا الموضوع.","to_topic_blank":"أدخل اسم مَن تريد دعوته إلى هذا الموضوع أو بريده.","to_topic_email":"لقد ادخلت عنوان البريد إلإلكتروني. سنقوم بإرسال دعوة تسمح لصديقك بالرد حالاً على هذا الموضوع.","to_topic_username":"لقد ادخلت اسم المستحدم. سنقوم بإرسال إشعار يحتوي على رابط دعوة إلى الموضوع.","to_username":"ضع اسم المستخدم للشخص الذي تريد دعوته. سنقوم بإرسال إشعار يحتوي على رابط دعوة إلى الموضوع.","email_placeholder":"name@example.com","success_email":"قمنا بإرسال دعوة بالبريد لـ \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e . سيتم تنبيهك عند قبول الدعوة , تحقق من تبويب الدعوات في صفحتك الشخصية لمتابعة دعوتك.","success_username":"دعونا عضو للمشاركة في هذا الموضوع.","error":"نأسف لا يمكنك دعوة هذا المُستَخدم , ربما لأنه مُسَجِل لدينا مسبقاً (الدعوات محدودة)"},"login_reply":"لِج لترد","filters":{"n_posts":{"zero":"لا مشاركات","one":"مشاركة واحدة","two":"مشاركتان","few":"{{count}} مشاركات","many":"{{count}} مشاركة","other":"{{count}} مشاركة"},"cancel":"حذف التخصيص"},"split_topic":{"title":"موضوع جديد","action":"موضوع جديد","topic_name":"اسم الموضوع","error":"هناك مشكلة في نقل المشاركات الى الموضوع الجديد","instructions":{"zero":"أنت على وشك انشاء موضوع جديد, ولم يتم اختيار أي مشاركة لتعبئته.","one":"أنت على وشك انشاء موضوع جديد وتعبئته بمشاركة اخترتها.","two":"أنت على وشك انشاء موضوع جديد وتعبئته بـمشاركاتين اخترتها.","few":"أنت على وشك انشاء موضوع جديد وتعبئته بـ \u003cb\u003e{{count}}\u003c/b\u003e مشاركات اخترتها.","many":"أنت على وشك انشاء موضوع جديد وتعبئته بـ \u003cb\u003e{{count}}\u003c/b\u003e مشاركة اخترتها.","other":"أنت على وشك انشاء موضوع جديد وتعبئته بـ \u003cb\u003e{{count}}\u003c/b\u003e مشاركة اخترتها."}},"merge_topic":{"title":"الانتقال الى موضوع موجود","action":"الانتقال الى موضوع موجود","error":"هناك خطأ في نقل هذه المشاركات الى هذا الموضوع","instructions":{"zero":"لم يتم اختيار أي مشاركة لنقلها !","one":"الرجاء اختيار الموضوع الذي تود نقل المشاركة إليه.","two":"الرجاء اختيار الموضوع الذي تود نقل المشاركتين إليه.","few":"الرجاء اختيار الموضوع الذي تود نقل الـ\u003cb\u003e{{count}}\u003c/b\u003e مشاركات إليه.","many":"الرجاء اختيار الموضوع الذي تود نقل الـ\u003cb\u003e{{count}}\u003c/b\u003e مشاركة إليه.","other":"الرجاء اختيار الموضوع الذي تود نقل الـ\u003cb\u003e{{count}}\u003c/b\u003e مشاركة إليه."}},"merge_posts":{"title":"قم بدمج المشاركات المختارة","action":"قم بدمج المشاركات المختارة","error":"حدث خطأ في دمج المشاركات المحددة."},"change_owner":{"title":"تغيير صاحب المشاركة","action":"تغيير العضوية ","error":"هناك خطأ في نغيير العضوية","label":"عضوية جديدة للمشاركات","placeholder":"اسم مستخدم للعضوية الجديدة","instructions":{"zero":"لم يتم تحديد أي مشاركة!","one":"الرجاء اختيار المالك الجديد لمشاركة نُشرت بواسطة \u003cb\u003e{{old_user}}\u003c/b\u003e.","two":"الرجاء اختيار المالك الجديد لمشاركتين نُشرت بواسطة \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"الرجاء اختيار المالك الجديد لـ {{count}} مشاركات نُشرت بواسطة \u003cb\u003e{{old_user}}\u003c/b\u003e.","many":"الرجاء اختيار المالك الجديد لـ {{count}} مشاركة نُشرت بواسطة \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"الرجاء اختيار المالك الجديد لـ {{count}} مشاركة نُشرت بواسطة \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"ملاحطة لن يتم نقل الاشعارت القديمة  للمشاركة  للمسخدم الجديد \u003cbr\u003eتحذير: اي بيانات تتعلق بالمشاركة هذه لن يتم نقلها للمستخدم الجديد. استعملها بحذر."},"change_timestamp":{"title":"تغيير الطابع الزمني","action":"تغيير الطابع الزمني","invalid_timestamp":"الطابع الزمني لا يمكن أن يكون في المستقبل.","error":"هناك خطأ في نغيير الطابع الزمني للموضوع.","instructions":"من فضلك اختر الطابع الزمني الجديد للموضوع. ستُحدث المشاركات فيه لألا يختلف فرق تاريخ نشرها ووقته."},"multi_select":{"select":"تحديد","selected":"محدد ({{count}})","select_replies":"تحديد + ردود","delete":"حذف المحدد","cancel":"الغاء التحديد","select_all":"تحديد الكل","deselect_all":"حذف الكل","description":{"zero":"لم تحدّد أي مشاركة.","one":"لقد حدّدت مشاركة \u003cb\u003eواحدة\u003c/b\u003e.","two":"لقد حدّدت \u003cb\u003eمشاركتين\u003c/b\u003e.","few":"لقد حدّدت \u003cb\u003e{{count}}\u003c/b\u003e مشاركات.","many":"لقد حدّدت \u003cb\u003e{{count}}\u003c/b\u003e مشاركة.","other":"لقد حدّدت \u003cb\u003e{{count}}\u003c/b\u003e مشاركة."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"اقتبس للرد","edit":"أنت تعدّل {{link}} {{replyAvatar}} {{username}} .","edit_reason":"السبب:","post_number":"المشاركة {{number}}","last_edited_on":"آخر تعديل على المشاركة في ","reply_as_new_topic":"التعليق على الموضوع الاصلي","continue_discussion":"إكمال النقاش على {{postLink}}","follow_quote":"الذهاب إلى المشاركة المقتبسة","show_full":"عرض كامل المشاركة","show_hidden":"عرض المحتوى المخفي.","deleted_by_author":{"zero":"(المشاركة سحبت بواسطة الكاتب, سوف تحذف تلقائياً خلال أقل من ساعة مالم يُشار اليها)","one":"(المشاركة سحبت بواسطة الكاتب, سوف تحذف تلقائياً خلال ساعة مالم يُشار اليها)","two":"(المشاركة سحبت بواسطة الكاتب, سوف تحذف تلقائياً خلال ساعتين مالم يُشار اليها)","few":"(المشاركة سحبت بواسطة الكاتب, سوف تحذف تلقائياً خلال %{count} ساعات مالم يُشار اليها)","many":"(المشاركة سحبت بواسطة الكاتب, سوف تحذف تلقائياً خلال %{count} ساعة مالم يُشار اليها)","other":"(المشاركة سحبت بواسطة الكاتب, سوف تحذف تلقائياً خلال %{count} ساعة مالم يُشار اليها)"},"expand_collapse":"وسّع/اطو","gap":{"zero":"لا ردود مخفية","one":"اعرض الرد المخفي","two":"اعرض الردين المخفيين","few":"اعرض ال‍{{count}} ردود المخفية","many":"اعرض ال‍{{count}} ردا المخفية","other":"اعرض ال‍{{count}} رد المخفية"},"unread":"المشاركة غير مقروءة","has_replies":{"zero":"لا ردود","one":"رد واحد","two":"ردان","few":"{{count}} ردود","many":"{{count}} ردا","other":"{{count}} رد"},"has_likes":{"zero":"لا إعجابات","one":"إعجاب واحد","two":"إعجابان","few":"{{count}} إعجابات","many":"{{count}} إعجابا","other":"{{count}} إعجاب"},"has_likes_title":{"zero":"لم تعجب هذه المشاركة أحد","one":"أعجبت هذه المشاركة شخصا واحدا","two":"أعجبت هذه المشاركة شخصين","few":"أعجبت هذه المشاركة {{count}} أشخاص","many":"أعجبت هذه المشاركة {{count}} شخصا","other":"أعجبت هذه المشاركة {{count}} شخص"},"has_likes_title_only_you":"أعجبتك هذه المشاركة","has_likes_title_you":{"zero":"أعجبتك هذه المشاركة","one":"أعجبت هذه المشاركة شخصا واحدا غيرك","two":"أعجبت هذه المشاركة شخصين غيرك","few":"أعجبت هذه المشاركة {{count}} أشخاص غيرك","many":"أعجبت هذه المشاركة {{count}} شخصا غيرك","other":"أعجبت هذه المشاركة {{count}} شخص غيرك"},"errors":{"create":"آسفون، حدثت مشكلة في إنشاء المشاركة. من فضلك حاول مجددا.","edit":"آسفون، حدثت مشكلة في تعديل المشاركة. من فضلك حاول مجددا.","upload":"آسفون، حدثت مشكلة في رفع الملف. من فضلك حاول مجددا.","file_too_large":"آسفون، الملف هذا كبير جدا (أقصى حجم هو {{max_size_kb}}ك.بايت). ما رأيك برفع الملف على خدمة سحابيّة، ومن ثمّ تشارك الوصلة؟","too_many_uploads":"آسفون، يمكنك فقط رفع ملفّ واحد كلّ مرة.","too_many_dragged_and_dropped_files":"آسفون، يمكنك فقط رفع 10 ملفّات كلّ مرة.","upload_not_authorized":"المعذرة، الملف الذي تحاول رفعه غير مسموح به، الامتدادات المسموح بها هي {{authorized_extensions}}.","image_upload_not_allowed_for_new_user":"آسفون، لا يمكن للمستخدمين الجدد رفع الصور.","attachment_upload_not_allowed_for_new_user":"آسفون، لا يمكن للمستخدمين الجدد رفع المرفقات.","attachment_download_requires_login":"آسفون، عليك الولوج لتنزيل المرفقات."},"abandon":{"confirm":"أمتأكد من التخلي عن المشاركة؟","no_value":"لا، أبقها","yes_value":"نعم، لا أريدها"},"via_email":"وصلت هذه المشاركة من خلال الإيميل","via_auto_generated_email":"هذه المشاركة وصلت عبر بريد الكتروني منشىء تلقائياً","whisper":"هذه المشاركة همسة خاصة للمشرفين","wiki":{"about":"هذه المشاركة تعتبر ويكي."},"archetypes":{"save":"حفظ الخيارات"},"few_likes_left":"نشكرك على مشاركة حبّك! تبقّت لديك بضعة إعجابات لليوم فقط.","controls":{"reply":"اكتب ردا على المشاركة","like":"أعجبتني المشاركة","has_liked":"أعجبتك هذه المشاركة","undo_like":"ألغِ الإعجاب","edit":"عدّل المشاركة","edit_anonymous":"آسفون، عليك الولوج لتعديل المشاركة.","flag":"قم بمتابعة هذا الموضوع بشكل خاص حيث سيصلك تنبيهات عليها ","delete":"احذف المشاركة","undelete":"التراجع عن حذف المشاركة","share":"شارك رابط هذه المشاركة","more":"المزيد","delete_replies":{"confirm":{"zero":"لا ردود مباشرة لهذه المشاركة لتُحذف.","one":"أتريد أيضا حذف الرد المباشر لهذه المشاركة؟","two":"أتريد أيضا حذف الردين المباشرين لهذه المشاركة؟","few":"أتريد أيضا حذف ال‍{{count}} ردود المباشرة لهذه المشاركة؟","many":"أتريد أيضا حذف ال‍{{count}} ردا المباشر لهذه المشاركة؟","other":"أتريد أيضا حذف ال‍{{count}} رد المباشر لهذه المشاركة؟"},"yes_value":"نعم، احذف الردود أيضا","no_value":"لا، المشاركة فحسب"},"admin":"عمليات المدير","wiki":"تحويلها إلى ويكي","unwiki":"إيقاف وضعية الويكي","convert_to_moderator":"إضافة لون للموظف","revert_to_regular":"حذف اللون الوظيفي","rebake":"إعادة بناء HTML","unhide":"إظهار","change_owner":"تغيير الملكية"},"actions":{"flag":"التبليغات","defer_flags":{"zero":"أجّل الإعلام","one":"أجّل الإعلام","two":"أجّل الإعلامات","few":"أجّل الإعلامات","many":"أجّل الإعلامات","other":"أجّل الإعلامات"},"undo":{"off_topic":"تراجع عن التبليغ","spam":"تراجع عن التبليغ","inappropriate":"تراجع عن التبليغ","bookmark":"التراجع عن التفضيل","like":"التراجع عن الإعجاب","vote":"التراجع عن التصويت"},"people":{"off_topic":"أبلغ أن هذا خارج الموضوع.","spam":"علّم على أنّه سبام","inappropriate":"ابلغ انه غير ملائم ","notify_moderators":"اشعر المشرفين","notify_user":"ارسل رساله","bookmark":"اضف الى المفضله","like":"أعجبهم هذا","vote":"صوت لهذا"},"by_you":{"off_topic":"لقد تم الإبلاغ عن الموضوع على أنه ليس في المكان الصحيح","spam":"تم الإبلاغ عن الموضوع على أنه سبام","inappropriate":"تم الإبلاغ عن الموضوع على أنه غير لائق","notify_moderators":"تم الإبلاغ عن الموضوع ليشاهده المشرف","notify_user":"لقد قمت بأرسال رسالة لهذا المستخدم","bookmark":"قمت بتفضيل هذه المشاركة","like":"أعجبك هذا","vote":"قمت بالتصويت لهذه المشاركة"},"by_you_and_others":{"off_topic":{"zero":"أنت بلّغت بأن هذا خارج عن الموضوع.","one":"أنت وآخر بلّغتما بأن هذا خارج عن الموضوع.","two":"أنت و {{count}} آخرون بلّغتم بأن هذا خارج عن الموضوع.","few":"أنت و {{count}} آخرون بلّغتم بأن هذا خارج عن الموضوع.","many":"أنت و {{count}} آخرون بلّغتم بأن هذا خارج عن الموضوع.","other":"أنت و {{count}} آخرون بلّغتم بأن هذا خارج عن الموضوع."},"spam":{"zero":"أنت أبلّغت بأن هذا غير مرغوب فيه.","one":"أنت وآخر أبلّغتما بأن هذا غير مرغوب فيه.","two":"أنت و {{count}} آخرون أبلّغتم بأن هذا غير مرغوب فيه.","few":"أنت و {{count}} آخرون أبلّغتم بأن هذا غير مرغوب فيه.","many":"أنت و {{count}} آخرون أبلّغتم بأن هذا غير مرغوب فيه.","other":"أنت و {{count}} آخرون أبلّغتم بأن هذا غير مرغوب فيه."},"inappropriate":{"zero":"أنت أشرت لهذا كغير ملائم.","one":"أنت و شخص آخر أشرتُما لهذا كغير ملائم.","two":"أنت و {{count}} آخران أشرتُم لهذا كغير ملائم.","few":"أنت و {{count}} آخرون أشرتُم لهذا كغير ملائم.","many":"أنت و {{count}} آخرون أشرتُم لهذا كغير ملائم.","other":"أنت و {{count}} آخرون أشرتُم لهذا كغير ملائم."},"notify_moderators":{"zero":"أنت و 1 آخر علّمتم هذا للمراقبين","one":"أنت و 1 آخر علّمتم هذا للمراقبين","two":"أنت و {{count}} آخرون علّمتما هذا للمراقبين","few":"أنت و {{count}} آخرون علّمتم هذا للمراقبين","many":"أنت و {{count}} آخرون علّمتم هذا للمراقبين","other":"أنت و {{count}} آخرون علّمتم هذا للمراقبين"},"notify_user":{"zero":"أنت أرسلت رسالة لهذا المستخدم.","one":"أنت و شخص آخر أرسلتما رسالة لهذا المستخدم.","two":"أنت و {{count}} آخران أرسلتم رسالة لهذا المستخدم.","few":"أنت و {{count}} آخرون أرسلتم رسالة لهذا المستخدم.","many":"أنت و {{count}} آخرون أرسلتم رسالة لهذا المستخدم.","other":"أنت و {{count}} آخرون أرسلتم رسالة لهذا المستخدم."},"bookmark":{"zero":"أنت عَلَّمتَ هذه المشاركة.","one":"أنت و شخص آخر عَلَّمتُما هذه المشاركة.","two":"أنت و {{count}} آخران عَلَّمتُم هذه المشاركة.","few":"أنت و {{count}} آخرون عَلَّمتُم هذه المشاركة.","many":"أنت و {{count}} آخرون عَلَّمتُم هذه المشاركة.","other":"أنت و {{count}} آخرون عَلَّمتُم هذه المشاركة."},"like":{"zero":"أعجبك هذا","one":"أعجب هذا شخصا واحدا غيرك","two":"أعجب هذا شخصين غيرك","few":"أعجب هذا {{count}} أشخاص غيرك","many":"أعجب هذا {{count}} شخصا غيرك","other":"أعجب هذا {{count}} شخص غيرك"},"vote":{"zero":"أنت و {{count}} أشخاص أخرين صوتو لهذا الموضوع","one":"أنت و {{count}} أشخاص أخرين صوتو لهذا الموضوع","two":"أنت و {{count}} أشخاص أخرين صوتو لهذا الموضوع","few":"أنت و {{count}} أشخاص أخرين صوتو لهذا الموضوع","many":"أنت و {{count}} أشخاص أخرين صوتو لهذا الموضوع","other":"أنت و {{count}} أشخاص أخرين صوتو لهذا الموضوع"}},"by_others":{"off_topic":{"zero":"لم يتم الاشارة لهذا كخارج عن الموضوع.","one":"شخص أشار لهذا كخارج عن الموضوع.","two":"شخصان أشارا لهذا كخارج عن الموضوع.","few":"{{count}} أشخاص أشاروا لهذا كخارج عن الموضوع.","many":"{{count}} شخص أشار لهذا كخارج عن الموضوع.","other":"{{count}} شخص أشار لهذا كخارج عن الموضوع."},"spam":{"zero":"لم يتم الاشارة لهذا كغير مفيد,","one":"شخص أشار لهذا كغير مفيد.","two":"شخصان أشارا لهذا كغير مفيد.","few":"{{count}} أشخاص أشاروا لهذا كغير مفيد.","many":"{{count}} شخص أشار لهذا كغير مفيد.","other":"{{count}} شخص أشار لهذا كغير مفيد."},"inappropriate":{"zero":"لم تتم الإشارة لهذا كغير ملائم.","one":"شخص أشار لهذا كغير ملائم.","two":"شخصان أشارا لهذا كغير ملائم.","few":"{{count}} أشخاص أشاروا لهذا كغير ملائم.","many":"{{count}} شخص أشاروا لهذا كغير ملائم.","other":"{{count}} شخص أشاروا لهذا كغير ملائم."},"notify_moderators":{"zero":"1 عضو علّم هذا للمراقبين","one":"1 عضو علّم هذا للمراقبين","two":"{{count}} أعضاء علّمو هذا للمراقبين","few":"{{count}} أعضاء علّمو هذا للمراقبين","many":"{{count}} أعضاء علّمو هذا للمراقبين","other":"{{count}} أعضاء علّمو هذا للمراقبين"},"notify_user":{"zero":"لم يُرسل شيء لهذا المستخدم","one":"أرسل شخص واحد رسالة لهذا المستخدم","two":"أرسل شخصين رسالة لهذا المستخدم","few":"أرسل {{count}} أشخاص رسالة لهذا المستخدم","many":"أرسل {{count}} شخصا رسالة لهذا المستخدم","other":"أرسل {{count}} شخص رسالة لهذا المستخدم"},"bookmark":{"zero":"لم يفضل أحد هذه المشاركة.","one":" شخص واحد فضل هذه المشاركة.","two":" شخصان فضلا هذه المشاركة.","few":"أشخاص قليلون فضلوا هذه المشاركة.","many":"أشخاص كثيرون فضلوا هذه المشاركة.","other":"{{count}} أشخاص فضلوا هذه المشاركة."},"like":{"zero":"لم يعجب هذا أحدا","one":"أعجب هذا شخص واحد","two":"أعجب هذا شخصان","few":"أعجب هذا {{count}} أشخاص","many":"أعجب هذا {{count}} شخصا","other":"أعجب هذا {{count}} شخص"},"vote":{"zero":"لم يصوّت أحد على هذه المشاركة","one":"صوّت شخص واحد على هذه المشاركة","two":"صوّت شخصان على هذه المشاركة","few":"صوّت {{count}} أشخاص على هذه المشاركة","many":"صوّت {{count}} شخصا على هذه المشاركة","other":"صوّت {{count}} شخص على هذه المشاركة"}}},"delete":{"confirm":{"zero":"لا شيء لحذفه.","one":"أمتأكد من حذف المشاركة؟","two":"أمتأكد من حذف المشاركتين؟","few":"أمتأكد من حذف المشاركات هذه؟","many":"أمتأكد من حذف المشاركات هذه؟","other":"أمتأكد من حذف المشاركات هذه؟"}},"merge":{"confirm":{"zero":"لا شيء لدمجه.","one":"أمتأكد من دمج هذه المشاركة؟","two":"أمتأكد من دمج هتين المشاركتين؟","few":"أمتأكد من دمج هذه المشاركات ال‍{{count}} مشاركات هذه؟","many":"أمتأكد من دمج هذه المشاركات ال‍{{count}} مشاركة هذه؟","other":"أمتأكد من دمج هذه المشاركات ال‍{{count}} مشاركة هذه؟"}},"revisions":{"controls":{"first":"أول مراجعة","previous":"المراجعة السابقة","next":"المراجعة التالية","last":"آخر مراجعة","hide":"أخفِ المراجعة","show":"أظهر المراجعة","revert":"اعكس إلى هذه المراجعة","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"اظهر النتيجة المعالجة مع الاضافات وازالة مابين السطور","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"أظهر فروقات الخرج المصيّر جنبًا إلى جنب","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"أظهر فروقات المصدر الخامّ جنبًا إلى جنب","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e الخامّ"}}}},"category":{"can":"يمكنها\u0026hellip;","none":"(غير مصنف)","all":"كل الفئات","choose":"اختر فئة\u0026hellip;","edit":"تعديل","edit_long":"تعديل","view":"اظهار المواضيع في الصنف","general":"عام","settings":"اعدادات","topic_template":"إطار الموضوع","tags":"العلامات الوصفية ","tags_allowed_tags":"العلامات الوصفية التي تستخدم فقط في هذا القسم:","tags_allowed_tag_groups":"مجموعات العلامات الوصفية التي تستخدم فقط في هذا القسم:","tags_placeholder":"(اختياري) قائمة العلامات الوصفية المسموح بها","tag_groups_placeholder":"(اختياري) قائمة مجموعات العلامات الوصفية المسموح بها","delete":"احذف الفئة","create":"فئة جديدة","create_long":"أنشئ فئة جديدة","save":"احفظ الفئة","slug":"عنوان التصنيف/Slug","slug_placeholder":"(اختياري) خط تحت عنوان الموقع","creation_error":"حدثت مشكلة أثناء إنشاء الفئة.","save_error":"حدث خطأ في حفظ الفئة.","name":"اسم الفئة","description":"الوصف","topic":"موضوع التصنيف","logo":"شعار الفئة","background_image":"خلفية الفئة","badge_colors":"ألوان الشارة","background_color":"لون الخلفية","foreground_color":"لون المقدمة","name_placeholder":"كلمة أو كلمتين على الأكثر","color_placeholder":"أي لون ","delete_confirm":"أمتأكد من حذف هذه الفئة؟","delete_error":"حدث خطأ في حذف الفئة.","list":"عرض التصنيفات","no_description":"من فضلك أضف وصفا لهذه الفئة.","change_in_category_topic":"عدّل الوصف","already_used":"استُخدم هذا اللون لفئة أخرى","security":"الأمن","special_warning":"تحذير: هذه الفئة هي فئة قبل التصنيف وإعدادات الحماية لا يمكن تعديلها. إذا لم تكن تريد استخدام هذه الفئة، احذفها بدلا من تطويعها لأغراض أخرى.","images":"الصور","auto_close_label":"الإغلاق التلقائي للمواضيع بعد:","auto_close_units":"ساعات","email_in":"تعيين بريد إلكتروني خاص:","email_in_allow_strangers":"قبول بريد إلكتروني من مستخدمين لا يملكون حسابات","email_in_disabled":"إضافة مواضيع جديدة من خلال البريد الإلكتروني موقوف في الوقت الحالي من خلال إعدادات الموقع. لتفعيل إضافة مواضيع جديدة من خلال البريد الإلكتروني,","email_in_disabled_click":"قم بتفعيل خيار \"email in\" في الإعدادات","suppress_from_homepage":"كتم هذه الفئة من الصفحة الرئيسية","allow_badges_label":"السماح بالحصول على الأوسمة في هذا التصنيف","edit_permissions":"تعديل الصلاحيات","add_permission":"اضف صلاحية","this_year":"هذه السنة","position":"المكان","default_position":"المكان الافتراضي","position_disabled":"التصنيفات يتم عرضها حسب النشاط. لتغيير طريقة ترتيب التصنيفات، ","position_disabled_click":"فعّل خيار \" تثبيت مكان التصنيفات\".","parent":"التصنيف الأب","notifications":{"watching":{"title":"مُراقبة","description":"ستراقب آليا كل مواضيع هذه الفئات. ستصلك إشعارات لكل مشاركة أو موضوع جديد، وسيظهر أيضا عدّاد للمشاركات الجديدة."},"watching_first_post":{"title":"يُراقب فيها أول مشاركة","description":"سنرسل لك إشعارا فقط لأول مشاركة في كل موضوع جديد في هذه المجموعات."},"tracking":{"title":"مُتابعة","description":"ستتابع آليا كل مواضيع هذه الفئات. ستصلك إشعارات إن أشار أحدهم إلى @اسمك أو رد عليك، وسيظهر عدّاد للمشاركات الجديدة."},"regular":{"title":"منتظم","description":"سوف تُنبه اذا قام أحد بالاشارة لاسمك \"@name\" أو الرد عليك."},"muted":{"title":"مكتومة","description":"لن يتم إشعارك بأي مشاركات جديدة في هذه التصنيفات ولن يتم عرضها في قائمة المواضيع المنشورة مؤخراً."}}},"flagging":{"title":"شكرا لمساعدتك في إبقاء مجتمعنا نظيفاً.","action":"التبليغ عن مشاركة","take_action":"أجراء العمليه ","notify_action":"رسالة","official_warning":"تحذير رسمي","delete_spammer":"احذف ناشر السخام","yes_delete_spammer":"نعم، احذف ناشر السخام","ip_address_missing":"(N/A)","hidden_email_address":"(مخفي)","submit_tooltip":"إرسال تبليغ","take_action_tooltip":"الوصول إلى الحد الأعلى للتبليغات دون انتظار تبليغات أكثر من أعضاء الموقع.","cant":"المعذرة، لا يمكنك التبليغ عن هذه المشاركة في هذه اللحظة.","notify_staff":"اشعر الطاقم سرياً","formatted_name":{"off_topic":"خارج عن الموضوع","inappropriate":"غير لائق","spam":"هذا سبام"},"custom_placeholder_notify_user":"كن محدد, استدلالي ودائما حسن الاخلاق","custom_placeholder_notify_moderators":"ممكن تزودنا بمعلومات أكثر عن سبب عدم ارتياحك حول هذه المشاركة؟ زودنا ببعض الروابط و الأمثلة قدر الإمكان."},"flagging_topic":{"title":"شكرا لمساعدتنا في ابقاء مجتمعنا نضيفا","action":"التبليغ عن الموضوع","notify_action":"رسالة"},"topic_map":{"title":"ملخص الموضوع","participants_title":"مشاركين معتادين","links_title":"روابط شائعة","links_shown":"أظهر روابط أخرى...","clicks":{"zero":"لا نقرات","one":"نقرة واحدة","two":"نقرتان","few":"%{count} نقرات","many":"%{count} نقرة","other":"%{count} نقرة"}},"post_links":{"about":"وسّع المزيد من الروابط في هذه المشاركة","title":{"zero":"لا شيء آخر","one":"واحدة أخرى","two":"إثنتان أخريتان","few":"%{count} أخرى","many":"%{count} أخرى","other":"%{count} أخرى"}},"topic_statuses":{"warning":{"help":"هذا تحذير رسمي"},"bookmarked":{"help":"قمت بتفضيل  هذا الموضوع"},"locked":{"help":"هذا الموضوع مغلق, لن يتم قبول اي رد "},"archived":{"help":"هذا الموضوع مؤرشف، لذا فهو مجمّد ولا يمكن تعديله"},"locked_and_archived":{"help":"هذا الموضوع مغلق و مؤرشف; لم يعد يقبل ردود جديدة أو لا يمكن تغيره."},"unpinned":{"title":"غير مثبت","help":"هذا الموضوع غير مثبت بالنسبة لك, سيتم عرضه بالترتيب العادي"},"pinned_globally":{"title":"تثبيت عام","help":"هذا الموضوع مثبت بشكل عام, سوف يظهر في مقدمة المواضيع بآخر المشاركات وفي الفئة الخاصة به"},"pinned":{"title":"مثبت","help":"هذا الموضوع مثبت لك, سوف يتم عرضه في اول القسم"},"invisible":{"help":"هذا الموضوع غير مصنف لن يظهر في قائمة التصانيف ولايمكن الدخول عليه الابرابط مباشر."}},"posts":"مشاركات","posts_long":"هناك {{number}} مشاركات في هذا الموضوع","original_post":"المشاركة الاصلية","views":"المشاهدات","views_lowercase":{"zero":"المشاهدات","one":"المشاهدات","two":"المشاهدات","few":"المشاهدات","many":"المشاهدات","other":"المشاهدات"},"replies":"الردود","views_long":"هذا الموضوع قد تمت مشاهدته  {{number}} مرات","activity":"النشاط","likes":"اعجابات","likes_lowercase":{"zero":"اﻹعجابات","one":"اﻹعجابات","two":"اﻹعجابات","few":"اﻹعجابات","many":"اﻹعجابات","other":"اﻹعجابات"},"likes_long":"هناك {{number}} اعجابات في هذا الموضوع","users":"المستخدمون","users_lowercase":{"zero":"المستخدمون","one":"المستخدمون","two":"المستخدمون","few":"المستخدمون","many":"المستخدمون","other":"المستخدمون"},"category_title":"الفئة","history":"تاريخ","changed_by":"الكاتب {{author}}","raw_email":{"title":"البريد الإلكتروني","not_available":"غير متوفر!"},"categories_list":"قائمة الاقسام","filters":{"with_topics":"المواضيع %{filter}","with_category":"المواضيع %{filter} في %{category}","latest":{"title":"الأخيرة","title_with_count":{"zero":"الأخيرة ({{count}})","one":"الأخيرة ({{count}})","two":"الأخيرة ({{count}})","few":"الأخيرة ({{count}})","many":"الأخيرة ({{count}})","other":"الأخيرة ({{count}})"},"help":"مواضيع بآخر المشاركات"},"hot":{"title":"ساخن","help":"مختارات من مواضيع ساخنة"},"read":{"title":"المقروءة","help":"مواضيع قمت بقراءتها بترتيب آخر قراءة"},"search":{"title":"بحث","help":"بحث في كل المواضيع"},"categories":{"title":"الفئات","title_in":"قسم - {{categoryName}}","help":"جميع المواضيع تتبع القسم"},"unread":{"title":"غير المقروءة","title_with_count":{"zero":"غير المقروءة ({{count}})","one":"غير المقروءة ({{count}})","two":"غير المقروءة ({{count}})","few":"غير المقروءة ({{count}})","many":"غير المقروءة ({{count}})","other":"غير المقروءة ({{count}})"},"help":"مواضيع أنت تشاهدها بمشاركات غير مقروءة ","lower_title_with_count":{"zero":"1 غير مقررء ","one":"1 غير مقروء","two":"{{count}} غير مقروء ","few":"{{count}} غير مقروء ","many":"{{count}} غير مقروء","other":"{{count}} غير مقروء"}},"new":{"lower_title_with_count":{"zero":"لا جديد","one":"1 جديد","two":"{{count}} جديد","few":"{{count}} جديد","many":"{{count}} جديد","other":"{{count}} جديد"},"lower_title":"جديد","title":"الجديدة","title_with_count":{"zero":"الجديدة ({{count}})","one":"الجديدة ({{count}})","two":"الجديدة ({{count}})","few":"الجديدة ({{count}})","many":"الجديدة ({{count}})","other":"الجديدة ({{count}})"},"help":"مواضيع جديد في الايام السابقة"},"posted":{"title":"مشاركاتي","help":"مواضيع شاركت بها "},"bookmarks":{"title":"المفضلة","help":"مواضيع قمت بتفضيلها"},"category":{"title":"{{categoryName}}","title_with_count":{"zero":"{{categoryName}} ({{count}})","one":"{{categoryName}} ({{count}})","two":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"آخر المواضيع في  {{categoryName}} قسم"},"top":{"title":"أعلى","help":"أكثر المواضيع نشاطا خلال سنة, شهر, اسبوع او يوم","all":{"title":"كل الأوقات"},"yearly":{"title":"سنوي"},"quarterly":{"title":"فصليا"},"monthly":{"title":"شهري"},"weekly":{"title":"اسبوعي"},"daily":{"title":"يومي"},"all_time":"جميع الأوقات","this_year":"سنة","this_quarter":"ربع","this_month":"شهر","this_week":"أسبوع","today":"اليوم","other_periods":"مشاهدة الأفضل"}},"browser_update":"للأسف، \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eمتصفّحك قديم جدًّا ليعمل عليه هذا الموقع\u003c/a\u003e. من فضلك \u003ca href=\"http://browsehappy.com\"\u003eرقّه\u003c/a\u003e.","permission_types":{"full":"انشاء / رد / مشاهدة","create_post":"رد / مشاهدة","readonly":"مشاهدة"},"lightbox":{"download":"تحميل"},"search_help":{"title":"مساعدة البحث"},"keyboard_shortcuts_help":{"title":"اختصارات لوحة المفاتيح","jump_to":{"title":"الانتقال إلى","home":"\u003cb\u003eg\u003c/b\u003e، \u003cb\u003eh\u003c/b\u003e الرئيسية","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e الاحدث","new":"\u003cb\u003eg\u003c/b\u003e، \u003cb\u003en\u003c/b\u003e الجديد","unread":"\u003cb\u003eg\u003c/b\u003e، \u003cb\u003eu\u003c/b\u003e غير المقروء","categories":"\u003cb\u003eg\u003c/b\u003e، \u003cb\u003ec\u003c/b\u003e الفئات","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e الأعلى","bookmarks":"\u003cb\u003eg\u003c/b\u003e، \u003cb\u003eb\u003c/b\u003e العلامات","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e ملف التعريف","messages":"\u003cb\u003eg\u003c/b\u003e، \u003cb\u003em\u003c/b\u003e الرسائل"},"navigation":{"title":"التنقّل","jump":"\u003cb\u003e#\u003c/b\u003e الانتقال الى المشاركة #","back":"\u003cb\u003eu\u003c/b\u003e العودة","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e نقل المحدد \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e أو \u003cb\u003eEnter\u003c/b\u003e فتح الموضوع المحدد","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e القسم التالي/السابق"},"application":{"title":"التطبيقات","create":"\u003cb\u003ec\u003c/b\u003e كتابة موضوع جديد","notifications":"\u003cb\u003en\u003c/b\u003e فتح الإشعارات","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e فتح القائمة الرئيسية","user_profile_menu":"\u003cb\u003ep\u003c/b\u003eفتح قائمة المستخدم","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e عرض المواضيع المحدثة","search":"\u003cb\u003e/\u003c/b\u003e البحث","help":"\u003cb\u003e?\u003c/b\u003e فتح مساعدة لوحة المفاتيح","dismiss_new_posts":"تجاهل جديد / المشاركات \u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e تجاهل المواضيع","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e تسجيل خروج"},"actions":{"title":"إجراءات","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e تبديل علامة مرجعية الموضوع","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e تثبيت الموضوع أو إلغاء تثبيته","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e مشاركة الموضوع","share_post":"\u003cb\u003es\u003c/b\u003e مشاركة المشاركة","reply_as_new_topic":"الرد في موضوع مرتبط \u003cb\u003et\u003c/b\u003e","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e الرد على الموضوع","reply_post":"\u003cb\u003er\u003c/b\u003e الرد على المشاركة","quote_post":"\u003cb\u003eq\u003c/b\u003e اقتباس المشاركة","like":"\u003cb\u003el\u003c/b\u003e الإعجاب بالمشاركة","flag":"\u003cb\u003e!\u003c/b\u003e علم على المشاركة","bookmark":"\u003cb\u003eb\u003c/b\u003e أضف مرجعية للمشاركة","edit":"\u003cb\u003ee\u003c/b\u003e تعديل المشاركة","delete":"\u003cb\u003ed\u003c/b\u003e حذف المشاركة","mark_muted":"\u003cb\u003em\u003c/b\u003e، \u003cb\u003em\u003c/b\u003e كتم الموضوع","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e موضوع منظم (الإفتراضي)","mark_tracking":"\u003cb\u003em\u003c/b\u003e، \u003cb\u003et\u003c/b\u003e متابعة الموضوع","mark_watching":"\u003cb\u003em\u003c/b\u003e، \u003cb\u003ew\u003c/b\u003e مراقبة الموضوع"}},"badges":{"granted_on":"ممنوح في  %{date}","others_count":"اخرون بنفس الدرع (%{count})","title":"أوسمة","allow_title":"عنوان متوفر","multiple_grant":"يمكن منحه عدة مرات. ","select_badge_for_title":"حدد وسام لتستخدمه كعنوانك","none":"لا شئ","badge_grouping":{"getting_started":{"name":"البداية"},"community":{"name":"مجتمع"},"trust_level":{"name":"مستوى الثقة"},"other":{"name":"أخرى"},"posting":{"name":"نشر"}}},"google_search":"\u003ch3\u003eابحث باستخدام غوغل\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eغوغل\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"كل العلامات الوصفية","selector_all_tags":"كل العلامات الوصفية","selector_no_tags":"لا علامات وصفية ","changed":"العلامات الوصفية تم تغييرها:","tags":"العلامات الوصفية","choose_for_topic":"اختر علامات وصفية جديدة لهذه الموضوع","delete_tag":"حذف العلامة الوصفية","delete_confirm":"أمتأكد من حذف هذا الوسم؟","rename_tag":"اعادة تسمية العلامة الوصفية","rename_instructions":"اختر اسم جديد للعلامة الوصفية:","sort_by":"افرز ب‍:","sort_by_count":"العدد","sort_by_name":"الاسم","manage_groups":"تنظيم مجموعات العلامة الوصفية","manage_groups_description":"حدد المجموعات لتنظيم العلامات الوصفية","filters":{"without_category":"%{filter} %{category} مواضيع","with_category":"%{filter} %{category} مواضيع في","untagged_without_category":"مواضيع غير موسومة %{filter} ","untagged_with_category":"%{filter} مواضيع بدون بطاقة فى %{category}"},"notifications":{"watching":{"title":"مُراقب","description":"ستتابع بشكل تلقائي جديد هذه التصنيفات. سيتم إشعارك بكل مشاركة او موضوع، بالإضافة لذلك سيتم عرض عدد  المشاركات الغير مقروءة و الجديدة بجانب الموضوع."},"watching_first_post":{"title":"يُراقب فيه أول مشاركة","description":"سنرسل لك إشعارا فقط لأول مشاركة في كل موضوع جديد في هذه المجموعة."},"tracking":{"title":"مُتابع","description":"ستتابع آليا كل مواضيع هذا الوسم. سيظهر عدّاد للمشاركات غير المقروءة والجديدة بجانب الموضوع."},"regular":{"title":"موضوع عادي","description":".سيتم إشعارك إذا ذكر أحد ما اسمك أو رد على مشاركاتك"},"muted":{"title":"مكتوم","description":"لن يتم إشعارك بأي جديد يخص هذا الموضوع ولن يظهرهذا الموضوع في تبويب المواضيع الغير مقروءة."}},"groups":{"title":"مجموعات العلامات الوصفية","about":"اضف علامات وصفية للمجموعات ليسهل عليك ادارتها","new":"مجموعة جديدة","tags_label":"علامات وصفية في هذه المجموعة:","parent_tag_label":"التصنيف الأب","parent_tag_placeholder":"اختياري","parent_tag_description":"العلامات الوصفية في هذه المجموعة لايمكن استخدامها الا في حالة وجود العلامة الوصفية الأساسية ","one_per_topic_label":"اختر علامة وصفية واحدة لكل موضوع من هذه المجموعة","new_name":"مجموعة علامة وصفية جديدة","save":"حفظ","delete":"حذف","confirm_delete":"أمتأكد من حذف هذا الوسم؟"},"topics":{"none":{"unread":"ليست هناك مواضيع غير مقروءة.","new":"ليست هناك مواضيع جديدة.","read":"لم تقرأ أيّ موضوع بعد.","posted":"لم تشارك في أيّ موضوع بعد.","latest":"ليست هناك مواضيع حديثة.","hot":"لا يوجد المزيد من المواضيع النشطة","bookmarks":"ليس لديك مواضيع في المفضلة.","top":"لا يوجد المزيد من المواضيع العليا","search":"ليست هناك نتائج للبحث."},"bottom":{"latest":"ليست هناك مواضيع حديثة أخرى.","hot":"لا يوجد المزيد من المواضيع النشطة","posted":"لا يوجد مواضيع أخرى.","read":"ليست هناك مواضيع مقروءة أخرى.","new":"ليست هناك مواضيع جديدة أخرى.","unread":"ليست هناك مواضيع غير مقروءة أخرى.","top":"لقد اطلعت على كل المواضيع المميزة حتى هذه اللحظة.","bookmarks":"لايوجد المزيد من المواضيع في المفضلة","search":"ليست هناك نتائج بحث أخرى."}}},"invite":{"custom_message":"اجعل دعوتك اكثر خصوصية  بكتابة","custom_message_link":"رسالة مخصصة","custom_message_placeholder":"ادخل رسالتك المخصصة","custom_message_template_forum":"اهلا, يمكنك المشاركة في هذا المنتدى!","custom_message_template_topic":"اهلا, اظن انك ستستمتع يهذا الموضوع!"},"poll":{"voters":{"zero":"لا أحد صوّت","one":"واحد صوّت","two":"إثنان صوّتا","few":"صوّتوا","many":"صوّتوا","other":"صوّتوا"},"average_rating":"متوسط التقييمات: \u003cstrong\u003e%{average}\u003c/strong\u003e ","public":{"title":"الأصوات تظهر للعموم."},"multiple":{"help":{"at_least_min_options":{"zero":"لا تختر شيئا","one":"اختر خيارًا واحدًا على الأقل","two":"اختر خيارين إثنين على الأقل","few":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارات على الأقل","many":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارا على الأقل","other":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيار على الأقل"},"up_to_max_options":{"zero":"لا تختر شيئا","one":"اختر خيارا \u003cstrong\u003eواحدا\u003c/strong\u003e","two":"اختر ما حدّه \u003cstrong\u003eخيارين\u003c/strong\u003e","few":"اختر ما حدّه \u003cstrong\u003e%{count}\u003c/strong\u003e خيارات","many":"اختر ما حدّه \u003cstrong\u003e%{count}\u003c/strong\u003e خيارا","other":"اختر ما حدّه \u003cstrong\u003e%{count}\u003c/strong\u003e خيار"},"x_options":{"zero":"لا تختر شيئا","one":"اختر خيار \u003cstrong\u003eواحد\u003c/strong\u003e","two":"اختر \u003cstrong\u003eخيارين\u003c/strong\u003e","few":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارات","many":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارا","other":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيار"},"between_min_and_max_options":"اختر بين \u003cstrong\u003e%{min}\u003c/strong\u003e و \u003cstrong\u003e%{max}\u003c/strong\u003e خيارات"}},"cast-votes":{"title":"أدلِ بصوتك","label":"صوّت اﻵن!"},"show-results":{"title":"اعرض نتائج التصويت","label":"أظهر النتائج"},"hide-results":{"title":"عُد إلى أصواتك","label":"أخفِ النتائج"},"open":{"title":"افتح التّصويت","label":"افتح","confirm":"أمتأكد من فتح هذا التّصويت؟"},"close":{"title":"أغلق التّصويت","label":"أغلق","confirm":"أمتأكد من إغلاق هذا التّصويت؟"},"error_while_toggling_status":"آسفون، حدثت مشكلة في تبديل حالة هذا التّصويت.","error_while_casting_votes":"آسفون، حدث خطأ في الإدلاء بأصواتك.","error_while_fetching_voters":"آسفون، حدث خطأ في عرض المصوّتين.","ui_builder":{"title":"ابنِ تصويتا","insert":"أدرج التصويت","help":{"options_count":"أدخل خيارين على الأقل"},"poll_type":{"label":"النوع","regular":"اختيار من متعدد","multiple":"عدّة خيارات","number":"تقييم عددي"},"poll_config":{"max":"الأقصى","min":"الأدنى","step":"الخطوة"},"poll_public":{"label":"أظهر المصوّتون"},"poll_options":{"label":"أدخل خيارًا واحدًا في كل سطر"}}},"type_to_filter":"اكتب لتصفية","admin":{"title":"مدير المجتمع","moderator":"مراقب","dashboard":{"title":"داشبورد","last_updated":"أخر تحديث للوحة التحكم:","version":"الاصدار","up_to_date":"لديك أحدث إصدارة!","critical_available":"يتوفّر تحديث لمشاكل حرجة.","updates_available":"التحديثات متوفرة.","please_upgrade":"من فضلك رقّ البرمجية!","no_check_performed":"لم يتم التحقق من التحديثات. اضمن أن sidekiq يعمل.","stale_data":"لم يتم التحقق من التحديثات مؤخراً. اضمن أن sidekiq يعمل.","version_check_pending":"يبدو أنك رُقيت مؤخرا. رائع!","installed_version":"مثبّت","latest_version":"آخر","problems_found":"يوجد بعض المشاكل عند تثبيت Discourse :","last_checked":"آخر فحص","refresh_problems":"تحديث","no_problems":"لم يتم العثور على اي مشاكل.","moderators":"المشرفون:","admins":"مدراء:","blocked":"محظور:","suspended":"موقوف:","private_messages_short":"الرسائل","private_messages_title":"الرسائل","mobile_title":"متنقل","space_free":"{{size}} حرّ","uploads":"عمليات الرفع","backups":"النسخ الاحتياطية","traffic_short":"المرور","traffic":"طلبات تطبيقات الويب","page_views":"طلبات API ","page_views_short":"طلبات API ","show_traffic_report":"عرض تقرير مرور مفصل","reports":{"today":"اليوم","yesterday":"امس","last_7_days":"اخر ٧ ايام ","last_30_days":"اخر ٣٠ يوم","all_time":"كل الوقت","7_days_ago":"منذ ٧ ايام","30_days_ago":"منذ ٣٠ يوم","all":"الكل","view_table":"جدول","view_graph":"شكل رسومي","refresh_report":"تحديث التقرير ","start_date":"تاريخ البدء","end_date":"تاريخ الإنتهاء","groups":"جميع الفئات"}},"commits":{"latest_changes":"آخر تغيير: يرجى التحديث","by":"بواسطة"},"flags":{"title":"التبليغات","old":"قديم","active":"نشط","agree":"أوافق","agree_title":"أكد هذا البلاغ لكونه صحيح وصالح","agree_flag_modal_title":"أوافق مع ...","agree_flag_hide_post":"اوافق (اخفاء المشاركة + ارسال ر.خ)","agree_flag_hide_post_title":"أخفي هذه المشاركة وَ تلقائيا بإرسال رسالة للمستخدم وحثهم على تحريرها","agree_flag_restore_post":"موافق (استعادة المشاركة)","agree_flag_restore_post_title":"استعد هذه المشاركة.","agree_flag":"الموافقه على التبليغ","agree_flag_title":"الموافقة مع التَعَلّيم وحفظ المشاركة دون تغيير.","defer_flag":"تأجيل","defer_flag_title":"إزالة البلاغ، لا يتطلب منك إجراء في الوقت الحالي.","delete":"حذف","delete_title":"حذف المشاركة المرتبطة بهذا البلاغ","delete_post_defer_flag":"حذف المشاركة مع تأجيل البلاغ","delete_post_defer_flag_title":"حذف المشاركة. اذا كانت المشاركة الاولى, احذف الموضوع","delete_post_agree_flag":"حذف المشاركة مع الموافقة على البلاغ","delete_post_agree_flag_title":"حذف المشاركة. اذا كانت المشاركة الاولى, احذف الموضوع","delete_flag_modal_title":"حذف مع ...","delete_spammer":"احذف ناشر السخام","delete_spammer_title":"احذف المستخدم مع مشاركاته ومواضيعه.","disagree_flag_unhide_post":"أختلف مع البلاغ، إعادة إظهار المشاركة.","disagree_flag_unhide_post_title":"حذف أي بلاغ يخص هذه المشاركة مع إظهارها مرة أخرى","disagree_flag":"أختلف","disagree_flag_title":"رفض هذا البلاغ لكونه خاطئ","clear_topic_flags":"إتمام العملية","clear_topic_flags_title":"تم فحص الموضوع وحل المشاكل المتعلقة به. إضغط على إتمام العملية لحذف هذه البلاغات.","more":"ردود أكثر...","dispositions":{"agreed":"متفق","disagreed":"أختلف","deferred":"مؤجل"},"flagged_by":"مُبلّغ عنه بواسطة","resolved_by":"تم حلّه بواسطة","took_action":"اجريت العمليات","system":"النظام","error":"حدث خطأ ما","reply_message":"الرد","no_results":"لا يوجد بلاغات.","topic_flagged":"هذا  \u003cstrong\u003eالموضوع\u003c/strong\u003e قد عُلِّم.","visit_topic":"زيارة الموضوع لاتخاذ قرار","was_edited":"تم تعديل المشاركة بعد أول بلاغ","previous_flags_count":"هذه المشاركة قد سبق الإشارة إليها {{count}} مرات.","summary":{"action_type_3":{"zero":"خارج عن الموضوع","one":"خارج عن الموضوع","two":"خارج عن الموضوع x{{count}}","few":"خارج عن الموضوع x{{count}}","many":"خارج عن الموضوع x{{count}}","other":"خارج عن الموضوع x{{count}}"},"action_type_4":{"zero":"غير ملائم","one":"غير ملائم","two":"غير ملائم x{{count}}","few":"غير ملائم x{{count}}","many":"غير ملائم x{{count}}","other":"غير ملائم x{{count}}"},"action_type_6":{"zero":"مخصص","one":"مخصص","two":"مخصص x{{count}}","few":"مخصص x{{count}}","many":"مخصص x{{count}}","other":"مخصص x{{count}}"},"action_type_7":{"zero":"مخصص","one":"مخصص","two":"مخصص x{{count}}","few":"مخصص x{{count}}","many":"مخصص x{{count}}","other":"مخصص x{{count}}"},"action_type_8":{"zero":"رسائل مزعجة","one":"رسائل مزعجة","two":"رسائل مزعجة x{{count}}","few":"رسائل مزعجة x{{count}}","many":"رسائل مزعجة x{{count}}","other":"رسائل مزعجة x{{count}}"}}},"groups":{"primary":"المجموعة الأساسية","no_primary":"(لايوجد مجموعة أساسية)","title":"مجموعات","edit":"تعديل المجموعة","refresh":"تحديث","new":"جديد","selector_placeholder":"أدخل اسم المستخدم","name_placeholder":"اسم المجموعة, بدون مسافة, مثل قاعدة اسم المستخدم","about":"هنا عدّل على عضوية المجموعة والاسماء","group_members":"اعضاء المجموعة","delete":"حذف","delete_confirm":"أأحذف هذه المجموعة؟","delete_failed":"تعذّر حذف المجموعة. إن كانت مجموعة آليّة، فلا يمكن تدميرها.","delete_member_confirm":"أأزيل '%{username}' من المجموعة '%{group}'؟","delete_owner_confirm":"هل تريد إزالة صلاحيات الإدارة من '%{username} ؟","name":"الاسم","add":"اضافة","add_members":"اضافة عضو","custom":"مخصص","bulk_complete":"أُضيف المستخدمون إلى المجموعة.","bulk":"اضافة بالجملة للمجموعة","bulk_paste":"ألصق قائمة لأسماء المستخدم أو عناوين البريد، واحد في كل سطر:","bulk_select":"(اختر مجموعة)","automatic":"تلقائي","automatic_membership_email_domains":"المستخدمين الذين يمتلكون بريد الالكتروني عنوانه مطابق للعنوان الذي في القائمة سيتم تلقائيا اضافتهم للمجموعة.","automatic_membership_retroactive":"اضافة الاعضاء الذين يمتكلون عنوان ايميل مطابق للعنوان الموجود في القائمة.","default_title":"عنوان افتراضي لكل أعضاء هذه المجموعة.","primary_group":"تلقيائاً ضعها كمجموعة أساسية.","group_owners":"الملّاك","add_owners":"اضف ملّاكً","incoming_email":"تعيين بريد إلكتروني خاص:","incoming_email_placeholder":"يرجى إدخال بريد الكتروني فعّال."},"api":{"generate_master":"توليد مفتاح  API رئيسى","none":"لا يوجد مفاتيح API مفعلة اﻷن.","user":"مستخدمين","title":"API","key":"مفتاح API","generate":"إنشاء","regenerate":"إعادة إنشاء","revoke":"الغاء","confirm_regen":"هل أنت متأكد من استبدال مفتاح الAPI بالمفتاح الجديد ؟","confirm_revoke":"هل أنت متأكد من رغبتك في تعطيل هذا المفتاح؟","info_html":"مفتاح API الخاص بك سيسمح لك بانشاء أو تعديل مواضيع باستخدام أليات رسائل JSON.","all_users":"جميع المستخدمين","note_html":"حافظ على \u003cstrong\u003eسرية\u003c/strong\u003e هذا المفتاح، اي شخص يحصل عليه يستطيع انشاء مواضيع باسم اي مستخدم اخر"},"plugins":{"title":"اضافات","installed":"اضافات مثيته","name":"الاسم","none_installed":"لاتملك اي اضافة مثبته","version":"الاصدار","enabled":"مفعل؟","is_enabled":"Y","not_enabled":"N","change_settings":"تغيير الاعدادت","change_settings_short":"الاعدادات","howto":"كيف اثبت اضافة؟"},"backups":{"title":"نسخة احتياطية","menu":{"backups":"نسخة احتياطية","logs":"Logs"},"none":"لا نسخ احتياطية.","read_only":{"enable":{"title":"فعّل وضع القراءة فقط","label":"فعّل القراءة فقط","confirm":"أمتأكد من تفعيل وضع القراءة فقط؟"},"disable":{"title":"عطّل وضع القراءة فقط","label":"عطّل القراءة فقط"}},"logs":{"none":"لا سجلات بعد..."},"columns":{"filename":"اسم الملف","size":"حجم"},"upload":{"label":"رفع","title":"رفع نسخة احتياطية لهذه الحالة.","uploading":"يرفع...","success":"رُفع '{{filename}}' بنجاح.","error":"حصلت مشكلة أثناء رفع '{{filename}}': {{message}}"},"operations":{"is_running":"هناك عملية مازالت تعمل ...","failed":"الـ {{operation}} فشلت. الرجاء التحقق من logs.","cancel":{"label":"إلغاء","title":"الغاء العملية الحالية","confirm":"أمتأكد من إلغاء العملية الحالية؟"},"backup":{"label":"نسخة احتياطية","title":"انشاء نسخة احتياطية","confirm":"هل تريد انشاء نسخة احتياطية جديدة ؟","without_uploads":"نعم (لا تضمن الملفات)"},"download":{"label":"تحميل","title":"تحميل النسخة الاحتياطية"},"destroy":{"title":"حذف النسخة الاحتياطية","confirm":"هل أنت متأكد من رغبتك في حذف النسخة الاحتياطية؟"},"restore":{"is_disabled":"الاستعادة معطّلة في إعدادات الموقع.","label":"استعادة","title":"اعادة تخزين النسخة الاحتياطية","confirm":"هل انت متاكد انك تريد استعاده هذه النسخه الاحتياطيه؟"},"rollback":{"label":"اعادة السنخة السابقة","title":"Rollback the database to previous working state","confirm":"هل انت متاكد انك تريد اعاده قواعد البيانات الى الحاله السابقه؟"}}},"export_csv":{"user_archive_confirm":"هل أنت متأكد من رغبتك في تحميل جميع مشاركاتك ؟","success":"بدأ التصدير, سيتم إعلامك برسالة عند اكتمال العملية.","failed":"فشل التصدير. من فضلك افحص السجلات.","rate_limit_error":"المشاركات يمكن تحميلها لمرة واحدة في اليوم , الرجاء المحاولة غدا.","button_text":"التصدير","button_title":{"user":"تصدير قائمة المستخدمين على شكل CSV","staff_action":"تصدير قائمة الموظفين على شكل CSV.","screened_email":"Export full screened email list in CSV format.","screened_ip":"Export full screened IP list in CSV format.","screened_url":"Export full screened URL list in CSV format."}},"export_json":{"button_text":"تصدير"},"invite":{"button_text":"ارسال دعوات","button_title":"ارسال دعوات"},"customize":{"title":"تخصيص","long_title":"تخصيص الموقع","css":"CSS","header":"Header","top":"Top","footer":"تذييل ","embedded_css":"تضمين CSS","head_tag":{"text":"\u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e"},"enabled":"مفعل؟","preview":"معاينة","undo_preview":"ازالة المعاينة","rescue_preview":"الشكل الافتراضي","explain_preview":"مشاهدة الموقع بهذا الشكل المخصص","explain_undo_preview":"الرجوع الى الشكل السابق","explain_rescue_preview":"مشاهدة الموقع بالشكل الافتراضي","save":"حفظ","new":"جديد","new_style":"تصميم جديد","import":"استيراد","import_title":"حدد ملف او انسخ نص","delete":"حذف","delete_confirm":"حذف هذا التخصيص؟","copy":"نسخ","email_templates":{"title":"قالب البريد الالكتروني ","subject":"الموضوع","multiple_subjects":"قالب البريد الإلكتروني هذا لديه موضوعات متعددة.","body":"المحتوى","none_selected":"اختر قالب بريد الكتروني لتبدا بتعديله ","revert":"اعاده التغيرات ","revert_confirm":"هل انت متاكد من انك تريد اعاده التغيرات؟ "},"colors":{"title":"اللون","long_title":"نمط الألوان","new_name":"نمط ألوان جديد","copy_name_prefix":"نسخة من","delete_confirm":"حذف جميع الالوان؟","undo":"تراجع","undo_title":"التراجع عن تغيير اللن الى اللون السابق","revert":"تراجع","revert_title":"اعادة ضبط اللون الى اللون الافتراضي للموقع","primary":{"name":"اساسي"},"secondary":{"name":"ثانوي","description":"اللون الاساسي للخلفية, والنص للايقونة"},"tertiary":{"name":"ثلاثي","description":"الروابط، الأزرار، الإشعارات و أشياء أخرى."},"quaternary":{"name":"رباعي","description":"الروابط"},"header_background":{"name":"خلفية رأس الصفحة","description":"لون الخلفية لرأس الصفحة الخاصة بالموقع"},"header_primary":{"name":"رأس الصفحة الأساسي","description":"لون و أيقونات رأس الصفحة الخاصة بالموقع."},"highlight":{"name":"تحديد","description":"لون خلفية النصوص و العناصر المحددة في جسم الصفحة مثل المشاركات و المواضيع."},"danger":{"name":"خطر","description":"لون  بعض الأوامر مثل حذف المشاركات و المواضيع"},"success":{"name":"نجاح","description":"يستخدم لإظهار نجاح عملية ما."},"love":{"name":"إعجاب","description":"لون زر الإعجاب."}}},"email":{"title":"رسائل البريد الالكتروني","settings":"اعدادات","templates":"نماذج","preview_digest":"ملخص المعاينة.","sending_test":"إرسال بريد إلكتروني للتجربة...","error":"\u003cb\u003eخطأ\u003c/b\u003e - %{server_error}","test_error":"حدث خطأ أثناء إرسال رسالة تجريبية. الرجاء فحص إعدادات البريد الإلكتروني و التأكد من أن الاستضافة لا تمنع مرور البريد الإلكتروني والمحاولة مرة أخرى.","sent":"تم الإرسال","skipped":"تم التجاوز","bounced":"مروج","received":"وارد","rejected":"مرفوض","sent_at":"أرسلت في","time":"الوقت","user":"المستخدم","email_type":"نوع البريد الكتروني","to_address":"الى العناوين","test_email_address":"عنوان البريد الكتروني للتجربة","send_test":"ارسل رسالة تجربة","sent_test":"اٌرسلت!","delivery_method":"طريقة التسليم","preview_digest_desc":"معاينة محتوى رسائل البريد الإلكتروني الملخص المرسلة للأعضاء الغير متاحين.","refresh":"تحديث","format":"التنسيق","html":"html","text":"نص","last_seen_user":"آخر مستخدم تواجد:","reply_key":"مفتاح الرد","skipped_reason":"تجاوز السبب","incoming_emails":{"from_address":"من","to_addresses":"الى","cc_addresses":"Cc","subject":"موضوع","error":"خطأ","none":"لا يوجد بريد وارد","modal":{"title":"تفاصيل الرسائل الوارده","error":"خطأ","headers":"رؤوس","subject":"الموضوع","body":"المحتوى","rejection_message":"البريد المحظور"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"موضوع...","error_placeholder":"خطأ"}},"logs":{"none":"لا يوجد سجلات.","filters":{"title":"المنقي","user_placeholder":"اسم المستخدم","address_placeholder":"name@example.com","type_placeholder":"الخلاصة، إنشاء حساب...","reply_key_placeholder":"مفتاح الرد","skipped_reason_placeholder":"السبب"}}},"logs":{"title":"سجلات","action":"عملية","created_at":"مكتوبة","last_match_at":"اخر تطابق","match_count":"تطابقات","ip_address":"IP","topic_id":"رقم معرّف الموضوع","post_id":"رقم المشاركة","category_id":"معرف الفئة","delete":"حذف","edit":"تعديل","save":"حفظ","screened_actions":{"block":"حظر","do_nothing":"لا تفعل شيء"},"staff_actions":{"title":"عمليات المشرفين","instructions":"إضغط على أسماء الإعضاء والإجراءات لتصفيه القائمة . إضغط على صورة العرض للإنتقال لصفحة العضو","clear_filters":"إظهار كل شيء","staff_user":"عضو  إداري","target_user":"عضو مستهدف","subject":"الموضوع","when":"متى","context":"السياق","details":"التفاصيل","previous_value":"معاينة","new_value":"جديد","diff":"الاختلافات","show":"إظهار","modal_title":"التفاصيل","no_previous":"لا يوجد قيمة سابقة.","deleted":"لايوجد قيمة جديدة , السجل قد حذف","actions":{"delete_user":"حذف المستخدم","change_trust_level":"تغيير مستوى الثقة","change_username":"تغيير اسم المستخدم","change_site_setting":"تغيير اعدادات الموقع","change_site_customization":"تخصيص الموقع","delete_site_customization":"حذف هذا التخصيص؟","change_site_text":"تغيير نص الموقع.","suspend_user":"حظر المستخدم","unsuspend_user":"رفع الحظر ","grant_badge":"منح شارة","revoke_badge":"حذف الشعار","check_email":"التحقق من البريد","delete_topic":"احذف الموضوع","delete_post":"حذف المشاركة","impersonate":"إنتحال","anonymize_user":"مستخدم مجهول","roll_up":"عناوين IP المتغيرة المحظورة","change_category_settings":"تغيير إعدادات الفئة","delete_category":"حذف الفئة","create_category":"أنشئ فئة","block_user":"حظر","unblock_user":"رفع الحظر","grant_admin":"منح صلاحيات ادارية","revoke_admin":"سحب الصلاحيات الادارية","grant_moderation":"عين كمشرف","revoke_moderation":"سحب صلاحيات المشرف","backup_operation":"عمليه النسخ الاحتياطي","deleted_tag":"علامة وصفية محذوفة","renamed_tag":"اعادة تسمية العلامة الوصفية","revoke_email":"حذف البريد الالكتروني"}},"screened_emails":{"title":"عناوين بريد إلكتروني محجوبة.","description":"عندما يحاول أحدهم إنشاء حساب جديد، ستُفحص عناوين البريد الإلكتروني وسيُمنع التسجيل إن تطابق إحداها، أو أن يُتّخذ أي إجراء آخر.","email":"قائمة البريد الالكتروني","actions":{"allow":"سماح"}},"screened_urls":{"title":"عناوين مواقع محجوبة","description":"الروابط الالكترونية الموجودة هنا تم استخدامها في مشاركات  من قيل مستخدمين سبام ","url":"رابط","domain":"عنوان"},"screened_ips":{"title":"عناوين IP محجوبة","description":"عناوين IP التي شوهدت. أستخدم \"اسمح\" لإضافة عناوين IP للقائمة البيضاء.","delete_confirm":"هل أنت متأكد أنك تريد إزالة القاعدة لـ %{ip_address} ؟","roll_up_confirm":"هل أنت متأكد أنك تريد تغيير مصفي عناوين IP الشائعة إلى الشبكات الفرعية ؟","rolled_up_some_subnets":"تم بنجاح حظر IP متغير يدخل إلى هذه الشبكات الفرعية : %{subnets}.","actions":{"block":"حظر","do_nothing":"سماح","allow_admin":"سماح المدير"},"form":{"label":"جديد:","ip_address":"عناوين الIP","add":"اضافة","filter":"بحث"},"roll_up":{"text":"متغير","title":"أنشئ مدخلات فرعية جديدة إذا كانت هذه على الأقل مدخلات 'min_ban_entries_for_roll_up'."}},"logster":{"title":"سجلات الخطأ."}},"impersonate":{"title":"انتحال الشخصية","help":"استخدم هذه الأداة لانتحال شخصية حساب مستخدم لأغراض التصحيح. سيتم تسجيل خروجك عندما تنتهي.","not_found":"تعذر إيجاد المستخدم.","invalid":"عذراً , لايمكنك تمثل شخصية ذلك العضو."},"users":{"title":"مستخدمين","create":"اضافة مدير","last_emailed":"آخر بريد الكتروني","not_found":"آسفون، اسم هذا المستخدم غير موجود في النظام.","id_not_found":"آسفون، معرّف هذا المستخدم غير موجود في النظام.","active":"نشط","show_emails":"عرض الرسائل","nav":{"new":"جديد","active":"نشط","pending":"قيد الانتظار","staff":"الإدارة","suspended":"موقوف","blocked":"محظور","suspect":"مريب"},"approved":"موافقة؟","approved_selected":{"zero":"وافق المستخدم","one":"وافق المستخدم","two":" وافق المستخدمين ({{count}})","few":" وافق المستخدمين ({{count}})","many":" وافق المستخدمين ({{count}})","other":" وافق المستخدمين ({{count}})"},"reject_selected":{"zero":"رفض المستخدمين","one":"رفض المستخدم","two":"رفض المستخدمين ({{count}})","few":"رفض المستخدمين ({{count}})","many":"رفض المستخدمين ({{count}})","other":"رفض المستخدمين ({{count}})"},"titles":{"active":"مستخدمين نشطين","new":"مستخدمين جدد ","pending":"أعضاء بانتظار المراجعة","newuser":"أعضاء في مستوى الثقة 0 (عضو جديد)","basic":"أعضاء في مستوى الثقة 1 (عضو أساسي)","member":"الاعضاء في مستوى الثقة رقم 2 (أعضاء)","regular":"الاعضاء في مستوى الثقة رقم 3 (عاديين)","leader":"الاعضاء في مستوى الثقة رقم 4 (قادة)","staff":"طاقم","admins":"مستخدمين مدراء","moderators":"المشرفون","blocked":"مستخدمين محظورين:","suspended":"أعضاء موقوفين","suspect":"أعضاء مريبين"},"reject_successful":{"zero":"رفض بنجاح 1 مستخدم","one":"رفض بنجاح 1 مستخدم","two":"رفض بنجاح %{count} مستخدمين.","few":"رفض بنجاح %{count} مستخدمين.","many":"رفض بنجاح %{count} مستخدمين.","other":"رفض بنجاح %{count} مستخدمين."},"reject_failures":{"zero":"فشل لرفض 1 مستخدم.","one":"فشل لرفض 1 مستخدم.","two":"فشل لرفض %{count} مستخدمين.","few":"فشل لرفض %{count} مستخدمين.","many":"فشل لرفض %{count} مستخدمين.","other":"فشل لرفض %{count} مستخدمين."},"not_verified":"لم يتم التحقق","check_email":{"title":"اظهار عوان البريد الالكتروني لهذا العضو.","text":"إظهار"}},"user":{"suspend_failed":"حدث خطأ ما أوقف هذا المستخدم {{error}}.","unsuspend_failed":"حدث خطأ ما لم يوقف هذا المستخدم {{error}}.","suspend_duration":"كم هي مدة تعلّيق العضو ؟","suspend_duration_units":"(أيام)","suspend_reason_label":"لماذا هل أنت عالق؟ هذا النص \u003cb\u003eسيكون ظاهراً للكل\u003c/b\u003e على صفحة تعريف هذا العضو, وسيكون ظاهراً للعضو عندما يحاول تسجل الدخول. احفظها قصيرة.","suspend_reason":"سبب","suspended_by":"محظور من قبل","delete_all_posts":"حذف جميع المشاركات","suspend":"علّق","unsuspend":"إلقاء التعليق","suspended":"معلّق؟","moderator":"مراقب؟","admin":"مدير؟","blocked":"محظور؟","staged":"تنظيم؟","show_admin_profile":"مدير","edit_title":"تعديل العنوان","save_title":"حفظ العنوان","refresh_browsers":"تحديث المتصفحات اجبارياً","refresh_browsers_message":"الرسالة أُرسلت إلى كل الأعضاء!","show_public_profile":"عرض الملف العام.","impersonate":"انتحال شخصية","ip_lookup":"جدول \"IP\"","log_out":"تسجيل الخروج","logged_out":"أخرجنا العضو من كل أجهزته","revoke_admin":"سحب الإدارة","grant_admin":"منحة إدارية","revoke_moderation":"سحب المراقبة","grant_moderation":"منحة مراقبة","unblock":"إلغاء حظر","block":"حظر","reputation":"شهرة","permissions":"صلاحيات","activity":"أنشطة","like_count":"الإعجابات المعطاة / المستلمة","last_100_days":"في آخر 100 يوم","private_topics_count":"موضوع خاص","posts_read_count":"المشاركات المقروءة","post_count":"المشاركات المنشأة","topics_entered":"المواضيع المشاهدة","flags_given_count":"مبلغ عنه","flags_received_count":"تم إستلام بلاغ","warnings_received_count":"تحذيرات مستلمه","flags_given_received_count":"تم التبليغ ","approve":"تصديق","approved_by":"مصدق بواسطة","approve_success":"تم تسجيل العضوية  و إرسال رسالة الى بريد العضو  بتعليمات التفعيل ","approve_bulk_success":"تم ! جميع الأعضاء المحددين تم توثيقهم وتنبيهم ","time_read":"وقت القراءة","anonymize":"مستخدم مجهول","anonymize_confirm":"هل أنت متأكد أنك تريد هذا الحساب مجهول؟ هذا سيغير اسم المستخدم والبريد الإلكتروني، ويعيد تعين كل معلومات ملف التعريف.","anonymize_yes":"نعم، أخفي هذا الحساب.","anonymize_failed":"كانت هناك مشكلة من حساب مجهول المصدر","delete":"حذف المستخدم","delete_forbidden_because_staff":"لا يمكن حذف المدراء والمشرفين.","delete_posts_forbidden_because_staff":"لا يمكن حذف جميع المشاركات للمدراء والمشرفين.  ","delete_forbidden":{"zero":"لا يمكن حذف الأعضاء إذا كان لديهم مشاركات. احذف جميع المشاركات قبل المحاولة بحذف العضو.","one":"لا يمكن للأعضاء الحذف إذا كان لديهم مشاركات. احذف جميع المشاركات قبل المحاولة بحذف العضو. (المشاركات الأقدم من يوم لا يمكن حذفها.)","two":"لا يمكن حذف الأعضاء إذا كان لديهم مشاركات. احذف جميع المشاركات قبل المحاولة بحذف العضو. (المشاركات الأقدم من يومين لا يمكن حذفها.)","few":"لا يمكن حذف الأعضاء إذا كان لديهم مشاركات. احذف جميع المشاركات قبل المحاولة بحذف العضو.\n(المشاركات الأقدم من أيام قليلة لا يمكن حذفها.)","many":"لا يمكن حذف الأعضاء إذا كان لديهم مشاركات. احذف جميع المشاركات قبل المحاولة بحذف العضو. (المشاركات الأقدم من أيام %{كثيرة} لا يمكن حذفها.)","other":"لا يمكن للأعضاء الحذف إذا كان لديهم مشاركات. احذف جميع المشاركات قبل المحاولة بحذف العضو. (المشاركات الأقدم من %{count} أيام لا يمكن حذفها.)"},"cant_delete_all_posts":{"zero":"لا تستطيع حذف جميع المشاركات. (The delete_user_max_post_age setting.)","one":"لا تستطيع حذف جميع المشاركات. بعض المشاركات أقدم من يوم. (The delete_user_max_post_age setting.)","two":"لا تستطيع حذف جميع المشاركات. بعض المشاركات أقدم من يومين. (The delete_user_max_post_age setting.)","few":"لا تستطيع حذف جميع المشاركات. بعض المشاركات أقدم من أيام قليلة. (The delete_user_max_post_age setting.)","many":"لا تستطيع حذف جميع المشاركات. بعض المشاركات أقدم من أيام %{كثيرة}. (The delete_user_max_post_age setting.)","other":"لا تستطيع حذف جميع المشاركات. بعض المشاركات أقدم من %{count} أيام. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"zero":"لا يمكن مسح كل المشاركات لأن العضو لديه أكثر من %{count} مشاركة.\n(delete_all_posts_max)","one":"لا يمكن مسح كل المشاركات لأن العضو لديه أكثر من %{count} مشاركة.\n(delete_all_posts_max)","two":"لا يمكن مسح كل المشاركات لأن العضو لديه أكثر من %{count} مشاركتين.\n(delete_all_posts_max)","few":"لا يمكن مسح كل المشاركات لأن العضو لديه أكثر من %{count} مشاركات.\n(delete_all_posts_max)","many":"لا يمكن مسح كل المشاركات لأن العضو لديه أكثر من %{count} مشاركة.\n(delete_all_posts_max)","other":"لا يمكن مسح كل المشاركات لأن العضو لديه أكثر من %{count} مشاركة.\n(delete_all_posts_max)"},"delete_confirm":"أمتأكّد من حذف هذا المستخدم؟ لا عودة في هذا!","delete_and_block":"احذفه و\u003cb\u003eامنع\u003c/b\u003e بريده وعنوان IP","delete_dont_block":"فقط احذفه","deleted":"حُذف المستخدم.","delete_failed":"حدث خطأ في حذف المستخدم. تأكد من أن كل مشاركاته محذوفة قبل حذفه.","send_activation_email":"ارسل رسالة تفعيل","activation_email_sent":"تم ارسال رسالة التفعيل الى البريد.","send_activation_email_failed":"حدث خطأ عند محاولة ارسال رسالة تفعيل مرّة أخرى. %{error}","activate":"تفعيل الحساب","activate_failed":"حدث خطأ عند تفعيل هذا المستخدم.","deactivate_account":"تعطيل الحساب","deactivate_failed":"حدث خطأ عند تعطيل هذا المستخدم.","unblock_failed":"حدث خطأ عند الغاء حظر هذا المستخدم.","block_failed":"حدث خطأ عند حظر هذا المستخدم.","block_confirm":"هل انت متأكد من حظر هذا المستخدم؟ لن يستطيع انشاء مواضيع او ردود جديدة","block_accept":"نعم, حظر هذا المستخدم","bounce_score":"سجل الترويج","reset_bounce_score":{"label":"اعادة تعيين","title":"اعادة تعيين سجل الترويج  الى 0"},"deactivate_explanation":"المستخدم الغير نشط يحب أن يتأكد من البريد الالكتروني","suspended_explanation":"المستخدم الموقوف لايملك صلاحية تسجيل الدخول","block_explanation":"المستخدم الموقوف لايستطيع أن يشارك","staged_explanation":"العضو المنظم يمكنه فقط النشر عن طريق البريد الالكتروني في المواضيع المخصصه .","bounce_score_explanation":{"none":"لا ترويجات تم استلامها من هذا البريد الالكتروني","some":"هناك بعض الترويجات تم استلامها مؤخرا من هذا البريد الالكتروني","threshold_reached":"تم استلام الكثير من الترويجات من هذا البريد الالكتروني"},"trust_level_change_failed":"هناك مشكلة في تغيير مستوى ثقة المستخدم ","suspend_modal_title":"حظر المستخدم","trust_level_2_users":"أعضاء مستوى الثقة 2.","trust_level_3_requirements":"متطلبات مستوى الثقة 3.","trust_level_locked_tip":"مستوى الثقة مغلق، والنظام لن يرقي أو سيخفض رتبة العضو.","trust_level_unlocked_tip":"مستوى الثقة غير مؤمن، والنظام قد ترقية أو تخفيض المستعمل ","lock_trust_level":"قفل مستوى الثقة","unlock_trust_level":"فتح مستوى الثقة ","tl3_requirements":{"title":"المتطلبات لمستوى الثقة 3.","value_heading":"تصويت","requirement_heading":"متطلبات","visits":"الزيارات","days":"أيام","topics_replied_to":"مواضيع للردود","topics_viewed":"المواضيع شوهدت","topics_viewed_all_time":"المواضيع المعروضة(جميع الأوقات)","posts_read":"المنشورات المقروءة","posts_read_all_time":"المشاركات المقروءة (جميع الاوقات)","flagged_posts":"المشاركات المبلغ عنها ","flagged_by_users":"المستخدمين الذين بلغوا","likes_given":"الإعجابات المعطاة","likes_received":"الإعجابات المستلمة","likes_received_days":"الإعجابات المستلمة : الايام الغير عادية","likes_received_users":"الإعجابات المستلمة : المستخدمين المميزين","qualifies":"مستوى الثقة الممنوحة للمستوى ","does_not_qualify":"غير مستحق للمستوى","will_be_promoted":"سيتم الترقية عنه قريبا","will_be_demoted":"سيتم التخفيض قريبا","on_grace_period":"حاليا في فترة مهلة ترقية، لن يتم تخفيض رتب.","locked_will_not_be_promoted":"مستوى الثفة هذا لن يتم الترقية له نهائيا","locked_will_not_be_demoted":"مستوى الثفة هذا لن يتم الخفض له نهائيا"},"sso":{"title":"الدخول الموحد","external_id":"ID الخارجي","external_username":"أسم المستخدم","external_name":"الأسم","external_email":"البريد الإلكتروني","external_avatar_url":"رابط الملف الشخصي"}},"user_fields":{"title":"حقول المستخدم","help":"إضافة الحقول التي يمكن للمستخدمين ملئها .","create":"أضف حقل مستخدم","untitled":"بدون عنوان","name":"اسم الحقل","type":"نوع الحقل ","description":"حقل الوصف","save":"حفظ","edit":"تعديل","delete":"حذف","cancel":"إلغاء","delete_confirm":"هل انت متأكد من انك تريد حذف هذا الحقل ؟","options":"خيارات","required":{"title":"المطلوب للأشتراك ؟","enabled":"مطلوب","disabled":"غير مطلوب"},"editable":{"title":"التعديل بعد انشاء الحساب ؟","enabled":"تعديل","disabled":"غير قابل للتعديل"},"show_on_profile":{"title":"عرض في الملف الشحصي العام؟","enabled":"عرض في الملف الشخصي","disabled":"عدم الأظهار في الملف الشخصي"},"show_on_user_card":{"title":"اظهارها على كرت المستخدم؟","enabled":"ظاهرة على كرت المستخدم","disabled":"غير ظاهرة على كرت المستخدم"},"field_types":{"text":"حقل النص","confirm":"تأكيد","dropdown":"القائمة المنسدلة"}},"site_text":{"description":"يمكنك تخصيص أيّ من نصوص هذه المدونة. يمكنك استكشاف ذلك أدناه:","search":"ابحث عن النص الذي تريد تعديله","title":"محتوى النص","edit":"تعديل","revert":"حفظ التعديلات","revert_confirm":"هل انت متاكد من انك تريد اعاده التغيرات؟ ","go_back":"العودة إلى البحث","recommended":"نوصيك بتخصيص النص التالي ليلائم احتياجاتك:","show_overriden":"اظهر التجاوزات فقط"},"site_settings":{"show_overriden":"تظهر فقط تجاوز","title":"اعدادات","reset":"إعادة تعيين","none":"لا شيء","no_results":"لا توجد نتائج.","clear_filter":"مسح","add_url":"أضافة رابط","add_host":"أضافة نطاق","categories":{"all_results":"كل","required":"مطلوب","basic":"الإعداد الأساسي","users":"مستخدمون","posting":"مشاركة","email":"البريد الإلكتروني","files":"ملفات","trust":"المستويات الموثوقة","security":"أمن","onebox":"رابط تفصيلي","seo":"SEO","spam":"سخام","rate_limits":"حدود المعدل","developer":"المطور","embedding":"تضمين","legal":"قانوني","uncategorized":"أخرى","backups":"النسخ الإحتياطية","login":"تسجيل الدخول","plugins":"الإضافات ","user_preferences":"تفضيلات العضو","tags":"العلامات الوصفية "}},"badges":{"title":"شعارات ","new_badge":"شعار جديد","new":"جديد ","name":"إسم ","badge":"شعار ","display_name":"إسم العرض","description":"الوصف","long_description":"وصف طويل","badge_type":"نوع الشعار","badge_grouping":"المجموعة","badge_groupings":{"modal_title":"تجميع الشعارات "},"granted_by":"ممنوح بواسطة ","granted_at":"ممنوح في","reason_help":"( رابط إلى مشاركة أو موضوع )","save":"حفظ","delete":"حذف","delete_confirm":"هل أنت متأكد من أنك تريد حذف هذا الشعار ؟","revoke":"تعطيل","reason":"السبب","expand":"توسيع \u0026مساعدة;","revoke_confirm":"هل أنت متأكد أنك تريد سحب هذه الشارة؟","edit_badges":"تعديل الشعارات ","grant_badge":"منح شارة","granted_badges":"أوسمة ممنوحة.","grant":"منحة","no_user_badges":"%{name} لم يمنح أي شارة.","no_badges":"لا يوجد أي شارة يمكن منحها.","none_selected":"حدد شارة البدء","allow_title":"اسمح للشارة أن تستخدم كعنوان.","multiple_grant":"يمكن منحه عدة مرات. ","listable":"اظهار الوسام على صفحة الأوسمة العامة","enabled":"تفعيل الشعار","icon":"أيقونة","image":"صورة","icon_help":"إستخدم فئة الخط او رابط الى صورة","query":"علامة استفهام (SQL)","target_posts":"إستعلام يستهدف المشاركات","auto_revoke":"إلغاء الاستعلام اليومي","show_posts":"عرض مشاركة الوسام الممنوح على صفحة الوسام.","trigger":"مطلق","trigger_type":{"none":"تحديث يومي","post_action":"عندما يعمل عضو على مشاركة.","post_revision":"عندما يقوم عضو بتعديل أو إنشاء مشاركة.","trust_level_change":"عندما يقوم شخص بتغير مستوى الثقة.","user_change":"عندما يتم تعديل عضو أو انشاءه.","post_processed":"بعد تنفيذ المشاركة"},"preview":{"link_text":"معاينة الأوسمة الممنوحة.","plan_text":"معاينة مع خطة الاستعلام.","modal_title":"معاينة علامة استفهام","sql_error_header":"كان هناك خطأ ما في الاستعلام.","error_help":"انظر الرابط التالي للمساعدة باستفسارات الوسام.","bad_count_warning":{"header":"تحذير !!","text":"هناك عينات ممنوحة ضائعة. حدث هذا عندما أعادت شارة الإستعلام user IDs أو post IDs التي لم تكن موجودة. هذا ربما بسبب نتيجة غير متوقعة في وقت لاحق - رجائا أنقر مرتين للتأكد من إستعلامك-"},"no_grant_count":"لا توجد اوسمه لتمنح ","grant_count":{"zero":"\u003cb\u003e%{count}\u003c/b\u003e وساما لتمنح .","one":"وسام واحد ليتم منحه .","two":"وسامين ليتم منحهما .","few":"\u003cb\u003e%{count}\u003c/b\u003e أوسمة لتمنح .","many":"\u003cb\u003e%{count}\u003c/b\u003e وساما لتمنح .","other":"\u003cb\u003e%{count}\u003c/b\u003e وساما لتمنح ."},"sample":"أمثلة:","grant":{"with":"\u003cspan class=\"username\"\u003e%{أسم المستخدم}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{أسم المستخدم}\u003c/span\u003e لهذه المشاركة %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{أسم المستخدم}\u003c/span\u003e لهذه المشاركة %{link} at \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{أسم المستخدم}\u003c/span\u003e في \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"الوجه التعبيري","help":"أضف رموز تعبيرية جديدة التي سوف تكون متاحة للكل . (PROTIP: drag \u0026 drop multiple files at once)","add":"أضافة وجه تعبيري جديد ؟","name":"الأسم","image":"صورة","delete_confirm":"هل أنت متأكد من انك تريد حذف هذا  :%{name}: الوجه التعبيري ؟"},"embedding":{"get_started":"إذا أردت تضمين Discourse في موقع اخر، أبدأ بإضافة مضيف.","confirm_delete":"هل انت متأكد من انك تريد حذف هذا المضيف ؟","sample":"استخدم كود HTML التالي لموقعك لإنشاء وتضمين موضوع discourse. استبدل \u003cb\u003eREPLACE_ME\u003c/b\u003e مع canonical URL لصفحة قمت بتضمينها فيه.","title":"تضمين","host":"أسمع بالمضيفين","edit":"تعديل","category":"مشاركة لفئة","add_host":"أضف مضيف","settings":"تضمين إعدادات","feed_settings":"إعدادات التغذية ","feed_description":" توفير مغذي RSS/ATOM لموقعك سيطور قدرة Discourse على استيراد المحتوى الخاص بك.","crawling_settings":"إعدادات المتقدم ببطء.","crawling_description":"عندما ينشأ Discourse مواضيع لمشاركتك، إذا لم يتوفر مغذي RSS/ATOM سيحاول تحليل محتواك من HTML الخاص بك. أحيانا يمكن أن يكون تحديا استخراج محتواك، لذا نمنحك القدرة لتحديد قواعد CSS لجعل الاستخراج أسهل.","embed_by_username":"اسم العضو للموضوع المنشأ","embed_post_limit":"أقصى عدد مشاركات مضمنة","embed_username_key_from_feed":"مفتاح لسحب اسم عضو discourse من المغذي","embed_truncate":"بتر المشاركات المضمنة","embed_whitelist_selector":"منتقي CSS للعناصر التي تسمح في التضمينات.","embed_blacklist_selector":"منتقي CSS للعناصر التي حذفت من التضمينات.","embed_classname_whitelist":"اسماء  اصناف المظاهر الجمالية المسموح بها","feed_polling_enabled":"استورد المشاركات عبر RSS/ATOM","feed_polling_url":"URL مغذي RSS/ATOM يتقدم ببطء.","save":"أحفظ الإعدادات المضمنة"},"permalink":{"title":"الرابط الثابت","url":"رابط","topic_id":"رقم الموضوع","topic_title":"موضوع","post_id":"رقم المشاركة","post_title":"مشاركة","category_id":"رقم الفئة","category_title":"تصنيف","external_url":"رابط خارجي","delete_confirm":"هل أنت متأكد من حذف هذا الرابط الثابت ؟","form":{"label":"جديد :","add":"أضف","filter":"بحث  ( رابط داخلي أو خارجي )"}}}}},"en":{"js":{"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","summary":{"topic_count":{"one":"topic created","other":"topics created"},"post_count":{"one":"post created","other":"posts created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"}}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"read_more_MF":"There { UNREAD, plural, =0 {} one { is \u003ca href='/unread'\u003e1 unread\u003c/a\u003e } other { are \u003ca href='/unread'\u003e# unread\u003c/a\u003e } } { NEW, plural, =0 {} one { {BOTH, select, true{and } false {is } other{}} \u003ca href='/new'\u003e1 new\u003c/a\u003e topic} other { {BOTH, select, true{and } false {are } other{}} \u003ca href='/new'\u003e# new\u003c/a\u003e topics} } remaining, or {CATEGORY, select, true {browse other topics in {catLink}} false {{latestLink}} other {}}","auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"}},"poll":{"total_votes":{"one":"total vote","other":"total votes"}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"customize":{"head_tag":{"title":"HTML that will be inserted before the \u003c/head\u003e tag"},"body_tag":{"title":"HTML that will be inserted before the \u003c/body\u003e tag"},"override_default":"Do not include standard style sheet","about":"Modify CSS stylesheets and HTML headers on the site. Add a customization to start.","color":"Color","opacity":"Opacity","css_html":{"title":"CSS/HTML","long_title":"CSS and HTML Customizations"},"colors":{"about":"Modify the colors used on the site without writing CSS. Add a scheme to start.","primary":{"description":"Most text, icons, and borders."}}},"logs":{"screened_ips":{"rolled_up_no_subnet":"There was nothing to roll up."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'ar';
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
//! Locale: Arabic (ar)
//! Author: Abdel Said: https://github.com/abdelsaid
//! Changes in months, weekdays: Ahmed Elkhatib
//! Native plural forms: forabi https://github.com/forabi

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var symbolMap = {
        '1': '١',
        '2': '٢',
        '3': '٣',
        '4': '٤',
        '5': '٥',
        '6': '٦',
        '7': '٧',
        '8': '٨',
        '9': '٩',
        '0': '٠'
    }, numberMap = {
        '١': '1',
        '٢': '2',
        '٣': '3',
        '٤': '4',
        '٥': '5',
        '٦': '6',
        '٧': '7',
        '٨': '8',
        '٩': '9',
        '٠': '0'
    }, pluralForm = function (n) {
        return n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5;
    }, plurals = {
        s : ['أقل من ثانية', 'ثانية واحدة', ['ثانيتان', 'ثانيتين'], '%d ثوان', '%d ثانية', '%d ثانية'],
        m : ['أقل من دقيقة', 'دقيقة واحدة', ['دقيقتان', 'دقيقتين'], '%d دقائق', '%d دقيقة', '%d دقيقة'],
        h : ['أقل من ساعة', 'ساعة واحدة', ['ساعتان', 'ساعتين'], '%d ساعات', '%d ساعة', '%d ساعة'],
        d : ['أقل من يوم', 'يوم واحد', ['يومان', 'يومين'], '%d أيام', '%d يومًا', '%d يوم'],
        M : ['أقل من شهر', 'شهر واحد', ['شهران', 'شهرين'], '%d أشهر', '%d شهرا', '%d شهر'],
        y : ['أقل من عام', 'عام واحد', ['عامان', 'عامين'], '%d أعوام', '%d عامًا', '%d عام']
    }, pluralize = function (u) {
        return function (number, withoutSuffix, string, isFuture) {
            var f = pluralForm(number),
                str = plurals[u][pluralForm(number)];
            if (f === 2) {
                str = str[withoutSuffix ? 0 : 1];
            }
            return str.replace(/%d/i, number);
        };
    }, months = [
        'كانون الثاني يناير',
        'شباط فبراير',
        'آذار مارس',
        'نيسان أبريل',
        'أيار مايو',
        'حزيران يونيو',
        'تموز يوليو',
        'آب أغسطس',
        'أيلول سبتمبر',
        'تشرين الأول أكتوبر',
        'تشرين الثاني نوفمبر',
        'كانون الأول ديسمبر'
    ];

    var ar = moment.defineLocale('ar', {
        months : months,
        monthsShort : months,
        weekdays : 'الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
        weekdaysShort : 'أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'.split('_'),
        weekdaysMin : 'ح_ن_ث_ر_خ_ج_س'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'D/\u200FM/\u200FYYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd D MMMM YYYY HH:mm'
        },
        meridiemParse: /ص|م/,
        isPM : function (input) {
            return 'م' === input;
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 12) {
                return 'ص';
            } else {
                return 'م';
            }
        },
        calendar : {
            sameDay: '[اليوم عند الساعة] LT',
            nextDay: '[غدًا عند الساعة] LT',
            nextWeek: 'dddd [عند الساعة] LT',
            lastDay: '[أمس عند الساعة] LT',
            lastWeek: 'dddd [عند الساعة] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'بعد %s',
            past : 'منذ %s',
            s : pluralize('s'),
            m : pluralize('m'),
            mm : pluralize('m'),
            h : pluralize('h'),
            hh : pluralize('h'),
            d : pluralize('d'),
            dd : pluralize('d'),
            M : pluralize('M'),
            MM : pluralize('M'),
            y : pluralize('y'),
            yy : pluralize('y')
        },
        preparse: function (string) {
            return string.replace(/\u200f/g, '').replace(/[١٢٣٤٥٦٧٨٩٠]/g, function (match) {
                return numberMap[match];
            }).replace(/،/g, ',');
        },
        postformat: function (string) {
            return string.replace(/\d/g, function (match) {
                return symbolMap[match];
            }).replace(/,/g, '،');
        },
        week : {
            dow : 6, // Saturday is the first day of the week.
            doy : 12  // The week that contains Jan 1st is the first week of the year.
        }
    });

    return ar;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
