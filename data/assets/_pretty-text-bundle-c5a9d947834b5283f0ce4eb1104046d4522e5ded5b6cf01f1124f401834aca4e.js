define("pretty-text/pretty-text", 
  ["pretty-text/engines/discourse-markdown","pretty-text/sanitizer","pretty-text/white-lister","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

    __exports__.registerOption = registerOption;
    __exports__.buildOptions = buildOptions;

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

    var _cook = __dependency1__.cook;
    var setup = __dependency1__.setup;
    var sanitize = __dependency2__.sanitize;
    var WhiteLister = __dependency3__["default"];

    var _registerFns = [];
    var identity = function (value) {
      return value;
    };

    function registerOption(fn) {
      _registerFns.push(fn);
    }

    function buildOptions(state) {
      setup();

      var siteSettings = state.siteSettings;
      var getURL = state.getURL;
      var lookupAvatar = state.lookupAvatar;
      var getTopicInfo = state.getTopicInfo;
      var topicId = state.topicId;
      var categoryHashtagLookup = state.categoryHashtagLookup;
      var userId = state.userId;
      var getCurrentUser = state.getCurrentUser;
      var currentUser = state.currentUser;

      var features = {
        'bold-italics': true,
        'auto-link': true,
        'mentions': true,
        'bbcode': true,
        'quote': true,
        'html': true,
        'category-hashtag': true,
        'onebox': true,
        'newline': true
      };

      var options = {
        sanitize: true,
        getURL: getURL,
        features: features,
        lookupAvatar: lookupAvatar,
        getTopicInfo: getTopicInfo,
        topicId: topicId,
        categoryHashtagLookup: categoryHashtagLookup,
        userId: userId,
        getCurrentUser: getCurrentUser,
        currentUser: currentUser,
        mentionLookup: state.mentionLookup
      };

      _registerFns.forEach(function (fn) {
        return fn(siteSettings, options, state);
      });

      return options;
    }

    var _default = (function () {
      function _default(opts) {
        _classCallCheck(this, _default);

        this.opts = opts || {};
        this.opts.features = this.opts.features || {};
        this.opts.sanitizer = !!this.opts.sanitize ? this.opts.sanitizer || sanitize : identity;
        setup();
      }

      _createClass(_default, [{
        key: 'cook',
        value: function cook(raw) {
          if (!raw || raw.length === 0) {
            return "";
          }

          var result = _cook(raw, this.opts);
          return result ? result : "";
        }
      }, {
        key: 'sanitize',
        value: function sanitize(html) {
          return this.opts.sanitizer(html, new WhiteLister(this.opts.features));
        }
      }]);

      return _default;
    })();

    __exports__["default"] = _default;;
  });
define("pretty-text/guid", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*eslint no-bitwise:0 */

    // http://stackoverflow.com/a/8809472/17174
    __exports__["default"] = function () {
      var d = new Date().getTime();
      if (window.performance && typeof window.performance.now === "function") {
        d += performance.now(); //use high-precision timer if available
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : r & 0x3 | 0x8).toString(16);
      });
    };
  });
define("pretty-text/censored-words", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__.censor = censor;

    function censor(text, censoredWords) {
      if (censoredWords && censoredWords.length) {
        var split = censoredWords.split("|");
        var censorRegexp = undefined;
        if (split && split.length) {
          censorRegexp = new RegExp("(\\b(?:" + split.map(function (t) {
            return "(" + t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + ")";
          }).join("|") + ")\\b)(?![^\\(]*\\))", "ig");
        }

        if (censorRegexp) {
          var m = censorRegexp.exec(text);
          while (m && m[0]) {
            var replacement = new Array(m[0].length + 1).join('&#9632;');
            text = text.replace(new RegExp("(\\b" + m[0] + "\\b)(?![^\\(]*\\))", "ig"), replacement);
            m = censorRegexp.exec(text);
          }
        }
      }
      return text;
    }
  });
define("pretty-text/emoji/data", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var emoji = ["100", "1234", "8ball", "a", "ab", "abc", "abcd", "accept", "aerial_tramway", "airplane", "airplane_arriving", "airplane_departure", "airplane_small", "alarm_clock", "alembic", "alien", "ambulance", "amphora", "anchor", "angel", "anger", "anger_right", "angry", "anguished", "ant", "apple", "aquarius", "aries", "arrow_backward", "arrow_double_down", "arrow_double_up", "arrow_down", "arrow_down_small", "arrow_forward", "arrow_heading_down", "arrow_heading_up", "arrow_left", "arrow_lower_left", "arrow_lower_right", "arrow_right", "arrow_right_hook", "arrow_up", "arrow_up_down", "arrow_up_small", "arrow_upper_left", "arrow_upper_right", "arrows_clockwise", "arrows_counterclockwise", "art", "articulated_lorry", "astonished", "athletic_shoe", "atm", "atom", "b", "baby", "baby_bottle", "baby_chick", "baby_symbol", "back", "badminton", "baggage_claim", "balloon", "ballot_box", "ballot_box_with_check", "bamboo", "banana", "bangbang", "bank", "bar_chart", "barber", "baseball", "basketball", "basketball_player", "bath", "bathtub", "battery", "beach", "beach_umbrella", "bear", "bed", "bee", "beer", "beers", "beetle", "beginner", "bell", "bellhop", "bento", "bicyclist", "bike", "bikini", "biohazard", "bird", "birthday", "black_circle", "black_joker", "black_large_square", "black_medium_small_square", "black_medium_square", "black_nib", "black_small_square", "black_square_button", "blossom", "blowfish", "blue_book", "blue_car", "blue_heart", "blush", "boar", "bomb", "book", "bookmark", "bookmark_tabs", "books", "boom", "boot", "bouquet", "bow", "bow_and_arrow", "bowling", "boy", "bread", "bride_with_veil", "bridge_at_night", "briefcase", "broken_heart", "bug", "bulb", "bullettrain_front", "bullettrain_side", "burrito", "bus", "busstop", "bust_in_silhouette", "busts_in_silhouette", "cactus", "cake", "calendar", "calendar_spiral", "calling", "camel", "camera", "camera_with_flash", "camping", "cancer", "candle", "candy", "capital_abcd", "capricorn", "card_box", "card_index", "carousel_horse", "cat", "cat2", "cd", "chains", "champagne", "chart", "chart_with_downwards_trend", "chart_with_upwards_trend", "checkered_flag", "cheese", "cherries", "cherry_blossom", "chestnut", "chicken", "children_crossing", "chipmunk", "chocolate_bar", "christmas_tree", "church", "cinema", "circus_tent", "city_dusk", "city_sunset", "cityscape", "cl", "clap", "clapper", "classical_building", "clipboard", "clock", "clock1", "clock10", "clock1030", "clock11", "clock1130", "clock12", "clock1230", "clock130", "clock2", "clock230", "clock3", "clock330", "clock4", "clock430", "clock5", "clock530", "clock6", "clock630", "clock7", "clock730", "clock8", "clock830", "clock9", "clock930", "closed_book", "closed_lock_with_key", "closed_umbrella", "cloud", "cloud_lightning", "cloud_rain", "cloud_snow", "cloud_tornado", "clubs", "cocktail", "coffee", "coffin", "cold_sweat", "comet", "compression", "computer", "confetti_ball", "confounded", "confused", "congratulations", "construction", "construction_site", "construction_worker", "control_knobs", "convenience_store", "cookie", "cool", "cop", "copyright", "corn", "couch", "couple", "couple_with_heart", "couplekiss", "cow", "cow2", "crab", "crayon", "credit_card", "crescent_moon", "cricket", "crocodile", "cross", "crossed_flags", "crossed_swords", "crown", "cruise_ship", "cry", "crying_cat_face", "crystal_ball", "cupid", "curly_loop", "currency_exchange", "curry", "custard", "customs", "cyclone", "dagger", "dancer", "dancers", "dango", "dark_sunglasses", "dart", "dash", "date", "deciduous_tree", "department_store", "desert", "desktop", "diamond_shape_with_a_dot_inside", "diamonds", "disappointed", "disappointed_relieved", "dividers", "dizzy", "dizzy_face", "do_not_litter", "dog", "dog2", "dollar", "dolls", "dolphin", "door", "doughnut", "dove", "dragon", "dragon_face", "dress", "dromedary_camel", "droplet", "dvd", "e-mail", "ear", "ear_of_rice", "earth_africa", "earth_americas", "earth_asia", "egg", "eggplant", "eight", "eight_pointed_black_star", "eight_spoked_asterisk", "electric_plug", "elephant", "end", "envelope", "envelope_with_arrow", "euro", "european_castle", "european_post_office", "evergreen_tree", "exclamation", "expressionless", "eye", "eyeglasses", "eyes", "factory", "fallen_leaf", "family", "fast_forward", "fax", "fearful", "feet", "ferris_wheel", "ferry", "field_hockey", "file_cabinet", "file_folder", "film_frames", "fire", "fire_engine", "fireworks", "first_quarter_moon", "first_quarter_moon_with_face", "fish", "fish_cake", "fishing_pole_and_fish", "fist", "five", "flag_black", "flag_cn", "flag_de", "flag_es", "flag_fr", "flag_gb", "flag_it", "flag_jp", "flag_kr", "flag_ru", "flag_us", "flag_white", "flags", "flashlight", "fleur-de-lis", "floppy_disk", "flower_playing_cards", "flushed", "fog", "foggy", "football", "footprints", "fork_and_knife", "fork_knife_plate", "fountain", "four", "four_leaf_clover", "frame_photo", "free", "fried_shrimp", "fries", "frog", "frowning", "frowning2", "fuelpump", "full_moon", "full_moon_with_face", "game_die", "gear", "gem", "gemini", "ghost", "gift", "gift_heart", "girl", "globe_with_meridians", "goat", "golf", "golfer", "grapes", "green_apple", "green_book", "green_heart", "grey_exclamation", "grey_question", "grimacing", "grin", "grinning", "guardsman", "guitar", "gun", "haircut", "hamburger", "hammer", "hammer_pick", "hamster", "hand_splayed", "handbag", "hash", "hatched_chick", "hatching_chick", "head_bandage", "headphones", "hear_no_evil", "heart", "heart_decoration", "heart_exclamation", "heart_eyes", "heart_eyes_cat", "heartbeat", "heartpulse", "hearts", "heavy_check_mark", "heavy_division_sign", "heavy_dollar_sign", "heavy_minus_sign", "heavy_multiplication_x", "heavy_plus_sign", "helicopter", "helmet_with_cross", "herb", "hibiscus", "high_brightness", "high_heel", "hockey", "hole", "homes", "honey_pot", "horse", "horse_racing", "hospital", "hot_pepper", "hotdog", "hotel", "hotsprings", "hourglass", "hourglass_flowing_sand", "house", "house_abandoned", "house_with_garden", "hugging", "hushed", "ice_cream", "ice_skate", "icecream", "id", "ideograph_advantage", "imp", "inbox_tray", "incoming_envelope", "information_desk_person", "information_source", "innocent", "interrobang", "iphone", "island", "izakaya_lantern", "jack_o_lantern", "japan", "japanese_castle", "japanese_goblin", "japanese_ogre", "jeans", "joy", "joy_cat", "joystick", "kaaba", "key", "key2", "keyboard", "kimono", "kiss", "kissing", "kissing_cat", "kissing_closed_eyes", "kissing_heart", "kissing_smiling_eyes", "knife", "koala", "koko", "label", "large_blue_circle", "large_blue_diamond", "large_orange_diamond", "last_quarter_moon", "last_quarter_moon_with_face", "laughing", "leaves", "ledger", "left_luggage", "left_right_arrow", "leftwards_arrow_with_hook", "lemon", "leo", "leopard", "level_slider", "levitate", "libra", "lifter", "light_rail", "link", "lion_face", "lips", "lipstick", "lock", "lock_with_ink_pen", "lollipop", "loop", "loud_sound", "loudspeaker", "love_hotel", "love_letter", "low_brightness", "m", "mag", "mag_right", "mahjong", "mailbox", "mailbox_closed", "mailbox_with_mail", "mailbox_with_no_mail", "man", "man_with_gua_pi_mao", "man_with_turban", "mans_shoe", "map", "maple_leaf", "mask", "massage", "meat_on_bone", "medal", "mega", "melon", "menorah", "mens", "metal", "metro", "microphone", "microphone2", "microscope", "middle_finger", "military_medal", "milky_way", "minibus", "minidisc", "mobile_phone_off", "money_mouth", "money_with_wings", "moneybag", "monkey", "monkey_face", "monorail", "mortar_board", "mosque", "motorboat", "motorcycle", "motorway", "mount_fuji", "mountain", "mountain_bicyclist", "mountain_cableway", "mountain_railway", "mountain_snow", "mouse", "mouse2", "mouse_three_button", "movie_camera", "moyai", "muscle", "mushroom", "musical_keyboard", "musical_note", "musical_score", "mute", "nail_care", "name_badge", "necktie", "negative_squared_cross_mark", "nerd", "neutral_face", "new", "new_moon", "new_moon_with_face", "newspaper", "newspaper2", "ng", "night_with_stars", "nine", "no_bell", "no_bicycles", "no_entry", "no_entry_sign", "no_good", "no_mobile_phones", "no_mouth", "no_pedestrians", "no_smoking", "non-potable_water", "nose", "notebook", "notebook_with_decorative_cover", "notepad_spiral", "notes", "nut_and_bolt", "o", "o2", "ocean", "octopus", "oden", "office", "oil", "ok", "ok_hand", "ok_woman", "older_man", "older_woman", "om_symbol", "on", "oncoming_automobile", "oncoming_bus", "oncoming_police_car", "oncoming_taxi", "one", "open_file_folder", "open_hands", "open_mouth", "ophiuchus", "orange_book", "orthodox_cross", "outbox_tray", "ox", "package", "page_facing_up", "page_with_curl", "pager", "paintbrush", "palm_tree", "panda_face", "paperclip", "paperclips", "park", "parking", "part_alternation_mark", "partly_sunny", "passport_control", "pause_button", "peace", "peach", "pear", "pen_ballpoint", "pen_fountain", "pencil", "pencil2", "penguin", "pensive", "performing_arts", "persevere", "person_frowning", "person_with_blond_hair", "person_with_pouting_face", "pick", "pig", "pig2", "pig_nose", "pill", "pineapple", "ping_pong", "pisces", "pizza", "place_of_worship", "play_pause", "point_down", "point_left", "point_right", "point_up", "point_up_2", "police_car", "poodle", "poop", "popcorn", "post_office", "postal_horn", "postbox", "potable_water", "pouch", "poultry_leg", "pound", "pouting_cat", "pray", "prayer_beads", "princess", "printer", "projector", "punch", "purple_heart", "purse", "pushpin", "put_litter_in_its_place", "question", "rabbit", "rabbit2", "race_car", "racehorse", "radio", "radio_button", "radioactive", "rage", "railway_car", "railway_track", "rainbow", "raised_hand", "raised_hands", "raising_hand", "ram", "ramen", "rat", "record_button", "recycle", "red_car", "red_circle", "registered", "relaxed", "relieved", "reminder_ribbon", "repeat", "repeat_one", "restroom", "revolving_hearts", "rewind", "ribbon", "rice", "rice_ball", "rice_cracker", "rice_scene", "ring", "robot", "rocket", "roller_coaster", "rolling_eyes", "rooster", "rose", "rosette", "rotating_light", "round_pushpin", "rowboat", "rugby_football", "runner", "running_shirt_with_sash", "sa", "sagittarius", "sailboat", "sake", "sandal", "santa", "satellite", "satellite_orbital", "saxophone", "scales", "school", "school_satchel", "scissors", "scorpion", "scorpius", "scream", "scream_cat", "scroll", "seat", "secret", "see_no_evil", "seedling", "seven", "shamrock", "shaved_ice", "sheep", "shell", "shield", "shinto_shrine", "ship", "shirt", "shopping_bags", "shower", "signal_strength", "six", "six_pointed_star", "ski", "skier", "skull", "skull_crossbones", "sleeping", "sleeping_accommodation", "sleepy", "slight_frown", "slight_smile", "slot_machine", "small_blue_diamond", "small_orange_diamond", "small_red_triangle", "small_red_triangle_down", "smile", "smile_cat", "smiley", "smiley_cat", "smiling_imp", "smirk", "smirk_cat", "smoking", "snail", "snake", "snowboarder", "snowflake", "snowman", "snowman2", "sob", "soccer", "soon", "sos", "sound", "space_invader", "spades", "spaghetti", "sparkle", "sparkler", "sparkles", "sparkling_heart", "speak_no_evil", "speaker", "speaking_head", "speech_balloon", "speedboat", "spider", "spider_web", "spy", "stadium", "star", "star2", "star_and_crescent", "star_of_david", "stars", "station", "statue_of_liberty", "steam_locomotive", "stew", "stop_button", "stopwatch", "straight_ruler", "strawberry", "stuck_out_tongue", "stuck_out_tongue_closed_eyes", "stuck_out_tongue_winking_eye", "sun_with_face", "sunflower", "sunglasses", "sunny", "sunrise", "sunrise_over_mountains", "surfer", "sushi", "suspension_railway", "sweat", "sweat_drops", "sweat_smile", "sweet_potato", "swimmer", "symbols", "synagogue", "syringe", "taco", "tada", "tanabata_tree", "tangerine", "taurus", "taxi", "tea", "telephone", "telephone_receiver", "telescope", "ten", "tennis", "tent", "thermometer", "thermometer_face", "thinking", "thought_balloon", "three", "thumbsdown", "thumbsup", "thunder_cloud_rain", "ticket", "tickets", "tiger", "tiger2", "timer", "tired_face", "tm", "toilet", "tokyo_tower", "tomato", "tongue", "tools", "top", "tophat", "track_next", "track_previous", "trackball", "tractor", "traffic_light", "train", "train2", "tram", "triangular_flag_on_post", "triangular_ruler", "trident", "triumph", "trolleybus", "trophy", "tropical_drink", "tropical_fish", "truck", "trumpet", "tulip", "turkey", "turtle", "tv", "twisted_rightwards_arrows", "two", "two_hearts", "two_men_holding_hands", "two_women_holding_hands", "u5272", "u5408", "u55b6", "u6307", "u6708", "u6709", "u6e80", "u7121", "u7533", "u7981", "u7a7a", "umbrella", "umbrella2", "unamused", "underage", "unicorn", "unlock", "up", "upside_down", "urn", "v", "vertical_traffic_light", "vhs", "vibration_mode", "video_camera", "video_game", "violin", "virgo", "volcano", "volleyball", "vs", "vulcan", "walking", "waning_crescent_moon", "waning_gibbous_moon", "warning", "wastebasket", "watch", "water_buffalo", "watermelon", "wave", "wavy_dash", "waxing_crescent_moon", "waxing_gibbous_moon", "wc", "weary", "wedding", "whale", "whale2", "wheel_of_dharma", "wheelchair", "white_check_mark", "white_circle", "white_flower", "white_large_square", "white_medium_small_square", "white_medium_square", "white_small_square", "white_square_button", "white_sun_cloud", "white_sun_rain_cloud", "white_sun_small_cloud", "wind_blowing_face", "wind_chime", "wine_glass", "wink", "wolf", "woman", "womans_clothes", "womans_hat", "womens", "worried", "wrench", "writing_hand", "x", "yellow_heart", "yen", "yin_yang", "yum", "zap", "zero", "zipper_mouth", "zzz", "+1", "-1"];
    __exports__.emoji = emoji;
    var aliases = { "airplane_small": ["small_airplane"], "anger_right": ["right_anger_bubble"], "atom": ["atom_symbol"], "ballot_box": ["ballot_box_with_ballot"], "basketball_player": ["person_with_ball"], "beach": ["beach_with_umbrella"], "beach_umbrella": ["umbrella_on_ground"], "bellhop": ["bellhop_bell"], "biohazard": ["biohazard_sign"], "bow_and_arrow": ["archery"], "calendar_spiral": ["spiral_calendar_pad"], "card_box": ["card_file_box"], "champagne": ["bottle_with_popping_cork"], "cheese": ["cheese_wedge"], "city_sunset": ["city_sunrise"], "clock": ["mantlepiece_clock"], "cloud_lightning": ["cloud_with_lightning"], "cloud_rain": ["cloud_with_rain"], "cloud_snow": ["cloud_with_snow"], "cloud_tornado": ["cloud_with_tornado"], "construction_site": ["building_construction"], "couch": ["couch_and_lamp"], "crayon": ["lower_left_crayon"], "cricket": ["cricket_bat_ball"], "cross": ["latin_cross"], "cruise_ship": ["passenger_ship"], "dagger": ["dagger_knife"], "desktop": ["desktop_computer"], "dividers": ["card_index_dividers"], "dove": ["dove_of_peace"], "e-mail": ["email"], "feet": ["paw_prints"], "fire": ["flame"], "flag_black": ["waving_black_flag"], "flag_cn": ["cn"], "flag_de": ["de"], "flag_es": ["es"], "flag_fr": ["fr"], "flag_gb": ["gb"], "flag_it": ["it"], "flag_jp": ["jp"], "flag_kr": ["kr"], "flag_ru": ["ru"], "flag_us": ["us"], "flag_white": ["waving_white_flag"], "fork_knife_plate": ["fork_and_knife_with_plate"], "frame_photo": ["frame_with_picture"], "frowning2": ["white_frowning_face"], "hammer_pick": ["hammer_and_pick"], "hand_splayed": ["raised_hand_with_fingers_splayed"], "head_bandage": ["face_with_head_bandage"], "heart_exclamation": ["heavy_heart_exclamation_mark_ornament"], "helmet_with_cross": ["helmet_with_white_cross"], "homes": ["house_buildings"], "hotdog": ["hot_dog"], "house_abandoned": ["derelict_house_building"], "hugging": ["hugging_face"], "island": ["desert_island"], "key2": ["old_key"], "laughing": ["satisfied"], "levitate": ["man_in_business_suit_levitating"], "lifter": ["weight_lifter"], "lion_face": ["lion"], "map": ["world_map"], "medal": ["sports_medal"], "metal": ["sign_of_the_horns"], "microphone2": ["studio_microphone"], "middle_finger": ["reversed_hand_with_middle_finger_extended"], "money_mouth": ["money_mouth_face"], "motorcycle": ["racing_motorcycle"], "mountain_snow": ["snow_capped_mountain"], "mouse_three_button": ["three_button_mouse"], "nerd": ["nerd_face"], "newspaper2": ["rolled_up_newspaper"], "notepad_spiral": ["spiral_note_pad"], "oil": ["oil_drum"], "older_woman": ["grandma"], "paintbrush": ["lower_left_paintbrush"], "paperclips": ["linked_paperclips"], "park": ["national_park"], "pause_button": ["double_vertical_bar"], "peace": ["peace_symbol"], "pen_ballpoint": ["lower_left_ballpoint_pen"], "pen_fountain": ["lower_left_fountain_pen"], "ping_pong": ["table_tennis"], "place_of_worship": ["worship_symbol"], "poop": ["shit", "hankey", "poo"], "projector": ["film_projector"], "race_car": ["racing_car"], "radioactive": ["radioactive_sign"], "railway_track": ["railroad_track"], "robot": ["robot_face"], "rolling_eyes": ["face_with_rolling_eyes"], "skull": ["skeleton"], "skull_crossbones": ["skull_and_crossbones"], "slight_frown": ["slightly_frowning_face"], "slight_smile": ["slightly_smiling_face", "slightly_smiling"], "speaking_head": ["speaking_head_in_silhouette"], "spy": ["sleuth_or_spy"], "thermometer_face": ["face_with_thermometer"], "thinking": ["thinking_face"], "thumbsdown": ["-1"], "thumbsup": ["+1"], "thunder_cloud_rain": ["thunder_cloud_and_rain"], "tickets": ["admission_tickets"], "timer": ["timer_clock"], "tools": ["hammer_and_wrench"], "track_next": ["next_track"], "track_previous": ["previous_track"], "unicorn": ["unicorn_face"], "upside_down": ["upside_down_face"], "urn": ["funeral_urn"], "vulcan": ["raised_hand_with_part_between_middle_and_ring_fingers"], "white_sun_cloud": ["white_sun_behind_cloud"], "white_sun_rain_cloud": ["white_sun_behind_cloud_with_rain"], "white_sun_small_cloud": ["white_sun_with_small_cloud"], "zipper_mouth": ["zipper_mouth_face"] };
    __exports__.aliases = aliases;
    var translations = {
      ':)': 'slight_smile',
      ':-)': 'slight_smile',
      ':(': 'frowning',
      ':-(': 'frowning',
      ';)': 'wink',
      ';-)': 'wink',
      ':\'(': 'cry',
      ':\'-(': 'cry',
      ':-\'(': 'cry',
      ':p': 'stuck_out_tongue',
      ':P': 'stuck_out_tongue',
      ':-P': 'stuck_out_tongue',
      ':O': 'open_mouth',
      ':-O': 'open_mouth',
      ':D': 'smiley',
      ':-D': 'smiley',
      ':|': 'expressionless',
      ':-|': 'expressionless',
      ':/': 'confused',
      '8-)': 'sunglasses',
      ";P": 'stuck_out_tongue_winking_eye',
      ";-P": 'stuck_out_tongue_winking_eye',
      ":$": 'blush',
      ":-$": 'blush'
    };
    __exports__.translations = translations;
  });
define("pretty-text/emoji", 
  ["pretty-text/emoji/data","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    __exports__.registerEmoji = registerEmoji;
    __exports__.emojiList = emojiList;
    __exports__.performEmojiUnescape = performEmojiUnescape;
    __exports__.buildEmojiUrl = buildEmojiUrl;
    __exports__.emojiExists = emojiExists;
    __exports__.emojiSearch = emojiSearch;
    var emoji = __dependency1__.emoji;
    var aliases = __dependency1__.aliases;
    var translations = __dependency1__.translations;

    // bump up this number to expire all emojis
    var IMAGE_VERSION = "3";

    __exports__.IMAGE_VERSION = IMAGE_VERSION;
    var extendedEmoji = {};

    function registerEmoji(code, url) {
      code = code.toLowerCase();
      extendedEmoji[code] = url;
    }

    function emojiList() {
      var result = emoji.slice(0);
      _.each(extendedEmoji, function (v, k) {
        return result.push(k);
      });
      return result;
    }

    var emojiHash = {};

    // add all default emojis
    emoji.forEach(function (code) {
      return emojiHash[code] = true;
    });

    // and their aliases
    var aliasHash = {};
    Object.keys(aliases).forEach(function (name) {
      aliases[name].forEach(function (alias) {
        return aliasHash[alias] = name;
      });
    });

    function performEmojiUnescape(string, opts) {
      // this can be further improved by supporting matches of emoticons that don't begin with a colon
      if (string.indexOf(":") >= 0) {
        return string.replace(/\B:[^\s:]+:?\B/g, function (m) {
          var isEmoticon = !!translations[m];
          var emojiVal = isEmoticon ? translations[m] : m.slice(1, m.length - 1);
          var hasEndingColon = m.lastIndexOf(":") === m.length - 1;
          var url = buildEmojiUrl(emojiVal, opts);

          return url && (isEmoticon || hasEndingColon) ? "<img src='" + url + "' title='" + emojiVal + "' alt='" + emojiVal + "' class='emoji'>" : m;
        });
      }

      return string;
    }

    function buildEmojiUrl(code, opts) {
      var url = undefined;
      code = code.toLowerCase();

      if (extendedEmoji.hasOwnProperty(code)) {
        url = extendedEmoji[code];
      }

      if (opts && opts.customEmoji && opts.customEmoji[code]) {
        url = opts.customEmoji[code];
      }

      if (!url && emojiHash.hasOwnProperty(code)) {
        url = opts.getURL("/images/emoji/" + opts.emojiSet + "/" + code + ".png");
      }

      if (url) {
        url = url + "?v=" + IMAGE_VERSION;
      }

      return url;
    }

    function emojiExists(code) {
      code = code.toLowerCase();
      return !!(extendedEmoji.hasOwnProperty(code) || emojiHash.hasOwnProperty(code));
    }

    ;

    var toSearch = undefined;

    function emojiSearch(term, options) {
      var maxResults = options && options["maxResults"] || -1;
      if (maxResults === 0) {
        return [];
      }

      toSearch = toSearch || _.union(_.keys(emojiHash), _.keys(extendedEmoji), _.keys(aliasHash)).sort();

      var results = [];

      function addResult(t) {
        var val = aliasHash[t] || t;
        if (results.indexOf(val) === -1) {
          results.push(val);
        }
        return maxResults > 0 && results.length >= maxResults;
      }

      for (var i = 0; i < toSearch.length; i++) {
        var item = toSearch[i];
        if (item.indexOf(term) === 0 && addResult(item)) {
          return results;
        }
      }

      for (var i = 0; i < toSearch.length; i++) {
        var item = toSearch[i];
        if (item.indexOf(term) > 0 && addResult(item)) {
          return results;
        }
      }

      return results;
    }

    ;
  });
define("pretty-text/engines/discourse-markdown", 
  ["pretty-text/guid","pretty-text/white-lister","pretty-text/sanitizer","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

    __exports__.cook = cook;
    __exports__.setup = setup;

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

    var guid = __dependency1__["default"];
    var WhiteLister = __dependency2__.default;
    var whiteListFeature = __dependency2__.whiteListFeature;
    var _escape = __dependency3__.escape;

    var parser = window.BetterMarkdown,
        MD = parser.Markdown,
        DialectHelpers = parser.DialectHelpers,
        hoisted;

    var currentOpts = undefined;

    var emitters = [];
    var preProcessors = [];
    var parseNodes = [];

    function findEndPos(text, start, stop, args, offset) {
      var endPos = undefined,
          nextStart = undefined;
      do {
        endPos = text.indexOf(stop, offset);
        if (endPos === -1) {
          return -1;
        }
        nextStart = text.indexOf(start, offset);
        offset = endPos + stop.length;
      } while (nextStart !== -1 && nextStart < endPos);
      return endPos;
    }

    var DialectHelper = (function () {
      function DialectHelper() {
        _classCallCheck(this, DialectHelper);

        this._dialect = MD.dialects.Discourse = DialectHelpers.subclassDialect(MD.dialects.Gruber);
        this._setup = false;
      }

      _createClass(DialectHelper, [{
        key: 'escape',
        value: function escape(str) {
          return _escape(str);
        }
      }, {
        key: 'getOptions',
        value: function getOptions() {
          return currentOpts;
        }
      }, {
        key: 'registerInlineFeature',
        value: function registerInlineFeature(featureName, start, fn) {
          this._dialect.inline[start] = function () {
            if (!currentOpts.features[featureName]) {
              return;
            }
            return fn.apply(this, arguments);
          };
        }
      }, {
        key: 'addPreProcessorFeature',
        value: function addPreProcessorFeature(featureName, fn) {
          preProcessors.push(function (raw) {
            if (!currentOpts.features[featureName]) {
              return raw;
            }
            return fn(raw, hoister);
          });
        }

        /**
          The simplest kind of replacement possible. Replace a stirng token with JsonML.
           For example to replace all occurrances of :) with a smile image:
           ```javascript
            helper.inlineReplace(':)', text => ['img', {src: '/images/smile.png'}]);
          ```
        **/
      }, {
        key: 'inlineReplaceFeature',
        value: function inlineReplaceFeature(featureName, token, emitter) {
          var _this = this;

          this.registerInline(token, function (text, match, prev) {
            if (!currentOpts.features[featureName]) {
              return;
            }
            return [token.length, emitter.call(_this, token, match, prev)];
          });
        }

        /**
          After the parser has been executed, change the contents of a HTML tag.
           Let's say you want to replace the contents of all code tags to prepend
          "EVIL TROUT HACKED YOUR CODE!":
           ```javascript
            helper.postProcessTag('code', contents => `EVIL TROUT HACKED YOUR CODE!\n\n${contents}`);
          ```
        **/
      }, {
        key: 'postProcessTagFeature',
        value: function postProcessTagFeature(featureName, tag, emitter) {
          this.onParseNode(function (event) {
            if (!currentOpts.features[featureName]) {
              return;
            }
            var node = event.node;
            if (node[0] === tag) {
              node[node.length - 1] = emitter(node[node.length - 1]);
            }
          });
        }

        /**
          Matches inline using a regular expression. The emitter function is passed
          the matches from the regular expression.
           For example, this auto links URLs:
           ```javascript
            helper.inlineRegexp({
              matcher: /((?:https?:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.])(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\([^\s()<>]+\)|[^`!()\[\]{};:'".,<>?«»“”‘’\s]))/gm,
              spaceBoundary: true,
              start: 'http',
               emitter(matches) {
                const url = matches[1];
                return ['a', {href: url}, url];
              }
            });
          ```
        **/
      }, {
        key: 'inlineRegexpFeature',
        value: function inlineRegexpFeature(featureName, args) {
          this.registerInline(args.start, function (text, match, prev) {
            if (!currentOpts.features[featureName]) {
              return;
            }
            if (invalidBoundary(args, prev)) {
              return;
            }

            args.matcher.lastIndex = 0;
            var m = args.matcher.exec(text);
            if (m) {
              var result = args.emitter.call(this, m);
              if (result) {
                return [m[0].length, result];
              }
            }
          });
        }

        /**
          Handles inline replacements surrounded by tokens.
           For example, to handle markdown style bold. Note we use `concat` on the array because
          the contents are JsonML too since we didn't pass `rawContents` as true. This supports
          recursive markup.
           ```javascript
            helper.inlineBetween({
              between: '**',
              wordBoundary: true.
              emitter(contents) {
                return ['strong'].concat(contents);
              }
            });
          ```
        **/
      }, {
        key: 'inlineBetweenFeature',
        value: function inlineBetweenFeature(featureName, args) {
          var start = args.start || args.between;
          var stop = args.stop || args.between;
          var startLength = start.length;

          this.registerInline(start, function (text, match, prev) {
            if (!currentOpts.features[featureName]) {
              return;
            }
            if (invalidBoundary(args, prev)) {
              return;
            }

            var endPos = findEndPos(text, start, stop, args, startLength);
            if (endPos === -1) {
              return;
            }
            var between = text.slice(startLength, endPos);

            // If rawcontents is set, don't process inline
            if (!args.rawContents) {
              between = this.processInline(between);
            }

            var contents = args.emitter.call(this, between);
            if (contents) {
              return [endPos + stop.length, contents];
            }
          });
        }

        /**
          Replaces a block of text between a start and stop. As opposed to inline, these
          might span multiple lines.
           Here's an example that takes the content between `[code]` ... `[/code]` and
          puts them inside a `pre` tag:
           ```javascript
            helper.replaceBlock({
              start: /(\[code\])([\s\S]*)/igm,
              stop: '[/code]',
              rawContents: true,
               emitter(blockContents) {
                return ['p', ['pre'].concat(blockContents)];
              }
            });
          ```
        **/
      }, {
        key: 'replaceBlockFeature',
        value: function replaceBlockFeature(featureName, args) {
          function blockFunc(block, next) {
            if (!currentOpts.features[featureName]) {
              return;
            }

            var linebreaks = currentOpts.traditionalMarkdownLinebreaks;
            if (linebreaks && args.skipIfTradtionalLinebreaks) {
              return;
            }

            args.start.lastIndex = 0;
            var result = [];
            var match = args.start.exec(block);
            if (!match) {
              return;
            }

            var lastChance = function () {
              return !next.some(function (blk) {
                return blk.match(args.stop);
              });
            };

            // shave off start tag and leading text, if any.
            var pos = args.start.lastIndex - match[0].length;
            var leading = block.slice(0, pos);
            var trailing = match[2] ? match[2].replace(/^\n*/, "") : "";

            // The other leading block should be processed first! eg a code block wrapped around a code block.
            if (args.withoutLeading && args.withoutLeading.test(leading)) {
              return;
            }

            // just give up if there's no stop tag in this or any next block
            args.stop.lastIndex = block.length - trailing.length;
            if (!args.stop.exec(block) && lastChance()) {
              return;
            }
            if (leading.length > 0) {
              var parsedLeading = this.processBlock(MD.mk_block(leading), []);
              if (parsedLeading && parsedLeading[0]) {
                result.push(parsedLeading[0]);
              }
            }
            if (trailing.length > 0) {
              next.unshift(MD.mk_block(trailing, block.trailing, block.lineNumber + countLines(leading) + (match[2] ? match[2].length : 0) - trailing.length));
            }

            // go through the available blocks to find the matching stop tag.
            var contentBlocks = [];
            var nesting = 0;
            var actualEndPos = -1;
            var currentBlock = undefined;

            blockloop: while (currentBlock = next.shift()) {

              // collect all the start and stop tags in the current block
              args.start.lastIndex = 0;
              var startPos = [];
              var m = undefined;
              while (m = args.start.exec(currentBlock)) {
                startPos.push(args.start.lastIndex - m[0].length);
                args.start.lastIndex = args.start.lastIndex - (m[2] ? m[2].length : 0);
              }
              args.stop.lastIndex = 0;
              var endPos = [];
              while (m = args.stop.exec(currentBlock)) {
                endPos.push(args.stop.lastIndex - m[0].length);
              }

              // go through the available end tags:
              var ep = 0;
              var sp = 0;
              while (ep < endPos.length) {
                if (sp < startPos.length && startPos[sp] < endPos[ep]) {
                  // there's an end tag, but there's also another start tag first. we need to go deeper.
                  sp++;nesting++;
                } else if (nesting > 0) {
                  // found an end tag, but we must go up a level first.
                  ep++;nesting--;
                } else {
                  // found an end tag and we're at the top: done! -- or: start tag and end tag are
                  // identical, (i.e. startPos[sp] == endPos[ep]), so we don't do nesting at all.
                  actualEndPos = endPos[ep];
                  break blockloop;
                }
              }

              if (lastChance()) {
                // when lastChance() becomes true the first time, currentBlock contains the last
                // end tag available in the input blocks but it's not on the right nesting level
                // or we would have terminated the loop already. the only thing we can do is to
                // treat the last available end tag as tho it were matched with our start tag
                // and let the emitter figure out how to render the garbage inside.
                actualEndPos = endPos[endPos.length - 1];
                break;
              }

              // any left-over start tags still increase the nesting level
              nesting += startPos.length - sp;
              contentBlocks.push(currentBlock);
            }

            var stopLen = currentBlock.match(args.stop)[0].length;
            var before = currentBlock.slice(0, actualEndPos).replace(/\n*$/, "");
            var after = currentBlock.slice(actualEndPos + stopLen).replace(/^\n*/, "");
            if (before.length > 0) contentBlocks.push(MD.mk_block(before, "", currentBlock.lineNumber));
            if (after.length > 0) next.unshift(MD.mk_block(after, currentBlock.trailing, currentBlock.lineNumber + countLines(before)));

            var emitterResult = args.emitter.call(this, contentBlocks, match);
            if (emitterResult) {
              result.push(emitterResult);
            }
            return result;
          };

          if (args.priority) {
            blockFunc.priority = args.priority;
          }

          this.registerBlock(args.start.toString(), blockFunc);
        }

        /**
          After the parser has been executed, post process any text nodes in the HTML document.
          This is useful if you want to apply a transformation to the text.
           If you are generating HTML from the text, it is preferable to use the replacer
          functions and do it in the parsing part of the pipeline. This function is best for
          simple transformations or transformations that have to happen after all earlier
          processing is done.
           For example, to convert all text to upper case:
           ```javascript
            helper.postProcessText(function (text) {
              return text.toUpperCase();
            });
          ```
        **/
      }, {
        key: 'postProcessTextFeature',
        value: function postProcessTextFeature(featureName, fn) {
          emitters.push(function () {
            if (!currentOpts.features[featureName]) {
              return;
            }
            return fn.apply(this, arguments);
          });
        }
      }, {
        key: 'onParseNodeFeature',
        value: function onParseNodeFeature(featureName, fn) {
          parseNodes.push(function () {
            if (!currentOpts.features[featureName]) {
              return;
            }
            return fn.apply(this, arguments);
          });
        }
      }, {
        key: 'registerBlockFeature',
        value: function registerBlockFeature(featureName, name, fn) {
          var blockFunc = function () {
            if (!currentOpts.features[featureName]) {
              return;
            }
            return fn.apply(this, arguments);
          };

          blockFunc.priority = fn.priority;
          this._dialect.block[name] = blockFunc;
        }
      }, {
        key: 'applyFeature',
        value: function applyFeature(featureName, module) {
          helper.registerInline = function (code, fn) {
            return helper.registerInlineFeature(featureName, code, fn);
          };
          helper.replaceBlock = function (args) {
            return helper.replaceBlockFeature(featureName, args);
          };
          helper.addPreProcessor = function (fn) {
            return helper.addPreProcessorFeature(featureName, fn);
          };
          helper.inlineReplace = function (token, emitter) {
            return helper.inlineReplaceFeature(featureName, token, emitter);
          };
          helper.postProcessTag = function (token, emitter) {
            return helper.postProcessTagFeature(featureName, token, emitter);
          };
          helper.inlineRegexp = function (args) {
            return helper.inlineRegexpFeature(featureName, args);
          };
          helper.inlineBetween = function (args) {
            return helper.inlineBetweenFeature(featureName, args);
          };
          helper.postProcessText = function (fn) {
            return helper.postProcessTextFeature(featureName, fn);
          };
          helper.onParseNode = function (fn) {
            return helper.onParseNodeFeature(featureName, fn);
          };
          helper.registerBlock = function (name, fn) {
            return helper.registerBlockFeature(featureName, name, fn);
          };

          module.setup(this);
        }
      }, {
        key: 'setup',
        value: function setup() {
          var _this2 = this;

          if (this._setup) {
            return;
          }
          this._setup = true;

          Object.keys(require._eak_seen).forEach(function (entry) {
            if (entry.indexOf('discourse-markdown') !== -1) {
              var _module = require(entry);
              if (_module && _module.setup) {
                (function () {
                  var featureName = entry.split('/').reverse()[0];
                  helper.whiteList = function (info) {
                    return whiteListFeature(featureName, info);
                  };

                  _this2.applyFeature(featureName, _module);
                  helper.whiteList = undefined;
                })();
              }
            }
          });

          MD.buildBlockOrder(this._dialect.block);
          var index = this._dialect.block.__order__.indexOf("code");
          if (index > -1) {
            this._dialect.block.__order__.splice(index, 1);
            this._dialect.block.__order__.unshift("code");
          }
          MD.buildInlinePatterns(this._dialect.inline);
        }
      }]);

      return DialectHelper;
    })();

    ;

    var helper = new DialectHelper();

    function cook(raw, opts) {
      currentOpts = opts;

      hoisted = {};
      raw = hoistCodeBlocksAndSpans(raw);

      preProcessors.forEach(function (p) {
        return raw = p(raw);
      });

      var whiteLister = new WhiteLister(opts.features);

      var tree = parser.toHTMLTree(raw, 'Discourse');
      var result = opts.sanitizer(parser.renderJsonML(parseTree(tree, opts)), whiteLister);

      // If we hoisted out anything, put it back
      var keys = Object.keys(hoisted);
      if (keys.length) {
        var found = true;

        var unhoist = function (key) {
          result = result.replace(new RegExp(key, "g"), function () {
            found = true;
            return hoisted[key];
          });
        };

        while (found) {
          found = false;
          keys.forEach(unhoist);
        }
      }

      return result.trim();
    }

    function setup() {
      helper.setup();
    }

    function processTextNodes(node, event, emitter) {
      if (node.length < 2) {
        return;
      }

      if (node[0] === '__RAW') {
        var hash = guid();
        hoisted[hash] = node[1];
        node[1] = hash;
        return;
      }

      for (var j = 1; j < node.length; j++) {
        var textContent = node[j];
        if (typeof textContent === "string") {
          var result = emitter(textContent, event);
          if (result) {
            if (result instanceof Array) {
              node.splice.apply(node, [j, 1].concat(result));
            } else {
              node[j] = result;
            }
          } else {
            node[j] = textContent;
          }
        }
      }
    }

    // Parse a JSON ML tree, using registered handlers to adjust it if necessary.
    function parseTree(tree, options, path, insideCounts) {

      if (tree instanceof Array) {
        var j;
        var i;
        var n, tagName;
        var text;

        (function () {
          var event = { node: tree, options: options, path: path, insideCounts: insideCounts || {} };
          parseNodes.forEach(function (fn) {
            return fn(event);
          });

          for (j = 0; j < emitters.length; j++) {
            processTextNodes(tree, event, emitters[j]);
          }

          path = path || [];
          insideCounts = insideCounts || {};

          path.push(tree);

          for (i = 1; i < tree.length; i++) {
            n = tree[i];
            tagName = n[0];

            insideCounts[tagName] = (insideCounts[tagName] || 0) + 1;

            if (n && n.length === 2 && n[0] === "p" && /^<!--([\s\S]*)-->$/.exec(n[1])) {
              // Remove paragraphs around comment-only nodes.
              tree[i] = n[1];
            } else {
              parseTree(n, options, path, insideCounts);
            }

            insideCounts[tagName] = insideCounts[tagName] - 1;
          }

          // If raw nodes are in paragraphs, pull them up
          if (tree.length === 2 && tree[0] === 'p' && tree[1] instanceof Array && tree[1][0] === "__RAW") {
            text = tree[1][1];

            tree[0] = "__RAW";
            tree[1] = text;
          }

          path.pop();
        })();
      }
      return tree;
    }

    // Returns true if there's an invalid word boundary for a match.
    function invalidBoundary(args, prev) {
      if (!(args.wordBoundary || args.spaceBoundary || args.spaceOrTagBoundary)) {
        return false;
      }

      var last = prev[prev.length - 1];
      if (typeof last !== "string") {
        return false;
      }

      if (args.wordBoundary && !last.match(/\W$/)) {
        return true;
      }
      if (args.spaceBoundary && !last.match(/\s$/)) {
        return true;
      }
      if (args.spaceOrTagBoundary && !last.match(/(\s|\>)$/)) {
        return true;
      }
    }

    function countLines(str) {
      var index = -1,
          count = 0;
      while ((index = str.indexOf("\n", index + 1)) !== -1) {
        count++;
      }
      return count;
    }

    function hoister(t, target, replacement) {
      var regexp = new RegExp(target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "g");
      if (t.match(regexp)) {
        var hash = guid();
        t = t.replace(regexp, hash);
        hoisted[hash] = replacement;
      }
      return t;
    }

    function outdent(t) {
      return t.replace(/^([ ]{4}|\t)/gm, "");
    }

    function removeEmptyLines(t) {
      return t.replace(/^\n+/, "").replace(/\s+$/, "");
    }

    function hideBackslashEscapedCharacters(t) {
      return t.replace(/\\\\/g, "\u1E800").replace(/\\`/g, "\u1E8001");
    }

    function showBackslashEscapedCharacters(t) {
      return t.replace(/\u1E8001/g, "\\`").replace(/\u1E800/g, "\\\\");
    }

    function hoistCodeBlocksAndSpans(text) {
      // replace all "\`" with a single character
      text = hideBackslashEscapedCharacters(text);

      // /!\ the order is important /!\

      // fenced code blocks (AKA GitHub code blocks)
      text = text.replace(/(^\n*|\n)```([a-z0-9\-]*)\n([\s\S]*?)\n```/g, function (_, before, language, content) {
        var hash = guid();
        hoisted[hash] = _escape(showBackslashEscapedCharacters(removeEmptyLines(content)));
        return before + "```" + language + "\n" + hash + "\n```";
      });

      // markdown code blocks
      text = text.replace(/(^\n*|\n\n)((?:(?:[ ]{4}|\t).*\n*)+)/g, function (match, before, content, index) {
        // make sure we aren't in a list
        var previousLine = text.slice(0, index).trim().match(/.*$/);
        if (previousLine && previousLine[0].length) {
          previousLine = previousLine[0].trim();
          if (/^(?:\*|\+|-|\d+\.)\s+/.test(previousLine)) {
            return match;
          }
        }
        // we can safely hoist the code block
        var hash = guid();
        hoisted[hash] = _escape(outdent(showBackslashEscapedCharacters(removeEmptyLines(content))));
        return before + "    " + hash + "\n";
      });

      // <pre>...</pre> code blocks
      text = text.replace(/(\s|^)<pre>([\s\S]*?)<\/pre>/ig, function (_, before, content) {
        var hash = guid();
        hoisted[hash] = _escape(showBackslashEscapedCharacters(removeEmptyLines(content)));
        return before + "<pre>" + hash + "</pre>";
      });

      // code spans (double & single `)
      ["``", "`"].forEach(function (delimiter) {
        var regexp = new RegExp("(^|[^`])" + delimiter + "([^`\\n]+?)" + delimiter + "([^`]|$)", "g");
        text = text.replace(regexp, function (_, before, content, after) {
          var hash = guid();
          hoisted[hash] = _escape(showBackslashEscapedCharacters(content.trim()));
          return before + delimiter + hash + delimiter + after;
        });
      });

      // replace back all weird character with "\`"
      return showBackslashEscapedCharacters(text);
    }
  });
define("pretty-text/engines/discourse-markdown/auto-link", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__.setup = setup;
    //  This addition handles auto linking of text. When included, it will parse out links and create
    //  `<a href>`s for them.

    var urlReplacerArgs = {
      matcher: /^((?:https?:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.])(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\([^\s()<>]+\)|[^`!()\[\]{};:'".,<>?«»“”‘’\s]))/,
      spaceOrTagBoundary: true,

      emitter: function (matches) {
        var url = matches[1];
        var href = url;

        // Don't autolink a markdown link to something
        if (url.match(/\]\[\d$/)) {
          return;
        }

        // If we improperly caught a markdown link abort
        if (url.match(/\(http/)) {
          return;
        }

        if (url.match(/^www/)) {
          href = "http://" + url;
        }
        return ['a', { href: href }, url];
      }
    };

    function setup(helper) {
      helper.inlineRegexp(_.merge({ start: 'http' }, urlReplacerArgs));
      helper.inlineRegexp(_.merge({ start: 'www' }, urlReplacerArgs));
    }
  });
define("pretty-text/engines/discourse-markdown/bbcode", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__.register = register;
    __exports__.builders = builders;
    __exports__.setup = setup;

    function register(helper, codeName, args, emitter) {
      // Optional second param for args
      if (typeof args === "function") {
        emitter = args;
        args = {};
      }

      helper.replaceBlock({
        start: new RegExp("\\[" + codeName + "(=[^\\[\\]]+)?\\]([\\s\\S]*)", "igm"),
        stop: new RegExp("\\[\\/" + codeName + "\\]", "igm"),
        emitter: function (blockContents, matches) {
          var _this = this;

          var options = helper.getOptions();
          while (blockContents.length && (typeof blockContents[0] === "string" || blockContents[0] instanceof String)) {
            blockContents[0] = String(blockContents[0]).replace(/^\s+/, '');
            if (!blockContents[0].length) {
              blockContents.shift();
            } else {
              break;
            }
          }

          var contents = [];
          if (blockContents.length) {
            var nextContents = blockContents.slice(1);
            blockContents = this.processBlock(blockContents[0], nextContents).concat(nextContents);

            blockContents.forEach(function (bc) {
              if (typeof bc === "string" || bc instanceof String) {
                var processed = _this.processInline(String(bc));
                if (processed.length) {
                  contents.push(['p'].concat(processed));
                }
              } else {
                contents.push(bc);
              }
            });
          }
          if (!args.singlePara && contents.length === 1 && contents[0] instanceof Array && contents[0][0] === "para") {
            contents[0].shift();
            contents = contents[0];
          }
          var result = emitter(contents, matches[1] ? matches[1].replace(/^=|\"/g, '') : null, options);
          return args.noWrap ? result : ['p', result];
        }
      });
    }

    ;

    function builders(helper) {
      function replaceBBCode(tag, emitter, opts) {
        var start = "[" + tag + "]";
        var stop = "[/" + tag + "]";

        opts = opts || {};
        opts = _.merge(opts, { start: start, stop: stop, emitter: emitter });
        helper.inlineBetween(opts);

        opts = _.merge(opts, { start: start.toUpperCase(), stop: stop.toUpperCase(), emitter: emitter });
        helper.inlineBetween(opts);
      }

      return {
        replaceBBCode: replaceBBCode,

        register: function (codeName, args, emitter) {
          register(helper, codeName, args, emitter);
        },

        rawBBCode: function (tag, emitter) {
          replaceBBCode(tag, emitter, { rawContents: true });
        },

        removeEmptyLines: function (contents) {
          var result = [];
          for (var i = 0; i < contents.length; i++) {
            if (contents[i] !== "\n") {
              result.push(contents[i]);
            }
          }
          return result;
        },

        replaceBBCodeParamsRaw: function (tag, emitter) {
          var opts = {
            rawContents: true,
            emitter: function (contents) {
              var m = /^([^\]]+)\]([\S\s]*)$/.exec(contents);
              if (m) {
                return emitter.call(this, m[1], m[2]);
              }
            }
          };

          helper.inlineBetween(_.merge(opts, { start: "[" + tag + "=", stop: "[/" + tag + "]" }));

          tag = tag.toUpperCase();
          helper.inlineBetween(_.merge(opts, { start: "[" + tag + "=", stop: "[/" + tag + "]" }));
        }
      };
    }

    function setup(helper) {

      helper.whiteList(['span.bbcode-b', 'span.bbcode-i', 'span.bbcode-u', 'span.bbcode-s']);

      var _builders = builders(helper);

      var replaceBBCode = _builders.replaceBBCode;
      var rawBBCode = _builders.rawBBCode;
      var removeEmptyLines = _builders.removeEmptyLines;
      var replaceBBCodeParamsRaw = _builders.replaceBBCodeParamsRaw;

      replaceBBCode('b', function (contents) {
        return ['span', { 'class': 'bbcode-b' }].concat(contents);
      });
      replaceBBCode('i', function (contents) {
        return ['span', { 'class': 'bbcode-i' }].concat(contents);
      });
      replaceBBCode('u', function (contents) {
        return ['span', { 'class': 'bbcode-u' }].concat(contents);
      });
      replaceBBCode('s', function (contents) {
        return ['span', { 'class': 'bbcode-s' }].concat(contents);
      });

      replaceBBCode('ul', function (contents) {
        return ['ul'].concat(removeEmptyLines(contents));
      });
      replaceBBCode('ol', function (contents) {
        return ['ol'].concat(removeEmptyLines(contents));
      });
      replaceBBCode('li', function (contents) {
        return ['li'].concat(removeEmptyLines(contents));
      });

      rawBBCode('img', function (href) {
        return ['img', { href: href }];
      });
      rawBBCode('email', function (contents) {
        return ['a', { href: "mailto:" + contents, 'data-bbcode': true }, contents];
      });

      replaceBBCode('url', function (contents) {
        if (!Array.isArray(contents)) {
          return;
        }

        var first = contents[0];
        if (contents.length === 1 && Array.isArray(first) && first[0] === 'a') {
          // single-line bbcode links shouldn't be oneboxed, so we mark this as a bbcode link.
          if (typeof first[1] !== 'object') {
            first.splice(1, 0, {});
          }
          first[1]['data-bbcode'] = true;
        }
        return ['concat'].concat(contents);
      });

      replaceBBCodeParamsRaw('url', function (param, contents) {
        var url = param.replace(/(^")|("$)/g, '');
        return ['a', { 'href': url }].concat(this.processInline(contents));
      });

      replaceBBCodeParamsRaw("email", function (param, contents) {
        return ['a', { href: "mailto:" + param, 'data-bbcode': true }].concat(contents);
      });

      helper.onParseNode(function (event) {
        if (!Array.isArray(event.node)) {
          return;
        }
        var result = [event.node[0]];
        var nodes = event.node.slice(1);
        for (var i = 0; i < nodes.length; i++) {
          if (Array.isArray(nodes[i]) && nodes[i][0] === 'concat') {
            for (var j = 1; j < nodes[i].length; j++) {
              result.push(nodes[i][j]);
            }
          } else {
            result.push(nodes[i]);
          }
        }
        for (var i = 0; i < result.length; i++) {
          event.node[i] = result[i];
        }
      });

      helper.replaceBlock({
        start: /(\[code\])([\s\S]*)/igm,
        stop: /\[\/code\]/igm,
        rawContents: true,

        emitter: function (blockContents) {
          var options = helper.getOptions();
          var inner = blockContents.join("\n");
          var defaultCodeLang = options.defaultCodeLang;
          return ['p', ['pre', ['code', { 'class': "lang-" + defaultCodeLang }, inner]]];
        }
      });
    }
  });
define("pretty-text/engines/discourse-markdown/bold-italics", 
  ["pretty-text/guid","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    __exports__.setup = setup;
    var guid = __dependency1__["default"];

    /**
      markdown-js doesn't ensure that em/strong codes are present on word boundaries.
      So we create our own handlers here.
    **/

    // From PageDown
    var aLetter = /[a-zA-Z0-9\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u203f-\u2040\u2054\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua67f-\ua697\ua717-\ua71f\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe33-\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]/;

    function unhoist(obj, from, to) {
      var unhoisted = 0;
      var regex = new RegExp(from, "g");

      if (_.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
          var item = obj[i];

          if (_.isString(item)) {
            // Odd, but we need +1 for the / in front of /*
            var matches = item.match(regex);
            unhoisted -= matches ? matches.length : 0;

            obj[i] = item.replace(regex, to);
            unhoisted += item.length - obj[i].length;
          }
          if (_.isArray(item)) {
            unhoisted += unhoist(item, from, to);
          }
        }
      }
      return unhoisted;
    };

    function setup(helper) {

      function replaceMarkdown(match, tag) {
        var hash = guid();

        helper.registerInline(match, function (text, matched, prev) {
          if (!text || text.length < match.length + 1) {
            return;
          }

          var lastText = prev[prev.length - 1];
          lastText = typeof lastText === "string" && lastText;
          lastText = lastText && lastText[lastText.length - 1];

          if (lastText && (lastText === "/" || lastText.match(aLetter))) {
            return;
          }
          if (text[match.length].match(/\s/)) {
            return;
          }

          // hoist out escaped \*
          text = text.replace(new RegExp("\\\\\\" + match[0], "g"), hash);

          var endText = new RegExp("[^\\s|" + match[0] + "]" + match.replace(/\*/g, "\\*") + "([^" + match[0] + "]|$)");
          var finish = text.split("\n")[0].search(endText);
          if (finish && finish >= 0) {
            var newText = this.processInline(text.substring(match.length, finish + 1));
            var unhoisted_length = unhoist(newText, hash, match[0]);
            var array = typeof tag === "string" ? [tag].concat(newText) : [tag[0], [tag[1]].concat(newText)];
            return [finish + match.length + 1 - unhoisted_length, array];
          }
        });
      }

      replaceMarkdown('***', ['strong', 'em']);
      replaceMarkdown('___', ['strong', 'em']);
      replaceMarkdown('**', 'strong');
      replaceMarkdown('__', 'strong');
      replaceMarkdown('*', 'em');
      replaceMarkdown('_', 'em');
    }

    ;
  });
define("pretty-text/engines/discourse-markdown/category-hashtag", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    __exports__.setup = setup;

    function setup(helper) {
      helper.inlineRegexp({
        start: '#',
        matcher: /^#([\w-:]{1,101})/i,
        spaceOrTagBoundary: true,

        emitter: function (matches) {
          var options = helper.getOptions();

          var _matches = _slicedToArray(matches, 2);

          var hashtag = _matches[0];
          var slug = _matches[1];

          var categoryHashtagLookup = options.categoryHashtagLookup;
          var result = categoryHashtagLookup && categoryHashtagLookup(slug);

          return result ? ['a', { class: 'hashtag', href: result[0] }, '#', ["span", {}, result[1]]] : ['span', { class: 'hashtag' }, hashtag];
        }
      });
    }
  });
define("pretty-text/engines/discourse-markdown/censored", 
  ["pretty-text/censored-words","pretty-text/pretty-text","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    __exports__.setup = setup;
    var censor = __dependency1__.censor;
    var registerOption = __dependency2__.registerOption;

    registerOption(function (siteSettings, opts) {
      opts.features.censored = true;
      opts.censoredWords = siteSettings.censored_words;
    });

    function setup(helper) {
      helper.addPreProcessor(function (text) {
        return censor(text, helper.getOptions().censoredWords);
      });
    }
  });
define("pretty-text/engines/discourse-markdown/code", 
  ["pretty-text/sanitizer","pretty-text/pretty-text","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    __exports__.setup = setup;
    var escape = __dependency1__.escape;
    var registerOption = __dependency2__.registerOption;

    // Support for various code blocks
    var TEXT_CODE_CLASSES = ["text", "pre", "plain"];

    function codeFlattenBlocks(blocks) {
      var result = "";
      blocks.forEach(function (b) {
        result += b;
        if (b.trailing) {
          result += b.trailing;
        }
      });
      return result;
    }

    registerOption(function (siteSettings, opts) {
      opts.features.code = true;
      opts.defaultCodeLang = siteSettings.default_code_lang;
      opts.acceptableCodeClasses = (siteSettings.highlighted_languages || "").split("|").concat(['auto', 'nohighlight']);
    });

    function setup(helper) {

      helper.whiteList({
        custom: function (tag, name, value) {
          if (tag === 'code' && name === 'class') {
            var m = /^lang\-(.+)$/.exec(value);
            if (m) {
              return helper.getOptions().acceptableCodeClasses.indexOf(m[1]) !== -1;
            }
          }
        }
      });

      helper.replaceBlock({
        start: /^`{3}([^\n\[\]]+)?\n?([\s\S]*)?/gm,
        stop: /^```$/gm,
        withoutLeading: /\[quote/gm, //if leading text contains a quote this should not match
        emitter: function (blockContents, matches) {
          var opts = helper.getOptions();

          var codeLang = opts.defaultCodeLang;
          var acceptableCodeClasses = opts.acceptableCodeClasses;
          if (acceptableCodeClasses && matches[1] && acceptableCodeClasses.indexOf(matches[1]) !== -1) {
            codeLang = matches[1];
          }

          if (TEXT_CODE_CLASSES.indexOf(matches[1]) !== -1) {
            return ['p', ['pre', ['code', { 'class': 'lang-nohighlight' }, codeFlattenBlocks(blockContents)]]];
          } else {
            return ['p', ['pre', ['code', { 'class': 'lang-' + codeLang }, codeFlattenBlocks(blockContents)]]];
          }
        }
      });

      helper.replaceBlock({
        start: /(<pre[^\>]*\>)([\s\S]*)/igm,
        stop: /<\/pre>/igm,
        rawContents: true,
        skipIfTradtionalLinebreaks: true,

        emitter: function (blockContents) {
          return ['p', ['pre', codeFlattenBlocks(blockContents)]];
        }
      });

      // Ensure that content in a code block is fully escaped. This way it's not white listed
      // and we can use HTML and Javascript examples.
      helper.onParseNode(function (event) {
        var node = event.node,
            path = event.path;

        if (node[0] === 'code') {
          var regexp = path && path[path.length - 1] && path[path.length - 1][0] && path[path.length - 1][0] === "pre" ? / +$/g : /^ +| +$/g;

          var contents = node[node.length - 1];
          node[node.length - 1] = escape(contents.replace(regexp, ''));
        }
      });
    }
  });
define("pretty-text/engines/discourse-markdown/emoji", 
  ["pretty-text/pretty-text","pretty-text/emoji","pretty-text/emoji/data","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    __exports__.setUnicodeReplacements = setUnicodeReplacements;
    __exports__.setup = setup;
    var registerOption = __dependency1__.registerOption;
    var buildEmojiUrl = __dependency2__.buildEmojiUrl;
    var translations = __dependency3__.translations;

    var _unicodeReplacements = undefined;
    var _unicodeRegexp = undefined;

    function setUnicodeReplacements(replacements) {
      _unicodeReplacements = replacements;
      if (replacements) {
        _unicodeRegexp = new RegExp(Object.keys(replacements).join("|"), "g");
      }
    }

    ;

    function escapeRegExp(s) {
      return s.replace(/[-/\\^$*+?.()|[\]{}]/gi, '\\$&');
    }

    function checkPrev(prev) {
      if (prev && prev.length) {
        var lastToken = prev[prev.length - 1];
        if (lastToken && lastToken.charAt) {
          var lastChar = lastToken.charAt(lastToken.length - 1);
          if (!/\W/.test(lastChar)) return false;
        }
      }
      return true;
    }

    registerOption(function (siteSettings, opts, state) {
      opts.features.emoji = !!siteSettings.enable_emoji;
      opts.emojiSet = siteSettings.emoji_set || "";
      opts.customEmoji = state.customEmoji;
    });

    function setup(helper) {

      helper.whiteList('img.emoji');

      function imageFor(code) {
        code = code.toLowerCase();
        var url = buildEmojiUrl(code, helper.getOptions());
        if (url) {
          var title = ':' + code + ':';
          return ['img', { href: url, title: title, 'class': 'emoji', alt: title }];
        }
      }

      var translationsWithColon = {};
      Object.keys(translations).forEach(function (t) {
        if (t[0] === ':') {
          translationsWithColon[t] = translations[t];
        } else {
          (function () {
            var replacement = translations[t];
            helper.inlineReplace(t, function (token, match, prev) {
              return checkPrev(prev) ? imageFor(replacement) : token;
            });
          })();
        }
      });
      var translationColonRegexp = new RegExp(Object.keys(translationsWithColon).map(function (t) {
        return '(' + escapeRegExp(t) + ')';
      }).join("|"));

      helper.registerInline(':', function (text, match, prev) {
        var endPos = text.indexOf(':', 1);
        var firstSpace = text.search(/\s/);
        if (!checkPrev(prev)) {
          return;
        }

        // If there is no trailing colon, check our translations that begin with colons
        if (endPos === -1 || firstSpace !== -1 && endPos > firstSpace) {
          translationColonRegexp.lastIndex = 0;
          var m = translationColonRegexp.exec(text);
          if (m && m[0] && text.indexOf(m[0]) === 0) {
            // Check outer edge
            var lastChar = text.charAt(m[0].length);
            if (lastChar && !/\s/.test(lastChar)) return;
            var _contents = imageFor(translationsWithColon[m[0]]);
            if (_contents) {
              return [m[0].length, _contents];
            }
          }
          return;
        }

        // Simple find and replace from our array
        var between = text.slice(1, endPos);
        var contents = imageFor(between);
        if (contents) {
          return [endPos + 1, contents];
        }
      });

      helper.addPreProcessor(function (text) {
        if (_unicodeReplacements) {
          _unicodeRegexp.lastIndex = 0;

          var m = undefined;
          while ((m = _unicodeRegexp.exec(text)) !== null) {
            var replacement = ":" + _unicodeReplacements[m[0]] + ":";
            var before = text.charAt(m.index - 1);
            if (!/\B/.test(before)) {
              replacement = "\u200b" + replacement;
            }
            text = text.replace(m[0], replacement);
          }
        }
        return text;
      });
    }
  });
define("pretty-text/engines/discourse-markdown/html", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__.setup = setup;
    var BLOCK_TAGS = ['address', 'article', 'aside', 'audio', 'blockquote', 'canvas', 'dd', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'iframe', 'noscript', 'ol', 'output', 'p', 'pre', 'section', 'table', 'tfoot', 'ul', 'video', 'summary'];

    function splitAtLast(tag, block, next, first) {
      var endTag = '</' + tag + '>';
      var endTagIndex = first ? block.indexOf(endTag) : block.lastIndexOf(endTag);

      if (endTagIndex !== -1) {
        endTagIndex += endTag.length;

        var trailing = block.substr(endTagIndex).replace(/^\s+/, '');
        if (trailing.length) {
          next.unshift(trailing);
        }

        return [block.substr(0, endTagIndex)];
      }
    };

    function setup(helper) {

      // If a row begins with HTML tags, don't parse it.
      helper.registerBlock('html', function (block, next) {
        var split = undefined,
            pos = undefined;

        // Fix manual blockquote paragraphing even though it's not strictly correct
        // PERF NOTE: /\S+<blockquote/ is a perf hog for search, try on huge string
        if (pos = block.search(/<blockquote/) >= 0) {
          if (block.substring(0, pos).search(/\s/) === -1) {
            split = splitAtLast('blockquote', block, next, true);
            if (split) {
              return this.processInline(split[0]);
            }
          }
        }

        var m = /^\s*<\/?([^>]+)\>/.exec(block);
        if (m && m[1]) {
          var tag = m[1].split(/\s/);
          if (tag && tag[0] && BLOCK_TAGS.indexOf(tag[0]) !== -1) {
            split = splitAtLast(tag[0], block, next);
            if (split) {
              if (split.length === 1 && split[0] === block) {
                return;
              }
              return split;
            }
            return [block.toString()];
          }
        }
      });
    }
  });
define("pretty-text/engines/discourse-markdown/mentions", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__.setup = setup;
    /**
      Supports our custom @mention syntax for calling out a user in a post.
      It will add a special class to them, and create a link if the user is found in a
      local map.
    **/

    function setup(helper) {

      // We have to prune @mentions that are within links.
      helper.onParseNode(function (event) {
        var node = event.node,
            path = event.path;

        if (node[1] && node[1]["class"] === 'mention') {
          var _parent = path[path.length - 1];

          // If the parent is an 'a', remove it
          if (_parent && _parent[0] === 'a') {
            var _name = node[2];
            node.length = 0;
            node[0] = "__RAW";
            node[1] = _name;
          }
        }
      });

      helper.inlineRegexp({
        start: '@',
        // NOTE: since we can't use SiteSettings here (they loads later in process)
        // we are being less strict to account for more cases than allowed
        matcher: /^@(\w[\w.-]{0,59})\b/i,
        wordBoundary: true,

        emitter: function (matches) {
          var mention = matches[0].trim();
          var name = matches[1];
          var opts = helper.getOptions();
          var mentionLookup = opts.mentionLookup;

          var type = mentionLookup && mentionLookup(name);
          if (type === "user") {
            return ['a', { 'class': 'mention', href: opts.getURL("/users/") + name.toLowerCase() }, mention];
          } else if (type === "group") {
            return ['a', { 'class': 'mention-group', href: opts.getURL("/groups/") + name }, mention];
          } else {
            return ['span', { 'class': 'mention' }, mention];
          }
        }
      });
    }
  });
define("pretty-text/engines/discourse-markdown/newline", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__.setup = setup;
    // Support for the newline behavior in markdown that most expect. Look through all text nodes
    // in the tree, replace any new lines with `br`s.

    function setup(helper) {
      helper.postProcessText(function (text, event) {
        var options = event.options;
        var insideCounts = event.insideCounts;

        if (options.traditionalMarkdownLinebreaks || insideCounts.pre > 0) {
          return;
        }

        if (text === "\n") {
          // If the tag is just a new line, replace it with a `<br>`
          return [['br']];
        } else {
          // If the text node contains new lines, perhaps with text between them, insert the
          // `<br>` tags.
          var split = text.split(/\n+/);
          if (split.length) {
            var replacement = [];
            for (var i = 0; i < split.length; i++) {
              if (split[i].length > 0) {
                replacement.push(split[i]);
              }
              if (i !== split.length - 1) {
                replacement.push(['br']);
              }
            }

            return replacement;
          }
        }
      });
    }
  });
define("pretty-text/engines/discourse-markdown/onebox", 
  ["pretty-text/oneboxer","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    __exports__.setup = setup;
    var lookupCache = __dependency1__.lookupCache;

    //  Given a node in the document and its parent, determine whether it is on its own line or not.
    function isOnOneLine(link, parent) {
      if (!parent) {
        return false;
      }

      var siblings = parent.slice(1);
      if (!siblings || siblings.length < 1) {
        return false;
      }

      var idx = siblings.indexOf(link);
      if (idx === -1) {
        return false;
      }

      if (idx > 0) {
        var prev = siblings[idx - 1];
        if (prev[0] !== 'br') {
          return false;
        }
      }

      if (idx < siblings.length) {
        var next = siblings[idx + 1];
        if (next && !(next[0] === 'br' || typeof next === 'string' && next.trim() === "")) {
          return false;
        }
      }

      return true;
    }

    //  We only onebox stuff that is on its own line.

    function setup(helper) {
      helper.onParseNode(function (event) {
        var node = event.node,
            path = event.path;

        // We only care about links
        if (node[0] !== 'a') {
          return;
        }

        var parent = path[path.length - 1];

        // We don't onebox bbcode
        if (node[1]['data-bbcode']) {
          delete node[1]['data-bbcode'];
          return;
        }

        // We don't onebox mentions
        if (node[1]['class'] === 'mention') {
          return;
        }

        // Don't onebox links within a list
        for (var i = 0; i < path.length; i++) {
          if (path[i][0] === 'li') {
            return;
          }
        }

        // If the link has a different label text than the link itself, don't onebox it.
        var label = node[node.length - 1];
        if (label !== node[1]['href']) {
          return;
        }

        if (isOnOneLine(node, parent)) {

          node[1]['class'] = 'onebox';
          node[1].target = '_blank';

          var contents = lookupCache(node[1].href);
          if (contents) {
            node[0] = '__RAW';
            node[1] = contents;
            node.length = 2;
          }
        }
      });
    }
  });
define("pretty-text/engines/discourse-markdown/quote", 
  ["pretty-text/engines/discourse-markdown/bbcode","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    __exports__.setup = setup;
    var register = __dependency1__.register;

    function setup(helper) {
      register(helper, 'quote', { noWrap: true, singlePara: true }, function (contents, bbParams, options) {
        var params = { 'class': 'quote' };
        var username = null;

        if (bbParams) {
          var paramsSplit = bbParams.split(/\,\s*/);
          username = paramsSplit[0];

          paramsSplit.forEach(function (p, i) {
            if (i > 0) {
              var assignment = p.split(':');
              if (assignment[0] && assignment[1]) {
                var escaped = helper.escape(assignment[0]);
                // don't escape attributes, makes no sense
                if (escaped === assignment[0]) {
                  params['data-' + assignment[0]] = helper.escape(assignment[1].trim());
                }
              }
            }
          });
        }

        var avatarImg = undefined;
        var postNumber = parseInt(params['data-post'], 10);
        var topicId = parseInt(params['data-topic'], 10);

        if (options.lookupAvatarByPostNumber) {
          // client-side, we can retrieve the avatar from the post
          avatarImg = options.lookupAvatarByPostNumber(postNumber, topicId);
        } else if (options.lookupAvatar) {
          // server-side, we need to lookup the avatar from the username
          avatarImg = options.lookupAvatar(username);
        }

        // If there's no username just return a simple quote
        if (!username) {
          return ['p', ['aside', params, ['blockquote'].concat(contents)]];
        }

        var header = ['div', { 'class': 'title' }, ['div', { 'class': 'quote-controls' }], avatarImg ? ['__RAW', avatarImg] : "", username ? username + ':' : ""];

        if (options.topicId && postNumber && options.getTopicInfo && topicId !== options.topicId) {
          var topicInfo = options.getTopicInfo(topicId);
          if (topicInfo) {
            var href = topicInfo.href;
            if (postNumber > 0) {
              href += "/" + postNumber;
            }
            // get rid of username said stuff
            header.pop();
            header.push(['a', { 'href': href }, topicInfo.title]);
          }
        }

        return ['aside', params, header, ['blockquote'].concat(contents)];
      });
    }
  });
define("pretty-text/engines/discourse-markdown/table", 
  ["pretty-text/pretty-text","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    __exports__.setup = setup;
    var registerOption = __dependency1__.registerOption;

    function tableFlattenBlocks(blocks) {
      var result = "";

      blocks.forEach(function (b) {
        result += b;
        if (b.trailing) {
          result += b.trailing;
        }
      });

      // bypass newline insertion
      return result.replace(/[\n\r]/g, " ");
    };

    registerOption(function (siteSettings, opts) {
      opts.features.table = !!siteSettings.allow_html_tables;
    });

    function setup(helper) {

      helper.whiteList(['table', 'table.md-table', 'tbody', 'thead', 'tr', 'th', 'td']);

      helper.replaceBlock({
        start: /(<table[^>]*>)([\S\s]*)/igm,
        stop: /<\/table>/igm,
        rawContents: true,
        priority: 1,

        emitter: function (contents) {
          return ['table', { "class": "md-table" }, tableFlattenBlocks.apply(this, [contents])];
        }
      });
    }
  });
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){var FilterCSS=require("cssfilter").FilterCSS;var _=require("./util");function getDefaultWhiteList(){return{a:["target","href","title"],abbr:["title"],address:[],area:["shape","coords","href","alt"],article:[],aside:[],audio:["autoplay","controls","loop","preload","src"],b:[],bdi:["dir"],bdo:["dir"],big:[],blockquote:["cite"],br:[],caption:[],center:[],cite:[],code:[],col:["align","valign","span","width"],colgroup:["align","valign","span","width"],dd:[],del:["datetime"],details:["open"],div:[],dl:[],dt:[],em:[],font:["color","size","face"],footer:[],h1:[],h2:[],h3:[],h4:[],h5:[],h6:[],header:[],hr:[],i:[],img:["src","alt","title","width","height"],ins:["datetime"],li:[],mark:[],nav:[],ol:[],p:[],pre:[],s:[],section:[],small:[],span:[],sub:[],sup:[],strong:[],table:["width","border","align","valign"],tbody:["align","valign"],td:["width","rowspan","colspan","align","valign"],tfoot:["align","valign"],th:["width","rowspan","colspan","align","valign"],thead:["align","valign"],tr:["rowspan","align","valign"],tt:[],u:[],ul:[],video:["autoplay","controls","loop","preload","src","height","width"]}}var defaultCSSFilter=new FilterCSS;function onTag(tag,html,options){}function onIgnoreTag(tag,html,options){}function onTagAttr(tag,name,value){}function onIgnoreTagAttr(tag,name,value){}function escapeHtml(html){return html.replace(REGEXP_LT,"&lt;").replace(REGEXP_GT,"&gt;")}function safeAttrValue(tag,name,value,cssFilter){cssFilter=cssFilter||defaultCSSFilter;value=friendlyAttrValue(value);if(name==="href"||name==="src"){value=_.trim(value);if(value==="#")return"#";if(!(value.substr(0,7)==="http://"||value.substr(0,8)==="https://"||value.substr(0,7)==="mailto:"||value[0]==="#"||value[0]==="/")){return""}}else if(name==="background"){REGEXP_DEFAULT_ON_TAG_ATTR_4.lastIndex=0;if(REGEXP_DEFAULT_ON_TAG_ATTR_4.test(value)){return""}}else if(name==="style"){REGEXP_DEFAULT_ON_TAG_ATTR_7.lastIndex=0;if(REGEXP_DEFAULT_ON_TAG_ATTR_7.test(value)){return""}REGEXP_DEFAULT_ON_TAG_ATTR_8.lastIndex=0;if(REGEXP_DEFAULT_ON_TAG_ATTR_8.test(value)){REGEXP_DEFAULT_ON_TAG_ATTR_4.lastIndex=0;if(REGEXP_DEFAULT_ON_TAG_ATTR_4.test(value)){return""}}value=cssFilter.process(value)}value=escapeAttrValue(value);return value}var REGEXP_LT=/</g;var REGEXP_GT=/>/g;var REGEXP_QUOTE=/"/g;var REGEXP_QUOTE_2=/&quot;/g;var REGEXP_ATTR_VALUE_1=/&#([a-zA-Z0-9]*);?/gim;var REGEXP_ATTR_VALUE_COLON=/&colon;?/gim;var REGEXP_ATTR_VALUE_NEWLINE=/&newline;?/gim;var REGEXP_DEFAULT_ON_TAG_ATTR_3=/\/\*|\*\//gm;var REGEXP_DEFAULT_ON_TAG_ATTR_4=/((j\s*a\s*v\s*a|v\s*b|l\s*i\s*v\s*e)\s*s\s*c\s*r\s*i\s*p\s*t\s*|m\s*o\s*c\s*h\s*a)\:/gi;var REGEXP_DEFAULT_ON_TAG_ATTR_5=/^[\s"'`]*(d\s*a\s*t\s*a\s*)\:/gi;var REGEXP_DEFAULT_ON_TAG_ATTR_6=/^[\s"'`]*(d\s*a\s*t\s*a\s*)\:\s*image\//gi;var REGEXP_DEFAULT_ON_TAG_ATTR_7=/e\s*x\s*p\s*r\s*e\s*s\s*s\s*i\s*o\s*n\s*\(.*/gi;var REGEXP_DEFAULT_ON_TAG_ATTR_8=/u\s*r\s*l\s*\(.*/gi;function escapeQuote(str){return str.replace(REGEXP_QUOTE,"&quot;")}function unescapeQuote(str){return str.replace(REGEXP_QUOTE_2,'"')}function escapeHtmlEntities(str){return str.replace(REGEXP_ATTR_VALUE_1,function replaceUnicode(str,code){return code[0]==="x"||code[0]==="X"?String.fromCharCode(parseInt(code.substr(1),16)):String.fromCharCode(parseInt(code,10))})}function escapeDangerHtml5Entities(str){return str.replace(REGEXP_ATTR_VALUE_COLON,":").replace(REGEXP_ATTR_VALUE_NEWLINE," ")}function clearNonPrintableCharacter(str){var str2="";for(var i=0,len=str.length;i<len;i++){str2+=str.charCodeAt(i)<32?" ":str.charAt(i)}return _.trim(str2)}function friendlyAttrValue(str){str=unescapeQuote(str);str=escapeHtmlEntities(str);str=escapeDangerHtml5Entities(str);str=clearNonPrintableCharacter(str);return str}function escapeAttrValue(str){str=escapeQuote(str);str=escapeHtml(str);return str}function onIgnoreTagStripAll(){return""}function StripTagBody(tags,next){if(typeof next!=="function"){next=function(){}}var isRemoveAllTag=!Array.isArray(tags);function isRemoveTag(tag){if(isRemoveAllTag)return true;return _.indexOf(tags,tag)!==-1}var removeList=[];var posStart=false;return{onIgnoreTag:function(tag,html,options){if(isRemoveTag(tag)){if(options.isClosing){var ret="[/removed]";var end=options.position+ret.length;removeList.push([posStart!==false?posStart:options.position,end]);posStart=false;return ret}else{if(!posStart){posStart=options.position}return"[removed]"}}else{return next(tag,html,options)}},remove:function(html){var rethtml="";var lastPos=0;_.forEach(removeList,function(pos){rethtml+=html.slice(lastPos,pos[0]);lastPos=pos[1]});rethtml+=html.slice(lastPos);return rethtml}}}function stripCommentTag(html){return html.replace(STRIP_COMMENT_TAG_REGEXP,"")}var STRIP_COMMENT_TAG_REGEXP=/<!--[\s\S]*?-->/g;function stripBlankChar(html){var chars=html.split("");chars=chars.filter(function(char){var c=char.charCodeAt(0);if(c===127)return false;if(c<=31){if(c===10||c===13)return true;return false}return true});return chars.join("")}exports.whiteList=getDefaultWhiteList();exports.getDefaultWhiteList=getDefaultWhiteList;exports.onTag=onTag;exports.onIgnoreTag=onIgnoreTag;exports.onTagAttr=onTagAttr;exports.onIgnoreTagAttr=onIgnoreTagAttr;exports.safeAttrValue=safeAttrValue;exports.escapeHtml=escapeHtml;exports.escapeQuote=escapeQuote;exports.unescapeQuote=unescapeQuote;exports.escapeHtmlEntities=escapeHtmlEntities;exports.escapeDangerHtml5Entities=escapeDangerHtml5Entities;exports.clearNonPrintableCharacter=clearNonPrintableCharacter;exports.friendlyAttrValue=friendlyAttrValue;exports.escapeAttrValue=escapeAttrValue;exports.onIgnoreTagStripAll=onIgnoreTagStripAll;exports.StripTagBody=StripTagBody;exports.stripCommentTag=stripCommentTag;exports.stripBlankChar=stripBlankChar;exports.cssFilter=defaultCSSFilter},{"./util":4,cssfilter:8}],2:[function(require,module,exports){var DEFAULT=require("./default");var parser=require("./parser");var FilterXSS=require("./xss");function filterXSS(html,options){var xss=new FilterXSS(options);return xss.process(html)}exports=module.exports=filterXSS;exports.FilterXSS=FilterXSS;for(var i in DEFAULT)exports[i]=DEFAULT[i];for(var i in parser)exports[i]=parser[i];if(typeof window!=="undefined"){window.filterXSS=module.exports}},{"./default":1,"./parser":3,"./xss":5}],3:[function(require,module,exports){var _=require("./util");function getTagName(html){var i=html.indexOf(" ");if(i===-1){var tagName=html.slice(1,-1)}else{var tagName=html.slice(1,i+1)}tagName=_.trim(tagName).toLowerCase();if(tagName.slice(0,1)==="/")tagName=tagName.slice(1);if(tagName.slice(-1)==="/")tagName=tagName.slice(0,-1);return tagName}function isClosing(html){return html.slice(0,2)==="</"}function parseTag(html,onTag,escapeHtml){"user strict";var rethtml="";var lastPos=0;var tagStart=false;var quoteStart=false;var currentPos=0;var len=html.length;var currentHtml="";var currentTagName="";for(currentPos=0;currentPos<len;currentPos++){var c=html.charAt(currentPos);if(tagStart===false){if(c==="<"){tagStart=currentPos;continue}}else{if(quoteStart===false){if(c==="<"){rethtml+=escapeHtml(html.slice(lastPos,currentPos));tagStart=currentPos;lastPos=currentPos;continue}if(c===">"){rethtml+=escapeHtml(html.slice(lastPos,tagStart));currentHtml=html.slice(tagStart,currentPos+1);currentTagName=getTagName(currentHtml);rethtml+=onTag(tagStart,rethtml.length,currentTagName,currentHtml,isClosing(currentHtml));lastPos=currentPos+1;tagStart=false;continue}if((c==='"'||c==="'")&&html.charAt(currentPos-1)==="="){quoteStart=c;continue}}else{if(c===quoteStart){quoteStart=false;continue}}}}if(lastPos<html.length){rethtml+=escapeHtml(html.substr(lastPos))}return rethtml}var REGEXP_ATTR_NAME=/[^a-zA-Z0-9_:\.\-]/gim;function parseAttr(html,onAttr){"user strict";var lastPos=0;var retAttrs=[];var tmpName=false;var len=html.length;function addAttr(name,value){name=_.trim(name);name=name.replace(REGEXP_ATTR_NAME,"").toLowerCase();if(name.length<1)return;var ret=onAttr(name,value||"");if(ret)retAttrs.push(ret)}for(var i=0;i<len;i++){var c=html.charAt(i);var v,j;if(tmpName===false&&c==="="){tmpName=html.slice(lastPos,i);lastPos=i+1;continue}if(tmpName!==false){if(i===lastPos&&(c==='"'||c==="'")&&html.charAt(i-1)==="="){j=html.indexOf(c,i+1);if(j===-1){break}else{v=_.trim(html.slice(lastPos+1,j));addAttr(tmpName,v);tmpName=false;i=j;lastPos=i+1;continue}}}if(c===" "){if(tmpName===false){j=findNextEqual(html,i);if(j===-1){v=_.trim(html.slice(lastPos,i));addAttr(v);tmpName=false;lastPos=i+1;continue}else{i=j-1;continue}}else{j=findBeforeEqual(html,i-1);if(j===-1){v=_.trim(html.slice(lastPos,i));v=stripQuoteWrap(v);addAttr(tmpName,v);tmpName=false;lastPos=i+1;continue}else{continue}}}}if(lastPos<html.length){if(tmpName===false){addAttr(html.slice(lastPos))}else{addAttr(tmpName,stripQuoteWrap(_.trim(html.slice(lastPos))))}}return _.trim(retAttrs.join(" "))}function findNextEqual(str,i){for(;i<str.length;i++){var c=str[i];if(c===" ")continue;if(c==="=")return i;return-1}}function findBeforeEqual(str,i){for(;i>0;i--){var c=str[i];if(c===" ")continue;if(c==="=")return i;return-1}}function isQuoteWrapString(text){if(text[0]==='"'&&text[text.length-1]==='"'||text[0]==="'"&&text[text.length-1]==="'"){return true}else{return false}}function stripQuoteWrap(text){if(isQuoteWrapString(text)){return text.substr(1,text.length-2)}else{return text}}exports.parseTag=parseTag;exports.parseAttr=parseAttr},{"./util":4}],4:[function(require,module,exports){module.exports={indexOf:function(arr,item){var i,j;if(Array.prototype.indexOf){return arr.indexOf(item)}for(i=0,j=arr.length;i<j;i++){if(arr[i]===item){return i}}return-1},forEach:function(arr,fn,scope){var i,j;if(Array.prototype.forEach){return arr.forEach(fn,scope)}for(i=0,j=arr.length;i<j;i++){fn.call(scope,arr[i],i,arr)}},trim:function(str){if(String.prototype.trim){return str.trim()}return str.replace(/(^\s*)|(\s*$)/g,"")}}},{}],5:[function(require,module,exports){var FilterCSS=require("cssfilter").FilterCSS;var DEFAULT=require("./default");var parser=require("./parser");var parseTag=parser.parseTag;var parseAttr=parser.parseAttr;var _=require("./util");function isNull(obj){return obj===undefined||obj===null}function getAttrs(html){var i=html.indexOf(" ");if(i===-1){return{html:"",closing:html[html.length-2]==="/"}}html=_.trim(html.slice(i+1,-1));var isClosing=html[html.length-1]==="/";if(isClosing)html=_.trim(html.slice(0,-1));return{html:html,closing:isClosing}}function FilterXSS(options){options=options||{};if(options.stripIgnoreTag){if(options.onIgnoreTag){console.error('Notes: cannot use these two options "stripIgnoreTag" and "onIgnoreTag" at the same time')}options.onIgnoreTag=DEFAULT.onIgnoreTagStripAll}options.whiteList=options.whiteList||DEFAULT.whiteList;options.onTag=options.onTag||DEFAULT.onTag;options.onTagAttr=options.onTagAttr||DEFAULT.onTagAttr;options.onIgnoreTag=options.onIgnoreTag||DEFAULT.onIgnoreTag;options.onIgnoreTagAttr=options.onIgnoreTagAttr||DEFAULT.onIgnoreTagAttr;options.safeAttrValue=options.safeAttrValue||DEFAULT.safeAttrValue;options.escapeHtml=options.escapeHtml||DEFAULT.escapeHtml;options.css=options.css||{};this.options=options;this.cssFilter=new FilterCSS(options.css)}FilterXSS.prototype.process=function(html){html=html||"";html=html.toString();if(!html)return"";var me=this;var options=me.options;var whiteList=options.whiteList;var onTag=options.onTag;var onIgnoreTag=options.onIgnoreTag;var onTagAttr=options.onTagAttr;var onIgnoreTagAttr=options.onIgnoreTagAttr;var safeAttrValue=options.safeAttrValue;var escapeHtml=options.escapeHtml;var cssFilter=me.cssFilter;if(options.stripBlankChar){html=DEFAULT.stripBlankChar(html)}if(!options.allowCommentTag){html=DEFAULT.stripCommentTag(html)}var stripIgnoreTagBody=false;if(options.stripIgnoreTagBody){var stripIgnoreTagBody=DEFAULT.StripTagBody(options.stripIgnoreTagBody,onIgnoreTag);onIgnoreTag=stripIgnoreTagBody.onIgnoreTag}var retHtml=parseTag(html,function(sourcePosition,position,tag,html,isClosing){var info={sourcePosition:sourcePosition,position:position,isClosing:isClosing,isWhite:tag in whiteList};var ret=onTag(tag,html,info);if(!isNull(ret))return ret;if(info.isWhite){if(info.isClosing){return"</"+tag+">"}var attrs=getAttrs(html);var whiteAttrList=whiteList[tag];var attrsHtml=parseAttr(attrs.html,function(name,value){var isWhiteAttr=_.indexOf(whiteAttrList,name)!==-1;var ret=onTagAttr(tag,name,value,isWhiteAttr);if(!isNull(ret))return ret;if(isWhiteAttr){value=safeAttrValue(tag,name,value,cssFilter);if(value){return name+'="'+value+'"'}else{return name}}else{var ret=onIgnoreTagAttr(tag,name,value,isWhiteAttr);if(!isNull(ret))return ret;return}});var html="<"+tag;if(attrsHtml)html+=" "+attrsHtml;if(attrs.closing)html+=" /";html+=">";return html}else{var ret=onIgnoreTag(tag,html,info);if(!isNull(ret))return ret;return escapeHtml(html)}},escapeHtml);if(stripIgnoreTagBody){retHtml=stripIgnoreTagBody.remove(retHtml)}return retHtml};module.exports=FilterXSS},{"./default":1,"./parser":3,"./util":4,cssfilter:8}],6:[function(require,module,exports){var DEFAULT=require("./default");var parseStyle=require("./parser");var _=require("./util");function isNull(obj){return obj===undefined||obj===null}function FilterCSS(options){options=options||{};options.whiteList=options.whiteList||DEFAULT.whiteList;options.onAttr=options.onAttr||DEFAULT.onAttr;options.onIgnoreAttr=options.onIgnoreAttr||DEFAULT.onIgnoreAttr;this.options=options}FilterCSS.prototype.process=function(css){css=css||"";css=css.toString();if(!css)return"";var me=this;var options=me.options;var whiteList=options.whiteList;var onAttr=options.onAttr;var onIgnoreAttr=options.onIgnoreAttr;var retCSS=parseStyle(css,function(sourcePosition,position,name,value,source){var check=whiteList[name];var isWhite=false;if(check===true)isWhite=check;else if(typeof check==="function")isWhite=check(value);else if(check instanceof RegExp)isWhite=check.test(value);if(isWhite!==true)isWhite=false;var opts={position:position,sourcePosition:sourcePosition,source:source,isWhite:isWhite};if(isWhite){var ret=onAttr(name,value,opts);if(isNull(ret)){return name+":"+value}else{return ret}}else{var ret=onIgnoreAttr(name,value,opts);if(!isNull(ret)){return ret}}});return retCSS};module.exports=FilterCSS},{"./default":7,"./parser":9,"./util":10}],7:[function(require,module,exports){function getDefaultWhiteList(){var whiteList={};whiteList["align-content"]=false;whiteList["align-items"]=false;whiteList["align-self"]=false;whiteList["alignment-adjust"]=false;whiteList["alignment-baseline"]=false;whiteList["all"]=false;whiteList["anchor-point"]=false;whiteList["animation"]=false;whiteList["animation-delay"]=false;whiteList["animation-direction"]=false;whiteList["animation-duration"]=false;whiteList["animation-fill-mode"]=false;whiteList["animation-iteration-count"]=false;whiteList["animation-name"]=false;whiteList["animation-play-state"]=false;whiteList["animation-timing-function"]=false;whiteList["azimuth"]=false;whiteList["backface-visibility"]=false;whiteList["background"]=true;whiteList["background-attachment"]=true;whiteList["background-clip"]=true;whiteList["background-color"]=true;whiteList["background-image"]=true;whiteList["background-origin"]=true;whiteList["background-position"]=true;whiteList["background-repeat"]=true;whiteList["background-size"]=true;whiteList["baseline-shift"]=false;whiteList["binding"]=false;whiteList["bleed"]=false;whiteList["bookmark-label"]=false;whiteList["bookmark-level"]=false;whiteList["bookmark-state"]=false;whiteList["border"]=true;whiteList["border-bottom"]=true;whiteList["border-bottom-color"]=true;whiteList["border-bottom-left-radius"]=true;whiteList["border-bottom-right-radius"]=true;whiteList["border-bottom-style"]=true;whiteList["border-bottom-width"]=true;whiteList["border-collapse"]=true;whiteList["border-color"]=true;whiteList["border-image"]=true;whiteList["border-image-outset"]=true;whiteList["border-image-repeat"]=true;whiteList["border-image-slice"]=true;whiteList["border-image-source"]=true;whiteList["border-image-width"]=true;whiteList["border-left"]=true;whiteList["border-left-color"]=true;whiteList["border-left-style"]=true;whiteList["border-left-width"]=true;whiteList["border-radius"]=true;whiteList["border-right"]=true;whiteList["border-right-color"]=true;whiteList["border-right-style"]=true;whiteList["border-right-width"]=true;whiteList["border-spacing"]=true;whiteList["border-style"]=true;whiteList["border-top"]=true;whiteList["border-top-color"]=true;whiteList["border-top-left-radius"]=true;whiteList["border-top-right-radius"]=true;whiteList["border-top-style"]=true;whiteList["border-top-width"]=true;whiteList["border-width"]=true;whiteList["bottom"]=false;whiteList["box-decoration-break"]=true;whiteList["box-shadow"]=true;whiteList["box-sizing"]=true;whiteList["box-snap"]=true;whiteList["box-suppress"]=true;whiteList["break-after"]=true;whiteList["break-before"]=true;whiteList["break-inside"]=true;whiteList["caption-side"]=false;whiteList["chains"]=false;whiteList["clear"]=true;whiteList["clip"]=false;whiteList["clip-path"]=false;whiteList["clip-rule"]=false;whiteList["color"]=true;whiteList["color-interpolation-filters"]=true;whiteList["column-count"]=false;whiteList["column-fill"]=false;whiteList["column-gap"]=false;whiteList["column-rule"]=false;whiteList["column-rule-color"]=false;whiteList["column-rule-style"]=false;whiteList["column-rule-width"]=false;whiteList["column-span"]=false;whiteList["column-width"]=false;whiteList["columns"]=false;whiteList["contain"]=false;whiteList["content"]=false;whiteList["counter-increment"]=false;whiteList["counter-reset"]=false;whiteList["counter-set"]=false;whiteList["crop"]=false;whiteList["cue"]=false;whiteList["cue-after"]=false;whiteList["cue-before"]=false;whiteList["cursor"]=false;whiteList["direction"]=false;whiteList["display"]=true;whiteList["display-inside"]=true;whiteList["display-list"]=true;whiteList["display-outside"]=true;whiteList["dominant-baseline"]=false;whiteList["elevation"]=false;whiteList["empty-cells"]=false;whiteList["filter"]=false;whiteList["flex"]=false;whiteList["flex-basis"]=false;whiteList["flex-direction"]=false;whiteList["flex-flow"]=false;whiteList["flex-grow"]=false;whiteList["flex-shrink"]=false;whiteList["flex-wrap"]=false;whiteList["float"]=false;whiteList["float-offset"]=false;whiteList["flood-color"]=false;whiteList["flood-opacity"]=false;whiteList["flow-from"]=false;whiteList["flow-into"]=false;whiteList["font"]=true;whiteList["font-family"]=true;whiteList["font-feature-settings"]=true;whiteList["font-kerning"]=true;whiteList["font-language-override"]=true;whiteList["font-size"]=true;whiteList["font-size-adjust"]=true;whiteList["font-stretch"]=true;whiteList["font-style"]=true;whiteList["font-synthesis"]=true;whiteList["font-variant"]=true;whiteList["font-variant-alternates"]=true;whiteList["font-variant-caps"]=true;whiteList["font-variant-east-asian"]=true;whiteList["font-variant-ligatures"]=true;whiteList["font-variant-numeric"]=true;whiteList["font-variant-position"]=true;whiteList["font-weight"]=true;whiteList["grid"]=false;whiteList["grid-area"]=false;whiteList["grid-auto-columns"]=false;whiteList["grid-auto-flow"]=false;whiteList["grid-auto-rows"]=false;whiteList["grid-column"]=false;whiteList["grid-column-end"]=false;whiteList["grid-column-start"]=false;whiteList["grid-row"]=false;whiteList["grid-row-end"]=false;whiteList["grid-row-start"]=false;whiteList["grid-template"]=false;whiteList["grid-template-areas"]=false;whiteList["grid-template-columns"]=false;whiteList["grid-template-rows"]=false;whiteList["hanging-punctuation"]=false;whiteList["height"]=true;whiteList["hyphens"]=false;whiteList["icon"]=false;whiteList["image-orientation"]=false;whiteList["image-resolution"]=false;whiteList["ime-mode"]=false;whiteList["initial-letters"]=false;whiteList["inline-box-align"]=false;whiteList["justify-content"]=false;whiteList["justify-items"]=false;whiteList["justify-self"]=false;whiteList["left"]=false;whiteList["letter-spacing"]=true;whiteList["lighting-color"]=true;whiteList["line-box-contain"]=false;whiteList["line-break"]=false;whiteList["line-grid"]=false;whiteList["line-height"]=false;whiteList["line-snap"]=false;whiteList["line-stacking"]=false;whiteList["line-stacking-ruby"]=false;whiteList["line-stacking-shift"]=false;whiteList["line-stacking-strategy"]=false;whiteList["list-style"]=true;whiteList["list-style-image"]=true;whiteList["list-style-position"]=true;whiteList["list-style-type"]=true;whiteList["margin"]=true;whiteList["margin-bottom"]=true;whiteList["margin-left"]=true;whiteList["margin-right"]=true;whiteList["margin-top"]=true;whiteList["marker-offset"]=false;whiteList["marker-side"]=false;whiteList["marks"]=false;whiteList["mask"]=false;whiteList["mask-box"]=false;whiteList["mask-box-outset"]=false;whiteList["mask-box-repeat"]=false;whiteList["mask-box-slice"]=false;whiteList["mask-box-source"]=false;whiteList["mask-box-width"]=false;whiteList["mask-clip"]=false;whiteList["mask-image"]=false;whiteList["mask-origin"]=false;whiteList["mask-position"]=false;whiteList["mask-repeat"]=false;whiteList["mask-size"]=false;whiteList["mask-source-type"]=false;whiteList["mask-type"]=false;whiteList["max-height"]=true;whiteList["max-lines"]=false;whiteList["max-width"]=true;whiteList["min-height"]=true;whiteList["min-width"]=true;whiteList["move-to"]=false;whiteList["nav-down"]=false;whiteList["nav-index"]=false;whiteList["nav-left"]=false;whiteList["nav-right"]=false;whiteList["nav-up"]=false;whiteList["object-fit"]=false;whiteList["object-position"]=false;whiteList["opacity"]=false;whiteList["order"]=false;whiteList["orphans"]=false;whiteList["outline"]=false;whiteList["outline-color"]=false;whiteList["outline-offset"]=false;whiteList["outline-style"]=false;whiteList["outline-width"]=false;whiteList["overflow"]=false;whiteList["overflow-wrap"]=false;whiteList["overflow-x"]=false;whiteList["overflow-y"]=false;whiteList["padding"]=true;whiteList["padding-bottom"]=true;whiteList["padding-left"]=true;whiteList["padding-right"]=true;whiteList["padding-top"]=true;whiteList["page"]=false;whiteList["page-break-after"]=false;whiteList["page-break-before"]=false;whiteList["page-break-inside"]=false;whiteList["page-policy"]=false;whiteList["pause"]=false;whiteList["pause-after"]=false;whiteList["pause-before"]=false;whiteList["perspective"]=false;whiteList["perspective-origin"]=false;whiteList["pitch"]=false;whiteList["pitch-range"]=false;whiteList["play-during"]=false;whiteList["position"]=false;whiteList["presentation-level"]=false;whiteList["quotes"]=false;whiteList["region-fragment"]=false;whiteList["resize"]=false;whiteList["rest"]=false;whiteList["rest-after"]=false;whiteList["rest-before"]=false;whiteList["richness"]=false;whiteList["right"]=false;whiteList["rotation"]=false;whiteList["rotation-point"]=false;whiteList["ruby-align"]=false;whiteList["ruby-merge"]=false;whiteList["ruby-position"]=false;whiteList["shape-image-threshold"]=false;whiteList["shape-outside"]=false;whiteList["shape-margin"]=false;whiteList["size"]=false;whiteList["speak"]=false;whiteList["speak-as"]=false;whiteList["speak-header"]=false;whiteList["speak-numeral"]=false;whiteList["speak-punctuation"]=false;whiteList["speech-rate"]=false;whiteList["stress"]=false;whiteList["string-set"]=false;whiteList["tab-size"]=false;whiteList["table-layout"]=false;whiteList["text-align"]=true;whiteList["text-align-last"]=true;whiteList["text-combine-upright"]=true;whiteList["text-decoration"]=true;whiteList["text-decoration-color"]=true;whiteList["text-decoration-line"]=true;whiteList["text-decoration-skip"]=true;whiteList["text-decoration-style"]=true;whiteList["text-emphasis"]=true;whiteList["text-emphasis-color"]=true;whiteList["text-emphasis-position"]=true;whiteList["text-emphasis-style"]=true;whiteList["text-height"]=true;whiteList["text-indent"]=true;whiteList["text-justify"]=true;whiteList["text-orientation"]=true;whiteList["text-overflow"]=true;whiteList["text-shadow"]=true;whiteList["text-space-collapse"]=true;whiteList["text-transform"]=true;whiteList["text-underline-position"]=true;whiteList["text-wrap"]=true;whiteList["top"]=false;whiteList["transform"]=false;whiteList["transform-origin"]=false;whiteList["transform-style"]=false;whiteList["transition"]=false;whiteList["transition-delay"]=false;whiteList["transition-duration"]=false;whiteList["transition-property"]=false;whiteList["transition-timing-function"]=false;whiteList["unicode-bidi"]=false;whiteList["vertical-align"]=false;whiteList["visibility"]=false;whiteList["voice-balance"]=false;whiteList["voice-duration"]=false;whiteList["voice-family"]=false;whiteList["voice-pitch"]=false;whiteList["voice-range"]=false;whiteList["voice-rate"]=false;whiteList["voice-stress"]=false;whiteList["voice-volume"]=false;whiteList["volume"]=false;whiteList["white-space"]=false;whiteList["widows"]=false;whiteList["width"]=true;whiteList["will-change"]=false;whiteList["word-break"]=true;whiteList["word-spacing"]=true;whiteList["word-wrap"]=true;whiteList["wrap-flow"]=false;whiteList["wrap-through"]=false;whiteList["writing-mode"]=false;whiteList["z-index"]=false;return whiteList}function onAttr(name,value,options){}function onIgnoreAttr(name,value,options){}exports.whiteList=getDefaultWhiteList();exports.getDefaultWhiteList=getDefaultWhiteList;exports.onAttr=onAttr;exports.onIgnoreAttr=onIgnoreAttr},{}],8:[function(require,module,exports){var DEFAULT=require("./default");var FilterCSS=require("./css");function filterCSS(html,options){var xss=new FilterCSS(options);return xss.process(html)}exports=module.exports=filterCSS;exports.FilterCSS=FilterCSS;for(var i in DEFAULT)exports[i]=DEFAULT[i];if(typeof window!=="undefined"){window.filterCSS=module.exports}},{"./css":6,"./default":7}],9:[function(require,module,exports){var _=require("./util");function parseStyle(css,onAttr){css=_.trimRight(css);if(css[css.length-1]!==";")css+=";";var cssLength=css.length;var isParenthesisOpen=false;var lastPos=0;var i=0;var retCSS="";function addNewAttr(){if(!isParenthesisOpen){var source=_.trim(css.slice(lastPos,i));var j=source.indexOf(":");if(j!==-1){var name=_.trim(source.slice(0,j));var value=_.trim(source.slice(j+1));if(name){var ret=onAttr(lastPos,retCSS.length,name,value,source);if(ret)retCSS+=ret+"; "}}}lastPos=i+1}for(;i<cssLength;i++){var c=css[i];if(c==="/"&&css[i+1]==="*"){var j=css.indexOf("*/",i+2);if(j===-1)break;i=j+1;lastPos=i+1;isParenthesisOpen=false}else if(c==="("){isParenthesisOpen=true}else if(c===")"){isParenthesisOpen=false}else if(c===";"){if(isParenthesisOpen){}else{addNewAttr()}}else if(c==="\n"){addNewAttr()}}return _.trim(retCSS)}module.exports=parseStyle},{"./util":10}],10:[function(require,module,exports){module.exports={indexOf:function(arr,item){var i,j;if(Array.prototype.indexOf){return arr.indexOf(item)}for(i=0,j=arr.length;i<j;i++){if(arr[i]===item){return i}}return-1},forEach:function(arr,fn,scope){var i,j;if(Array.prototype.forEach){return arr.forEach(fn,scope)}for(i=0,j=arr.length;i<j;i++){fn.call(scope,arr[i],i,arr)}},trim:function(str){if(String.prototype.trim){return str.trim()}return str.replace(/(^\s*)|(\s*$)/g,"")},trimRight:function(str){if(String.prototype.trimRight){return str.trimRight()}return str.replace(/(\s*$)/g,"")}}},{}]},{},[2]);
/*
  This is a fork of markdown-js with a few changes to support discourse:

  * We have replaced the strong/em handlers because we prefer them only to work on word
    boundaries.

  * [MOD]: non-url is fixed

  // Fix code within attrs
  if (prev && (typeof prev[0] === "string") && prev[0].match(/<[^>]+$/)) { return; }

  // __RAW

  // if ( next_block.match(is_list_re) || (next_block.match(/^ /) && (!next_block.match(/^ *\>/))) ) {

*/

// Released under MIT license
// Copyright (c) 2009-2010 Dominic Baggott
// Copyright (c) 2009-2010 Ash Berlin
// Copyright (c) 2011 Christoph Dorn <christoph@christophdorn.com> (http://www.christophdorn.com)

/*jshint browser:true, devel:true */


(function(expose) {

  var MarkdownHelpers = {};

  // For Spidermonkey based engines
  function mk_block_toSource() {
    return "Markdown.mk_block( " +
            uneval(this.toString()) +
            ", " +
            uneval(this.trailing) +
            ", " +
            uneval(this.lineNumber) +
            " )";
  }

  // node
  function mk_block_inspect() {
    var util = require("util");
    return "Markdown.mk_block( " +
            util.inspect(this.toString()) +
            ", " +
            util.inspect(this.trailing) +
            ", " +
            util.inspect(this.lineNumber) +
            " )";

  }

  MarkdownHelpers.mk_block = function(block, trail, line) {
    // Be helpful for default case in tests.
    if ( arguments.length === 1 )
      trail = "\n\n";

    // We actually need a String object, not a string primitive
    /* jshint -W053 */
    var s = new String(block);
    s.trailing = trail;
    // To make it clear its not just a string
    s.inspect = mk_block_inspect;
    s.toSource = mk_block_toSource;

    if ( line !== undefined )
      s.lineNumber = line;

    return s;
  };

  var isArray = MarkdownHelpers.isArray = Array.isArray || function(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };

  // Don't mess with Array.prototype. Its not friendly
  if ( Array.prototype.forEach ) {
    MarkdownHelpers.forEach = function forEach( arr, cb, thisp ) {
      return arr.forEach( cb, thisp );
    };
  }
  else {
    MarkdownHelpers.forEach = function forEach(arr, cb, thisp) {
      for (var i = 0; i < arr.length; i++)
        cb.call(thisp || arr, arr[i], i, arr);
    };
  }

  MarkdownHelpers.isEmpty = function isEmpty( obj ) {
    for ( var key in obj ) {
      if ( hasOwnProperty.call( obj, key ) )
        return false;
    }
    return true;
  };

  MarkdownHelpers.extract_attr = function extract_attr( jsonml ) {
    return isArray(jsonml)
        && jsonml.length > 1
        && typeof jsonml[ 1 ] === "object"
        && !( isArray(jsonml[ 1 ]) )
        ? jsonml[ 1 ]
        : undefined;
  };

 /**
   *  class Markdown
   *
   *  Markdown processing in Javascript done right. We have very particular views
   *  on what constitutes 'right' which include:
   *
   *  - produces well-formed HTML (this means that em and strong nesting is
   *    important)
   *
   *  - has an intermediate representation to allow processing of parsed data (We
   *    in fact have two, both as [JsonML]: a markdown tree and an HTML tree).
   *
   *  - is easily extensible to add new dialects without having to rewrite the
   *    entire parsing mechanics
   *
   *  - has a good test suite
   *
   *  This implementation fulfills all of these (except that the test suite could
   *  do with expanding to automatically run all the fixtures from other Markdown
   *  implementations.)
   *
   *  ##### Intermediate Representation
   *
   *  *TODO* Talk about this :) Its JsonML, but document the node names we use.
   *
   *  [JsonML]: http://jsonml.org/ "JSON Markup Language"
   **/
  var Markdown = function(dialect) {
    switch (typeof dialect) {
    case "undefined":
      this.dialect = Markdown.dialects.Gruber;
      break;
    case "object":
      this.dialect = dialect;
      break;
    default:
      if ( dialect in Markdown.dialects )
        this.dialect = Markdown.dialects[dialect];
      else
        throw new Error("Unknown Markdown dialect '" + String(dialect) + "'");
      break;
    }
    this.em_state = [];
    this.strong_state = [];
    this.debug_indent = "";
  };

  /**
   * Markdown.dialects
   *
   * Namespace of built-in dialects.
   **/
  Markdown.dialects = {};

  // Imported functions
  var mk_block = Markdown.mk_block = MarkdownHelpers.mk_block,
      isArray = MarkdownHelpers.isArray;

  /**
   *  parse( markdown, [dialect] ) -> JsonML
   *  - markdown (String): markdown string to parse
   *  - dialect (String | Dialect): the dialect to use, defaults to gruber
   *
   *  Parse `markdown` and return a markdown document as a Markdown.JsonML tree.
   **/
  Markdown.parse = function( source, dialect ) {
    // dialect will default if undefined
    var md = new Markdown( dialect );
    return md.toTree( source );
  };

  /**
   *  count_lines( str ) -> count
   *  - str (String): String whose lines we want to count
   *
   *  Counts the number of linebreaks in `str`
   **/
  function count_lines( str ) {
    return str.split("\n").length - 1;
  }

  // Internal - split source into rough blocks
  Markdown.prototype.split_blocks = function splitBlocks( input ) {
    input = input.replace(/(\r\n|\n|\r)/g, "\n");
    // [\s\S] matches _anything_ (newline or space)
    // [^] is equivalent but doesn't work in IEs.
    var re = /([\s\S]+?)($|\n#|\n(?:\s*\n|$)+)/g,
        blocks = [],
        m;

    var line_no = 1;

    if ( ( m = /^(\s*\n)/.exec(input) ) !== null ) {
      // skip (but count) leading blank lines
      line_no += count_lines( m[0] );
      re.lastIndex = m[0].length;
    }

    while ( ( m = re.exec(input) ) !== null ) {
      if (m[2] === "\n#") {
        m[2] = "\n";
        re.lastIndex--;
      }
      blocks.push( mk_block( m[1], m[2], line_no ) );
      line_no += count_lines( m[0] );
    }

    return blocks;
  };

  /**
   *  Markdown#processBlock( block, next ) -> undefined | [ JsonML, ... ]
   *  - block (String): the block to process
   *  - next (Array): the following blocks
   *
   * Process `block` and return an array of JsonML nodes representing `block`.
   *
   * It does this by asking each block level function in the dialect to process
   * the block until one can. Succesful handling is indicated by returning an
   * array (with zero or more JsonML nodes), failure by a false value.
   *
   * Blocks handlers are responsible for calling [[Markdown#processInline]]
   * themselves as appropriate.
   *
   * If the blocks were split incorrectly or adjacent blocks need collapsing you
   * can adjust `next` in place using shift/splice etc.
   *
   * If any of this default behaviour is not right for the dialect, you can
   * define a `__call__` method on the dialect that will get invoked to handle
   * the block processing.
   */
  Markdown.prototype.processBlock = function processBlock( block, next ) {
    var cbs = this.dialect.block,
        ord = cbs.__order__;

    if ( "__call__" in cbs )
      return cbs.__call__.call(this, block, next);

    for ( var i = 0; i < ord.length; i++ ) {
      //D:this.debug( "Testing", ord[i] );
      var res = cbs[ ord[i] ].call( this, block, next );
      if ( res ) {
        //D:this.debug("  matched");
        if ( !isArray(res) || ( res.length > 0 && !( isArray(res[0]) ) && ( typeof res[0] !== "string")) )
          this.debug(ord[i], "didn't return a proper array");
        //D:this.debug( "" );
        return res;
      }
    }

    // Uhoh! no match! Should we throw an error?
    return [];
  };

  Markdown.prototype.processInline = function processInline( block ) {
    return this.dialect.inline.__call__.call( this, String( block ) );
  };

  /**
   *  Markdown#toTree( source ) -> JsonML
   *  - source (String): markdown source to parse
   *
   *  Parse `source` into a JsonML tree representing the markdown document.
   **/
  // custom_tree means set this.tree to `custom_tree` and restore old value on return
  Markdown.prototype.toTree = function toTree( source, custom_root ) {
    var blocks = source instanceof Array ? source : this.split_blocks( source );

    // Make tree a member variable so its easier to mess with in extensions
    var old_tree = this.tree;
    try {
      this.tree = custom_root || this.tree || [ "markdown" ];

      blocks_loop:
      while ( blocks.length ) {
        var b = this.processBlock( blocks.shift(), blocks );

        // Reference blocks and the like won't return any content
        if ( !b.length )
          continue blocks_loop;

        this.tree.push.apply( this.tree, b );
      }
      return this.tree;
    }
    finally {
      if ( custom_root )
        this.tree = old_tree;
    }
  };

  // Noop by default
  Markdown.prototype.debug = function () {
    var args = Array.prototype.slice.call( arguments);
    args.unshift(this.debug_indent);
    if ( typeof print !== "undefined" )
      print.apply( print, args );
    if ( typeof console !== "undefined" && typeof console.log !== "undefined" )
      console.log.apply( null, args );
  };

  Markdown.prototype.loop_re_over_block = function( re, block, cb ) {
    // Dont use /g regexps with this
    var m,
        b = block.valueOf();

    while ( b.length && (m = re.exec(b) ) !== null ) {
      b = b.substr( m[0].length );
      cb.call(this, m);
    }
    return b;
  };

  // Build default order from insertion order.
  Markdown.buildBlockOrder = function(d) {
    var ord = [[]];
    for ( var i in d ) {
      if ( i === "__order__" || i === "__call__" )
        continue;

      var priority = d[i].priority || 0;
      ord[priority] = ord[priority] || [];
      ord[priority].push( i );
    }

    var flattend = [];
    for (i=ord.length-1; i>=0; i--){
      if (ord[i]) {
        for (var j=0; j<ord[i].length; j++){
          flattend.push(ord[i][j]);
        }
      }
    }

    d.__order__ = flattend;
  };

  // Build patterns for inline matcher
  Markdown.buildInlinePatterns = function(d) {
    var patterns = [];

    for ( var i in d ) {
      // __foo__ is reserved and not a pattern
      if ( i.match( /^__.*__$/) )
        continue;
      var l = i.replace( /([\\.*+?^$|()\[\]{}])/g, "\\$1" )
               .replace( /\n/, "\\n" );
      patterns.push( i.length === 1 ? l : "(?:" + l + ")" );
    }

    patterns = patterns.join("|");
    d.__patterns__ = patterns;
    //print("patterns:", uneval( patterns ) );

    var fn = d.__call__;
    d.__call__ = function(text, pattern) {
      if ( pattern !== undefined )
        return fn.call(this, text, pattern);
      else
        return fn.call(this, text, patterns);
    };
  };

  var extract_attr = MarkdownHelpers.extract_attr;

  /**
   *  renderJsonML( jsonml[, options] ) -> String
   *  - jsonml (Array): JsonML array to render to XML
   *  - options (Object): options
   *
   *  Converts the given JsonML into well-formed XML.
   *
   *  The options currently understood are:
   *
   *  - root (Boolean): wether or not the root node should be included in the
   *    output, or just its children. The default `false` is to not include the
   *    root itself.
   */
  Markdown.renderJsonML = function( jsonml, options ) {
    options = options || {};
    // include the root element in the rendered output?
    options.root = options.root || false;

    var content = [];

    if ( options.root ) {
      content.push( render_tree( jsonml ) );
    }
    else {
      jsonml.shift(); // get rid of the tag
      if ( jsonml.length && typeof jsonml[ 0 ] === "object" && !( jsonml[ 0 ] instanceof Array ) )
        jsonml.shift(); // get rid of the attributes

      while ( jsonml.length )
        content.push( render_tree( jsonml.shift() ) );
    }

    return content.join( "\n\n" );
  };

  /**
   *  toHTMLTree( markdown, [dialect] ) -> JsonML
   *  toHTMLTree( md_tree ) -> JsonML
   *  - markdown (String): markdown string to parse
   *  - dialect (String | Dialect): the dialect to use, defaults to gruber
   *  - md_tree (Markdown.JsonML): parsed markdown tree
   *
   *  Turn markdown into HTML, represented as a JsonML tree. If a string is given
   *  to this function, it is first parsed into a markdown tree by calling
   *  [[parse]].
   **/
  Markdown.toHTMLTree = function toHTMLTree( input, dialect , options ) {

    // convert string input to an MD tree
    if ( typeof input === "string" )
      input = this.parse( input, dialect );

    // Now convert the MD tree to an HTML tree

    // remove references from the tree
    var attrs = extract_attr( input ),
        refs = {};

    if ( attrs && attrs.references )
      refs = attrs.references;


    var html = convert_tree_to_html( input, refs , options );
    merge_text_nodes( html );
    return html;
  };

  /**
   *  toHTML( markdown, [dialect]  ) -> String
   *  toHTML( md_tree ) -> String
   *  - markdown (String): markdown string to parse
   *  - md_tree (Markdown.JsonML): parsed markdown tree
   *
   *  Take markdown (either as a string or as a JsonML tree) and run it through
   *  [[toHTMLTree]] then turn it into a well-formated HTML fragment.
   **/
  Markdown.toHTML = function toHTML( source , dialect , options ) {
    var input = this.toHTMLTree( source , dialect , options );

    return this.renderJsonML( input );
  };

  function escapeHTML( text ) {
    if (text && text.length > 0) {
      return text.replace( /&/g, "&amp;" )
                 .replace( /</g, "&lt;" )
                 .replace( />/g, "&gt;" )
                 .replace( /"/g, "&quot;" )
                 .replace( /'/g, "&#39;" );
    } else {
      return "";
    }
  }

  function render_tree( jsonml ) {
    // basic case
    if ( typeof jsonml === "string" )
      return jsonml;

    if ( jsonml[0] === "__RAW" ) {
      return jsonml[1];
    }

    var tag = jsonml.shift(),
        attributes = {},
        content = [];

    if ( jsonml.length && typeof jsonml[ 0 ] === "object" && !( jsonml[ 0 ] instanceof Array ) )
      attributes = jsonml.shift();

    while ( jsonml.length )
      content.push( render_tree( jsonml.shift() ) );

    var tag_attrs = "";
    if (typeof attributes.src !== 'undefined') {
      tag_attrs += ' src="' + escapeHTML( attributes.src ) + '"';
      delete attributes.src;
    }

    for ( var a in attributes ) {
      var escaped = escapeHTML( attributes[ a ]);
      if (escaped && escaped.length) {
        tag_attrs += " " + a + '="' + escaped + '"';
      }
    }

    // be careful about adding whitespace here for inline elements
    if ( tag === "img" || tag === "br" || tag === "hr" )
      return "<"+ tag + tag_attrs + "/>";
    else
      return "<"+ tag + tag_attrs + ">" + content.join( "" ) + "</" + tag + ">";
  }

  function convert_tree_to_html( tree, references, options ) {
    var i;
    options = options || {};

    // shallow clone
    var jsonml = tree.slice( 0 );

    if ( typeof options.preprocessTreeNode === "function" )
      jsonml = options.preprocessTreeNode(jsonml, references);

    // Clone attributes if they exist
    var attrs = extract_attr( jsonml );
    if ( attrs ) {
      jsonml[ 1 ] = {};
      for ( i in attrs ) {
        jsonml[ 1 ][ i ] = attrs[ i ];
      }
      attrs = jsonml[ 1 ];
    }

    // basic case
    if ( typeof jsonml === "string" )
      return jsonml;

    // convert this node
    switch ( jsonml[ 0 ] ) {
    case "header":
      jsonml[ 0 ] = "h" + jsonml[ 1 ].level;
      delete jsonml[ 1 ].level;
      break;
    case "bulletlist":
      jsonml[ 0 ] = "ul";
      break;
    case "numberlist":
      jsonml[ 0 ] = "ol";
      break;
    case "listitem":
      jsonml[ 0 ] = "li";
      break;
    case "para":
      jsonml[ 0 ] = "p";
      break;
    case "markdown":
      jsonml[ 0 ] = "html";
      if ( attrs )
        delete attrs.references;
      break;
    case "code_block":
      jsonml[ 0 ] = "pre";
      i = attrs ? 2 : 1;
      var code = [ "code" ];
      code.push.apply( code, jsonml.splice( i, jsonml.length - i ) );
      jsonml[ i ] = code;
      break;
    case "inlinecode":
      jsonml[ 0 ] = "code";
      break;
    case "img":
      jsonml[ 1 ].src = jsonml[ 1 ].href;
      delete jsonml[ 1 ].href;
      break;
    case "linebreak":
      jsonml[ 0 ] = "br";
      break;
    case "link":
      jsonml[ 0 ] = "a";
      break;
    case "link_ref":
      jsonml[ 0 ] = "a";

      // grab this ref and clean up the attribute node
      var ref = references[ attrs.ref ];

      // if the reference exists, make the link
      if ( ref ) {
        delete attrs.ref;

        // add in the href and title, if present
        attrs.href = ref.href;
        if ( ref.title )
          attrs.title = ref.title;

        // get rid of the unneeded original text
        delete attrs.original;
      }
      // the reference doesn't exist, so revert to plain text
      else {
        return attrs.original;
      }
      break;
    case "img_ref":
      jsonml[ 0 ] = "img";

      // grab this ref and clean up the attribute node
      var ref = references[ attrs.ref ];

      // if the reference exists, make the link
      if ( ref ) {
        delete attrs.ref;

        // add in the href and title, if present
        attrs.src = ref.href;
        if ( ref.title )
          attrs.title = ref.title;

        // get rid of the unneeded original text
        delete attrs.original;
      }
      // the reference doesn't exist, so revert to plain text
      else {
        return attrs.original;
      }
      break;
    }

    // convert all the children
    i = 1;

    // deal with the attribute node, if it exists
    if ( attrs ) {
      // if there are keys, skip over it
      for ( var key in jsonml[ 1 ] ) {
        i = 2;
        break;
      }
      // if there aren't, remove it
      if ( i === 1 )
        jsonml.splice( i, 1 );
    }

    for ( ; i < jsonml.length; ++i ) {
      jsonml[ i ] = convert_tree_to_html( jsonml[ i ], references, options );
    }

    return jsonml;
  }

  // merges adjacent text nodes into a single node
  function merge_text_nodes( jsonml ) {
    // skip the tag name and attribute hash
    var i = extract_attr( jsonml ) ? 2 : 1;

    while ( i < jsonml.length ) {
      // if it's a string check the next item too
      if ( typeof jsonml[ i ] === "string" ) {
        if ( i + 1 < jsonml.length && typeof jsonml[ i + 1 ] === "string" ) {
          // merge the second string into the first and remove it
          jsonml[ i ] += jsonml.splice( i + 1, 1 )[ 0 ];
        }
        else {
          ++i;
        }
      }
      // if it's not a string recurse
      else {
        merge_text_nodes( jsonml[ i ] );
        ++i;
      }
    }
  }

  var DialectHelpers = {};
  DialectHelpers.inline_until_char = function( text, want ) {
    var consumed = 0,
        nodes = [],
        patterns = this.dialect.inline.__patterns__.replace('|_|', '|');

    while ( true ) {
      if ( text.charAt( consumed ) === want ) {
        // Found the character we were looking for
        consumed++;
        return [ consumed, nodes ];
      }

      if ( consumed >= text.length ) {
        // No closing char found. Abort.
        return [consumed, null, nodes];
      }

      var res = this.dialect.inline.__oneElement__.call(this, text.substr( consumed ), patterns, [text.substr(0, consumed)]);
      consumed += res[ 0 ];
      // Add any returned nodes.
      nodes.push.apply( nodes, res.slice( 1 ) );
    }
  };

  // Helper function to make sub-classing a dialect easier
  DialectHelpers.subclassDialect = function( d ) {
    function Block() {}
    Block.prototype = d.block;
    function Inline() {}
    Inline.prototype = d.inline;

    return { block: new Block(), inline: new Inline() };
  };

  var forEach = MarkdownHelpers.forEach,
      extract_attr = MarkdownHelpers.extract_attr,
      mk_block = MarkdownHelpers.mk_block,
      isEmpty = MarkdownHelpers.isEmpty,
      inline_until_char = DialectHelpers.inline_until_char;

  // A robust regexp for matching URLs. Thakns: https://gist.github.com/dperini/729294
  var urlRegexp = /(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?/i.source;

  /**
   * Gruber dialect
   *
   * The default dialect that follows the rules set out by John Gruber's
   * markdown.pl as closely as possible. Well actually we follow the behaviour of
   * that script which in some places is not exactly what the syntax web page
   * says.
   **/
  var Gruber = {
    block: {
      atxHeader: function atxHeader( block, next ) {
        var m = block.match( /^(#{1,6})\s*(.*?)\s*#*\s*(?:\n|$)/ );

        if ( !m )
          return undefined;

        var header = [ "header", { level: m[ 1 ].length } ];
        Array.prototype.push.apply(header, this.processInline(m[ 2 ]));

        if ( m[0].length < block.length )
          next.unshift( mk_block( block.substr( m[0].length ), block.trailing, block.lineNumber + 2 ) );

        return [ header ];
      },

      setextHeader: function setextHeader( block, next ) {
        var m = block.match( /^(.*)\n([-=])\2\2+(?:\n|$)/ );

        if ( !m )
          return undefined;

        var level = ( m[ 2 ] === "=" ) ? 1 : 2,
            header = [ "header", { level : level } ].concat( this.processInline(m[ 1 ]) );

        if ( m[0].length < block.length )
          next.unshift( mk_block( block.substr( m[0].length ), block.trailing, block.lineNumber + 2 ) );

        return [ header ];
      },

      code: function code( block, next ) {
        // |    Foo
        // |bar
        // should be a code block followed by a paragraph. Fun
        //
        // There might also be adjacent code block to merge.

        var ret = [],
            re = /^(?: {0,3}\t| {4})(.*)\n?/;

        // 4 spaces + content
        if ( !block.match( re ) )
          return undefined;

        block_search:
        do {
          // Now pull out the rest of the lines
          var b = this.loop_re_over_block(
                    re, block.valueOf(), function( m ) { ret.push( m[1] ); } );

          if ( b.length ) {
            // Case alluded to in first comment. push it back on as a new block
            next.unshift( mk_block(b, block.trailing) );
            break block_search;
          }
          else if ( next.length ) {
            // Check the next block - it might be code too
            if ( !next[0].match( re ) )
              break block_search;

            // Pull how how many blanks lines follow - minus two to account for .join
            ret.push ( block.trailing.replace(/[^\n]/g, "").substring(2) );

            block = next.shift();
          }
          else {
            break block_search;
          }
        } while ( true );

        return [ [ "code_block", ret.join("\n") ] ];
      },

      horizRule: function horizRule( block, next ) {
        // this needs to find any hr in the block to handle abutting blocks
        var m = block.match( /^(?:([\s\S]*?)\n)?[ \t]*([-_*])(?:[ \t]*\2){2,}[ \t]*(?:\n([\s\S]*))?$/ );

        if ( !m )
          return undefined;

        var jsonml = [ [ "hr" ] ];

        // if there's a leading abutting block, process it
        if ( m[ 1 ] ) {
          var contained = mk_block( m[ 1 ], "", block.lineNumber );
          jsonml.unshift.apply( jsonml, this.toTree( contained, [] ) );
        }

        // if there's a trailing abutting block, stick it into next
        if ( m[ 3 ] )
          next.unshift( mk_block( m[ 3 ], block.trailing, block.lineNumber + 1 ) );

        return jsonml;
      },

      // There are two types of lists. Tight and loose. Tight lists have no whitespace
      // between the items (and result in text just in the <li>) and loose lists,
      // which have an empty line between list items, resulting in (one or more)
      // paragraphs inside the <li>.
      //
      // There are all sorts weird edge cases about the original markdown.pl's
      // handling of lists:
      //
      // * Nested lists are supposed to be indented by four chars per level. But
      //   if they aren't, you can get a nested list by indenting by less than
      //   four so long as the indent doesn't match an indent of an existing list
      //   item in the 'nest stack'.
      //
      // * The type of the list (bullet or number) is controlled just by the
      //    first item at the indent. Subsequent changes are ignored unless they
      //    are for nested lists
      //
      lists: (function( ) {
        // Use a closure to hide a few variables.
        var any_list = "[*+-]|\\d+\\.",
            bullet_list = /[*+-]/,
            // Capture leading indent as it matters for determining nested lists.
            is_list_re = new RegExp( "^( {0,3})(" + any_list + ")[ \t]+" ),
            indent_re = "(?: {0,3}\\t| {4})";

        // TODO: Cache this regexp for certain depths.
        // Create a regexp suitable for matching an li for a given stack depth
        function regex_for_depth( depth ) {
          return new RegExp(
            // m[1] = indent, m[2] = list_type
            "(?:^(" + indent_re + "{0," + depth + "} {0,3})(" + any_list + ")\\s+)|" +
            // m[3] = cont
            "(^" + indent_re + "{0," + (depth-1) + "}[ ]{0,4})"
          );
        }
        function expand_tab( input ) {
          return input.replace( / {0,3}\t/g, "    " );
        }

        // Add inline content `inline` to `li`. inline comes from processInline
        // so is an array of content
        function add(li, loose, inline, nl) {
          if ( loose ) {
            li.push( [ "para" ].concat(inline) );
            return;
          }
          // Hmmm, should this be any block level element or just paras?
          var add_to = li[li.length -1] instanceof Array && li[li.length - 1][0] === "para"
                     ? li[li.length -1]
                     : li;

          // If there is already some content in this list, add the new line in
          if ( nl && li.length > 1 )
            inline.unshift(nl);

          for ( var i = 0; i < inline.length; i++ ) {
            var what = inline[i],
                is_str = typeof what === "string";
            if ( is_str && add_to.length > 1 && typeof add_to[add_to.length-1] === "string" )
              add_to[ add_to.length-1 ] += what;
            else
              add_to.push( what );
          }
        }

        // contained means have an indent greater than the current one. On
        // *every* line in the block
        function get_contained_blocks( depth, blocks ) {

          var re = new RegExp( "^(" + indent_re + "{" + depth + "}.*?\\n?)*$" ),
              replace = new RegExp("^" + indent_re + "{" + depth + "}", "gm"),
              ret = [];


          while ( blocks.length > 0 ) {
            // HACK: Fixes a v8 issue
            test = blocks[0].replace(/^ {8,}/, '        ');
            if ( re.exec( test ) ) {
              var b = blocks.shift(),
                  // Now remove that indent
                  x = b.replace( replace, "");

              ret.push( mk_block( x, b.trailing, b.lineNumber ) );
            }
            else
              break;
          }
          return ret;
        }

        // passed to stack.forEach to turn list items up the stack into paras
        function paragraphify(s, i, stack) {
          var list = s.list;
          var last_li = list[list.length-1];

          if ( last_li[1] instanceof Array && last_li[1][0] === "para" )
            return;

          if ( i + 1 === stack.length ) {
            // Last stack frame
            // Keep the same array, but replace the contents
            last_li.push( ["para"].concat( last_li.splice(1, last_li.length - 1) ) );
          }
          else {
            var sublist = last_li.pop();
            last_li.push( ["para"].concat( last_li.splice(1, last_li.length - 1) ), sublist );
          }
        }

        // The matcher function
        return function( block, next ) {
          var m = block.match( is_list_re );
          if ( !m )
            return undefined;

          function make_list( m ) {
            var list = bullet_list.exec( m[2] )
                     ? ["bulletlist"]
                     : ["numberlist"];

            stack.push( { list: list, indent: m[1] } );
            return list;
          }

          var stack = [], // Stack of lists for nesting.
              list = make_list( m ),
              last_li,
              loose = false,
              ret = [ stack[0].list ],
              i;

          // Loop to search over block looking for inner block elements and loose lists
          loose_search:
          while ( true ) {
            // Split into lines preserving new lines at end of line
            var lines = block.split( /(?=\n)/ );

            // We have to grab all lines for a li and call processInline on them
            // once as there are some inline things that can span lines.
            var li_accumulate = "", nl = "";

            // Loop over the lines in this block looking for tight lists.
            tight_search:
            for ( var line_no = 0; line_no < lines.length; line_no++ ) {
              nl = "";
              var l = lines[line_no].replace(/^\n/, function(n) { nl = n; return ""; });

              // TODO: really should cache this
              var line_re = regex_for_depth( stack.length );

              m = l.match( line_re );
              //print( "line:", uneval(l), "\nline match:", uneval(m) );

              // We have a list item
              if ( m[1] !== undefined ) {
                // Process the previous list item, if any
                if ( li_accumulate.length ) {
                  add( last_li, loose, this.processInline( li_accumulate ), nl );
                  // Loose mode will have been dealt with. Reset it
                  loose = false;
                  li_accumulate = "";
                }

                m[1] = expand_tab( m[1] );
                var wanted_depth = Math.floor(m[1].length/4)+1;
                //print( "want:", wanted_depth, "stack:", stack.length);
                if ( wanted_depth > stack.length ) {
                  // Deep enough for a nested list outright
                  //print ( "new nested list" );
                  list = make_list( m );
                  last_li.push( list );
                  last_li = list[1] = [ "listitem" ];
                }
                else {
                  // We aren't deep enough to be strictly a new level. This is
                  // where Md.pl goes nuts. If the indent matches a level in the
                  // stack, put it there, else put it one deeper then the
                  // wanted_depth deserves.
                  var found = false;
                  for ( i = 0; i < stack.length; i++ ) {
                    if ( stack[ i ].indent !== m[1] )
                      continue;

                    list = stack[ i ].list;
                    stack.splice( i+1, stack.length - (i+1) );
                    found = true;
                    break;
                  }

                  if (!found) {
                    //print("not found. l:", uneval(l));
                    wanted_depth++;
                    if ( wanted_depth <= stack.length ) {
                      stack.splice(wanted_depth, stack.length - wanted_depth);
                      //print("Desired depth now", wanted_depth, "stack:", stack.length);
                      list = stack[wanted_depth-1].list;
                      //print("list:", uneval(list) );
                    }
                    else {
                      //print ("made new stack for messy indent");
                      list = make_list(m);
                      last_li.push(list);
                    }
                  }

                  //print( uneval(list), "last", list === stack[stack.length-1].list );
                  last_li = [ "listitem" ];
                  list.push(last_li);
                } // end depth of shenegains
                nl = "";
              }

              // Add content
              if ( l.length > m[0].length )
                li_accumulate += nl + l.substr( m[0].length );
            } // tight_search

            if ( li_accumulate.length ) {

              var contents = this.processBlock(li_accumulate, []),
                  firstBlock = contents[0];

              if (firstBlock) {
                firstBlock.shift();
                contents.splice.apply(contents, [0, 1].concat(firstBlock));
                add( last_li, loose, contents, nl );

                // Let's not creating a trailing \n after content in the li
                if(last_li[last_li.length-1] === "\n") {
                  last_li.pop();
                }

                // Loose mode will have been dealt with. Reset it
                loose = false;
                li_accumulate = "";
              }
            }

            // Look at the next block - we might have a loose list. Or an extra
            // paragraph for the current li
            var contained = get_contained_blocks( stack.length, next );

            // Deal with code blocks or properly nested lists
            if ( contained.length > 0 ) {
              // Make sure all listitems up the stack are paragraphs
              forEach( stack, paragraphify, this);

              last_li.push.apply( last_li, this.toTree( contained, [] ) );
            }

            var next_block = next[0] && next[0].valueOf() || "";

            if ( next_block.match(is_list_re) )  {
              block = next.shift();

              // Check for an HR following a list: features/lists/hr_abutting
              var hr = this.dialect.block.horizRule.call( this, block, next );

              if ( hr ) {
                ret.push.apply(ret, hr);
                break;
              }

              // Add paragraphs if the indentation level stays the same
              if (stack[stack.length-1].indent === block.match(/^\s*/)[0]) {
                forEach( stack, paragraphify, this);
              }

              loose = true;
              continue loose_search;
            }
            break;
          } // loose_search

          return ret;
        };
      })(),

      blockquote: function blockquote( block, next ) {

        // Handle quotes that have spaces before them
        var m = /(^|\n) +(\>[\s\S]*)/.exec(block);
        if (m && m[2] && m[2].length) {
          var blockContents = block.replace(/(^|\n) +\>/, "$1>");
          next.unshift(blockContents);
          return [];
        }

        if ( !block.match( /^>/m ) )
          return undefined;

        var jsonml = [];

        // separate out the leading abutting block, if any. I.e. in this case:
        //
        //  a
        //  > b
        //
        if ( block[ 0 ] !== ">" ) {
          var lines = block.split( /\n/ ),
              prev = [],
              line_no = block.lineNumber;

          // keep shifting lines until you find a crotchet
          while ( lines.length && lines[ 0 ][ 0 ] !== ">" ) {
            prev.push( lines.shift() );
            line_no++;
          }

          var abutting = mk_block( prev.join( "\n" ), "\n", block.lineNumber );
          jsonml.push.apply( jsonml, this.processBlock( abutting, [] ) );
          // reassemble new block of just block quotes!
          block = mk_block( lines.join( "\n" ), block.trailing, line_no );
        }

        // if the next block is also a blockquote merge it in
        while ( next.length && next[ 0 ][ 0 ] === ">" ) {
          var b = next.shift();
          block = mk_block( block + block.trailing + b, b.trailing, block.lineNumber );
        }

        // Strip off the leading "> " and re-process as a block.
        var input = block.replace( /^> ?/gm, "" ),
            old_tree = this.tree,
            processedBlock = this.toTree( input, [ "blockquote" ] ),
            attr = extract_attr( processedBlock );

        // If any link references were found get rid of them
        if ( attr && attr.references ) {
          delete attr.references;
          // And then remove the attribute object if it's empty
          if ( isEmpty( attr ) )
            processedBlock.splice( 1, 1 );
        }

        jsonml.push( processedBlock );
        return jsonml;
      },

      referenceDefn: function referenceDefn( block, next) {
        var re = /^\s*\[([^\[\]]+)\]:\s*(\S+)(?:\s+(?:(['"])(.*)\3|\((.*?)\)))?\n?/;
        // interesting matches are [ , ref_id, url, , title, title ]

        if ( !block.match(re) )
          return undefined;

        var attrs = create_attrs.call( this );

        var b = this.loop_re_over_block(re, block, function( m ) {
          create_reference(attrs, m);
        } );

        if ( b.length )
          next.unshift( mk_block( b, block.trailing ) );

        return [];
      },

      para: function para( block ) {
        // everything's a para!
        return [ ["para"].concat( this.processInline( block ) ) ];
      }
    },

    inline: {

      __oneElement__: function oneElement( text, patterns_or_re, previous_nodes ) {

        // PERF NOTE: rewritten to avoid greedy match regex \([\s\S]*?)(...)\
        // greedy match performs horribly with large inline blocks, it can be so
        // slow it will crash chrome
        patterns_or_re = patterns_or_re || this.dialect.inline.__patterns__;

        var search_re = new RegExp(patterns_or_re.source || patterns_or_re);
        var pos = text.search(search_re);

        if (pos === -1) {
          return [ text.length, text ];
        } else if (pos !== 0) {
          // Some un-interesting text matched. Return that first
          return [pos, text.substring(0,pos)];
        }

        var match_re = new RegExp( "^(" + (patterns_or_re.source || patterns_or_re) + ")" );
        var m = match_re.exec( text );
        var res;
        if ( m[1] in this.dialect.inline ) {
          res = this.dialect.inline[ m[1] ].call(
                    this,
                    text.substr( m.index ), m, previous_nodes || [] );

          // If no inline code executed, fallback
          if (!res) {
            var fn = this.dialect.inline[m[1][0]];
            if (fn) {
              res = fn.call(
                    this,
                    text.substr( m.index ), m, previous_nodes || [] );
            }
          }
        }
        // Default for now to make dev easier. just slurp special and output it.
        res = res || [ m[1].length, m[1] ];
        return res;
      },

      __call__: function inline( text, patterns ) {

        var out = [],
            res;

        function add(x) {
          //D:self.debug("  adding output", uneval(x));
          if ( typeof x === "string" && typeof out[out.length-1] === "string" )
            out[ out.length-1 ] += x;
          else
            out.push(x);
        }

        while ( text.length > 0 ) {
          res = this.dialect.inline.__oneElement__.call(this, text, patterns, out );
          text = text.substr( res.shift() );
          forEach(res, add );
        }

        return out;
      },

      // These characters are interesting elsewhere, so have rules for them so that
      // chunks of plain text blocks don't include them
      "]": function () {},
      "}": function () {},

      __escape__ : /^\\[\\`\*_{}<>\[\]()#\+.!\-]/,

      "\\": function escaped( text ) {
        // [ length of input processed, node/children to add... ]
        // Only esacape: \ ` * _ { } [ ] ( ) # * + - . !
        if ( this.dialect.inline.__escape__.exec( text ) )
          return [ 2, text.charAt( 1 ) ];
        else
          // Not an esacpe
          return [ 1, "\\" ];
      },

      "![": function image( text ) {

        // Without this guard V8 crashes hard on the RegExp
        if (text.indexOf('(') >= 0 && text.indexOf(')') === -1) { return; }

        // Unlike images, alt text is plain text only. no other elements are
        // allowed in there

        // ![Alt text](/path/to/img.jpg "Optional title")
        //      1          2            3       4         <--- captures
        //
        // First attempt to use a strong URL regexp to catch things like parentheses. If it misses, use the
        // old one.
        var origMatcher = /^!\[(.*?)\][ \t]*\([ \t]*([^")]*?)(?:[ \t]+(["'])(.*?)\3)?[ \t]*\)/;
            m = text.match(new RegExp("^!\\[(.*?)][ \\t]*\\((" + urlRegexp + ")\\)([ \\t])*([\"'].*[\"'])?")) ||
                text.match(origMatcher);

        if (m && m[2].indexOf(")]") !== -1) { m = text.match(origMatcher); }

        if ( m ) {
          if ( m[2] && m[2][0] === "<" && m[2][m[2].length-1] === ">" )
            m[2] = m[2].substring( 1, m[2].length - 1 );

          m[2] = this.dialect.inline.__call__.call( this, m[2], /\\/ )[0];

          var attrs = { alt: m[1], href: m[2] || "" };
          if ( m[4] !== undefined)
            attrs.title = m[4];

          return [ m[0].length, [ "img", attrs ] ];
        }

        // ![Alt text][id]
        m = text.match( /^!\[(.*?)\][ \t]*\[(.*?)\]/ );

        if ( m ) {
          // We can't check if the reference is known here as it likely wont be
          // found till after. Check it in md tree->hmtl tree conversion
          return [ m[0].length, [ "img_ref", { alt: m[1], ref: m[2].toLowerCase(), original: m[0] } ] ];
        }

        // Just consume the '!['
        return [ 2, "![" ];
      },

      "[": function link( text ) {

        var open = 1;
        for (var i=0; i<text.length; i++) {
          var c = text.charAt(i);
          if (c === '[') { open++; }
          if (c === ']') { open--; }

          if (open > 3) { return [1, "["]; }
        }

        var orig = String(text);
        // Inline content is possible inside `link text`
        var res = inline_until_char.call( this, text.substr(1), "]" );

        // No closing ']' found. Just consume the [
        if ( !res[1] ) {
          return [ res[0] + 1, text.charAt(0) ].concat(res[2]);
        }

        if ( res[0] == 1 ) { return [ 2, "[]" ]; } // empty link found.

        var consumed = 1 + res[ 0 ],
            children = res[ 1 ],
            link,
            attrs;

        // At this point the first [...] has been parsed. See what follows to find
        // out which kind of link we are (reference or direct url)
        text = text.substr( consumed );

        // [link text](/path/to/img.jpg "Optional title")
        //                 1            2       3         <--- captures
        // This will capture up to the last paren in the block. We then pull
        // back based on if there a matching ones in the url
        //    ([here](/url/(test))
        // The parens have to be balanced
        var m = text.match( /^\s*\([ \t]*([^"'\s]*)(?:[ \t]+(["'])(.*?)\2)?[ \t]*\)/ );
        if ( m ) {
          var url = m[1].replace(/\s+$/, '');
          consumed += m[0].length;

          if ( url && url[0] === "<" && url[url.length-1] === ">" )
            url = url.substring( 1, url.length - 1 );

          // If there is a title we don't have to worry about parens in the url
          if ( !m[3] ) {
            var open_parens = 1; // One open that isn't in the capture
            for ( var len = 0; len < url.length; len++ ) {
              switch ( url[len] ) {
              case "(":
                open_parens++;
                break;
              case ")":
                if ( --open_parens === 0) {
                  consumed -= url.length - len;
                  url = url.substring(0, len);
                }
                break;
              }
            }
          }

          // Process escapes only
          url = this.dialect.inline.__call__.call( this, url, /\\/ )[0];

          attrs = { href: url || "" };
          if ( m[3] !== undefined)
            attrs.title = m[3];

          link = [ "link", attrs ].concat( children );
          return [ consumed, link ];
        }

        if (text.indexOf('(') === 0 && text.indexOf(')') !== -1) {
          m = text.match(new RegExp("^\\((" + urlRegexp + ")\\)"));
          if (m && m[1]) {
            consumed += m[0].length;
            link = ["link", {href: m[1]}].concat(children);
            return [consumed, link];
          }
        }

        // [Alt text][id]
        // [Alt text] [id]
        m = text.match( /^\s*\[(.*?)\]/ );
        if ( m ) {

          consumed += m[ 0 ].length;

          // [links][] uses links as its reference
          attrs = { ref: ( m[ 1 ] || String(children) ).toLowerCase(),  original: orig.substr( 0, consumed ) };

          if (children && children.length > 0) {
            link = [ "link_ref", attrs ].concat( children );

            // We can't check if the reference is known here as it likely wont be
            // found till after. Check it in md tree->hmtl tree conversion.
            // Store the original so that conversion can revert if the ref isn't found.
            return [ consumed, link ];
          }
        }

        // Another check for references
        m = orig.match(/^\s*\[(.*?)\]:\s*(\S+)(?:\s+(?:(['"])(.*?)\3|\((.*?)\)))?\n?/);
        if (m &&
            (/^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/i.test(m[2]) ||
             /(\/[\w~,;\-\./?%&+#=]*)/.test(m[2]))) {
          attrs = create_attrs.call(this);
          create_reference(attrs, m);

          return [ m[0].length ];
        }

        // [id]
        // Only if id is plain (no formatting.)
        if ( children.length === 1 && typeof children[0] === "string" ) {

          var normalized = children[0].toLowerCase().replace(/\s+/, ' ');
          attrs = { ref: normalized,  original: orig.substr( 0, consumed ) };
          link = [ "link_ref", attrs, children[0] ];
          return [ consumed, link ];
        }

        // Just consume the "["
        return [ 1, "[" ];
      },

      "<": function autoLink( text ) {
        var m;

        if ( ( m = text.match( /^<(?:((https?|ftp|mailto):[^>]+)|(.*?@.*?\.[a-zA-Z]+))>/ ) ) !== null ) {
          if ( m[3] )
            return [ m[0].length, [ "link", { href: "mailto:" + m[3] }, m[3] ] ];
          else if ( m[2] === "mailto" )
            return [ m[0].length, [ "link", { href: m[1] }, m[1].substr("mailto:".length ) ] ];
          else
            return [ m[0].length, [ "link", { href: m[1] }, m[1] ] ];
        }

        return [ 1, "<" ];
      },

      "`": function inlineCode( text, match, prev ) {

        // If we're in a tag, don't do it.
        if (prev && (typeof prev[0] === "string") && prev[0].match(/<[^>]+$/)) { return; }

        // Inline code block. as many backticks as you like to start it
        // Always skip over the opening ticks.
        var m = text.match( /(`+)(([\s\S]*?)\1)/ );

        if ( m && m[2] )
          return [ m[1].length + m[2].length, [ "inlinecode", m[3] ] ];
        else {
          // TODO: No matching end code found - warn!
          return [ 1, "`" ];
        }
      },

      "  \n": function lineBreak() {
        return [ 3, [ "linebreak" ] ];
      }

    }
  };

  // A helper function to create attributes
  function create_attrs() {
    if ( !extract_attr( this.tree ) ) {
      this.tree.splice( 1, 0, {} );
    }

    var attrs = extract_attr( this.tree );

    // make a references hash if it doesn't exist
    if ( attrs.references === undefined ) {
      attrs.references = {};
    }

    return attrs;
  }

  // Create references for attributes
  function create_reference(attrs, m) {
    if ( m[2] && m[2][0] === "<" && m[2][m[2].length-1] === ">" )
      m[2] = m[2].substring( 1, m[2].length - 1 );

    var ref = attrs.references[ m[1].toLowerCase() ] = {
      href: m[2]
    };

    if ( m[4] !== undefined )
      ref.title = m[4];
    else if ( m[5] !== undefined )
      ref.title = m[5];
  }

  Markdown.dialects.Gruber = Gruber;
  Markdown.buildBlockOrder ( Markdown.dialects.Gruber.block );
  Markdown.buildInlinePatterns( Markdown.dialects.Gruber.inline );

// Include all our dependencies and return the resulting library.

  expose.Markdown = Markdown;
  expose.parse = Markdown.parse;
  expose.toHTML = Markdown.toHTML;
  expose.toHTMLTree = Markdown.toHTMLTree;
  expose.renderJsonML = Markdown.renderJsonML;
  expose.DialectHelpers = DialectHelpers;

})(function() {
  window.BetterMarkdown = {};
  return window.BetterMarkdown;
}());
define("pretty-text/xss", 
  ["exports"],
  function(__exports__) {
    "use strict";

    // Shim for xss.js library
    __exports__["default"] = window.filterXSS;
  });
define("pretty-text/white-lister", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

    __exports__.whiteListFeature = whiteListFeature;

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

    var masterList = {};
    var masterCallbacks = {};

    var _whiteLists = {};
    var _callbacks = {};

    function concatUniq(src, elems) {
      src = src || [];
      if (!Array.isArray(elems)) {
        elems = [elems];
      }
      return src.concat(elems.filter(function (e) {
        return src.indexOf(e) === -1;
      }));
    }

    var WhiteLister = (function () {
      function WhiteLister(features) {
        _classCallCheck(this, WhiteLister);

        features.default = true;

        this._featureKeys = Object.keys(features).filter(function (f) {
          return features[f];
        });
        this._key = this._featureKeys.join(':');
        this._features = features;
      }

      // Builds our object that represents whether something is sanitized for a particular feature.

      _createClass(WhiteLister, [{
        key: 'getCustom',
        value: function getCustom() {
          var _this = this;

          if (!_callbacks[this._key]) {
            (function () {
              var callbacks = [];
              _this._featureKeys.forEach(function (f) {
                (masterCallbacks[f] || []).forEach(function (cb) {
                  return callbacks.push(cb);
                });
              });
              _callbacks[_this._key] = callbacks;
            })();
          }

          return _callbacks[this._key];
        }
      }, {
        key: 'getWhiteList',
        value: function getWhiteList() {
          var _this2 = this;

          if (!_whiteLists[this._key]) {
            (function () {
              var tagList = {};
              var attrList = {};

              // merge whitelists for these features
              _this2._featureKeys.forEach(function (f) {
                var info = masterList[f] || {};
                Object.keys(info).forEach(function (t) {
                  tagList[t] = [];
                  attrList[t] = attrList[t] || {};

                  var attrs = info[t];
                  Object.keys(attrs).forEach(function (a) {
                    return attrList[t][a] = concatUniq(attrList[t][a], attrs[a]);
                  });
                });
              });

              _whiteLists[_this2._key] = { tagList: tagList, attrList: attrList };
            })();
          }
          return _whiteLists[this._key];
        }
      }]);

      return WhiteLister;
    })();

    __exports__["default"] = WhiteLister;
    function whiteListFeature(feature, info) {
      var featureInfo = {};

      // we can supply a callback instead
      if (info.custom) {
        masterCallbacks[feature] = masterCallbacks[feature] || [];
        masterCallbacks[feature].push(info.custom);
        return;
      }

      if (typeof info === "string") {
        info = [info];
      }

      (info || []).forEach(function (tag) {
        var classes = tag.split('.');
        var tagName = classes.shift();
        var m = /\[([^\]]+)]/.exec(tagName);
        if (m) {
          var _m = _slicedToArray(m, 2);

          var full = _m[0];
          var inside = _m[1];

          var stripped = tagName.replace(full, '');
          var vals = inside.split('=');

          featureInfo[stripped] = featureInfo[stripped] || {};
          if (vals.length === 2) {
            var _vals = _slicedToArray(vals, 2);

            var _name = _vals[0];
            var value = _vals[1];

            featureInfo[stripped][_name] = value;
          } else {
            featureInfo[stripped][inside] = '*';
          }
        }

        featureInfo[tagName] = featureInfo[tagName] || {};
        if (classes.length) {
          featureInfo[tagName]['class'] = concatUniq(featureInfo[tagName]['class'], classes);
        }
      });

      masterList[feature] = featureInfo;
    }

    // Only add to `default` when you always want your whitelist to occur. In other words,
    // don't change this for a plugin or a feature that can be disabled
    whiteListFeature('default', ['a.attachment', 'a.hashtag', 'a.mention', 'a.mention-group', 'a.onebox', 'a[data-bbcode]', 'a[name]', 'a[name]', 'a[rel=nofollow]', 'a[target=_blank]', 'a[title]', 'abbr[title]', 'aside.quote', 'aside[data-*]', 'b', 'big', 'blockquote', 'br', 'code', 'dd', 'del', 'div', 'div.quote-controls', 'div.title', 'div[align]', 'div[dir]', 'dl', 'dt', 'em', 'h1[id]', 'h2[id]', 'h3[id]', 'h4[id]', 'h5[id]', 'h6[id]', 'hr', 'i', 'iframe', 'iframe[frameborder]', 'iframe[height]', 'iframe[marginheight]', 'iframe[marginwidth]', 'iframe[width]', 'img[alt]', 'img[class]', 'img[height]', 'img[title]', 'img[width]', 'ins', 'kbd', 'li', 'ol', 'p', 'pre', 's', 'small', 'span.excerpt', 'span.hashtag', 'span.mention', 'strike', 'strong', 'sub', 'sup', 'ul']);
  });
define("pretty-text/sanitizer", 
  ["pretty-text/xss","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    __exports__.escape = escape;
    __exports__.hrefAllowed = hrefAllowed;
    __exports__.sanitize = sanitize;
    __exports__.whiteListIframe = whiteListIframe;
    var xss = __dependency1__["default"];

    var _validIframes = [];

    function attr(name, value) {
      if (value) {
        return name + "=\"" + xss.escapeAttrValue(value) + "\"";
      }

      return name;
    }

    var ESCAPE_REPLACEMENTS = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      '`': '&#x60;'
    };
    var BAD_CHARS = /[&<>"'`]/g;
    var POSSIBLE_CHARS = /[&<>"'`]/;

    function escapeChar(chr) {
      return ESCAPE_REPLACEMENTS[chr];
    }

    function escape(string) {
      // don't escape SafeStrings, since they're already safe
      if (string === null) {
        return "";
      } else if (!string) {
        return string + '';
      }

      // Force a string conversion as this will be done by the append regardless and
      // the regex test will do this transparently behind the scenes, causing issues if
      // an object's to string has escaped characters in it.
      string = "" + string;

      if (!POSSIBLE_CHARS.test(string)) {
        return string;
      }
      return string.replace(BAD_CHARS, escapeChar);
    }

    function hrefAllowed(href) {
      // escape single quotes
      href = href.replace(/'/g, "%27");

      // absolute urls
      if (/^(https?:)?\/\/[\w\.\-]+/i.test(href)) {
        return href;
      }
      // relative urls
      if (/^\/[\w\.\-]+/i.test(href)) {
        return href;
      }
      // anchors
      if (/^#[\w\.\-]+/i.test(href)) {
        return href;
      }
      // mailtos
      if (/^mailto:[\w\.\-@]+/i.test(href)) {
        return href;
      }
    }

    function sanitize(text, whiteLister) {
      if (!text) return "";

      // Allow things like <3 and <_<
      text = text.replace(/<([^A-Za-z\/\!]|$)/g, "&lt;$1");

      var whiteList = whiteLister.getWhiteList();

      var result = xss(text, {
        whiteList: whiteList.tagList,
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'table'],

        onIgnoreTagAttr: function (tag, name, value) {
          var forTag = whiteList.attrList[tag];
          if (forTag) {
            var forAttr = forTag[name];
            if (forAttr && (forAttr.indexOf('*') !== -1 || forAttr.indexOf(value) !== -1) || name.indexOf('data-') === 0 && forTag['data-*'] || tag === 'a' && name === 'href' && hrefAllowed(value) || tag === 'img' && name === 'src' && (/^data:image.*$/i.test(value) || hrefAllowed(value)) || tag === 'iframe' && name === 'src' && _validIframes.some(function (i) {
              return i.test(value);
            })) {
              return attr(name, value);
            }

            if (tag === 'iframe' && name === 'src') {
              return "-STRIP-";
            }

            var custom = whiteLister.getCustom();
            for (var i = 0; i < custom.length; i++) {
              var fn = custom[i];
              if (fn(tag, name, value)) {
                return attr(name, value);
              }
            }
          }
        }
      });

      return result.replace(/\[removed\]/g, '').replace(/\<iframe[^>]+\-STRIP\-[^>]*>[^<]*<\/iframe>/g, '').replace(/&(?![#\w]+;)/g, '&amp;').replace(/&#39;/g, "'").replace(/ \/>/g, '>');
    }

    ;

    function whiteListIframe(regexp) {
      _validIframes.push(regexp);
    }

    whiteListIframe(/^(https?:)?\/\/www\.google\.com\/maps\/embed\?.+/i);
    whiteListIframe(/^(https?:)?\/\/www\.openstreetmap\.org\/export\/embed.html\?.+/i);
  });
define("pretty-text/oneboxer", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__.load = load;
    __exports__.lookupCache = lookupCache;
    /**
      A helper for looking up oneboxes and displaying them

      For now it only stores in a local Javascript Object, in future we can change it so it uses localStorage
      or some other mechanism.
    **/

    var localCache = {};
    var failedCache = {};

    // Perform a lookup of a onebox based an anchor element. It will insert a loading
    // indicator and remove it when the loading is complete or fails.

    function load(e, refresh, ajax) {
      var $elem = $(e);

      // If the onebox has loaded, return
      if ($elem.data('onebox-loaded')) return;
      if ($elem.hasClass('loading-onebox')) return;

      var url = e.href;

      // Unless we're forcing a refresh...
      if (!refresh) {
        // If we have it in our cache, return it.
        var cached = localCache[url];
        if (cached) return cached;

        // If the request failed, don't do anything
        var failed = failedCache[url];
        if (failed) return;
      }

      // Add the loading CSS class
      $elem.addClass('loading-onebox');

      // Retrieve the onebox
      return ajax("/onebox", {
        dataType: 'html',
        data: { url: url, refresh: refresh },
        cache: true
      }).then(function (html) {
        localCache[url] = html;
        $elem.replaceWith(html);
      }, function () {
        failedCache[url] = true;
      }).finally(function () {
        $elem.removeClass('loading-onebox');
        $elem.data('onebox-loaded');
      });
    }

    function lookupCache(url) {
      return localCache[url];
    }
  });













