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
I18n._compiledMFs = {"topic.read_more_MF" : function(){ return "Invalid Format: SyntaxError: Expected \"{\" but \"d\" found.";}, "posts_likes_MF" : function(d){
var r = "";
r += "Bu konuda ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "beğeni/gönderi oranı yüksek cevap";
return r;
},
"med" : function(d){
var r = "";
r += "beğeni/gönderi oranı çok yüksek cevap";
return r;
},
"high" : function(d){
var r = "";
r += "beğeni/gönderi oranı aşırı yüksek cevap";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += " var\n";
return r;
}};

MessageFormat.locale.tr_TR = function(n) {
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
I18n.translations = {"tr_TR":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"Bayt"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}b","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"AAA YYYY","long_no_year":"D MMM h:mm a","long_no_year_no_time":"D MMM","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM, YYYY h:mm a","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} önce","tiny":{"half_a_minute":"\u003c 1d","less_than_x_seconds":{"other":"\u003c %{count}s"},"x_seconds":{"other":"%{count}s"},"x_minutes":{"other":"%{count}d"},"about_x_hours":{"other":"%{count}s"},"x_days":{"other":"%{count}g"},"about_x_years":{"other":"%{count}y"},"over_x_years":{"other":"\u003e %{count}y"},"almost_x_years":{"other":"%{count}y"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"other":"%{count} dakika"},"x_hours":{"other":"%{count} saat"},"x_days":{"other":"%{count} gün"},"date_year":"D MMM, 'YY"},"medium_with_ago":{"x_minutes":{"other":"%{count} dakika önce"},"x_hours":{"other":"%{count} saat önce"},"x_days":{"other":"%{count} gün önce"}},"later":{"x_days":{"other":"%{count} gün sonra"},"x_months":{"other":"%{count} ay sonra"},"x_years":{"other":"%{count} yıl sonra"}},"previous_month":"Önceki Ay","next_month":"Sonraki Ay"},"share":{"topic":"bu konunun bağlantısını paylaşın","post":"#%{postNumber} nolu gönderiyi paylaşın","close":"kapat","twitter":"bu bağlantıyı Twitter'da paylaşın","facebook":"bu bağlantıyı Facebook'da paylaşın","google+":"bu bağlantıyı Google+'da paylaşın","email":"bu bağlantıyı e-posta ile gönderin"},"action_codes":{"public_topic":"bu konuyu %{when} herkese açık yaptı","private_topic":"bu konuyu %{when} tarihinde özel yaptı","split_topic":"bu konuyu ayır %{when}","invited_user":"%{when} %{who} davet edildi","invited_group":"%{who} %{when} devet edildi","removed_user":"%{when} %{who} silindi","removed_group":"%{who} %{when} kaldırıldı","autoclosed":{"enabled":"%{when} kapatıldı","disabled":"%{when} açıldı"},"closed":{"enabled":"%{when} kapatıldı","disabled":"%{when} açıldı"},"archived":{"enabled":"%{when} arşivlendi","disabled":"%{when} arşivden çıkarıldı"},"pinned":{"enabled":"%{when} sabitlendi","disabled":"%{when} sabitlikten çıkarıldı"},"pinned_globally":{"enabled":"%{when} genel olarak sabitlendi","disabled":"%{when} genel olarak sabitleme kaldırıldı"},"visible":{"enabled":"%{when} listelendi","disabled":"%{when} listelenmedi"}},"topic_admin_menu":"konuyla alakalı yönetici işlemleri","emails_are_disabled":"Tüm giden e-postalar yönetici tarafından evrensel olarak devre dışı bırakıldı. Herhangi bir e-posta bildirimi gönderilmeyecek.","bootstrap_mode_enabled":"Yeni sitenizi kolayca çalıştırmak  için bootstrap modundasınız. Tüm yeni kullanıcılar 1. seviyeden başlar ve email uyarıcıları açıksa günlük mail alırlar. Bu özellik kullanıcı sayısı %{min_users}  rakamına ulaştığında otomatik kapatılacaktır.","bootstrap_mode_disabled":"Bootstrap modu önümüzdeki 24 saat içinde devre dışı kalacaktır.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)","cn_north_1":"China (Beijing)"}},"edit":"bu konunun başlığını ve kategorisini düzenleyin","not_implemented":"Bu özellik henüz geliştirilmedi, üzgünüz!","no_value":"Hayır","yes_value":"Evet","generic_error":"Üzgünüz, bir hata oluştu.","generic_error_with_reason":"Bir hata oluştu: %{error}","sign_up":"Üye Ol","log_in":"Giriş Yap","age":"Yaş","joined":"Katıldı","admin_title":"Yönetici","flags_title":"Bayraklar","show_more":"devamını göster","show_help":"seçenekler","links":"Bağlantılar","links_lowercase":{"other":"bağlantılar"},"faq":"Sıkça Sorulan Sorular","guidelines":"Yönergeler","privacy_policy":"Gizlilik Sözleşmesi","privacy":"Gizlilik","terms_of_service":"Kullanım Koşulları","mobile_view":"Mobil Görünüm","desktop_view":"Masaüstü Görünüm","you":"Siz","or":"ya da","now":"hemen şimdi","read_more":"devamını oku","more":"Daha fazla","less":"Daha az","never":"asla","every_30_minutes":"30 dakikada bir","every_hour":"her saat","daily":"günlük","weekly":"haftalık","every_two_weeks":"her iki haftada bir","every_three_days":"her üç günde bir","max_of_count":"azami {{count}}","alternation":"ya da","character_count":{"other":"{{count}} karakter"},"suggested_topics":{"title":"Önerilen Konular","pm_title":"Önerilen Mesajlar"},"about":{"simple_title":"Hakkında","title":"%{title} Hakkında","stats":"Site İstatistikleri","our_admins":"Yöneticilerimiz","our_moderators":"Moderatörlerimiz","stat":{"all_time":"Tüm Zamanlar","last_7_days":"Son 7 gün","last_30_days":"Son 30 gün"},"like_count":"Beğeni","topic_count":"Konular","post_count":"Gönderiler","user_count":"Yeni Kullanıcılar","active_user_count":"Aktif Kullanıcılar","contact":"Bize Ulaşın","contact_info":"Bu siteyi etkileyen kritik bir problem ya da acil bir durum oluştuğunda, lütfen %{contact_info} adresi üzerinden bizimle iletişime geçin."},"bookmarked":{"title":"İşaretle","clear_bookmarks":"İşaretlenenleri Temizle","help":{"bookmark":"Bu konudaki ilk gönderiyi işaretlemek için tıklayın","unbookmark":"Bu konudaki bütün işaretleri kaldırmak için tıklayın"}},"bookmarks":{"not_logged_in":"üzgünüz, gönderileri işaretleyebilmeniz için oturum açmanız gerekiyor.","created":"bu gönderiyi işaretlediniz","not_bookmarked":"bu gönderiyi okudunuz; yer imlerinize eklemek için tıklayın","last_read":"bu okuduğunuz son gönderi; yer imlerinize eklemek için tıklayın","remove":"İşareti Kaldır","confirm_clear":"Bu konuya ait tüm işaretleri kaldırmak istediğinize emin misiniz?"},"topic_count_latest":{"other":"{{count}} yeni ya da güncellenmiş konu."},"topic_count_unread":{"other":"{{count}} okunmamış konu."},"topic_count_new":{"other":"{{count}} yeni konu."},"click_to_show":"Görüntülemek için tıklayın.","preview":"önizleme","cancel":"İptal","save":"Değişiklikleri Kaydet","saving":"Kaydediliyor...","saved":"Kaydedildi!","upload":"Yükle","uploading":"Yükleniyor...","uploading_filename":"{{filemame}} yükleniyor...","uploaded":"Yüklendi!","enable":"Etkinleştir","disable":"Devredışı Bırak","undo":"Geri Al","revert":"Eski Haline Getir","failed":"Başarısız oldu","switch_to_anon":"Ziyaretçi moduna geç","switch_from_anon":"Ziyaretçi modundan çıkış","banner":{"close":"Bu manşeti yoksay.","edit":"Bu manşeti düzenle \u003e\u003e"},"choose_topic":{"none_found":"Hiç bir konu bulunamadı.","title":{"search":"İsim, url ya da id ile başlık arayın:","placeholder":"konu başlığını buraya yazın"}},"queue":{"topic":"Konu:","approve":"Onayla","reject":"Reddet","delete_user":"Kullanıcıyı Sil","title":"Onay Gerektirir","none":"Gözden geçirilecek bir gönderi yok.","edit":"Düzenle","cancel":"İptal","view_pending":"bekleyen yazıları görüntüleyin","has_pending_posts":{"other":"Bu konuda \u003cb\u003e{{count}}\u003c/b\u003e sayıda onay bekleyen gönderi var"},"confirm":"Düzenlemeleri Kaydet","delete_prompt":"\u003cb\u003e%{username}\u003c/b\u003e kullanıcısını silmek istediğinize emin misiniz? Bunu yaparsanız tüm gönderileri silinecek, eposta adresi ve IP adresi bloklanacak.","approval":{"title":"Gönderi Onay Gerektirir","description":"Gönderinizi aldık fakat gösterilmeden önce bir moderatör tarafından onaylanması gerekiyor. Lütfen sabırlı olun.","pending_posts":{"other":"Bekleyen \u003cstrong\u003e{{count}}\u003c/strong\u003e yazınız bulunmaktadır."},"ok":"Tamam"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003ekonuyu\u003c/a\u003e açtı","you_posted_topic":"\u003ca href='{{topicUrl}}'\u003ekonuyu\u003c/a\u003e \u003ca href='{{userUrl}}'\u003esen\u003c/a\u003e açtın","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e gönderiyi cevapladı","you_replied_to_post":"\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e gönderiyi \u003ca href='{{userUrl}}'\u003esen\u003c/a\u003e cevapladın","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e  \u003ca href='{{topicUrl}}'\u003ekonuya\u003c/a\u003e cevap verdi","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eSiz\u003c/a\u003e  \u003ca href='{{topicUrl}}'\u003ekonuya\u003c/a\u003e cevap verdiniz","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e adlı kullanıcıdan bahsetti","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003esizden\u003c/a\u003e bahsetti","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eSiz\u003c/a\u003e, \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e adlı kullanıcıdan bahsettiniz","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e tarafından gönderildi","posted_by_you":"\u003ca href='{{userUrl}}'\u003eSizin\u003c/a\u003e tarafınızdan gönderildi","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e tarafından yollandı","sent_by_you":"\u003ca href='{{userUrl}}'\u003eSizin\u003c/a\u003e tarafınızdan yollandı"},"directory":{"filter_name":"kullanıcı adına göre filtrele","title":"Kullanıcılar","likes_given":"Verilen","likes_received":"Alınan","topics_entered":"Görüntülendi","topics_entered_long":"Konu Görüntülendi","time_read":"Okuma Zamanı","topic_count":"Konular","topic_count_long":"Oluşturulan Konular","post_count":"Cevap","post_count_long":"Gönderilen Cevaplar","no_results":"Sonuç bulunamadı.","days_visited":"Ziyaretler","days_visited_long":"Ziyaret Günü","posts_read":"Okunmuşlar","posts_read_long":"Okunmuş Gönderiler","total_rows":{"other":"%{count} kullanıcı"}},"groups":{"empty":{"posts":"Bu grubun üyelerinden mesaj yok.","members":"Bu grupta üye yok.","mentions":"Bu gruptan söz edilmemiş.","messages":"Bu grup için bir mesaj yok.","topics":"Bu grubun üyelerinden konu yok."},"add":"Ekle","selector_placeholder":"Üye ekle","owner":"sahip","visible":"Grup tüm kullanıcılar tarafından görüntülenebiliyor","index":"Gruplar","title":{"other":"gruplar"},"members":"Üyeler","topics":"Konular","posts":"Gönderiler","mentions":"Atıflar","messages":"Mesajlar","alias_levels":{"title":"Kimler bu gruba mesaj gönderebilir ve gruptan @bahsedebilir?","nobody":" Hiç Kimse","only_admins":"Sadece Yöneticiler","mods_and_admins":"Sadece Moderatörler ve Yöneticiler","members_mods_and_admins":"Sadece Grup Üyeleri, Moderatörler ve Yöneticiler","everyone":"Herkes"},"trust_levels":{"title":"Eklendiklerinde üyelere otomatik olarak güven seviyesi verilir:","none":"Hiç"},"notifications":{"watching":{"title":"Gözleniyor","description":"Tüm mesajlardaki her yazı hakkında bilgilendirileceksiniz ve yeni cevap sayısı gösterilecek."},"watching_first_post":{"title":"İlk gönderi izlemeniz","description":"Bu grupta bulunan tüm konuların sadece ilk gönderilerinde bildirim alacaksınız."},"tracking":{"title":"Takip ediliyor","description":"Biri @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız ve yeni cevap sayısı gösterilecek."},"regular":{"title":"Normal","description":"Birisi @isminizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız."},"muted":{"title":"Susturuldu","description":"Bu gruptan herhangi yeni konuyla ilgili asla bildirim almayacaksınız"}}},"user_action_groups":{"1":"Verilen Beğeniler","2":"Alınan Beğeniler","3":"İşaretlenenler","4":"Konular","5":"Cevaplar","6":"Yanıtlar","7":"Bahsedenler","9":"Alıntılar","11":"Düzenlemeler","12":"Yollanmış ögeler","13":"Gelen Kutusu","14":"Bekleyen"},"categories":{"all":"Tüm Kategoriler","all_subcategories":"hepsi","no_subcategory":"hiçbiri","category":"Kategori","category_list":"Kategori ekranı listesi","reorder":{"title":"Kategorileri Yeniden Sırala","title_long":"Kategori listesini yeniden yapılandır","fix_order":"Konumları Onar","fix_order_tooltip":"Bütün kategoriler eşsiz bir konum numarasına sabit değil, bu beklenmedik sonuçlara neden olabilir.","save":"Sıralamayı Kaydet","apply_all":"Uygula","position":"Konum"},"posts":"Gönderiler","topics":"Konular","latest":"En Son","latest_by":"son gönderen","toggle_ordering":"sıralama kontrolünü aç/kapa","subcategories":"Alt kategoriler","topic_stat_sentence":{"other":"%{unit} beri %{count} yeni konu."}},"ip_lookup":{"title":"IP Adresi Ara","hostname":"Sunucu ismi","location":"Yer","location_not_found":"(bilinmeyen)","organisation":"Organizasyon","phone":"Telefon","other_accounts":"Bu IP adresine sahip diğer hesaplar:","delete_other_accounts":"Sil %{count}","username":"kullanıcı adı","trust_level":"TL","read_time":"okunma zamanı","topics_entered":"açılan konular","post_count":"# gönderi","confirm_delete_other_accounts":"Bu hesapları silmek isteğinize emin misiniz?"},"user_fields":{"none":"(bir seçenek seçin)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Sustur","edit":"Ayarları Düzenle","download_archive":"Gönderilerimi İndir","new_private_message":"Yeni Mesaj","private_message":"Mesaj","private_messages":"Mesajlar","activity_stream":"Aktivite","preferences":"Seçenekler","expand_profile":"Genişlet","bookmarks":"İşaretlenenler","bio":"Hakkımda","invited_by":"Tarafından Davet Edildi","trust_level":"Güven Seviyesi","notifications":"Bildirimler","statistics":"istatistikler","desktop_notifications":{"label":"Masaüstü Bildirimleri","not_supported":"Bildirimler bu tarayıcıda desteklenmiyor. Üzgünüz.","perm_default":"Bildirimleri Etkinleştirin","perm_denied_btn":"Erişim İzni Reddedildi","perm_denied_expl":"Bildirimler için izinleri reddettiniz. Tarayıcı ayarlarınızdan bildirimlere izin verin.","disable":"Bildirimleri Devre Dışı Bırakın","enable":"Bildirimleri Etkinleştirin","each_browser_note":"Not: Bu ayarı kullandığınız her tarayıcıda değiştirmelisiniz."},"dismiss_notifications":"Tümünü kaldır","dismiss_notifications_tooltip":"Tüm okunmamış bildirileri okunmuş olarak işaretle","disable_jump_reply":"Cevapladıktan sonra gönderime atlama","dynamic_favicon":"Tarayıcı simgesinde yeni / güncellenen konu sayısını göster","external_links_in_new_tab":"Tüm dış bağlantıları yeni sekmede aç","enable_quoting":"Vurgulanan yazıyı alıntılayarak cevaplama özelliğini etkinleştir","change":"değiştir","moderator":"{{user}} bir moderatördür","admin":"{{user}} bir yöneticidir","moderator_tooltip":"Bu kullanıcı bir moderatör","admin_tooltip":"Bu kullanıcı bir yönetici.","blocked_tooltip":"Bu kullanıcı engellendi","suspended_notice":"Bu kullanıcı {{tarih}} tarihine kadar uzaklaştırıldı.","suspended_reason":"Neden:","github_profile":"Github","email_activity_summary":"Aktivite özeti","mailing_list_mode":{"label":"Duyuru listesi modu","enabled":"Duyuru listesi modunu aktifleştir","instructions":"Bu ayar aktivite özetini geçersiz kılacaktır.\u003cbr /\u003e\nSessize alınmış başlıklar ve kategoriler bu epostalarda yer almaz.\n","daily":"Günlük güncellemeleri gönder","individual":"Her yazı için bir eposta gönder","many_per_day":" ({{dailyEmailEstimate}} konusu hakkında) tüm yeni gönderilerde bana mail gönder","few_per_day":"Her yeni gönderi için bana email gönder ( 2 günlük )"},"tag_settings":"Etiketler","watched_tags":"Gözlendi","watched_tags_instructions":"Bu etiketlerle tüm konuları otomatik olarak izleyebileceksiniz. Tüm yeni gönderi ve konulardan haberdar olabileceksiniz ve yeni gönderileri konunun yanında görünecektir.","tracked_tags":"Takip edildi","tracked_tags_instructions":"Bu etiketlerle tüm konuları otomatik olarak izleyebileceksiniz. Yeni gönderiler konunun yanında görünecektir.","muted_tags":"Susturuldu","muted_tags_instructions":"Bu etiketler ile yeni konular hakkında herhangi bir bildiri almayacaksınız ve en son gönderilerde belirmeyecekler.","watched_categories":"Gözlendi","watched_categories_instructions":"Bu kategorilerdeki konuları otomatik olarak izleyebileceksiniz. Tüm yeni gönderi ve konulardan haberdar olabileceksiniz ve yeni gönderileri konunun yanında görünecektir.","tracked_categories":"Takip edildi","tracked_categories_instructions":"Bu kategorilerdeki tüm konuları otomatik olarak takip edeceksiniz. Yeni gönderilerin sayısı ilgili konunun yanında belirecek.","watched_first_post_categories":"İlk gönderi izlemeniz","watched_first_post_categories_instructions":"Bu kategorilerde bulunan tüm konuların ilk gönderilerinde bildirim alacaksınız.","watched_first_post_tags":"İlk gönderi izlemeniz","watched_first_post_tags_instructions":"Bu etiketlerle her yeni konudaki ilk gönderi için bildirim alacaksınız.","muted_categories":"Susturuldu","muted_categories_instructions":"Bu kategorilerdeki yeni konular hakkında herhangi bir bildiri almayacaksınız ve en son gönderilerde belirmeyecekler. ","delete_account":"Hesabımı Sil","delete_account_confirm":"Hesabınızı kalıcı olarak silmek istediğinize emin misiniz? Bu işlemi geri alamazsınız!","deleted_yourself":"Hesabınız başarıyla silindi.","delete_yourself_not_allowed":"Hesabınızı şu an silemezsiniz. Hesabınızı silmesi için bir yönetici ile iletişime geçin.","unread_message_count":"Mesajlar","admin_delete":"Sil","users":"Kullanıcılar","muted_users":"Susturuldu","muted_users_instructions":"Bu kullanıcılardan gelen tüm bildirileri kapa.","muted_topics_link":"Sessize alınmış konuları göster","watched_topics_link":"Takip edilen konuları göster","automatically_unpin_topics":"En alta ulaşınca otomatik olarak başlıkların tutturulmasını kaldır.","staff_counters":{"flags_given":"yararlı bayraklar","flagged_posts":"bayraklanan gönderiler","deleted_posts":"silinen gönderiler","suspensions":"uzaklaştırmalar","warnings_received":"uyarılar"},"messages":{"all":"Hepsi","inbox":"Gelen Kutusu","sent":"Gönderildi","archive":" Arşiv","groups":"Gruplarım","bulk_select":"Mesajları seçin","move_to_inbox":"Gelen kutusuna taşı","move_to_archive":" Arşiv","failed_to_move":"Seçilen mesajları taşımak başarısız oldu (muhtemelen ağınız çöktü)","select_all":"Tümünü seç"},"change_password":{"success":"(e-posta gönderildi)","in_progress":"(e-posta yollanıyor)","error":"(hata)","action":"Parola Sıfırlama E-postası Gönder","set_password":"Parola Belirle"},"change_about":{"title":"Hakkımda'yı Değiştir","error":"Bu değeri değiştirirken bir hata oluştu."},"change_username":{"title":"Kullanıcı Adını Değiştir","confirm":"Kullanıcı adınızı değiştirmeniz halinde, eski gönderilerinizden yapılan tüm alıntılar ve @eskiadınızdaki bahsedilenler bozulacak. Bunu yapmak istediğinize gerçekten emin misiniz?","taken":"Üzgünüz, bu kullanıcı adı alınmış.","error":"Kullanıcı adınızı değiştirirken bir hata oluştu.","invalid":"Bu kullanıcı adı geçersiz. Sadece sayı ve harf içermelidir."},"change_email":{"title":"E-posta Adresini Değiştirin","taken":"Üzgünüz, bu e-posta kullanılabilir değil.","error":"E-posta adresinizi değiştirirken bir hata oluştu. Belki bu adres zaten kullanımdadır?","success":"Adresinize bir e-posta gönderdik. Lütfen onaylama talimatlarını uygulayınız."},"change_avatar":{"title":"Profil görselinizi değiştirin","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baz alındı","gravatar_title":"Profil görselinizi Gravatar sitesinde değiştirin","refresh_gravatar_title":"Profil görselinizi yenileyin","letter_based":"Sistem tarafından verilen profil görseli","uploaded_avatar":"Özel resim","uploaded_avatar_empty":"Özel resim ekleyin","upload_title":"Resminizi yükleyin","upload_picture":"Resim Yükle","image_is_not_a_square":"Uyarı: resminizi kırptık; genişlik ve yükseklik eşit değildi.","cache_notice":"Profil resminizi başarıyla değiştirdiniz fakat tarayıcı önbelleklemesi nedeniyle görünür olması biraz zaman alabilir."},"change_profile_background":{"title":"Profil Arkaplanı","instructions":"Profil arkaplanları ortalanacak ve genişlikleri 850px olacak. "},"change_card_background":{"title":"Kullanıcı Kartı Arkaplanı","instructions":"Profil arkaplanları ortalanacak ve genişlikleri 590px olacak. "},"email":{"title":"E-posta","instructions":"Kimseye gösterilmeyecek.","ok":"Onay için size e-posta atacağız","invalid":"Lütfen geçerli bir e-posta adresini giriniz","authenticated":"E-posta adresiniz {{provider}} tarafından doğrulanmıştır","frequency_immediately":"Eğer yollamak üzere olduğumuz şeyi okumadıysanız size direk e-posta yollayacağız.","frequency":{"other":"Sadece son {{count}} dakika içinde sizi görmediysek e-posta yollayacağız."}},"name":{"title":"İsim","instructions":"Tam adınız (zorunlu değil)","instructions_required":"Tam adınız","too_short":"İsminiz çok kısa","ok":"İsminiz iyi görünüyor"},"username":{"title":"Kullanıcı adı","instructions":"Özgün, boşluksuz ve kısa","short_instructions":"Kullanıcılar sizden @{{username}} olarak bahsedebilirler.","available":"Kullanıcı adınız müsait","global_match":"E-posta kayıtlı kullanıcı adıyla eşleşiyor","global_mismatch":"Zaten mevcut. {{suggestion}} deneyin?","not_available":"Müsait değil. {{suggestion}} deneyin?","too_short":"Kullanıcı adınız çok kısa","too_long":"Kullanıcı adınız çok uzun","checking":"Kullanıcı adı müsait mi kontrol ediliyor...","enter_email":"Kullanıcı adı bulundu; eşleşen e-posta adresini girin","prefilled":"E-posta bu kullanıcı adı ile eşleşiyor"},"locale":{"title":"Arayüz dili","instructions":"Kullanıcı arayüzünün dili. Sayfayı yenilediğiniz zaman değişecektir.","default":"(varsayılan)"},"password_confirmation":{"title":"Tekrar Parola"},"last_posted":"Son Gönderi","last_emailed":"Son E-posta Atılan","last_seen":"Son Görülme","created":"Katıldı","log_out":"Oturumu Kapat","location":"Yer","card_badge":{"title":"Kullanıcı Kartı Rozeti"},"website":"Web Sayfası","email_settings":"E-posta","like_notification_frequency":{"title":"Beğenildiğinde bildir","always":"Her zaman","first_time_and_daily":"İlk kez bir posta günlük olarak beğenildi","first_time":"İlk ileti beğenisi","never":"Asla"},"email_previous_replies":{"title":"Önceki cevapları e-postaların altına ekle","unless_emailed":"daha önce gönderilmediyse","always":"her zaman","never":"asla"},"email_digests":{"title":"Ben burda yokken popüler konu ve cevapların özetini e-posta olarak gönder","every_30_minutes":"30 dakikada bir","every_hour":"saatte bir","daily":"günlük","every_three_days":"her üç günde bir","weekly":"haftalık","every_two_weeks":"her iki haftada bir"},"include_tl0_in_digests":"Yeni kullanıcılardan gelen içeriği özet e-postalarına ekle","email_in_reply_to":"Gönderilere gelen yanıtların bir örneğini e-postaya ekle","email_direct":"Birisi gönderime cevap verdiğinde, benden alıntı yaptığında, @username şeklinde bahsettiğinde ya da beni bir konuya davet ettiğinde bana bir email at","email_private_messages":"Biri bana mesaj yazdığında bana bir email at","email_always":"Sitede aktif olduğum sıralarda bile bana e-posta bildirimleri gönder","other_settings":"Diğer","categories_settings":"Kategoriler","new_topic_duration":{"label":"Seçili durumdaki konular yeni sayılsın","not_viewed":"Onları henüz görüntülemedim","last_here":"son ziyaretimden beri oluşturulanlar","after_1_day":"son 1 gün içinde oluşturuldu","after_2_days":"son 2 gün içinde oluşturuldu","after_1_week":"son 1 hafta içinde oluşturuldu","after_2_weeks":"son 2 hafta içinde oluşturuldu"},"auto_track_topics":"Girdiğim konuları otomatik olarak takip et","auto_track_options":{"never":"asla","immediately":"hemen","after_30_seconds":"30 saniye sonra","after_1_minute":"1 dakika sonra","after_2_minutes":"2 dakika sonra","after_3_minutes":"3 dakika sonra","after_4_minutes":"4 dakika sonra","after_5_minutes":"5 dakika sonra","after_10_minutes":"10 dakika sonra"},"invited":{"search":"davetiye aramak için yazın...","title":"Davetler","user":"Davet Edilen Kullanıcı","sent":"Gönderildi","none":"Bekleyen davet yok.","truncated":{"other":"ilk {{count}} davet gösteriliyor."},"redeemed":"Kabul Edilen Davetler","redeemed_tab":"Kabul Edildi","redeemed_tab_with_count":"İtfa edilmiş ({{count}})","redeemed_at":"Kabul Edildi","pending":"Bekleyen Davetler","pending_tab":"Bekleyen","pending_tab_with_count":"Beklemede ({{count}})","topics_entered":"Görüntülenmiş Konular","posts_read_count":"Okunmuş Yazılar","expired":"Bu davetin süresi doldu.","rescind":"Kaldır","rescinded":"Davet kaldırıldı","reinvite":"Davetiyeyi Tekrar Yolla","reinvite_all":"Tüm davetleri tekrar gönder","reinvited":"Davetiye tekrar yollandı","reinvited_all":"Tüm davetler tekrar gönderildi!","time_read":"Okunma Zamanı","days_visited":"Ziyaret Edilen Günler","account_age_days":"Gün içinde Hesap yaş","create":"Davet Yolla","generate_link":"Davet bağlantısını kopyala","generated_link_message":"\u003cp\u003eDavet bağlantısı başarılı bir şekilde oluşturuldu!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eDavet bağlantısı sadece bu e-posta adresi için geçerlidir: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Henüz kimseyi buraya davet etmediniz. Tek tek davetiye gönderebilirsiniz, ya da \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003etoplu bir davetiye dosyası yükleyerek\u003c/a\u003e birçok kişiyi aynı anda davet edebilirsiniz. ","text":"Dosyadan Toplu Davet Gönder","uploading":"Yükleniyor...","success":"Dosya başarıyla yüklendi, işlem tamamlandığında mesajla bilgilendirileceksiniz.","error":"'{{filename}}' yüklenirken bir hata oluştu: {{message}}"}},"password":{"title":"Parola","too_short":"Parolanız çok kısa.","common":"Bu parola çok yaygın.","same_as_username":"Şifreniz kullanıcı adınızla aynı.","same_as_email":"Şifreniz e-posta adresinizle aynı.","ok":"Parolanız uygun gözüküyor.","instructions":"En az %{count} karakter."},"summary":{"title":"Özet","stats":"İstatistikler","time_read":"okunma süresi","topic_count":{"other":"oluşturulan konular"},"post_count":{"other":"oluşturmuş gönderiler"},"likes_given":{"other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e verilen"},"likes_received":{"other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e alınan "},"days_visited":{"other":"ziyaret edilen günler"},"posts_read":{"other":"okunmuş yazılar"},"bookmark_count":{"other":"yer imleri"},"top_replies":"Başlıca Yanıtları","no_replies":"Henüz yanıt bulunmuyor.","more_replies":"Diğer Yanıtları","top_topics":"Başlıca Konuları","no_topics":"Henüz konu bulunmuyor.","more_topics":"Diğer Konuları","top_badges":"Başlıca Rozetleri","no_badges":"Henüz rozet bulunmuyor.","more_badges":"Diğer Rozetleri","top_links":"Önemli Bağlantılar","no_links":"Henüz bir bağlantı bulunmuyor.","most_liked_by":"Tarafından en çok beğenilen","most_liked_users":"Popüler Beğenmeler","most_replied_to_users":"En çok cevaplanan","no_likes":"Henüz bir beğeni bulunmuyor."},"associated_accounts":"Girişler","ip_address":{"title":"Son IP Adresi"},"registration_ip_address":{"title":"Kayıt Anındaki IP Adresi"},"avatar":{"title":"Profil Görseli","header_title":"profil, mesajlar, işaretliler ve seçenekler"},"title":{"title":"Başlık"},"filters":{"all":"Hepsi"},"stream":{"posted_by":"Gönderen","sent_by":"Yollayan","private_message":"mesaj","the_topic":"konu"}},"loading":"Yükleniyor...","errors":{"prev_page":"yüklemeye çalışırken","reasons":{"network":"Network Hatası","server":"Sunucu Hatası","forbidden":"Erişim Reddedildi","unknown":"Hata","not_found":"Sayfa Bulunamadı"},"desc":{"network":"Lütfen bağlantınızı kontrol edin.","network_fixed":"Geri döndü gibi gözüküyor.","server":"Hata kodu : {{status}}","forbidden":"Bunu görüntülemeye izniniz yok.","not_found":"Hoppala, uygulama var olmayan bir URL'i yüklemeye çalıştı.","unknown":"Bir şeyler ters gitti."},"buttons":{"back":"Geri Dönün","again":"Tekrar Deneyin","fixed":"Sayfayı Yükle"}},"close":"Kapat","assets_changed_confirm":"Bu site yeni versiyona güncellendi. Son hali için sayfayı yenilemek ister misiniz?","logout":"Çıkış yapıldı.","refresh":"Yenile","read_only_mode":{"enabled":"Bu site salt okunur modda. Lütfen gezinmeye devam edin, ancak yanıt yazma, beğenme ve diğer aksiyonlar şu an için devre dışı durumda.","login_disabled":"Site salt-okunur modda iken oturum açma devre dışı bırakılır .","logout_disabled":"Site salt okunur modda iken oturum kapatma işlemi yapılamaz."},"too_few_topics_and_posts_notice":"Hadi \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ebu tartışmayı başlatalım!\u003c/a\u003e Şu anda \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e konu ve \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e gönderi var. Yeni ziyaretçiler okumak ve yanıtlamak için birkaç tartışmaya ihtiyaç duyarlar.","too_few_topics_notice":"Hadi \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ebu tartışmayı başlatalım!\u003c/a\u003e Şu anda \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e konu var. Yeni ziyaretçiler okumak ve yanıtlamak için birkaç tartışmaya ihtiyaç duyarlar.","too_few_posts_notice":"Hadi \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ebu tartışmayı başlatalım!\u003c/a\u003e Şu anda \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e gönderi var. Yeni ziyaretçiler okumak ve yanıtlamak için birkaç tartışmaya ihtiyaç duyarlar.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e , %{siteSettingRate} 'in site ayarları limitine ulaştı.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e , %{siteSettingRate} 'in site ayarları limitini aştı.","rate":{"other":"%{count} hata/%{duration}"}},"learn_more":"daha fazlasını öğren...","year":"yıl","year_desc":"son 365 günde oluşturulan konular","month":"ay","month_desc":"son 30 günde oluşturulan konular","week":"hafta","week_desc":"son 7 günde oluşturulan konular","day":"gün","first_post":"İlk gönderi","mute":"Sustur","unmute":"Susturma","last_post":"Son gönderi","last_reply_lowercase":"son cevap","replies_lowercase":{"other":"cevap"},"signup_cta":{"sign_up":"Üye Ol","hide_session":"Yarın bana hatırlat","hide_forever":"hayır teşekkürler","hidden_for_session":"Tamamdır, yarın tekrar soracağım. İstediğiniz zaman 'Giriş' yaparak da hesap oluşturabilirsiniz.","intro":"Nabersin! :heart_eyes: Görüneşe göre tartışmaların keyfini çıkaryorsun, fakat henüz bir hesap almak için kayıt olmamışsın.","value_prop":"Bir hesap oluşturduğunuzda, tam olarak neyi okuyor olduğunuzu hatırlarız, böylece her zaman okumayı bırakmış olduğunuz yere geri gelirsiniz.  Ayrıca burada, yeni gönderiler yağıldığında email yoluyla bildirim alırsınız. Ve sevgiyi paylaşmak için gönderileri beğenebilirsiniz. :heartbeat:"},"summary":{"enabled_description":"Bu konunun özetini görüntülemektesiniz: topluluğun en çok ilgisini çeken gönderiler","description":"\u003cb\u003e{{replyCount}}\u003c/b\u003e adet yanıt var.","description_time":"Tahmini okuma süresi \u003cb\u003e{{readingTime}} dakika\u003c/b\u003e olan \u003cb\u003e{{replyCount}}\u003c/b\u003e yanıt var.","enable":"Bu Konuyu Özetle.","disable":"Tüm Gönderileri Göster"},"deleted_filter":{"enabled_description":"Bu konu gizlenen silinmiş gönderiler içeriyor.","disabled_description":"Bu konuda silinen gönderiler gösteriliyor.","enable":"Silinen Gönderileri Gizle","disable":"Silinen Gönderileri Göster"},"private_message_info":{"title":"Mesaj","invite":"Diğerlerini Davet Et...","remove_allowed_user":"Bu mesajlaşmadan {{name}} isimli kullanıcıyı çıkarmak istediğinize emin misiniz?","remove_allowed_group":"{{name}} bunu gerçekten mesajdan kaldırmak istiyor musunuz?"},"email":"E-posta","username":"Kullanıcı Adı","last_seen":"Son Görülme","created":"Oluşturuldu","created_lowercase":"oluşturuldu","trust_level":"Güven Seviyesi","search_hint":"kullanıcı adı, e-posta veya IP adresi","create_account":{"title":"Yeni Hesap Oluştur","failed":"Bir şeyler ters gitti. Bu e-posta adına daha önce bir kayıt oluşturulmuş olabilir, parolamı unuttum bağlantısını dene."},"forgot_password":{"title":"Parola Sıfırla","action":"Parolamı unuttum","invite":"Kullanıcı adınızı ya da e-posta adresinizi girin, size parola sıfırlama e-postası yollayalım.","reset":"Parola Sıfırla","complete_username":" \u003cb\u003e%{username}\u003c/b\u003e kullanıcı adı ile eşleşen bir hesap bulunması durumunda, kısa bir süre içerisinde parolanızı nasıl sıfırlayacağınızı açıklayan bir e-posta alacaksınız.","complete_email":" \u003cb\u003e%{email}\u003c/b\u003e adresi ile eşleşen bir hesap bulunması durumunda, kısa bir süre içerisinde parolanızı nasıl sıfırlayacağınızı açıklayan bir e-posta alacaksınız.","complete_username_found":"\u003cb\u003e%{username}\u003c/b\u003e kullanıcı adı ile eşleşen bir hesap bulduk, kısa bir süre içerisinde parolanızı nasıl sıfırlayacağınızı açıklayan bir e-posta alacaksınız.","complete_email_found":"\u003cb\u003e%{email}\u003c/b\u003e adresi ile eşleşen bir hesap bulduk, kısa bir süre içerisinde parolanızı nasıl sıfırlayacağınızı açıklayan bir e-posta alacaksınız.","complete_username_not_found":"Hiçbir hesap kullanıcı adı \u003cb\u003e%{username}\u003c/b\u003e ile eşleşmiyor","complete_email_not_found":"Hiçbir hesap \u003cb\u003e%{email}\u003c/b\u003e adresi ile eşleşmiyor"},"login":{"title":"Giriş Yap","username":"Kullanıcı","password":"Parola","email_placeholder":"e-posta veya kullanıcı adı","caps_lock_warning":"Caps Lock açık","error":"Bilinmeyen hata","rate_limit":"Tekrar giriş yapmayı denemeden önce lütfen bekleyin.","blank_username_or_password":"Lütfen e-posta adresinizi ya da kullanıcı adınızı, ve parolanızı girin.","reset_password":"Parola Sıfırlama","logging_in":"Oturum açılıyor...","or":"ya da","authenticating":"Kimliğiniz doğrulanıyor...","awaiting_confirmation":"Hesabınız etkinleştirilmemiş. Yeni bir etkinleştirme e-postası almak için parolamı unuttum bağlantısını kullanabilirsiniz. ","awaiting_approval":"Hesabınız henüz bir görevli tarafından onaylanmadı. Onaylandığında e-posta ile haberdar edileceksiniz.","requires_invite":"Üzgünüz, bu foruma sadece davetliler erişebilir.","not_activated":"Henüz oturum açamazsınız. Hesabınızı etkinleştirmek için lütfen daha önceden \u003cb\u003e{{sentTo}}\u003c/b\u003e adresine yollanan etkinleştirme e-postasındaki açıklamaları okuyun.","not_allowed_from_ip_address":"Bu IP adresiyle oturum açamazsınız.","admin_not_allowed_from_ip_address":"Bu IP adresinden yönetici olarak oturum açamazsınız.","resend_activation_email":"Etkinleştirme e-postasını tekrar yollamak için buraya tıklayın. ","sent_activation_email_again":"\u003cb\u003e{{currentEmail}}\u003c/b\u003e adresine yeni bir etkinleştirme e-postası yolladık. Bu e-postanın size ulaşması bir kaç dakika sürebilir; spam klasörüzü kontrol etmeyi unutmayın.","to_continue":"Lütfen Giriş Yap","preferences":"Seçeneklerinizi değiştirebilmek için giriş yapmanız gerekiyor.","forgot":"Hesap bilgilerimi hatırlamıyorum","google":{"title":"Google ile","message":"Google ile kimlik doğrulaması yapılıyor (pop-up engelleyicilerin etkinleştirilmediğinden emin olun)"},"google_oauth2":{"title":"Google ile","message":"Google ile kimlik doğrulaması yapılıyor (pop-up engelleyicilerin etkinleştirilmediğinden emin olun)"},"twitter":{"title":"Twitter ile","message":"Twitter ile kimlik doğrulaması yapılıyor (pop-up engelleyicilerin etkinleştirilmediğinden emin olun)"},"instagram":{"title":"Instagram ile","message":"Instagram ile kimlik doğrulaması yapılıyor (pop-up engelleyicilerin etkinleştirilmediğinden emin olun)"},"facebook":{"title":"Facebook ile","message":"Facebook ile kimlik doğrulaması yapılıyor (pop-up engelleyicilerin etkinleştirilmediğinden emin olun)"},"yahoo":{"title":"Yahoo ile","message":"Yahoo ile kimlik doğrulaması yapılıyor (pop-up engelleyicilerin etkinleştirilmediğinden emin olun)"},"github":{"title":"GitHub ile","message":"GitHub ile kimlik doğrulaması yapılıyor (pop-up engelleyicilerin etkinleştirilmediğinden emin olun)"}},"emoji_set":{"apple_international":"Apple/Uluslararası","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"dahası...","options":"Seçenekler","whisper":"fısıltı","unlist":"listelenmedi","add_warning":"Bu resmi bir uyarıdır.","toggle_whisper":"Fısıldamayı Göster/Gizle","toggle_unlisted":"Listelenmemiş Olanları Değiştir","posting_not_on_topic":"Hangi konuyu cevaplamak istiyorsun?","saving_draft_tip":"kaydediliyor...","saved_draft_tip":"kaydedildi","saved_local_draft_tip":"yerele kaydedildi","similar_topics":"Konunuz şunlara çok benziyor...","drafts_offline":"çevrimdışı taslaklar","duplicate_link":"It looks like your link to \u003cb\u003e{{etki_alanı}}\u003c/b\u003e 'nına bağlanan linkiniz \u003cb\u003e@{{kullanıcı_adı}}\u003c/b\u003e tarafından \u003ca href='{{post_url}}'\u003ea yanıtı içerisinde çoktan yayınlanmış görünüyor. {{önce}}\u003c/a\u003e – tekrar yayınlamak istediğinize emin misiniz?","error":{"title_missing":"Başlık gerekli","title_too_short":"Başlık en az {{min}} karakter olmalı","title_too_long":"Başlık {{max}} karakterden daha uzun olamaz","post_missing":"Gönderiler boş olamaz","post_length":"Gönderi en az {{min}} karakter olmalı","try_like":"\u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e butonunu denediniz mi?","category_missing":"Bir kategori seçmelisiniz"},"save_edit":"Değişikliği Kaydet","reply_original":"Ana Konuyu Cevapla","reply_here":"Buradan Cevapla","reply":"Cevapla","cancel":"İptal et","create_topic":"Konu Oluştur","create_pm":"Mesaj","title":"Ya da Ctrl+Enter'a bas","users_placeholder":"Kullanıcı ekle","title_placeholder":"Bir cümlede açıklamak gerekirse bu tartışmanın konusu nedir?","edit_reason_placeholder":"neden düzenleme yapıyorsunuz?","show_edit_reason":"(düzenleme sebebi ekle)","reply_placeholder":"Buraya yazın. Biçimlendirmek için Markdown, BBCode ya da HTML kullanabilirsin. Resimleri sürükleyebilir ya da yapıştırabilirsin.","view_new_post":"Yeni gönderinizi görüntüleyin.","saving":"Kaydediliyor","saved":"Kaydedildi!","saved_draft":"Gönderi taslağı işleniyor. Geri almak için seçin. ","uploading":"Yükleniyor...","show_preview":"önizlemeyi göster \u0026raquo;","hide_preview":"\u0026laquo; önizlemeyi gizle","quote_post_title":"Tüm gönderiyi alıntıla","bold_title":"Kalın","bold_text":"kalın yazı","italic_title":"Vurgular","italic_text":"vurgulanan yazı","link_title":"Bağlantı","link_description":"buraya bağlantı açıklamasını girin","link_dialog_title":"Bağlantı ekle","link_optional_text":"opsiyonel başlık","link_url_placeholder":"http://ornek.com","quote_title":"Blok-alıntı","quote_text":"Blok-alıntı","code_title":"Önceden biçimlendirilmiş yazı","code_text":"paragraf girintisi 4 boşluktan oluşan, önceden biçimlendirilen yazı","paste_code_text":"kodu buraya gir veya yapıştır","upload_title":"Yükle","upload_description":"yükleme açıklamasını buraya girin","olist_title":"Numaralandırılmış Liste","ulist_title":"Madde İşaretli Liste","list_item":"Liste öğesi","heading_title":"Başlık","heading_text":"Başlık","hr_title":"Yatay Çizgi","help":"Markdown Düzenleme Yardımı","toggler":"yazım alanını gizle veya göster","modal_ok":"Tamam","modal_cancel":"İptal","cant_send_pm":"Üzgünüz, %{username} kullanıcısına mesaj gönderemezsiniz.","yourself_confirm":{"title":"Alıcıları eklemeyi unuttun mu?","body":"Bu mesaj şu an sadece sana gönderiliyor!"},"admin_options_title":"Bu konu için opsiyonel görevli ayarları","auto_close":{"label":"Başlığı otomatik kapatma zamanı:","error":"Lütfen geçerli bir değer giriniz.","based_on_last_post":"Başlıktaki son gönderi de en az bu kadar eskiyinceye kadar kapatmayın.","all":{"examples":"Saat sayısı (24), kesin zaman (17:30) ya da zaman damgası (2013-11-22 14:00) girin."},"limited":{"units":"(saat sayısı)","examples":"Saat sayısını giriniz (24)."}}},"notifications":{"title":"@isim bahsedilişleri, gönderileriniz ve konularınıza verilen cevaplar, mesajlarla vb. ilgili bildiriler","none":"Şu an için bildirimler yüklenemiyor.","empty":"Bildirim Yok","more":"daha eski bildirimleri görüntüle","total_flagged":"tüm bayraklanan gönderiler","mentioned":"\u003ci title='bahsetti' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='bahsetti' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='alıntıladı' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='cevapladı' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='yazdı' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='düzenledi' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='beğendi' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"other":"\u003ci title='beğendi' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} ve diğer {{count}} kişi\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='özel mesaj' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='özel mesaj' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='konuya davet edildi' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='davetiyeni kabul etti' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e davetini kabul etti!\u003c/p\u003e","moved_post":"\u003ci title='gönderiyi taşıdı' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e taşıdı {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003e\u003cstrong\u003e{{description}}\u003c/strong\u003e rozeti kazandınız!\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eYeni Konu\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"other":"\u003ci title='grup gelen kutusundaki mesajlar' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{group_name}} isimli grubunuzun gelen kutusunda {{count}} adet mesaj var\u003c/p\u003e"},"alt":{"mentioned":"Bahsedildi, şu kişi tarafından","quoted":"Alıntılandı, şu kişi tarafından","replied":"Cevaplandı","posted":"Gönderildi, şu kişi tarafından","edited":"Gönderiniz düzenlendi, şu kişi tarafından","liked":"Gönderiniz beğenildi","private_message":"Özel mesaj, şu kişiden","invited_to_private_message":"Bir özel mesaja davet edildiniz, şu kişi tarafından","invited_to_topic":"Bir konuya davet edildiniz, şu kişi tarafından","invitee_accepted":"Davet kabul edildi, şu kişi tarafından","moved_post":"Gönderiniz taşındı, şu kişi tarafından","linked":"Gönderinize bağlantı","granted_badge":"Rozet alındı","group_message_summary":"Grup gelen kutusundaki mesajlar"},"popup":{"mentioned":"{{username}}, \"{{topic}}\" başlıklı konuda sizden bahsetti - {{site_title}}","group_mentioned":"{{username}} sizden bahsetti \"{{topic}}\" - {{site_title}}","quoted":"{{username}}, \"{{topic}}\" başlıklı konuda sizden alıntı yaptı - {{site_title}}","replied":"{{username}}, \"{{topic}}\" başlıklı konuda size cevap verdi - {{site_title}}","posted":"{{username}}, \"{{topic}}\" başlıklı konuya yazdı - {{site_title}}","private_message":"{{username}}, \"{{topic}}\" başlıklı konuda size özel mesaj gönderdi - {{site_title}}","linked":"{{username}}, \"{{topic}}\" başlıklı konudaki gönderinize bağlantı yaptı - {{site_title}}"}},"upload_selector":{"title":"Resim ekle","title_with_attachments":"Resim ya da dosya ekle","from_my_computer":"Kendi cihazımdan","from_the_web":"Webden","remote_tip":"resme bağlantı ver","remote_tip_with_attachments":"dosya yada imaj linki {{authorized_extensions}}","local_tip":"cihazınızdan resimler seçin","local_tip_with_attachments":"cihaınızdan imaj yada dosya seçin {{authorized_extensions}}","hint":"(editöre sürekle \u0026 bırak yaparak da yükleyebilirsiniz)","hint_for_supported_browsers":"ayrıca resimleri düzenleyiciye sürükleyip bırakabilir ya da yapıştırabilirsiniz","uploading":"Yükleniyor","select_file":"Dosya seçin","image_link":"resminizin yönleneceği bağlantı"},"search":{"sort_by":"Sırala","relevance":"Alaka","latest_post":"Son Gönderi","most_viewed":"En Çok Görüntülenen","most_liked":"En Çok Beğenilen","select_all":"Tümünü Seç","clear_all":"Tümünü Temizle","too_short":"Aradığın terim çok kısa.","result_count":{"other":"\u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e için sonuçlar {{count}}"},"title":"konu, gönderi, kullanıcı veya kategori ara","no_results":"Hiç bir sonuç bulunamadı.","no_more_results":"Başka sonuç yok.","search_help":"Arama yardımı","searching":"Aranıyor...","post_format":"{{username}} tarafından #{{post_number}}","context":{"user":"@{{username}} kullancısına ait gönderilerde ara","category":"#{{category}} kategorisini ara","topic":"Bu konuda ara","private_messages":"Mesajlarda ara"}},"hamburger_menu":"bir diğer konu ya da kategoriye git","new_item":"yeni","go_back":"geri dön","not_logged_in_user":"güncel aktivitelerin ve ayarların özetinin bulunduğu kullanıcı sayfası","current_user":"kendi kullanıcı sayfana git","topics":{"bulk":{"unlist_topics":"Konuları Listeleme","reset_read":"Okunmuşları Sıfırla","delete":"Konuları Sil","dismiss":"Yoksay","dismiss_read":"Okumadıklarını yoksay","dismiss_button":"Yoksay...","dismiss_tooltip":"Yeni gönderileri görmezden gel yada konuları izlemeyi bırak","also_dismiss_topics":"Bana, tekrar okunmamış olarak gösterilmemesi için bu konuları izlemeyi bırak.","dismiss_new":"Yenileri Yoksay","toggle":"konuların toplu seçimini aç/kapa","actions":"Toplu İşlemler","change_category":"Kategoriyi Değiştir","close_topics":"Konuları Kapat","archive_topics":"Konuları Arşivle","notification_level":"Bildirim Seviyesini Değiştir","choose_new_category":"Konular için yeni bir kategori seçin:","selected":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e konu seçtiniz."},"change_tags":"Etiketleri Değiştir","choose_new_tags":"Konular için yeni etiketler seçin:","changed_tags":"O konuların etiketleri değiştirildi."},"none":{"unread":"Okunmamış konunuz yok.","new":"Yeni konunuz yok.","read":"Henüz herhangi bir konu okumadınız.","posted":"Henüz herhangi bir konuda gönderi oluşturmadınız.","latest":"Son bir konu yok. Bu üzücü.","hot":"Sıcak bir konu yok.","bookmarks":"Henüz bir konu işaretlememişsiniz.","category":"{{category}} konusu yok.","top":"Popüler bir konu yok.","search":"Arama sonuçları yok.","educate":{"new":"\u003cp\u003eYeni konunuz burada görünecektir.\u003c/p\u003e\u003cp\u003eVarsayalına olarak son 2 gün içerisinde oluşturulmuş konular yeni olarak nitelendirilir ve  \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eyeni\u003c/span\u003e ibaresiyle işeretli olarak gösterilir.\u003c/p\u003e\u003cp\u003e \u003ca href=\"%{userPrefsUrl}\"\u003eayarlar\u003c/a\u003e sayfanızı ziyaret ederek bunu değiştirebilirsiniz.\u003c/p\u003e","unread":"\u003cp\u003eOkunmamış konularınız burda görünecektir.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}},"bottom":{"latest":"Daha fazla son konu yok.","hot":"Daha fazla sıcak bir konu yok.","posted":"Daha fazla konu yok.","read":"Daha fazla okunmuş konu yok.","new":"Daha fazla yeni konu yok.","unread":"Daha fazla okunmamış konu yok.","category":"Daha fazla {{category}} konusu yok.","top":"Daha fazla popüler konu yok","bookmarks":"Daha fazla işaretlenmiş konu yok.","search":"Daha fazla arama sonucu yok."}},"topic":{"unsubscribe":{"stop_notifications":"Artık \u003cstrong\u003e{{title}}\u003c/strong\u003e için daha az bildirim alacaksınız.","change_notification_state":"Geçerli bildirim durumunuz"},"create":"Yeni Konu","create_long":"Yeni bir konu oluştur","private_message":"Mesajlaşma başlat","archive_message":{"help":"Mesajı arşivine taşı","title":" Arşiv"},"move_to_inbox":{"title":"Gelen kutusuna taşı","help":"Mesajı yeniden gelen kutusuna taşı"},"list":"Konular","new":"yeni konu","unread":"okunmamış","new_topics":{"other":"{{count}} yeni konu"},"unread_topics":{"other":"{{count}} okunmamış konu"},"title":"Konu","invalid_access":{"title":"Bu konu özel","description":"Üzgünüz, bu konuya erişiminiz yok!","login_required":"Bu konuyu görüntülemek için oturum açmanız gerekiyor."},"server_error":{"title":"Konu yüklenemedi.","description":"Üzgünüz, muhtemelen bir bağlantı sorunundan ötürü bu konuyu yükleyemedik. Lütfen tekrar deneyin. Eğer sorun devam ederse, bizimle iletişime geçin. "},"not_found":{"title":"Konu bulunamadı.","description":"Üzgünüz, bu konuyu bulamadık. Belki de moderatör tarafından kaldırıldı?"},"total_unread_posts":{"other":"bu konuda {{count}} okunmamış gönderi var"},"unread_posts":{"other":"bu konuda {{count}} tane okunmamış eski gönderi var"},"new_posts":{"other":"bu konuda, son okumanızdan bu yana {{count}} yeni gönderi var"},"likes":{"other":"bu konuda {{count}} beğeni var"},"back_to_list":"Konu listesine geri dön","options":"Konu Seçenekleri","show_links":"Bu konunun içindeki bağlantıları göster. ","toggle_information":"konu ayrıntılarını aç/kapa","read_more_in_category":"Daha fazlası için {{catLink}} kategorisine göz atabilir ya da  {{latestLink}}yebilirsiniz.","read_more":"Daha fazla okumak mı istiyorsunuz? {{catLink}} ya da {{latestLink}}.","browse_all_categories":"Bütün kategorilere göz at","view_latest_topics":"en son konuları görüntüle","suggest_create_topic":"Konu oluşturmaya ne dersiniz?","jump_reply_up":"Daha önceki cevaba geç","jump_reply_down":"Daha sonraki cevaba geç","deleted":"Konu silindi ","auto_close_notice":"Bu konu otomatik olarak kapanacak %{timeLeft}.","auto_close_notice_based_on_last_post":"Bu konu son cevaptan %{duration} sonra kapanacak.","auto_close_title":"Otomatik Kapatma Ayarları","auto_close_save":"Kaydet","auto_close_remove":"Bu Konuyu Otomatik Olarak Kapatma","timeline":{"back":"Geri","back_description":"Okunmamış son gönderine dön","replies_short":"%{current} / %{total}"},"progress":{"title":"konu gidişatı","go_top":"en üst","go_bottom":"en alt","go":"git","jump_bottom":"son gönderiye geç","jump_prompt":"Gönderiye git","jump_prompt_long":"Hangi gönderiye geçmek istersin?","jump_bottom_with_number":"%{post_number} numaralı gönderiye geç","total":"tüm gönderiler","current":"şu anki gönderi"},"notifications":{"title":"bu konu hakkında ne sıklıkla bildirim almak istediğini değiştir","reasons":{"mailing_list_mode":"e-posta liste modunu etkinleştirdin, böylece bu konuya gelen yanıtlarla ilgili bildirimleri e-posta yoluyla alabileceksin. ","3_10":"Bu konuyla ilgili bir etiketi izlediğin için bildirim alacaksın.","3_6":"Bu kategoriyi gözlediğiniz için bildirimlerini alacaksınız.","3_5":"Bu konuyu otomatik olarak gözlemeye başladığınız için bildirimlerini alacaksınız.","3_2":"Bu konuyu gözlediğiniz için bildirimlerini alacaksınız.","3_1":"Bu konuyu siz oluşturduğunuz için bildirimlerini alacaksınız.","3":"Bu konuyu gözlediğiniz için bildirimlerini alacaksınız.","2_8":"Be kategoriyi takip ettiğiniz için bildirimlerini alacaksınız.","2_4":"Bu konuya cevap yazdığınız için bildirimlerini alacaksınız.","2_2":"Bu konuyu takip ettiğiniz için bildirimlerini alacaksınız.","2":"\u003ca href=\"/users/{{username}}/preferences\"\u003eBu konuyu okuduğunuz için\u003c/a\u003e bildirimlerini alacaksınız.","1_2":"Birisi @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız.","1":"Birisi @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız.","0_7":"Bu kategoriye ait tüm bildirimleri görmezden geliyorsunuz.","0_2":"Bu konuya ait tüm bildirimleri görmezden geliyorsunuz.","0":"Bu konuya ait tüm bildirimleri görmezden geliyorsunuz."},"watching_pm":{"title":"Gözleniyor","description":"Bu mesajlaşmada ki her yeni gönderi için bir bildirim alacaksınız. Okunmamış ve yeni gönderilerin sayısı konunun yanında belirecek."},"watching":{"title":"Gözleniyor","description":"Bu konudaki her yeni gönderi için bir bildirim alacaksınız. Okunmamış ve yeni gönderilerin sayısı konunun yanında belirecek."},"tracking_pm":{"title":"Takip Ediliyor","description":"Okunmamış ve yeni gönderi sayısı mesajın yanında belirecek. Birisi @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız."},"tracking":{"title":"Takip Ediliyor","description":"Okunmamış ve yeni gönderi sayısı başlığın yanında belirecek. Birisi @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız."},"regular":{"title":"Olağan","description":"Birisi @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız."},"regular_pm":{"title":"Olağan","description":"Birisi @isim şeklinde sizden bahsederse ya da gönderinize mesajla cevap verirse bildirim alacaksınız."},"muted_pm":{"title":"Susturuldu","description":"Bu mesajlaşmayla ilgili hiç bir bildirim almayacaksınız."},"muted":{"title":"Susturuldu","description":"Bu konu en son gönderilerde belirmeyecek, ve hakkında hiçbir bildirim almayacaksınız."}},"actions":{"recover":"Konuyu Geri Getir","delete":"Konuyu Sil","open":"Konuyu Aç","close":"Konuyu Kapat","multi_select":"Gönderileri Seç...","auto_close":"Otomatik Kapat...","pin":"Başa Tuttur...","unpin":"Baştan Kaldır...","unarchive":"Konuyu Arşivden Kaldır","archive":"Konuyu Arşivle","invisible":"Gizle","visible":"Görünür Yap","reset_read":"Görüntüleme Verilerini Sıfırla","make_public":"Herkese Açık Konu Yap","make_private":"Özel mesaj oluştur"},"feature":{"pin":"Başa Tuttur","unpin":"Baştan Kaldır","pin_globally":"Her Yerde Başa Tuttur","make_banner":"Manşet Konusu","remove_banner":"Manşet Konusunu Kaldır"},"reply":{"title":"Cevapla","help":"bu konuya bir cevap oluşturmaya başlayın"},"clear_pin":{"title":"Başa tutturmayı iptal et","help":"Bu konunun başa tutturulması iptal edilsin ki artık konu listenizin en üstünde gözükmesin"},"share":{"title":"Paylaş","help":"bu konunun bağlantısını paylaşın"},"flag_topic":{"title":"Bayrakla","help":"bu gönderiyi kontrol edilmesi için özel olarak bayraklayın ya da bununla ilgili özel bir bildirim yollayın","success_message":"Bu konuyu başarıyla bayrakladınız."},"feature_topic":{"title":"Bu konuyu ön plana çıkar","pin":"Şu zamana kadar bu konunun {{categoryLink}} kategorisinin başında görünmesini sağla","confirm_pin":"Zaten başa tutturulan {{count}} konunuz var. Çok fazla konuyu başa tutturmak yeni ve anonim kullanıcılara sıkıntı çektirebilir. Bu kategoride bir konuyu başa tutturmak istediğinize emin misiniz?","unpin":"Bu konuyu {{categoryLink}} kategorisinin en üstünden kaldır.","unpin_until":"Bu konuyu {{categoryLink}} kategorisinin başından kaldır ya da şu zamana kadar bekle: \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Kullanıcılar kendileri için konunun başa tutturulmasını kaldırabilir.","pin_validation":"Bu konuyu sabitlemek için bir tarih gerekli.","not_pinned":" {{categoryLink}} kategorisinde başa tutturulan herhangi bir konu yok.","already_pinned":{"other":"Şu an {{categoryLink}} kategorisinde başa tutturulan konular: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"pin_globally":"Şu zamana kadar bu konunun bütün konu listelerinin başında yer almasını sağla","confirm_pin_globally":"Zaten her yerde başa tutturulan {{count}} konunuz var. Çok fazla konuyu başa tutturmak yeni ve anonim kullanıcılara sıkıntı çektirebilir. Bir konuyu daha her yerde başa tutturmak istediğinizden emin misiniz?","unpin_globally":"Bu konuyu tüm konu listelerinin en üstünden kaldır.","unpin_globally_until":"Bu konuyu bütün konu listelerinin başından kaldır ya da şu zamana kadar bekle: \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Kullanıcılar kendileri için konunun başa tutturulmasını kaldırabilir.","not_pinned_globally":"Her yerde başa tutturulan herhangi bir konu yok.","already_pinned_globally":{"other":"Şu an her yerde başa tutturulan konular: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"make_banner":"Bu konuyu tüm sayfaların en üstünde görünecek şekilde manşetleştir.","remove_banner":"Tüm sayfaların en üstünde görünen manşeti kaldır.","banner_note":"Kullanıcılar bu manşeti kapatarak yoksayabilirler. Herhangi bir zamanda sadece bir konu manşetlenebilir.","no_banner_exists":"Manşet konusu yok.","banner_exists":"Şu an bir manşet konusu \u003cstrong class='badge badge-notification unread'\u003evar\u003c/strong\u003e."},"inviting":"Davet Ediliyor...","automatically_add_to_groups":"Bu davet aynı zamanda bu gruplara giriş sağlar:","invite_private":{"title":"Mesajlaşmaya Davet Et","email_or_username":"Davet edilenin e-postası ya da kullanıcı adı","email_or_username_placeholder":"e-posta ya da kullanıcı adı","action":"Davet et","success":"O kullanıcıyı bu mesajlaşmaya davet ettik.","success_group":"Grubu bu mesaja katılması için davet ettik.","error":"Üzgünüz, kullanıcı davet edilirken bir hata oluştu.","group_name":"grup adı"},"controls":"Konu Kontrolleri","invite_reply":{"title":"Davet Et","username_placeholder":"kullanıcıadı","action":"Davet Gönder","help":"e-posta veya bildiri aracılığıyla başkalarını bu konuya davet edin","to_forum":"Arkadaşınıza, oturum açması gerekmeden, bir bağlantıya tıklayarak katılabilmesi için kısa bir e-posta göndereceğiz. ","sso_enabled":"Bu konuya davet etmek istediğiniz kişinin kullanıcı adını girin.","to_topic_blank":"Bu konuya davet etmek istediğiniz kişinin kullanıcı adını veya e-posta adresini girin.","to_topic_email":"Bir email adresi girdiniz. Arkadaşınızın konuya hemen cevap verebilmesini sağlayacak bir davetiye e-postalayacağız.","to_topic_username":"Bir kullanıcı adı girdiniz. Kullanıcıya, bu konuya davet bağlantısı içeren bir bildiri yollayacağız.","to_username":"Davet etmek istediğiniz kişinin kullanıcı adını girin. Kullanıcıya, bu konuya davet bağlantısı içeren bir bildiri yollayacağız.","email_placeholder":"isim@örnek.com","success_email":"\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e kullanıcısına davet e-postalandı. Davet kabul edildiğinde size bir bildiri göndereceğiz. Davetlerinizi takip etmek için kullanıcı sayfanızdaki davetler sekmesine göz atın.","success_username":"Kullanıcıyı bu konuya katılması için davet ettik.","error":"Üzgünüz, kullanıcıyı davet edemedik. Zaten davet edilmiş olabilir mi? (Davetler oran sınırlarına tabiidir.)"},"login_reply":"Cevaplamak için oturum açın","filters":{"n_posts":{"other":"{{count}} gönderi"},"cancel":"Filteri kaldır"},"split_topic":{"title":"Yeni Konuya Geç","action":"yeni konuya geç","topic_name":"Yeni Konu Adı","error":"Gönderiler yeni konuya taşınırken bir hata oluştu.","instructions":{"other":"Yeni bir konu oluşturmak ve bu konuyu seçtiğiniz \u003cb\u003e{{count}}\u003c/b\u003e gönderi ile doldurmak üzeresiniz."}},"merge_topic":{"title":"Var Olan Bir Konuya Taşı","action":"var olan bir konuya taşı","error":"Gönderiler konuya aşınırken bir hata oluştu.","instructions":{"other":"Lütfen bu \u003cb\u003e{{count}}\u003c/b\u003e gönderiyi taşımak istediğiniz konuyu seçin. "}},"merge_posts":{"title":"Seçili Gönderileri Birleştir","action":"seçili gönderileri birleştir","error":"Seçili gönderileri birleştirirken bir hata oluştu."},"change_owner":{"title":"Gönderilerin Sahibini Değiştir","action":"sahipliğini değiştir","error":"Gönderilerin sahipliği değiştirilirken bir hata oluştu.","label":"Gönderilerin Yeni Sahibi","placeholder":"yeni sahibin kullanıcı adı","instructions":{"other":"Lütfen \u003cb\u003e{{old_user}}\u003c/b\u003e kullanıcısına ait {{count}} gönderinin yeni sahibini seçin."},"instructions_warn":"Bu gönderi ile ilgili geriye dönük biriken bildirimler yeni kullanıcıya aktarılmayacak.\u003cbr\u003eUyarı: Şu an, yeni kullanıcıya hiç bir gönderi-tabanlı ek bilgi aktarılmıyor. Dikkatli olun."},"change_timestamp":{"title":"Değişiklik Zaman Bilgisi","action":"değişiklik zaman bilgisi","invalid_timestamp":"Zaman bilgisi gelecekte olamaz.","error":"Konunun zaman bilgisini değiştirirken bir hata oluştu.","instructions":"Lütfen konunun yeni zaman bilgisini seçiniz. Konudaki gönderiler aynı zaman farkına sahip olmaları için güncellenecekler."},"multi_select":{"select":"seç","selected":"({{count}}) seçildi","select_replies":"cevaplarıyla seç","delete":"seçilenleri sil","cancel":"seçimi iptal et","select_all":"hepsini seç","deselect_all":"tüm seçimi kaldır","description":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e gönderi seçtiniz."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"alıntıyla cevapla","edit":"{{link}} {{replyAvatar}} {{username}} düzenleniyor","edit_reason":"Neden: ","post_number":"gönderi {{number}}","last_edited_on":"gönderinin en son düzenlenme tarihi","reply_as_new_topic":"Bağlantılı Konu Olarak Cevapla","continue_discussion":"{{postLink}} Gönderisinden tartışmaya devam ediliyor:","follow_quote":"alıntılanan mesaja git","show_full":"Gönderinin Tamamını Göster","show_hidden":"Gizlenmiş içeriği görüntüle.","deleted_by_author":{"other":"(yazarı tarafından geri alınan gönderi,  bayraklanmadığı takdirde %{count} saat içinde otomatik olarak silinecek.)"},"expand_collapse":"aç/kapat","gap":{"other":"gizlenen {{count}} yorumu gör"},"unread":"Gönderi okunmamış","has_replies":{"other":"{{count}} Yanıt"},"has_likes":{"other":"{{count}} Beğeni"},"has_likes_title":{"other":"{{count}} kişi bu gönderiyi beğendi"},"has_likes_title_only_you":"bu gönderiyi beğendiniz","has_likes_title_you":{"other":"siz ve {{count}} diğer kişi bu gönderiyi beğendi"},"errors":{"create":"Üzgünüz, gönderiniz oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.","edit":"Üzgünüz, gönderiniz düzenlenirken bir hata oluştu. Lütfen tekrar deneyin. ","upload":"Üzgünüz, dosya yüklenirken bir hata oluştu. Lütfen tekrar deneyin.","file_too_large":"Üzgünüz, bu dosya çok büyük (maximum size is {{max_size_kb}}kb) Niçin büyük boyutlu dosyanı bir paylaşım servisine yükleyip, sonra bağlantını paylaşmıyorsun ?","too_many_uploads":"Üzgünüz, aynı anda birden fazla dosya yükleyemezsiniz.","too_many_dragged_and_dropped_files":"Üzgünüz, aynı anda 10'dan fazla dosya yükleyemezsiniz.","upload_not_authorized":"Üzgünüz, yüklemeye çalıştığınız dosya tipine izin verilmiyor. (izin verilen uzantılar: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Üzgünüz, yeni kullanıcılar resim yükleyemiyorlar.","attachment_upload_not_allowed_for_new_user":"Üzgünüz, yeni kullanıcılar dosya ekleyemiyorlar.","attachment_download_requires_login":"Üzgünüz, eklentileri indirebilmek için oturum açmanız gerekiyor."},"abandon":{"confirm":"Gönderinizden vazgeçtiğinize emin misiniz?","no_value":"Hayır, kalsın","yes_value":"Evet, vazgeç"},"via_email":"bu gönderi e-posta ile iletildi","via_auto_generated_email":"bu gönderi otomatik bir e-posta yoluyla gönderildi","whisper":"bu gönderi yöneticiler için özel bir fısıltıdır","wiki":{"about":"bu gönderi bir wiki"},"archetypes":{"save":"Seçenekleri kaydet"},"few_likes_left":"Sevgiyi paylaştığınız için teşekkürler! Bugün için sadece birkaç beğeniniz kaldı. ","controls":{"reply":"bu gönderiye bir cevap oluşturmaya başlayın","like":"bu gönderiyi beğen","has_liked":"bu gönderiyi beğendiniz","undo_like":"beğenmekten vazgeç","edit":"bu gönderiyi düzenle","edit_anonymous":"Üzgünüz, ama bu gönderiyi düzenleyebilmek için oturum açmalısınız.","flag":"bu gönderiyi kontrol edilmesi için özel olarak bayraklayın ya da bununla ilgili özel bir bildirim yollayın","delete":"bu gönderiyi sil","undelete":"bu gönderinin silinmesini geri al","share":"bu gönderinin bağlantısını paylaşın","more":"Daha fazla","delete_replies":{"confirm":{"other":"Bu gönderiye verilen {{count}} direk cevabı da silmek istiyor musunuz?"},"yes_value":"Evet, cevapları da sil","no_value":"Hayır, sadece bu gönderiyi"},"admin":"gönderiyle alakalı yönetici işlemleri","wiki":"Wiki Yap","unwiki":"Wiki'yi Kaldır","convert_to_moderator":"Görevli Rengi Ekle","revert_to_regular":"Görevli Rengini Kaldır","rebake":"HTML'i Yeniden Yapılandır","unhide":"Gizleme","change_owner":"sahipliğini değiştir"},"actions":{"flag":"Bayrakla","defer_flags":{"other":"Bayrağı ertele"},"undo":{"off_topic":"Bayrağı geri al","spam":"Bayrağı geri al","inappropriate":"Bayrağı geri al","bookmark":"İşareti geri al","like":"Beğenini geri al","vote":"Oyunu geri al"},"people":{"off_topic":"konu dışı olarak bayrakladı","spam":"spam olarak bayrakladı","inappropriate":"uygunsuz olarak bayrakladı","notify_moderators":"moderatörler bilgilendirdi","notify_user":"mesaj gönderdi","bookmark":"işaretledi","like":"beğendi","vote":"oyladı"},"by_you":{"off_topic":"Bunu konu dışı olarak bayrakladınız","spam":"Bunu spam olarak bayrakladınız","inappropriate":"Bunu uygunsuz olarak bayrakladınız","notify_moderators":"Bunu moderasyon için bayrakladınız","notify_user":"Bu kullanıcıya mesaj yolladınız","bookmark":"Bu gönderiyi işaretlediniz","like":"Bunu beğendiniz","vote":"Bu gönderiyi oyladınız"},"by_you_and_others":{"off_topic":{"other":"Siz ve {{count}} diğer kişi bunu konu dışı olarak bayrakladı"},"spam":{"other":"Siz ve {{count}} diğer kişi bunu spam olarak bayrakladı"},"inappropriate":{"other":"Siz ve {{count}} diğer kişi bunu uygunsuz olarak bayrakladı"},"notify_moderators":{"other":"Siz ve {{count}} diğer kişi bunu denetlenmesi için bayrakladı"},"notify_user":{"other":"Siz ve {{count}} diğer kişi bu kullanıcıya mesaj yolladı"},"bookmark":{"other":"Siz ve {{count}} diğer kişi bu gönderiyi işaretledi"},"like":{"other":"Siz ve {{count}} başka kişi bunu beğendi"},"vote":{"other":"Siz ve {{count}} kişi bu gönderiyi oyladı"}},"by_others":{"off_topic":{"other":"{{count}} kişi bunu konu dışı olarak bayrakladı"},"spam":{"other":"{{count}} kişi bunu spam olarak bayrakladı"},"inappropriate":{"other":"{{count}} kişi bunu uygunsuz olarak bayrakladı"},"notify_moderators":{"other":"{{count}} kişi bunu moderasyon için bayrakladı"},"notify_user":{"other":"{{count}} bu kullanıcıya mesaj yolladı"},"bookmark":{"other":"{{count}} kişi bu gönderiyi işaretledi"},"like":{"other":"{{count}} kişi bunu beğendi"},"vote":{"other":"{{count}} kişi bu gönderiyi oyladı"}}},"delete":{"confirm":{"other":"Tüm bu gönderileri silmek istediğinize emin misiniz?"}},"merge":{"confirm":{"other":"{{sayı}} sayıdaki bu gönderileri birleştirmek istediğinize emin misiniz?"}},"revisions":{"controls":{"first":"İlk revizyon","previous":"Önceki revizyon","next":"Sonraki revizyon","last":"Son revizyon","hide":"Düzenlemeyi gizle","show":"Düzenlemeyi göster","revert":"Bu sürüme geri dön","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"İşlenmiş çıktıyı ekleme ve çıkarmalarla birlikte göster","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"İşlenmiş diff çıktılarını yan yana göster","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"İşlenmemiş diff kaynaklarını yan yana göster","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Raw"}}}},"category":{"can":"yapabilir\u0026hellip;","none":"(kategori yok)","all":"Tüm kategoriler","choose":"Kategori seç\u0026hellip;","edit":"düzenle","edit_long":"Düzenle","view":"Bu Kategorideki Konuları Görüntüle","general":"Genel","settings":"Ayarlar","topic_template":"Konu Şablonu","tags":"Etiketler","tags_allowed_tags":"Sadece bu kategoride kullanılabilir etiketler:","tags_allowed_tag_groups":"Yalnızca bu kategoride kullanılabilir etiket grupları:","tags_placeholder":"(Seçmeli) izin verilen etiketlerin listesi","tag_groups_placeholder":"(Seçmeli) izin verilen etiket gruplarının listesi","delete":"Kategoriyi Sil","create":"Yeni Kategori","create_long":"Yeni bir kategori oluştur","save":"Kategoriyi Kaydet","slug":"Kategori Kalıcı Bağlantısı","slug_placeholder":"(Opsiyonel) bağlantı için tire ile ayırılmış kelimeler","creation_error":"Kategori oluşturulurken hata oluştu.","save_error":"Kategori kaydedilirken hata oluştu.","name":"Kategori Adı","description":"Açıklama","topic":"kategori konusu","logo":"Kategori Logosu Görseli","background_image":"Kategori Arka Planı Görseli","badge_colors":"Rozet renkleri","background_color":"Arka plan rengi","foreground_color":"Ön plan rengi","name_placeholder":"En fazla bir ya da iki kelime","color_placeholder":"Herhangi bir web rengi","delete_confirm":"Bu kategoriyi silmek istediğinize emin misiniz?","delete_error":"Kategoriyi silinirken bir hata oluştu.","list":"Kategorileri Listele","no_description":"Lütfen bu kategori için bir açıklama girin.","change_in_category_topic":"Açıklamayı Düzenle","already_used":"Bu renk başka bir kategori için kullanıldı","security":"Güvenlik","special_warning":"Uyarı: Bu kategori önceden ayarlanmış bir kategoridir ve güvenlik ayarları değiştirilemez. Eğer bu kategoriyi kullanmak istemiyorsanız, başka bir amaçla kullanmak yerine silin.","images":"Resimler","auto_close_label":"Şu kadar süreden sonra konuları otomatik olarak kapat: ","auto_close_units":"saat","email_in":"Özel gelen e-posta adresi:","email_in_allow_strangers":"Hesabı olmayan, anonim kullanıcılardan e-posta kabul et","email_in_disabled":"E-posta üzerinden yeni konu oluşturma özelliği Site Ayarları'nda devre dışı bırakılmış. E-posta üzerinden yeni konu oluşturma özelliğini etkinleştirmek için,","email_in_disabled_click":"\"e-postala\" ayarını etkinleştir","suppress_from_homepage":"Bu kategoriyi ana sayfadan gizle","allow_badges_label":"Bu kategoride rozet verilmesine izin ver","edit_permissions":"İzinleri Düzenle","add_permission":"İzin Ekle","this_year":"bu yıl","position":"pozisyon","default_position":"Varsayılan Pozisyon","position_disabled":"Kategoriler etkinlik sıralarına göre görünecekler. Listelerdeki kategorilerin sıralamalarını kontrol edebilmek için,","position_disabled_click":"\"sabitlenmiş kategori pozisyonları\" ayarını etklinleştirin.","parent":"Üst Kategori","notifications":{"watching":{"title":"Gözleniyor","description":"Bu kategorilerdeki tüm yeni konuları otomatik olarak gözleyeceksiniz. Tüm yeni gönderi ve konular size bildirilecek. Ayrıca, okunmamış ve yeni gönderilerin sayısı ilgili konunun yanında belirecek."},"watching_first_post":{"title":"İlk gönderi izlemeniz","description":"Bu kategorilerde bulunan tüm konuların sadece ilk gönderilerinde bildirim alacaksınız."},"tracking":{"title":"Takip Ediliyor","description":"Bu kategorilerdeki tüm yeni konuları otomatik olarak gözleyeceksiniz. Biri @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız. Ayrıca, okunmamış ve yeni cevapların sayısı ilgili konunun yanında belirecek."},"regular":{"title":"Normal","description":"Birisi @isim şeklinde sizden bahsederse ya da gönderinize cevap verirse bildirim alacaksınız."},"muted":{"title":"Susturuldu","description":"Bu kategorilerdeki yeni konular hakkında herhangi bir bildiri almayacaksınız ve en son gönderilerde belirmeyecekler. "}}},"flagging":{"title":"Topluluğumuzun medeni kalmasına yardımcı olduğunuz için teşekkürler!","action":"Gönderiyi Bayrakla","take_action":"Harekete Geç","notify_action":"Mesaj","official_warning":"Resmi uyarı","delete_spammer":"Spamcıyı Sil","yes_delete_spammer":"Evet, spamcıyı sil","ip_address_missing":"(uygulanamaz)","hidden_email_address":"(gizli)","submit_tooltip":"Özel bayrağı gönder","take_action_tooltip":"Topluluğunuzdan daha fazla bayrak beklemek yerine bunu siz hızlıca yaparak eşiğe erişebilirsiniz","cant":"Üzgünüz, şu an bu gönderiyi bayraklayamazsınız.","notify_staff":"Yetkililere özel olarak bildir","formatted_name":{"off_topic":"Konu Dışı","inappropriate":"Uygunsuz","spam":"Spam"},"custom_placeholder_notify_user":"Açıklayıcı, yapıcı ve her zaman nazik olun.","custom_placeholder_notify_moderators":"Sizi neyin endişelendirdiğini açıklayıcı bir dille bize bildirin ve mümkün olan yerlerde konu ile alakalı bağlantıları paylaşın."},"flagging_topic":{"title":"Topluluğumuzun medeni kalmasına yardımcı olduğunuz için teşekkürler!","action":"Konuyu Bayrakla","notify_action":"Mesaj"},"topic_map":{"title":"Konu Özeti","participants_title":"Sıkça Yazanlar","links_title":"Popüler bağlantılar","links_shown":"Daha fazla bağlantı göster","clicks":{"other":"%{count} tıklama"}},"post_links":{"about":"bu gönderi için daha fazla link koy","title":{"other":"%{count} daha"}},"topic_statuses":{"warning":{"help":"Bu resmi bir uyarıdır."},"bookmarked":{"help":"Bu konuyu işaretlediniz"},"locked":{"help":"Bu konu kapatıldı; artık yeni cevaplar kabul edilmiyor"},"archived":{"help":"Bu başlık arşive kaldırıldı; donduruldu ve değiştirilemez"},"locked_and_archived":{"help":"Bu konu kapatıldı ve arşivlendi; yeni cevaplar kabul edemez ve değiştirilemez."},"unpinned":{"title":"Başa tutturma kaldırıldı","help":"Bu konu sizin için başa tutturulmuyor; normal sıralama içerisinde görünecek"},"pinned_globally":{"title":"Her Yerde Başa Tutturuldu","help":"Bu konu her yerde başa tutturuldu; gönderildiği kategori ve en son gönderilerin en üstünde görünecek"},"pinned":{"title":"Başa Tutturuldu","help":"Bu konu sizin için başa tutturuldu; kendi kategorisinin en üstünde görünecek"},"invisible":{"help":"Bu konu gizli; konu listelerinde görünmeyecek, ve sadece doğrudan bağlantı aracılığıyla erişilebilecek"}},"posts":"Gönderi","posts_long":"bu konuda {{number}} gönderi var","original_post":"Orijinal Gönderi","views":"Gösterim","views_lowercase":{"other":"gösterim"},"replies":"Cevap","views_long":"bu konu {{number}} defa görüntülendi","activity":"Aktivite","likes":"Beğeni","likes_lowercase":{"other":"beğeni"},"likes_long":"bu konuda {{number}} beğeni var","users":"Kullanıcı","users_lowercase":{"other":"kullanıcı"},"category_title":"Kategori","history":"Geçmiş","changed_by":"Yazan {{author}}","raw_email":{"title":"Ham e-posta","not_available":"Müsait değil!"},"categories_list":"Kategori Listesi","filters":{"with_topics":"%{filter} konular","with_category":"%{filter} %{category} konular","latest":{"title":"En son","title_with_count":{"other":"En Son ({{count}})"},"help":"yakın zamanda gönderi alan konular"},"hot":{"title":"Sıcak","help":"en sıcak konulardan bir derleme"},"read":{"title":"Okunmuş","help":"okuduğunuz başlıklar, okunma sırasına göre"},"search":{"title":"Arama","help":"tüm konularda ara"},"categories":{"title":"Kategoriler","title_in":"Kategori - {{categoryName}}","help":"kategori bazında tüm konular"},"unread":{"title":"Okunmamış","title_with_count":{"other":"Okunmamış ({{count}})"},"help":"okunmamış gönderiler bulunan gözlediğiniz ya da takip ettiğiniz konular","lower_title_with_count":{"other":"{{count}} okunmamış"}},"new":{"lower_title_with_count":{"other":"{{count}} yeni"},"lower_title":"yeni","title":"Yeni","title_with_count":{"other":"Yeni ({{count}}) "},"help":"son birkaç günde oluşturulmuş konular"},"posted":{"title":"Gönderilerim","help":"gönderi oluşturduğunuz konular"},"bookmarks":{"title":"İşaretlenenler","help":"işaretlediğiniz konular"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}} kategorisindeki en son konular"},"top":{"title":"En Popüler","help":"geçtiğimiz yıl, ay, hafta veya gündeki en etkin başlıklar","all":{"title":"Tüm Zamanlar"},"yearly":{"title":"Yıllık"},"quarterly":{"title":"Üç aylık"},"monthly":{"title":"Aylı"},"weekly":{"title":"Haftalık"},"daily":{"title":"Günlük"},"all_time":"Tüm Zamanlar","this_year":"Yıl","this_quarter":"Çeyrek","this_month":"Ay","this_week":"Hafta","today":"Bugün","other_periods":"yukarı bak"}},"browser_update":"Malesef,  \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003etarayıcınız bu site için çok eski\u003c/a\u003e. Lütfen \u003ca href=\"http://browsehappy.com\"\u003etarayıcınızı güncelleyin\u003c/a\u003e.","permission_types":{"full":"Oluştur / Cevapla / Bak","create_post":"Cevapla / Bak","readonly":"Bak"},"lightbox":{"download":"indir"},"search_help":{"title":"Arama yardım"},"keyboard_shortcuts_help":{"title":"Klavye Kısayolları","jump_to":{"title":"Şuraya git","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Anasayfa","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Enson","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Yeni","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Okunmamış","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategoriler","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Enüst","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Yer imleri","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mesajlar"},"navigation":{"title":"Navigasyon","jump":"\u003cb\u003e#\u003c/b\u003e Gönderiye git #","back":"\u003cb\u003eu\u003c/b\u003e Geri","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Seçileni taşı \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Seçili konuyu aç","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Önceki/Sonraki bölüm"},"application":{"title":"Uygulama","create":"\u003cb\u003ec\u003c/b\u003e Yeni konu oluştur","notifications":"\u003cb\u003en\u003c/b\u003e Bildirimleri aç","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Hamburger menüyü aç","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Kullanıcı menüsünü aç","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Güncellenmiş konuları göster","search":"\u003cb\u003e/\u003c/b\u003e Ara","help":"\u003cb\u003e?\u003c/b\u003e Klavye yardım sayfasını aç","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Yeni Konuları/Gönderileri Yoksay","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Konuları anımsatma","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Çıkış"},"actions":{"title":"Eylemler","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Konu yer imini değiştir","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Konuyu sabitle/bırak","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Konuyu paylaş","share_post":"\u003cb\u003es\u003c/b\u003e Gönderiyi paylaş","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Bağlantılı konu olarak cevapla","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Konuyu cevapla","reply_post":"\u003cb\u003er\u003c/b\u003e Gönderiyi cevapla","quote_post":"\u003cb\u003eq\u003c/b\u003e Gönderiden alıntı yap","like":"\u003cb\u003el\u003c/b\u003e Gönderiyi beğen","flag":"\u003cb\u003e!\u003c/b\u003e Gönderiyi şikayet et","bookmark":"\u003cb\u003eb\u003c/b\u003e Gönderiyi işaretle","edit":"\u003cb\u003ee\u003c/b\u003e Gönderiyi düzenle","delete":"\u003cb\u003ed\u003c/b\u003e Gönderiyi sil","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Konuyu sustur","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Varsayılan konu","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Konuyu takip et","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Konuyu Takip Et"}},"badges":{"earned_n_times":{"other":"Bu rozet %{count} defa kazanılmış"},"granted_on":"%{date} Tarihinde Verildi","others_count":"Bu rozete sahip diğer kişiler (%{count})","title":"Rozetler","allow_title":"başlık girin","multiple_grant":"birden fazla ödüllendirilmiş","badge_count":{"other":"%{count} Rozet"},"more_badges":{"other":"+%{count} Daha Fazla"},"granted":{"other":"%{count} İzin verildi"},"select_badge_for_title":"Başlık olarak kullanılacak bir rozet seçin","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Başlangıç"},"community":{"name":"Topluluk"},"trust_level":{"name":"Güven Seviyesi"},"other":{"name":"Diğer"},"posting":{"name":"Gönderiliyor"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Tüm etiketler","selector_all_tags":"tüm etiketler","selector_no_tags":"etiket yok","changed":"değişen etiketler:","tags":"Etiketler","choose_for_topic":"bu konu için etiket seçiniz","delete_tag":"Etiketi sil","delete_confirm":"Bu etiketi silmek istiyor musunuz?","rename_tag":"Etiketi Yeniden Adlandır","rename_instructions":"Bu etiket için yeni bir ad seçin:","sort_by":"Sırala:","sort_by_count":"say","sort_by_name":"ad","manage_groups":"Etiket Grubunu Yönet","manage_groups_description":"Etiket gurubunu yönetmek için grup tanımla","filters":{"without_category":"%{filter} %{tag} konular","with_category":"%{category} içerisinkeri konular%{filter} %{tag}","untagged_without_category":"%{filtre} etiketlenmemiş konular","untagged_with_category":" %{kategori} içindeki %{filtre} etiketlenmemiş konular"},"notifications":{"watching":{"title":"İzleniyor","description":"Bu etiketteki tüm yeni konuları takip ediyor olacaksınız. Bu etikete ait yeni tüm konularda ve gönderilerde bildirim alacaksınız, ayrıca yeni gönderiler konuların yanında görünecektir."},"watching_first_post":{"title":"İlk gönderi izlemeniz","description":"Bu etikette bulunan tüm konuların sadece ilk gönderilerinde bildirim alacaksınız."},"tracking":{"title":"İzleme","description":"Bu etiketteki tüm konuları otomatik olarak takip ediyor olacaksınız. Okunmamış yeni gönderilerin bir kısmı konunun yanında görünecektir."},"regular":{"title":"Düzenli","description":"Eğer bir kişi adınızın tagini kullanırsa (@isminiz gibi) veya oluşturduğunuz konuya cevap yazarsa bildirim alacaksınız."},"muted":{"title":"Susturuldu","description":"Bu etikette beliren yeni konular hakkında bildirim almayacaksınız ve bunlar okunmamışlar sekmesinde belirmeyecek."}},"groups":{"title":"Etiket Grupları","about":"Konuları kolayca yönetmek için onlara etiket ekleyiniz.","new":"Yeni grup","tags_label":"Bu gruptaki etiketler:","parent_tag_label":"Üst etiket:","parent_tag_placeholder":"İsteğe Bağlı","parent_tag_description":"Bu gruptaki etiketler aile etiketi yoksa kullanılamaz.","one_per_topic_label":"Bu etiket grubundan her konu için bir etiket ile sınırla","new_name":"Yeni Etiket Grubu","save":"Kaydet","delete":"Sil","confirm_delete":"Bu etiket grubunu silmek istedinizden emin misiniz?"},"topics":{"none":{"unread":"Okunmamış konunuz bulunmuyor.","new":"Yeni konunuz bulunmuyor","read":"Henüz bir konu okumadınız.","posted":"Henüz bir konu oluşturmadınız.","latest":"Yeni eklenen konu bulunmuyor.","hot":"Hareketli konu bulunmuyor.","bookmarks":"Henüz yer imi eklenmiş bir konunuz bulunmuyor.","top":"Üst sırada bir konu bulunmuyor.","search":"Arama sonucu hiçbirşey bulunamadı."},"bottom":{"latest":"Daha fazla yeni eklenmiş konu bulunmuyor.","hot":"Daha fazla hareketli konu bulunmuyor.","posted":"Daha fazla oluşturulmuş konu bulunmuyor.","read":"Okunacak daha fazla konu bulunmuyor.","new":"Daha fazla yeni konu bulunmuyor.","unread":"Daha fazla okunmamış konu bulunmuyor.","top":"Daha falza üst sıralarda konu bulunmuyor.","bookmarks":"Daha fazla imlenmiş konu bulunmuyor.","search":"Daha fazla arama sonucu bulunmuyor."}}},"invite":{"custom_message":"Davetini daha özel hale getirmek için şunu yaz","custom_message_link":"kişiselleştirilmiş mesak","custom_message_placeholder":"Kişiselleştirilmiş mesajınızı düzenleyin","custom_message_template_forum":"Hey, bu foruma üye olsan iyi olur!","custom_message_template_topic":"Hey, bu konu senin için eğleceli olabilir!"},"poll":{"voters":{"other":"oylayan"},"total_votes":{"other":"toplam oy"},"average_rating":"Ortalama oran: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Oylar Genel"},"multiple":{"help":{"at_least_min_options":{"other":"En az \u003cstrong\u003e%{count}\u003c/strong\u003e seçecek seçiniz"},"up_to_max_options":{"other":"\u003cstrong\u003e%{count}\u003c/strong\u003e seçeneğe kadar seçebilirsiniz"},"x_options":{"other":"\u003cstrong\u003e%{count}\u003c/strong\u003e  seçenek seçiniz"},"between_min_and_max_options":"\u003cstrong\u003e%{min}\u003c/strong\u003e ve \u003cstrong\u003e%{max}\u003c/strong\u003e arasında seçenek seçiniz"}},"cast-votes":{"title":"Oyunuzu kullanın","label":"Şimdi oylayın!"},"show-results":{"title":"Anket sonuçlarını göster","label":"Sonuçları göster"},"hide-results":{"title":"Oylarınıza dönün","label":"Sonuçları gizle"},"open":{"title":"Anketi başlat","label":"Başlat","confirm":"Bu anketi başlatmak istediğinize emin misiniz?"},"close":{"title":"Anketi bitir","label":"Bitir","confirm":"Bu anketi bitirmek istediğinize emin misiniz?"},"error_while_toggling_status":"Üzgünüz, anket durumunu değiştirme sırasında hata meydana geldi.","error_while_casting_votes":"Üzgünüz, oylarınızı dönüştürme sırasında hata meydana geldi","error_while_fetching_voters":"Üzgünüz, oy verenleri görüntüleme sırasında hata meydana geldi","ui_builder":{"title":"Anket Oluştur","insert":"Anket Ekle","help":{"options_count":"En az 2 özellik ekleyin"},"poll_type":{"label":"Tür","regular":"Tekli seçim","multiple":"Çoklu Seçim","number":"Sayısal Değerlendirme"},"poll_config":{"max":"Max","min":"Min","step":"Basamak"},"poll_public":{"label":"Oyverenleri görüntüle"},"poll_options":{"label":"Her satıra bir anket seçeneği girin"}}},"type_to_filter":"filtre girin...","admin":{"title":"Discourse Yönetici Paneli","moderator":"Moderatör","dashboard":{"title":"Yönetici Paneli","last_updated":"Yönetici panelinin son güncellenmesi:","version":"Versiyon","up_to_date":"Sisteminiz güncel durumda!","critical_available":"Önemli bir güncelleme var.","updates_available":"Yeni güncellemeler var.","please_upgrade":"Lütfen güncelleyin!","no_check_performed":"Güncelleme kontrolü gerçekleşmedi, lütfen sidekiq'in çalışır durumda olduğundan emin olun.","stale_data":"Güncelleme kontrolü bir süredir gerçekleşmiyor, lütfen sidekiq'in çalışır durumda olduğundan emin olun.","version_check_pending":"Sanırım yeni güncelleme yaptınız. Harika!","installed_version":"Yüklendi","latest_version":"En son","problems_found":"Discourse kurulumuyla ilgili bazı sorunlar bulundu: ","last_checked":"Son kontrol","refresh_problems":"Yenile","no_problems":"Herhangi bir sorun bulunamadı.","moderators":"Moderatörler:","admins":"Yöneticiler:","blocked":"Engellenmiş:","suspended":"Uzaklaştırılmışlar:","private_messages_short":"Mesajlar","private_messages_title":"Mesajlar","mobile_title":"Mobil","space_free":"{{size}} serbest","uploads":"yüklemeler","backups":"Yedekler","traffic_short":"Trafik","traffic":"Uygulama web istekleri","page_views":"API istekleri","page_views_short":"API istekleri","show_traffic_report":"Detaylı Trafik Raporunu Görüntüle","reports":{"today":"Bugün","yesterday":"Dün","last_7_days":"Son 7 Gün","last_30_days":"Son 30 Gün","all_time":"Tüm Zamanlar","7_days_ago":"7 Gün Önce","30_days_ago":"30 Gün Önce","all":"Hepsi","view_table":"tablo","view_graph":"grafik","refresh_report":"Raporu Yenile","start_date":"Başlangıç tarihi","end_date":"Bitiş Tarihi","groups":"Tüm gruplar"}},"commits":{"latest_changes":"En son değişiklikler: lütfen sık güncelleyin!","by":"tarafından"},"flags":{"title":"Bayraklar","old":"Eski","active":"Etkin","agree":"Onayla","agree_title":"Bu bayrağı geçerli ve doğru olarak onayla","agree_flag_modal_title":"Onayla ve...","agree_flag_hide_post":"Onayla (gönderiyi gizle + özel mesaj yolla)","agree_flag_hide_post_title":"Bu gönderiyi gizle ve otomatik olarak kullanıcıya acilen düzenleme yapmasını belirten bir mesaj gönder","agree_flag_restore_post":"Kabul ediyorum (gönderiyi geri getir)","agree_flag_restore_post_title":"Gönderiyi geri getir","agree_flag":"Bayrağı onayla","agree_flag_title":"Bayrağı onayla ve gönderide değişiklik yapma","defer_flag":"Ertele","defer_flag_title":"Bu bayrağı kaldır; şu an için bir seçeneği uygulamak gerekmiyor.","delete":"Sil","delete_title":"Bu bayrağın ait olduğu gönderiyi sil.","delete_post_defer_flag":"Gönderiyi sil ve bayrağı ertele","delete_post_defer_flag_title":"Gönderiyi sil; başka gönderi yoksa, konuyu da sil.","delete_post_agree_flag":"Gönderiyi sil ve bayrağı onayla","delete_post_agree_flag_title":"Gönderiyi sil; başka gönderi yoksa, konuyu da sil.","delete_flag_modal_title":"Sil ve...","delete_spammer":"Spamcıyı Sil","delete_spammer_title":"Kullanıcıyı ve kullanıcıya ait tüm konu ve gönderileri kaldır. ","disagree_flag_unhide_post":"Onaylama (gönderiyi gizleme)","disagree_flag_unhide_post_title":"Bu gönderiye ait tüm bayrakları kaldır ve gönderiyi tekrar görünür hale getir","disagree_flag":"Onaylama","disagree_flag_title":"Bu bayrağı geçersiz ya da yanlış sayarak reddet","clear_topic_flags":"Tamam","clear_topic_flags_title":"Bu konu araştırıldı ve sorunlar çözüldü. Bayrakları kaldırmak için Tamam butonuna basın. ","more":"(daha fazla cevap...)","dispositions":{"agreed":"onaylandı","disagreed":"onaylanmadı","deferred":"ertelendi"},"flagged_by":"Bayraklayan","resolved_by":"Çözen","took_action":"İşlem uygulandı","system":"Sistem","error":"Bir şeyler ters gitti","reply_message":"Yanıtla","no_results":"Bayraklanan içerik yok.","topic_flagged":"Bu \u003cstrong\u003ekonu\u003c/strong\u003e bayraklandı.","visit_topic":"Aksiyon almak için konuyu ziyaret edin","was_edited":"İlk bayraktan edilmesinden sonra gönderi düzenlendi","previous_flags_count":"Bu gönderi daha önce {{count}} defa bayraklanmış.","summary":{"action_type_3":{"other":"konu dışı x{{count}}"},"action_type_4":{"other":"uygunsuz x{{count}}"},"action_type_6":{"other":"özel x{{count}}"},"action_type_7":{"other":"özel x{{count}}"},"action_type_8":{"other":"spam x{{count}}"}}},"groups":{"primary":"Ana Grup","no_primary":"(ana grup yok)","title":"Grup","edit":"Grupları Düzenle","refresh":"Yenile","new":"Yeni","selector_placeholder":"kullanıcı adı girin","name_placeholder":"Grup adı, kullanıcı adındaki gibi boşluksuz olmalı","about":"Grup üyeliğinizi ve isimleri burada düzenleyin","group_members":"Grup üyeleri","delete":"Sil","delete_confirm":"Grup silinsin mi?","delete_failed":"Grup silinemedi. Bu otomatik oluşturulmuş bir grup ise, yok edilemez.","delete_member_confirm":"'%{username}' adlı kullanıcıyı '%{group}' grubundan çıkart?","delete_owner_confirm":"'%{username}' için sahiplik imtiyazı kaldırılsın mı?","name":"Ad","add":"Ekle","add_members":"Üye ekle","custom":"Özel","bulk_complete":"Kullanıcılar gruba eklendi.","bulk":"Topluca Gruba Ekle","bulk_paste":"Kullanıcı adı yada eposta listesini yapıştırın, her satıra bir tane gelecek:","bulk_select":"(bir grup seçin)","automatic":"Otomatik","automatic_membership_email_domains":"Bu listedeki bir e-posta alan adıyla kaydolan kullanıcılar otomatik olarak bu gruba eklenecekler:","automatic_membership_retroactive":"Varolan kayıtlı kullanıcıları eklemek için aynı e-posta alan adı kuralını uygula","default_title":"Bu gruptaki tüm kullanıcılar için varsayılan başlık","primary_group":"Otomatik olarak ana grup yap","group_owners":"Sahipler","add_owners":"Sahiplik ekle","incoming_email":"Özel gelen e-posta adresi","incoming_email_placeholder":"e-posta adresi girin"},"api":{"generate_master":"Ana API Anahtarı Üret","none":"Şu an etkin API anahtarı bulunmuyor.","user":"Kullanıcı","title":"API","key":"API Anahtarı","generate":"Oluştur","regenerate":"Tekrar Oluştur","revoke":"İptal Et","confirm_regen":"API anahtarını yenisi ile değiştirmek istediğinize emin misiniz?","confirm_revoke":"Anahtarı iptal etmek istediğinize emin misiniz?","info_html":"API anahtarınız JSON çağrıları kullanarak konu oluşturup güncelleyebilmenize olanak sağlayacaktır.","all_users":"Tüm Kullanıcılar","note_html":"Bu anahtarı \u003cstrong\u003egizli\u003c/strong\u003e tutun, anahtara sahip kullanıcılar her hangi bir kullanıcı adı altında istedikleri gönderiyi oluşturabilirler."},"plugins":{"title":"Eklentiler","installed":"Yüklü Eklentiler","name":"İsim","none_installed":"Yüklenmiş herhangi bir eklentiniz yok.","version":"Versiyon","enabled":"Etkinleştirildi mi?","is_enabled":"E","not_enabled":"H","change_settings":"Ayarları Değiştir","change_settings_short":"Ayarlar","howto":"Nasıl eklenti yükleyebilirim?"},"backups":{"title":"Yedekler","menu":{"backups":"Yedekler","logs":"Kayıtlar"},"none":"Yedek bulunmuyor.","read_only":{"enable":{"title":"Salt okuma modunu etkinleştir","label":"Salt okumayı etkinleştir","confirm":"Salt okuma modunu aktifleştirmek istediğinizden emin misiniz?"},"disable":{"title":"Salt okuma modunu engelle","label":"Salt okumayı engelle"}},"logs":{"none":"Henüz kayıt bulunmuyor..."},"columns":{"filename":"Dosya adı","size":"Boyut"},"upload":{"label":"Yedek Yükle","title":"Bu oluşuma bir yedekleme yükle","uploading":"Yükleniyor...","success":"'{{filename}}' başarıyla yüklendi.","error":"'{{filename}}': {{message}} yüklenirken bir hata oluştu"},"operations":{"is_running":"İşlem devam ediyor...","failed":"{{operation}} gerçekleşemedi. Lütfen kayıtları kontrol edin.","cancel":{"label":"İptal","title":"Devam eden işlemi iptal et","confirm":"Devam eden işlemi iptal etmek istediğinize emin misiniz?"},"backup":{"label":"Yedek Oluştur","title":"Yedek oluştur","confirm":"Yeni bir yedekleme başlatmak istiyor musunuz?","without_uploads":"Evet (dosya eklemeyin)"},"download":{"label":"İndir","title":"Yedeği indir"},"destroy":{"title":"Yedeği kaldır","confirm":"Bu yedeği yok etmek istediğinize emin misiniz?"},"restore":{"is_disabled":"Geri getirme site ayarlarında devredışı bırakılmış.","label":"Geri Yükle","title":"Yedeği geri getir","confirm":"Bu yedekten geri dönmek istediğinize emin misiniz?"},"rollback":{"label":"Geri al","title":"Veritabanını calışan son haline geri al.","confirm":"Veritabanını çalışan son haline döndürmek istediğinize emin misiniz?"}}},"export_csv":{"user_archive_confirm":"Gönderilerinizi indirmek istediğinize emin misiniz ?","success":"Dışarı aktarma başlatıldı, işlem tamamlandığında mesajla bilgilendirileceksiniz.","failed":"Dışa aktarırken hata oluştu. Lütfen kayıtları kontrol edin.","rate_limit_error":"Gönderiler günde bir kez indirilebilir, lütfen yarın tekrar deneyin.","button_text":"Dışa aktar","button_title":{"user":"Tüm kullanıcı listesini CSV formatında dışa aktar.","staff_action":"Tüm görevli aksiyonları logunu CSV formatında dışa aktar.","screened_email":"Tüm taranmış e-postalar listesini CSV formatında dışa aktar.","screened_ip":"Tüm taranmış IPler listesini CSV formatında dışa aktar.","screened_url":"Tüm taranmış URLler listesini CSV formatında dışa aktar."}},"export_json":{"button_text":"Dışarı Aktar"},"invite":{"button_text":"Davetleri Gönder","button_title":"Davetleri Gönder"},"customize":{"title":"Özelleştir","long_title":"Site Özelleştirmeleri","css":"CSS","header":"Başlık","top":"En Kısım","footer":"Alt Kısım","embedded_css":"Gömülü CSS","head_tag":{"text":"\u003c/head\u003e","title":"\u003c/head\u003e etiketinden önce eklenecek HTML"},"body_tag":{"text":"\u003c/body\u003e","title":"\u003c/body\u003e etiketinden önce eklenecek HTML"},"override_default":"Standart stil sayfasını eklemeyin","enabled":"Etkinleştirildi mi?","preview":"önizleme","undo_preview":"önizlemeyi kaldır","rescue_preview":"varsayılan stil","explain_preview":"Websitesine bu özelleştirilmiş stil sayfası ile bak","explain_undo_preview":"Şu an etkin olan özelleştirilmiş stil sayfasına geri dön","explain_rescue_preview":"Websitesine varsayılan stil sayfası ile bak","save":"Kaydet","new":"Yeni","new_style":"Yeni Stil","import":"İçeri Aktar","import_title":"Bir dosya seçin ya da kopyalayıp yapıştırın","delete":"Sil","delete_confirm":"Bu özelleştirmeyi sil?","about":"Websitesindeki CSS stil sayfalarını ve HTML başlıklarını değiştir. Özelleştirme ekleyerek başla.","color":"Renk","opacity":"Opaklık","copy":"Kopyala","email_templates":{"title":"E-posta Şablonları","subject":"Konu","multiple_subjects":"Bu e-posta şablonunda birden fazla konu mevcut.","body":"İçerik","none_selected":"Düzenlemeye başlamak için içerik tipi seçin. ","revert":"Değişiklikleri Sıfırla","revert_confirm":"Değişiklikleri sıfırlamak istediğinize emin misiniz?"},"css_html":{"title":"CSS/HTML","long_title":"CSS ve HTML Özelleştirmeleri"},"colors":{"title":"Renkler","long_title":"Renk Düzenleri","about":"Websitesindeki renkleri CSS yazmadan değiştir. Renk düzeni ekleyerek başla.","new_name":"Yeni Renk Düzeni","copy_name_prefix":"Kopyası","delete_confirm":"Bu renk düzenini sil?","undo":"geri al","undo_title":" Son kayıt esnasında yapılan bu renkteki değişiklikleri geri al.","revert":"eski haline getir","revert_title":"Bu rengi Discourse'un varsayılan renk düzenine sıfırla.","primary":{"name":"birincil","description":"Çoğu yazı, ikon ve kenarların rengi."},"secondary":{"name":"ikincil","description":"Ana arkaplan ve bazı butonların yazı rengi."},"tertiary":{"name":"üçüncül","description":"Bağlantı, bazı buton, bildiri ve vurguların rengi."},"quaternary":{"name":"dördüncül","description":"Navigasyon bağlantıları."},"header_background":{"name":"başlık arkaplanı","description":"Websitesi'nin sayfa başlığının arkaplan rengi."},"header_primary":{"name":"birincil başlık","description":"Websitesi'nin sayfa başlığındaki yazı ve ikonlar."},"highlight":{"name":"vurgula","description":"Sayfada vurgulanmış ögelerin, gönderi ve konu gibi, arkaplan rengi."},"danger":{"name":"tehlike","description":"Gönderi ve konu silme gibi aksiyonlar için vurgulama rengi."},"success":{"name":"başarı","description":"Seçeneğin başarılı olduğunu göstermek için kullanılır."},"love":{"name":"sevgi","description":"Beğen butonunun rengi."}}},"email":{"title":"E-postalar","settings":"Ayarlar","templates":"Şablonlar","preview_digest":"Özeti Önizle","sending_test":"Test e-postası gönderiliyor...","error":"\u003cb\u003eHATA\u003c/b\u003e - %{server_error}","test_error":"Test e-postasının gönderilmesinde sorun yaşandı. Lütfen e-posta ayarlarınızı tekrar kontrol edin, yer sağlayıcınızın e-posta bağlantılarını bloke etmediğinden emin olun, ve tekrar deneyin.","sent":"Gönderildi","skipped":"Atlandı","bounced":"Geri sekenler","received":"Alındı","rejected":"Reddedildi","sent_at":"Gönderildiği Zaman","time":"Zaman","user":"Kullanıcı","email_type":"E-posta Türü","to_address":"Gönderi Adresi","test_email_address":"test için e-posta adresi","send_test":"Test E-postası Gönder","sent_test":"gönderildi!","delivery_method":"Gönderme Metodu","preview_digest_desc":"Durgun kullanıcılara gönderilen özet e-postaların içeriğini önizle.","refresh":"Yenile","format":"Format","html":"html","text":"yazı","last_seen_user":"Son Görülen Kullanıcı:","reply_key":"Cevapla Tuşu","skipped_reason":"Nedeni Atla","incoming_emails":{"from_address":"Gönderen","to_addresses":"Kime","cc_addresses":"Cc","subject":"Konu","error":"Hata","none":"Gelen e-posta yok.","modal":{"title":"Gelen E-posta Detayları","error":"Hata","headers":"Başlıklar","subject":"Konu","body":"İçerik","rejection_message":"Ret E-postası"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Konu...","error_placeholder":"Hata"}},"logs":{"none":"Hiç bir kayıt bulunamadı.","filters":{"title":"Filtre","user_placeholder":"kullanıcıadı","address_placeholder":"isim@örnek.com","type_placeholder":"özet, üye olma...","reply_key_placeholder":"cevapla tuşu","skipped_reason_placeholder":"neden"}}},"logs":{"title":"Kayıtlar","action":"İşlem","created_at":"Oluşturuldu","last_match_at":"En Son Eşlenen","match_count":"Eşleşmeler","ip_address":"IP","topic_id":"Konu IDsi","post_id":"Gönderi IDsi","category_id":"Kategori ID","delete":"Sil","edit":"Düzenle","save":"Kaydet","screened_actions":{"block":"engelle","do_nothing":"hiçbir şey yapma"},"staff_actions":{"title":"Görevli Seçenekleri","instructions":"Kullanıcı adları ve aksiyonlara tıklayarak listeyi filtrele. Profil resimlerine tıklayarak kullanıcı sayfalarına git.","clear_filters":"Hepsini Göster","staff_user":"Görevli Kullanıcı","target_user":"Hedef Kullanıcı","subject":"Konu","when":"Ne zaman","context":"Durum","details":"Detaylar","previous_value":"Önceki","new_value":"Yeni","diff":"Diff","show":"Göster","modal_title":"Detaylar","no_previous":"Bir önceki değer yok.","deleted":"Yeni değer yok. Kayıt silindi.","actions":{"delete_user":"kullanıcıyı sil","change_trust_level":"güven seviyesini değiştir","change_username":"kullanıcı adını değiştir","change_site_setting":"websitesi ayarlarını değiştir","change_site_customization":"websitesinin özelleştirmesini değiştir","delete_site_customization":"websitesinin özelleştirmesini sil","change_site_text":"site metnini değiştir","suspend_user":"kullanıcıyı uzaklaştır","unsuspend_user":"kullanıcıyı uzaklaştırma","grant_badge":"rozet ver","revoke_badge":"rozeti iptal et","check_email":"e-posta kontrol et","delete_topic":"konuyu sil","delete_post":"gönderiyi sil","impersonate":"rolüne gir","anonymize_user":"kullanıcıyı anonimleştir","roll_up":"IP bloklarını topla","change_category_settings":"kategori ayarlarını değiştir","delete_category":"kategoriyi sil","create_category":"kategori oluştur","block_user":"kullanıcıyı blokla","unblock_user":"kullanıcı engelini kaldır","grant_admin":"yönetici yetkisi ver","revoke_admin":"yönetici yetkisini kaldır","grant_moderation":"moderasyon yetkisi ver","revoke_moderation":"moderasyon yetkisini kaldır","backup_operation":"yedek operasyonu","deleted_tag":"silinmiş etiket","renamed_tag":"yeniden adlandırılmış etiket","revoke_email":"e-posta kaldır"}},"screened_emails":{"title":"Taranmış E-postalar","description":"Biri yeni bir hesap oluşturmaya çalıştığında, aşağıdaki e-posta adresleri kontrol edilecek ve kayıt önlenecek veya başka bir aksiyon alınacak.","email":"E-posta Adresi","actions":{"allow":"İzin Ver"}},"screened_urls":{"title":"Taranmış Bağlantılar","description":"Burada listenen URLler spamci olduğu tespit edilmiş kullanıcılar tarafından gönderilerde kullanılmış.","url":"Bağlantı","domain":"Alan Adı"},"screened_ips":{"title":"Taranmış IPler","description":"İzlenen IP adresleri. IP adreslerini beyaz listeye aktarmak için \"İzin ver\"i kullan.","delete_confirm":"%{ip_address} için konulan kuralı kaldırmak istediğinize emin misiniz?","roll_up_confirm":"Tüm ortaklaşa taranmış IP adreslerini subnetlere toplamak istediğinize emin misiniz?","rolled_up_some_subnets":"Bu subnetlere başarıyla toplanmış tüm engellenen IP girişleri: %{subnets}.","rolled_up_no_subnet":"Toplanacak bir şey bulunamadı.","actions":{"block":"Engelle","do_nothing":"İzin Ver","allow_admin":"Yöneticiye İzin Ver"},"form":{"label":"Yeni:","ip_address":"IP adresi","add":"Ekle","filter":"Ara"},"roll_up":{"text":"Topla","title":"En az 'min_ban_entries_for_roll_up' adet giriş olduğu takdirde yeni subnet engelleme girişleri yaratır."}},"logster":{"title":"Hata Kayıtları"}},"impersonate":{"title":"Rolüne gir","help":"Hata bulma ve giderme amaçları için, bu aracı kullanarak kullanıcının rolüne girin. İşiniz bitince sistemdne çıkış yapmanız gerekecek.","not_found":"Bu kullanıcı bulunamadı.","invalid":"Üzgünüz, bu kullanıcının rolüne giremezsiniz."},"users":{"title":"Kullanıcılar","create":"Yönetici Kullanıcı Ekle","last_emailed":"Son E-posta Gönderimi","not_found":"Üzgünüz, bu kullanıcı adı sistemde yok.","id_not_found":"Üzgünüz, bu kullanıcı adı sistemimizde bulunmuyor.","active":"Etkin","show_emails":"E-postaları Göster","nav":{"new":"Yeni","active":"Etkin","pending":"Bekleyen","staff":"Görevli","suspended":"Uzaklaştırılmış","blocked":"Engellenmiş","suspect":"Kuşkulanılan"},"approved":"Onaylanmış mı?","approved_selected":{"other":"({{count}}) kullanıcıyı  onayla "},"reject_selected":{"other":"({{count}}) kullanıcıyı reddet"},"titles":{"active":"Etkin Kullanıcılar","new":"Yeni Kullanıcılar","pending":"Gözden Geçirilmeyi Bekleyen Kullanıcılar","newuser":"Güven seviyesi 0 (Yeni kullanıcı) olan kullanıcılar","basic":"Güven seviyesi 1 (Acemi kullanıcı) olan kullanıcılar","member":"Güven seviyesi 2 (Üye) olan kullanıcılar","regular":"Güven seviyesi 3 (Müdavim) olan kullanıcılar","leader":"Güven seviyesi 4 (Lider) olan kullanıcılar","staff":"Görevli","admins":"Yöneticiler","moderators":"Moderatörler","blocked":"Engellenen Kullanıcılar","suspended":"Uzaklaştırılmış Kullanıcılar","suspect":"Kuşkulanılan Kullanıcılar"},"reject_successful":{"other":"Başarıyla reddedilmiş %{count}  kullanıcı."},"reject_failures":{"other":"Reddedilemeyen %{count}  kullanıcı."},"not_verified":"Onaylanmayan","check_email":{"title":"Bu kullanıcının e-posta adresini ortaya çıkar","text":"Göster"}},"user":{"suspend_failed":"Bu kullanıcı uzaklaştırılırken bir şeyler ters gitti {{error}}","unsuspend_failed":"Bu kullanıcının uzaklaştırması kaldırılırken bir şeyler ters gitti {{error}}","suspend_duration":"Kullanıcı ne kadar uzun bir süre için uzaklaştırılacak?","suspend_duration_units":"(günler)","suspend_reason_label":"Neden uzaklaştırıyorsunuz? Buraya yazdıklarınız bu kullanıcının profil sayfasında \u003cb\u003eherkese gözükecek\u003cb\u003e ve sistemde oturum açtığı anda kullanıcıya gösterilecek. Lütfen yazıyı kısa tutun.","suspend_reason":"Neden","suspended_by":"Uzaklaştıran","delete_all_posts":"Tüm gönderileri sil","suspend":"Uzaklaştır","unsuspend":"Uzaklaştırmayı geri al","suspended":"Uzaklaştırıldı mı?","moderator":"Moderatör mü?","admin":"Yönetici mi?","blocked":"Engellendi mi?","staged":"Aşamalı?","show_admin_profile":"Yönetici","edit_title":"Başlığı Düzenle","save_title":"Başlığı Kaydet","refresh_browsers":"Tarayıcıyı sayfa yenilemesine zorla","refresh_browsers_message":"Mesaj tüm kullanıcılara gönderildi!","show_public_profile":"Herkese Açık Profili Görüntüle","impersonate":"Rolüne gir","ip_lookup":"IP Arama","log_out":"Çıkış Yap","logged_out":"Kullanıcının tüm cihazlarda oturumu kapatılmış","revoke_admin":"Yöneticiliğini İptal Et","grant_admin":"Yönetici Yetkisi Ver","revoke_moderation":"Moderasyonu İptal Et","grant_moderation":"Moderasyon Yetkisi Ver","unblock":"Engeli Kaldır","block":"Engelle","reputation":"İtibar","permissions":"İzinler","activity":"Aktivite","like_count":"Beğenileri / Beğendikleri","last_100_days":"son 100 günde","private_topics_count":"Özel Konular","posts_read_count":"Okuduğu Gönderiler","post_count":"Oluşturduğu Gönderiler","topics_entered":"Görüntülediği Konular","flags_given_count":"Verilen Bayraklar","flags_received_count":"Alınan Bayraklar","warnings_received_count":"Uyarılar Alındı","flags_given_received_count":"Alınan / Verilen Bayraklar","approve":"Onayla","approved_by":"onaylayan","approve_success":"Kullanıcı onaylandı ve etkinleştirme bilgilerini içeren bir e-posta yollandı.","approve_bulk_success":"Tebrikler! Seçilen tüm kullanıcılar onaylandı ve bilgilendirildi.","time_read":"Okunma Süresi","anonymize":"Kullanıcıyı Anonimleştir","anonymize_confirm":"Bu hesabı anonimleştirmek istediğinize EMİN misiniz? Kullanıcı adı ve e-posta değiştirilecek, ve tüm profil bilgileri sıfırlanacak.","anonymize_yes":"Evet, bu hesap anonimleştir","anonymize_failed":"Hesap anonimleştirilirken bir hata oluştu.","delete":"Kullanıcıyı Sil","delete_forbidden_because_staff":"Yöneticiler ve moderatörler silinemez.","delete_posts_forbidden_because_staff":"Yöneticiler ve moderatörlerin tüm gönderileri silinemez.","delete_forbidden":{"other":"Gönderisi olan kullanıcılar silinemez. Kullanıcıyı silmeden önce tüm gönderilerini silin. (%{count} günden eski gönderiler silinemez.)"},"cant_delete_all_posts":{"other":"Tüm gönderileri silemezsiniz. Bazı gönderiler %{count} günden daha eski.  (delete_user_max_post_age ayarı.)"},"cant_delete_all_too_many_posts":{"other":"Tüm gönderileri silemezsiniz çünkü kullanıcının %{count} 'ten daha fazla gönderisi var. (delete_all_posts_max)"},"delete_confirm":"Bu kullanıcıyı silmek istediğinize EMİN misiniz? Bu işlem geri alınamaz!","delete_and_block":"Sil ve bu e-posta ve IP adresini \u003cb\u003eengelle\u003c/b\u003e","delete_dont_block":"Sadece sil","deleted":"Kullanıcı silinmiş.","delete_failed":"Kullanıcı silinirken bir hata oluştu. Kullanıcıyı silmeye çalışmadan önce tüm gönderilerin silindiğinden emin olun. ","send_activation_email":"Etkinleştirme E-postası Gönder","activation_email_sent":"Etkinleştirme e-postası gönderildi.","send_activation_email_failed":"Tekrar etkinleştirme e-postası gönderilirken bir sorun yaşandı. %{error}","activate":"Hesabı aktifleştir","activate_failed":"Kullanıcı etkinleştirilirken bir sorun yaşandı.","deactivate_account":"Hesabı Pasifleştir","deactivate_failed":"Kullanıcı deaktive edilirken bir sorun yaşandı.","unblock_failed":"Kullanıcının engeli kaldırılırken bir sorun yaşandı.","block_failed":"Kullanıcı engellenirken bir sorun yaşandı.","block_confirm":"Bu kullanıcıyı bloklamak istediğinize emin misiniz? Bunu yaparsanız yeni başlık ya da gönderi oluşturamayacak.","block_accept":"Evet, bu kullanıcıyı blokla","bounce_score":"Geri Sekme Skoru","reset_bounce_score":{"label":"Yenile","title":"Geri sekme skorunu 0'a çek"},"deactivate_explanation":"Deaktive edilmiş bir kullanıcı e-postasını tekrar doğrulamalı.","suspended_explanation":"Uzaklaştırılmış kullanıcılar sistemde oturum açamaz.","block_explanation":"Engellenmiş bir kullanıcı gönderi oluşturamaz veya konu başlatamaz.","staged_explanation":"Aşamalı bir kullanıcı sadece belirli konularda e-posta ile gönderide bulunabilir.","bounce_score_explanation":{"none":"Bu e-posta adresinden yakın zamanda hiç geri sekme alınmadı.","some":"Bu e-posta adresinden yakın zamanda bazı geri sekmeler alındı. ","threshold_reached":"Bu e-posta adresinden birçok geri sekme alındı. "},"trust_level_change_failed":"Kullanıcının güven seviyesi değiştirilirken bir sorun yaşandı.","suspend_modal_title":"Kullanıcıyı Uzaklaştır","trust_level_2_users":"Güven Seviyesi 2 Olan Kullanıcılar","trust_level_3_requirements":"Güven Seviyesi 3 Gereksinimleri","trust_level_locked_tip":"güven seviyesi kitlendi, sistem kullanıcının seviyesini ne yükseltebilecek ne de düşürebilecek","trust_level_unlocked_tip":"güven seviyesi kilidi çözüldü, sistem kullanıcının seviyesini yükseltebilir ya da düşürebilir","lock_trust_level":"Güven Seviyesini Kilitle","unlock_trust_level":"Güvenlik Seviyesi Kilidini Aç","tl3_requirements":{"title":"Güven Seviyesi 3 için Gerekenler","value_heading":"Değer","requirement_heading":"Gereksinim","visits":"Ziyaretler","days":"gün","topics_replied_to":"Cevaplanan Konular","topics_viewed":"Görüntülenmiş Konular","topics_viewed_all_time":"Görüntülenmiş Konular (Tüm zamanlar)","posts_read":"Okunmuş Gönderiler","posts_read_all_time":"Okunmuş Gönderiler (Tüm zamanlarda)","flagged_posts":"Bayraklanan Gönderiler","flagged_by_users":"Bayraklayan Kullanıcılar","likes_given":"Verilen Beğeniler","likes_received":"Alınan Beğeniler","likes_received_days":"Alınan beğeniler: tekil günlük","likes_received_users":"Alınan beğeniler: tekil kullanıcı","qualifies":"Güven seviyesi 3 için yeterli.","does_not_qualify":"Güven seviyesi 3 için yeterli değil.","will_be_promoted":"Yakinda terfi ettirilecek.","will_be_demoted":"Yakında seviyesi düşürülecek","on_grace_period":"Şu an terfisi hoşgörü süresinde, seviyesi düşürülmeyecek","locked_will_not_be_promoted":"Güven seviyesi kilitlendi. Seviyesi hiç bir zaman yükseltilmeyecek.","locked_will_not_be_demoted":"Güven seviyesi kilitlendi. Seviyesi hiç bir zaman düşürülmeyecek."},"sso":{"title":"Tek Oturum Açma","external_id":"Harici ID","external_username":"Kullanıcı adı","external_name":"İsim","external_email":"E-posta","external_avatar_url":"Profil Görseli Bağlantısı"}},"user_fields":{"title":"Kullanıcı Alanları","help":"Kullanıcıların doldurabileceği alanlar ekleyin.","create":"Kullanıcı Alanı Oluştur","untitled":"İsimsiz","name":"Alan Adı","type":"Alan Türü","description":"Alan Açıklaması","save":"Kaydet","edit":"Düzenle","delete":"Sil","cancel":"İptal et","delete_confirm":"Bu kullanıcı alanını silmek istediğinize emin misiniz?","options":"Seçenekler","required":{"title":"Kayıt olurken zorunlu mu?","enabled":"gerekli","disabled":"isteğe bağlı"},"editable":{"title":"Üyelik sonrası düzenlenebilir mi?","enabled":"düzenlenebilir","disabled":"düzenlenemez"},"show_on_profile":{"title":"Herkese açık profilde göster?","enabled":"profilde gösteriliyor","disabled":"profilde gösterilmiyor"},"show_on_user_card":{"title":"Kullanıcı profilinde gösterilsin mi?","enabled":"Kullanıcı profilinde göster","disabled":"Kullanıcı profilinde gösterme"},"field_types":{"text":"Yazı Alanı","confirm":"Onay","dropdown":"Açılır liste"}},"site_text":{"description":"Forumunuzdaki herhangi bir metni özelleştirebilirsiniz. Lütfen aşağıda arayarak başlayın: ","search":"Düzenlemek istediğiniz metni arayın","title":"Yazı İçeriği","edit":"düzenle","revert":"Değişiklikleri Sıfırla","revert_confirm":"Değişiklikleri sıfırlamak istediğinize emin misiniz?","go_back":"Aramaya geri dön","recommended":"İzleyen metni ihtiyaçlarınıza uygun şekilde özelleştimenizi öneririz:","show_overriden":"Sadece değiştirdiklerimi göster"},"site_settings":{"show_overriden":"Sadece değiştirdiklerimi göster","title":"Ayarlar","reset":"sıfırla","none":"Hiçbiri","no_results":"Hiç sonuç bulunamadı.","clear_filter":"Temizle","add_url":"URL ekle","add_host":"sunucu ekle","categories":{"all_results":"Hepsi","required":"Gerekli Ayarlar","basic":"Genel Ayarlar","users":"Kullanıcılar","posting":"Gönderiler","email":"E-posta","files":"Dosyalar","trust":"Güven Seviyeleri","security":"Güvenlik","onebox":"Tek Kutu","seo":"SEO","spam":"Spam","rate_limits":"Oran Sınırları","developer":"Geliştirici","embedding":"Yerleştirme","legal":"Yasal","uncategorized":"Diğer","backups":"Yedekler","login":"Oturum Açma","plugins":"Eklentiler","user_preferences":"Kullanıcı Tercihleri","tags":"Etiketler"}},"badges":{"title":"Rozetler","new_badge":"Yeni Rozet","new":"Yeni","name":"İsim","badge":"Rozet","display_name":"Görünen Ad","description":"Açıklama","long_description":"Uzun Açıklama","badge_type":"Rozet Türü","badge_grouping":"Grup","badge_groupings":{"modal_title":"Rozet Gruplamaları"},"granted_by":"Tarafından Verildi","granted_at":"Tarihinde Verildi","reason_help":"(Bir mesaj ya da konuya bağlantı)","save":"Kaydet","delete":"Sil","delete_confirm":"Bu rozeti silmek istediğinize emin misiniz?","revoke":"İptal Et","reason":"Neden","expand":"Genişlet \u0026hellip;","revoke_confirm":"Bu rozeti iptal etmek istediğinize emin misiniz?","edit_badges":"Rozetleri Düzenle","grant_badge":"Rozet Ver","granted_badges":"Verilen Rozetler","grant":"Ver","no_user_badges":"%{name} hiç bir rozet almamış.","no_badges":"Verilebilecek bir rozet yok.","none_selected":"Başlamak için bir rozet seçin","allow_title":"Rozetin ünvan olarak kullanılmasına izin ver","multiple_grant":"Birden çok defa verilebilir","listable":"Rozeti herkese gözüken rozetler sayfasında göster","enabled":"Rozeti etkinleştir","icon":"İkon","image":"Görsel","icon_help":"Font Awesome sınıfı veya görsel URL'i kullanın","query":"Rozet Sorgusu (SQL)","target_posts":"Sorgu gönderileri hedefliyor","auto_revoke":"Geri alma sorgusunu her gün çalıştır.","show_posts":"Rozet alınmasına sebep olan gönderileri rozetler sayfasında göster","trigger":"Tetikleme","trigger_type":{"none":"Her gün güncelle","post_action":"Bir kullanıcı gönderiyle etkileşime geçtiğinde","post_revision":"Bir kullanıcı bir gönderiyi düzenlediğinde veya yeni bir gönderi oluşturduğunda","trust_level_change":"Bir kullanıcı güven seviyesini değiştirdiğinde","user_change":"Bir kullanıcı düzenlendiğinde veya oluşturduğunda","post_processed":"Gönderi işlendikten sonra"},"preview":{"link_text":"Verilen rozetleri önizle","plan_text":"Sorgu planıyla önizle","modal_title":"Rozet Sorgusunu Özizle","sql_error_header":"Sorgu ile ilgili bir hata oluştu.","error_help":"Rozet sorgularıyla ilgili yardım için aşağıdaki bağlantılara bakın","bad_count_warning":{"header":"UYARI!","text":"Bazı veriliş örnekleri bulunamıyor. Bu durum, rozet sorgusundan varolmayan kullanıcı IDsi veya gönderi IDsi dönünce gerçekleşir. İleride beklenmedik sonuçlara sebep olabilir - lütfen sorgunuzu tekrar kontrol edin."},"no_grant_count":"Verilecek rozet bulunmuyor.","grant_count":{"other":"\u003cb\u003e%{count}\u003c/b\u003e rozet verilecek."},"sample":"Örnek:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e buradaki gönderi için %{link} ","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e %{link} gönderisi için \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e zamanında","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e, \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Herkese açık yeni bir emoji ekle. (PROTIP: birden çok dosyayı tek seferde sürükleyip bırakabilirsiniz)","add":"Yeni Emoji Ekle","name":"İsim","image":"Görsel","delete_confirm":":%{name}: emojisini silmek istediğinize emin misiniz?"},"embedding":{"get_started":"Eğer Discourse'u bir başka web sitesine gömmek istiyorsanız, bu sitenin hostunu ekleyerek başlayın.","confirm_delete":"Bu hostu silmek istediğinize emin misiniz?","sample":"Discourse konuları oluşturmak ve gömmek için aşağıdaki HTML kodunu sitenizde kullanın. \u003cb\u003eREPLACE_ME\u003c/b\u003e'yi Discourse'u gömdüğünüz sayfanın tam URL'i ile değiştirin.","title":"Gömme","host":"İzin Verilen Hostlar","edit":"düzenle","category":"Kategoriye Gönder","add_host":"Host Ekle","settings":"Ayarları Gömmek","feed_settings":"Ayarları Besle","feed_description":"Siteniz için bir RSS/ATOM beslemesi sağlamanız Discourse'un içeriğinizi içe aktarma yeteneğini geliştirebilir.","crawling_settings":"Böcek Ayarları","crawling_description":"Discourse gönderileriniz için konular oluşturduğu zaman, eğer bir RSS/ATOM beslemesi yoksa içeriğinizi HTML'inizden ayrıştırmaya çalışacaktır. Bazen içeriğinizi çıkartmak çok zor olabilir, bu yüzden ayrıştırmayı kolaylaştırmak için CSS kuralları belirtme yeteneği sağlıyoruz.","embed_by_username":"Konu oluşturmak için kullanıcı adı","embed_post_limit":"Gömmek için en büyük gönderi sayısı","embed_username_key_from_feed":"Discourse kullanıcı adını beslemeden çekmek için anahtar","embed_truncate":"Gömülü gönderileri buda","embed_whitelist_selector":"Gömülüler içinde izin verilen elementler için CSS seçici","embed_blacklist_selector":"Gömülülerden kaldırılan elementler için CSS seçici","embed_classname_whitelist":"CSS Sınıf isimlerine izin verildi","feed_polling_enabled":"Konuları RSS/ATOM aracılığıyla içe aktar","feed_polling_url":"İstila etmek için RSS/ATOM beslemesi URL'i","save":"Gömme Ayarlarını Kaydet"},"permalink":{"title":"Kalıcı Bağlantılar","url":"Bağlantı","topic_id":"Konu ID","topic_title":"Konu","post_id":"Gönderi ID","post_title":"Gönderi","category_id":"Kategori ID","category_title":"Kategori","external_url":"Harici Bağlantı","delete_confirm":"Bu kalıcı bağlantıyı silmek istediğinize emin misiniz?","form":{"label":"Yeni:","add":"Ekle","filter":"Ara (Bağlantı veya Harici Bağlantı)"}}}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"tiny":{"less_than_x_seconds":{"one":"\u003c 1s"},"x_seconds":{"one":"1s"},"x_minutes":{"one":"1m"},"about_x_hours":{"one":"1h"},"x_days":{"one":"1d"},"about_x_years":{"one":"1y"},"over_x_years":{"one":"\u003e 1y"},"almost_x_years":{"one":"1y"}},"medium":{"x_minutes":{"one":"1 min"},"x_hours":{"one":"1 hour"},"x_days":{"one":"1 day"}},"medium_with_ago":{"x_minutes":{"one":"1 min ago"},"x_hours":{"one":"1 hour ago"},"x_days":{"one":"1 day ago"}},"later":{"x_days":{"one":"1 day later"},"x_months":{"one":"1 month later"},"x_years":{"one":"1 year later"}}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"{{count}} new or updated topic."},"topic_count_unread":{"one":"{{count}} unread topic."},"topic_count_new":{"one":"{{count}} new topic."},"queue":{"has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e1\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"1 user"}},"groups":{"title":{"one":"group"}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"},"topic_stat_sentence":{"one":"%{count} new topic in the past %{unit}."}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"invited":{"truncated":{"one":"Showing the first invite."}},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark"}}},"logs_error_rate_notice":{"rate":{"one":"1 error/%{duration}"}},"replies_lowercase":{"one":"reply"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e"},"group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e"}},"search":{"result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e topic."}}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"new_topics":{"one":"1 new topic"},"unread_topics":{"one":"1 unread topic"},"total_unread_posts":{"one":"you have 1 unread post in this topic"},"unread_posts":{"one":"you have 1 unread old post in this topic"},"new_posts":{"one":"there is 1 new post in this topic since you last read it"},"likes":{"one":"there is 1 like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"}},"filters":{"n_posts":{"one":"1 post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"change_owner":{"instructions":{"one":"Please choose the new owner of the post by \u003cb\u003e{{old_user}}\u003c/b\u003e."}},"multi_select":{"description":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e post."}}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view 1 hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes":{"one":"{{count}} Like"},"has_likes_title":{"one":"1 person liked this post"},"has_likes_title_you":{"one":"you and 1 other person liked this post"},"controls":{"delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?"}}},"actions":{"defer_flags":{"one":"Defer flag"},"by_you_and_others":{"off_topic":{"one":"You and 1 other flagged this as off-topic"},"spam":{"one":"You and 1 other flagged this as spam"},"inappropriate":{"one":"You and 1 other flagged this as inappropriate"},"notify_moderators":{"one":"You and 1 other flagged this for moderation"},"notify_user":{"one":"You and 1 other sent a message to this user"},"bookmark":{"one":"You and 1 other bookmarked this post"},"like":{"one":"You and 1 other liked this"},"vote":{"one":"You and 1 other voted for this post"}},"by_others":{"off_topic":{"one":"1 person flagged this as off-topic"},"spam":{"one":"1 person flagged this as spam"},"inappropriate":{"one":"1 person flagged this as inappropriate"},"notify_moderators":{"one":"1 person flagged this for moderation"},"notify_user":{"one":"1 person sent a message to this user"},"bookmark":{"one":"1 person bookmarked this post"},"like":{"one":"1 person liked this"},"vote":{"one":"1 person voted for this post"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?"}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"clicks":{"one":"1 click"}},"post_links":{"title":{"one":"1 more"}},"views_lowercase":{"one":"view"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (1)"}},"unread":{"title_with_count":{"one":"Unread (1)"},"lower_title_with_count":{"one":"1 unread"}},"new":{"lower_title_with_count":{"one":"1 new"},"title_with_count":{"one":"New (1)"}},"category":{"title_with_count":{"one":"{{categoryName}} (1)"}}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time"},"badge_count":{"one":"1 Badge"},"more_badges":{"one":"+1 More"},"granted":{"one":"1 granted"}},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option"}}}},"details":{"title":"Hide Details"},"admin":{"flags":{"summary":{"action_type_3":{"one":"off-topic"},"action_type_4":{"one":"inappropriate"},"action_type_6":{"one":"custom"},"action_type_7":{"one":"custom"},"action_type_8":{"one":"spam"}}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"users":{"approved_selected":{"one":"approve user"},"reject_selected":{"one":"reject user"},"reject_successful":{"one":"Successfully rejected 1 user."},"reject_failures":{"one":"Failed to reject 1 user."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)"},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"badges":{"preview":{"grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned."}}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'tr_TR';
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
//! locale : turkish (tr)
//! authors : Erhan Gundogan : https://github.com/erhangundogan,
//!           Burak Yiğit Kaya: https://github.com/BYK

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var suffixes = {
        1: '\'inci',
        5: '\'inci',
        8: '\'inci',
        70: '\'inci',
        80: '\'inci',
        2: '\'nci',
        7: '\'nci',
        20: '\'nci',
        50: '\'nci',
        3: '\'üncü',
        4: '\'üncü',
        100: '\'üncü',
        6: '\'ncı',
        9: '\'uncu',
        10: '\'uncu',
        30: '\'uncu',
        60: '\'ıncı',
        90: '\'ıncı'
    };

    var tr = moment.defineLocale('tr', {
        months : 'Ocak_Şubat_Mart_Nisan_Mayıs_Haziran_Temmuz_Ağustos_Eylül_Ekim_Kasım_Aralık'.split('_'),
        monthsShort : 'Oca_Şub_Mar_Nis_May_Haz_Tem_Ağu_Eyl_Eki_Kas_Ara'.split('_'),
        weekdays : 'Pazar_Pazartesi_Salı_Çarşamba_Perşembe_Cuma_Cumartesi'.split('_'),
        weekdaysShort : 'Paz_Pts_Sal_Çar_Per_Cum_Cts'.split('_'),
        weekdaysMin : 'Pz_Pt_Sa_Ça_Pe_Cu_Ct'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[bugün saat] LT',
            nextDay : '[yarın saat] LT',
            nextWeek : '[haftaya] dddd [saat] LT',
            lastDay : '[dün] LT',
            lastWeek : '[geçen hafta] dddd [saat] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s sonra',
            past : '%s önce',
            s : 'birkaç saniye',
            m : 'bir dakika',
            mm : '%d dakika',
            h : 'bir saat',
            hh : '%d saat',
            d : 'bir gün',
            dd : '%d gün',
            M : 'bir ay',
            MM : '%d ay',
            y : 'bir yıl',
            yy : '%d yıl'
        },
        ordinalParse: /\d{1,2}'(inci|nci|üncü|ncı|uncu|ıncı)/,
        ordinal : function (number) {
            if (number === 0) {  // special case for zero
                return number + '\'ıncı';
            }
            var a = number % 10,
                b = number % 100 - a,
                c = number >= 100 ? 100 : null;
            return number + (suffixes[a] || suffixes[b] || suffixes[c]);
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 1st is the first week of the year.
        }
    });

    return tr;

}));
moment.fn.shortDateNoYear = function(){ return this.format('G AAA'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['tr_TR'] = function(n) { return "other"; }
;
