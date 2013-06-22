var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = exports = tree;

function tree(schema, options) {
  schema.add({
    parent : {
      type : String,
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
      this.collection.findOne({ _id : mongoose.Types.ObjectId(this.parent) }, function(err, doc) {
        if(err) return next(err);

        var previousPath = self.path;
        self.path = doc.path + '#' + self._id.toString();

        if(isParentChange) {
          // When the parent is changed we must rewrite all children paths as well
          self.collection.find({ path : { '$regex' : '^' + previousPath + '#' } }, function(err, cursor) {
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
    this.collection.remove({ path : { '$regex' : '^' + this.path + '#' } }, next);
  });

  /* getChildren */

  schema.method('getChildren', function(recursive, cb) {
    if(typeof(recursive) === "function") {
      cb = recursive;
      recursive = false;
    }
    var filter = recursive ? { path : { $regex : '^' + this.path + '#' } } : { parent : this._id };
    return this.model(this.constructor.modelName).find(filter, cb);
  });

  schema.method('getParent', function(cb) {
    return this.model(this.constructor.modelName).findOne({ _id : this.parent }, cb);
  });

  /* getAncestors */

  var getAncestors = function(cb) {
    if(this.path) {
      var ids = this.path.split('#');
      ids.pop();
    } else {
      var ids = [];
    }
    var filter = { _id : { $in : ids } };
    return this.model(this.constructor.modelName).find(filter, cb);
  };

  schema.method('getAnsestors', getAncestors);
  schema.method('getAncestors', getAncestors);


  /* getChildrenTree */


  schema.method('getChildrenTree',function(args,cb) {
    var self = this;

    if(typeof(args) === "function") {
      var rargs = JSON.parse(JSON.stringify(args));
      cb = args;
    } else {
      var rargs = args;
    }
    var filters = rargs.filters || {};
    var columns = rargs.columns || null;
    var options = rargs.options || {};
    var minLevel = rargs.minLevel || 1;
    var recursive = rargs.recursive != undefined ? rargs.recursive : true;
    var emptyChilds = rargs.emptyChilds != undefined ? rargs.emptyChilds : true;

    if (!cb) throw new Error('no callback defined when calling getChildrenTree');

    // filters: Add recursive path filter or not
    if (recursive) {
      filters.path = { $regex : '^' + this.path + '#' };
      if (filters.parent === null) delete filters.parent;
    } else {
      filters.parent = this._id;
    }

    // columns: Add path and parent in the result if not already specified
    if (columns) {
      if (!columns.match(/path/)) columns+=' path';
      if (!columns.match(/parent/)) columns+=' parent';
    }

    // options:sort , path sort is mandatory
    if (!options.sort) options.sort = {};
    options.sort.path = 1;


    return this.model(this.constructor.modelName).find(filters, columns, options, function(err,results) {
      if (err) throw err;

      var copyOf = function(obj) {
        var o = JSON.parse(JSON.stringify(obj));
        if (emptyChilds) o.childs = [];
        return o;
      }

      var getLevel = function(path) {
        return path ? path.split('#').length : 0;
      }

      var createChilds = function(arr,node,level) {
        var rootLevel = getLevel(self.path) + 1;
        if (minLevel < rootLevel) {
          minLevel = rootLevel
        }
        if (level == minLevel) {
          return arr.push(copyOf(node));
        }
        var nextIndex = arr.length-1
        var myNode = arr[nextIndex];
        if (!myNode) {
            console.log("Tree node " + node.name + " filtered out. Level: " + level + " minLevel: " + minLevel);
            return []
        } else {
           createChilds(myNode.childs,node,level-1);
        }
      }
      var finalResults = [];
      for (var r in results) {
        var level = getLevel(results[r].path);
        createChilds(finalResults,results[r],level);
      }

      cb(err,finalResults);

    });
  });


  /* level */
  schema.virtual('level').get(function() {
    return this.path ? this.path.split('#').length : 0;
  });
}
