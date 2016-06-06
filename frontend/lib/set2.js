module.exports = Set2;

// Create a new Set2. The constructor takes optional data of the form [[a1,b1],
// [a2,b2], ...].
function Set2(data) {
  this.map = new Map;
  this.size = 0;
  if (data) {
    for (var i = 0; i < data.length; i++) {
      this.add(data[i][0], data[i][1]);
    }
  }
}

// Subset of the set. Returns a set with all entries with first value a.
Set2.prototype.subset = function(v1) {
  return this.map.get(v1);
};

// Does the set have (v1,v2)? Returns a bool.
Set2.prototype.has = function(v1, v2) {
  var inner = this.map.get(v1);
  return inner ? inner.has(v2) : false;
};

// Add (v1,v2) to the set. Chainable.
Set2.prototype.add = function(v1, v2) {
  var inner = this.map.get(v1);
  if (!inner) {
    inner = new Set;
    this.map.set(v1, inner);
  }
  this.size -= inner.size;
  inner.add(v2);
  this.size += inner.size;
  return this;
};

// Delete (v1,v2). Returns true if an item was removed.
Set2.prototype.delete = function(v1, v2) {
  var inner = this.map.get(v1);
  if (!inner) return false;

  var deleted = inner.delete(v2);
  if (!deleted) return false;

  this.size--;
  if (inner.size === 0) {
    this.map.delete(v1);
  }
  return true;
};

// Delete all entries with first value v1. Returns true if anything was
// removed. Otherwise returns false.
Set2.prototype.deleteAll = function(v1) {
  var set;
  if ((set = this.map.get(v1))) {
    this.size -= set.size;
    this.map.delete(v1);
    return true;
  }
  return false;
};

// Removes everything from the set.
Set2.prototype.clear = function() {
  this.map.clear();
  this.size = 0;
};


// ** Iteration

// Iterate through all items. fn(v1, v2).
Set2.prototype.forEach = function(fn) {
  this.map.forEach(function(inner, v1) {
    inner.forEach(function(v2) {
      fn(v1, v2);
    });
  });
};

// Iterator to support for..of loops. Its kind of weird that we register the
// same method under 3 different names, but both Map and Set have a .entries()
// method which lets you iterate over pairs of [k,v] or [v,v] in the case of
// set. 
//
// So I'll make the API more or less compatible - but in reality, you probably
// want .values() or to use for..of (which uses [Symbol.iterator]).
Set2.prototype[Symbol.iterator] = Set2.prototype.values = Set2.prototype.entries = function() {
  var outer = this.map.entries(); // Iterator over outer map

  var v1;
  var inner = null; // Iterator over inner set

  var iterator = {
    next: function() {
      var innerV;
      while (inner == null || (innerV = inner.next()).done) {
        // Go to the next outer map.
        var outerV = outer.next();
        // We need to return {done:true} - but this has the object we want.
        if (outerV.done) return outerV;

        v1 = outerV.value[0];
        inner = outerV.value[1].values();
      }

      // Ok, innerV should now contain [k2, v].
      var v2 = innerV.value;

      return {value:[v1, v2], done: false};

    }
  };

  iterator[Symbol.iterator] = function() { return iterator; };
  return iterator;
};


Set2.prototype.inspect = function(depth, options) {
  // This is a dirty hack to confuse browserify so it won't pull in node's util
  // library just to give us inspect.
  var inspect = require('' + 'util').inspect;

  if (depth < 0) {
    return '[Set2]';
  }
  var entries = [];
  this.forEach(function(v1, v2) {
    entries.push("(" + inspect(v1, options) + "," + inspect(v2, options) + ")");
  });
  assert.equal(entries.length, this.size);
  return "{[Set2] " + (entries.join(', ')) + " }";
};

