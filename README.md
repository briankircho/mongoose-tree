## mongoose-tree

Implements the materialized path strategy for storing a hierarchy of documents with mongoose

# Usage

Install via NPM

    $ npm install mongoose-tree

Then you can use the plugin on your schemas

```javascript
var tree = require('mongoose-tree');

var UserSchema = new Schema({
  name : String
});
UserSchema.plugin(tree);
var User = mongoose.model('User', UserSchema);

var adam = new User({ name : 'Adam' });
var bob = new User({ name : 'Bob' });
var carol = new User({ name : 'Carol' });

// Set the parent relationships
bob.parent = adam;
carol.parent = bob;

adam.save(function() {
  bob.save(function() {
    carol.save();
  });
});
```

At this point in mongoDB you will have documents similar to

    {
      "_id" : ObjectId("50136e40c78c4b9403000001"),
      "name" : "Adam",
      "path" : "50136e40c78c4b9403000001"
    }
    {
      "_id" : ObjectId("50136e40c78c4b9403000002"),
      "name" : "Bob",
      "parent" : ObjectId("50136e40c78c4b9403000001"),
      "path" : "50136e40c78c4b9403000001#50136e40c78c4b9403000002"
    }
    {
      "_id" : ObjectId("50136e40c78c4b9403000003"),
      "name" : "Carol",
      "parent" : ObjectId("50136e40c78c4b9403000002"),
      "path" : "50136e40c78c4b9403000001#50136e40c78c4b9403000002#50136e40c78c4b9403000003"
    }

The path is used for recursive methods and is kept up to date by the plugin if the parent is changed

## Options

```javascript
Model.plugin(tree, {
  pathSeparator : '#' // Default path separator
})
```

# API

### getChildren

Signature:

    getChildren([recursive], cb);

if recursive is supplied and true subchildren are returned

Based on the above hierarchy:

```javascript
adam.getChildren(function(err, users) {
  // users is an array of with the bob document
});

adam.getChildren(true, function(err, users) {
  // users is an array with both bob and carol documents
});
```

### getAncestors

Signature:

    getAncestors(cb);

Based on the above hierarchy:

```javascript
carol.getAncestors(function(err, users) {
  // users is an array of adam and bob
})
```

### level

Equal to the level of the hierarchy

```javascript
carol.level; // equals 3
```

# Tests

To run the tests install mocha

    npm install mocha -g

and then run

    mocha


