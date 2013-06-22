var assert = require('assert'),
    mongoose = require('mongoose'),
    tree = require('../lib/tree'),
    async = require('async'),
    should = require('should'),
    _ = require('underscore');

var Schema = mongoose.Schema;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mongoose-tree');

describe('tree tests', function() {
  // Schema for tests
  var UserSchema = new Schema({
    name : String
  });
  UserSchema.plugin(tree);
  var User = mongoose.model('User', UserSchema);

  // Set up the fixture
  beforeEach(function(done) {
    User.remove({}, function(err) {
      should.not.exist(err);

      var adam = new User({ 'name' : 'Adam' });
      var bob = new User({ 'name' : 'Bob', 'parent' : adam });
      var carol = new User({ 'name' : 'Carol', 'parent' : adam });
      var dann = new User({ 'name' : 'Dann', 'parent' : carol });
      var emily = new User({ 'name' : 'Emily', 'parent' : dann });

      async.forEachSeries([adam, bob, carol, dann, emily], function(doc, cb) {
        doc.save(cb);
      }, done);
    });
  });

  describe('adding documents', function() {
    it('should set parent id and path', function(done) {
      User.find({}, function(err, users) {
        should.not.exist(err);

        var names = {};
        users.forEach(function(user) {
          names[user.name] = user;
        });

        should.not.exist(names['Adam'].parent);
        names['Bob'].parent.toString().should.equal(names['Adam']._id.toString());
        names['Carol'].parent.toString().should.equal(names['Adam']._id.toString());
        names['Dann'].parent.toString().should.equal(names['Carol']._id.toString());
        names['Emily'].parent.toString().should.equal(names['Dann']._id.toString());

        var expectedPath = [names['Adam']._id, names['Carol']._id, names['Dann']._id].join('#');
        names['Dann'].path.should.equal(expectedPath);

        done();
      });
    });
  });

  describe('removing document', function() {
    it('should remove leaf nodes', function(done) {
      User.findOne({ name : 'Emily' }, function(err, emily) {
        emily.remove(function(err) {
          should.not.exist(err);

          User.find(['name'], function(err, users) {
            should.not.exist(err);
            users.length.should.equal(4);
            _.pluck(users, 'name').should.not.include('Emily');
            done();
          });
        });
      });
    });
    it('should remove all children', function(done) {
      User.findOne({ name : 'Carol' }, function(err, user) {
        should.not.exist(err);

        user.remove(function(err) {
          should.not.exist(err);

          User.find(['name'], function(err, users) {
            should.not.exist(err);

            users.length.should.equal(2);
            _.pluck(users, 'name').should.include('Adam').and.include('Bob');
            done();
          });
        });
      });
    });
  });

  function checkPaths(done) {
    User.find({}, function(err, users) {
      should.not.exist(err);

      var ids = {};
      users.forEach(function(user) {
        ids[user._id] = user;
      });

      users.forEach(function(user) {
        if(!user.parent) {
          return;
        }
        should.exist(ids[user.parent]);
        user.path.should.equal(ids[user.parent].path+"#"+user._id);
      });

      done();
    });
  }

  describe('moving documents', function() {
    it('should change children paths', function(done) {
      User.find({}, function(err, users) {
        should.not.exist(err);

        var names = {};
        users.forEach(function(user) {
          names[user.name] = user;
        });

        var carol = names['Carol'];
        var bob = names['Bob'];

        carol.parent = bob;
        carol.save(function(err) {
          should.not.exist(err);

          checkPaths(done);
        });
      });
    });
  });

  describe('get children', function() {
    it('should return immediate children', function(done) {
      User.findOne({ 'name' : 'Adam' }, function(err, adam) {
        should.not.exist(err);

        adam.getChildren(function(err, users) {
          should.not.exist(err);

          users.length.should.equal(2);
          _.pluck(users, 'name').should.include('Bob').and.include('Carol');
          done();
        });
      });
    });
    it('should return recursive children', function(done) {
      User.findOne({ 'name' : 'Carol' }, function(err, carol) {
        should.not.exist(err);

        carol.getChildren(true, function(err, users) {
          should.not.exist(err);

          users.length.should.equal(2);
          _.pluck(users, 'name').should.include('Dann').and.include('Emily');
          done();
        });
      });
    });
  });

  describe('level virtual', function() {
    it('should equal the number of ancestors', function(done) {
      User.findOne({ 'name' : 'Dann' }, function(err, dann) {
        should.not.exist(err);

        dann.level.should.equal(3);
        done();
      });
    });
  });

  describe('get ancestors', function() {
    it('should return ancestors', function(done) {
      User.findOne({ 'name' : 'Dann' }, function(err, dann) {
        dann.getAncestors(function(err, ancestors) {
          should.not.exist(err);

          ancestors.length.should.equal(2);
          _.pluck(ancestors, 'name').should.include('Carol').and.include('Adam');
          done();
        });
      });
    });
  });

});
