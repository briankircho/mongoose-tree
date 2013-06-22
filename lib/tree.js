
var Schema = require('mongoose').Schema;

module.exports = exports = tree;

function tree(schema, options) {
  var pathSeparator = options && options.pathSeparator || '#';

  schema.add({
    parent : {
      type : Schema.ObjectId,
      set : function(val) {
        if(typeof(val) === "object" && val._id) {
          return val._id;
        }
        return val;
      },
      index: true
    },
    path : {
      type : String,
      index: true
    }
  });

  schema.pre('save', function(next) {
    var isParentChange = this.isModified('parent');

    if(this.isNew || isParentChange) {
      if(!this.parent) {
        this.path = this._id.toString();
        return next();
      }

      var self = this;
      this.collection.findOne({ _id : this.parent }, function(err, doc) {
        if(err) return next(err);

        var previousPath = self.path;
        self.path = doc.path + pathSeparator + self._id.toString();

        if(isParentChange) {
          // When the parent is changed we must rewrite all children paths as well
          self.collection.find({ path : { '$regex' : '^' + previousPath + pathSeparator } }, function(err, cursor) {
            if(err) return next(err);

            var stream = cursor.stream();
            stream.on('data', function (doc) {
              var newPath = self.path+doc.path.substr(previousPath.length);
              self.collection.update({ _id : doc._id }, { $set : { path : newPath } }, function(err) {
                if(err) return next(err);
              });
            });
            stream.on('close', function() {
              next();
            });
            stream.on('error', function(err) {
              next(err);
            });
          });
        } else {
          next();
        }
      });
    } else {
      next();
    }
  });

  schema.pre('remove', function(next) {
    if(!this.path) {
      return next();
    }
    this.collection.remove({ path : { '$regex' : '^' + this.path + pathSeparator } }, next);
  });

  schema.method('getChildren', function(recursive, cb) {
    if(typeof(recursive) === "function") {
      cb = recursive;
      recursive = false;
    }
    var filter = recursive ? { path : { $regex : '^' + this.path + pathSeparator } } : { parent : this._id };
    return this.model(this.constructor.modelName).find(filter, cb);
  });

  schema.method('getParent', function(cb) {
    return this.model(this.constructor.modelName).findOne({ _id : this.parent }, cb);
  });

  var getAncestors = function(cb) {
    if(this.path) {
      var ids = this.path.split(pathSeparator);
      ids.pop();
    } else {
      var ids = [];
    }
    var filter = { _id : { $in : ids } };
    return this.model(this.constructor.modelName).find(filter, cb);
  };

  schema.method('getAnsestors', getAncestors);
  schema.method('getAncestors', getAncestors);

  schema.virtual('level').get(function() {
    return this.path ? this.path.split(pathSeparator).length : 0;
  });
}
