define("preload-store", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      We can insert data into the PreloadStore when the document is loaded.
      The data can be accessed once by a key, after which it is removed

      @class PreloadStore
    **/

    __exports__["default"] = {
      data: {},

      store: function (key, value) {
        this.data[key] = value;
      },

      /**
        To retrieve a key, you provide the key you want, plus a finder to load
        it if the key cannot be found. Once the key is used once, it is removed
        from the store.
        So, for example, you can't load a preloaded topic more than once.
      **/
      getAndRemove: function (key, finder) {
        if (this.data[key]) {
          var promise = Em.RSVP.resolve(this.data[key]);
          delete this.data[key];
          return promise;
        }

        if (finder) {
          return new Ember.RSVP.Promise(function (resolve, reject) {
            var result = finder();

            // If the finder returns a promise, we support that too
            if (result && result.then) {
              result.then(function (toResolve) {
                return resolve(toResolve);
              }).catch(function (toReject) {
                return reject(toReject);
              });
            } else {
              resolve(result);
            }
          });
        }

        return Ember.RSVP.resolve(null);
      },

      get: function (key) {
        return this.data[key];
      },

      remove: function (key) {
        if (this.data[key]) delete this.data[key];
      },

      reset: function () {
        this.data = {};
      }
    };
  });
