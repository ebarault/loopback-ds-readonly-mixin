var loopback = require('loopback');
var lt = require('loopback-testing');
var chai = require('chai');
var expect = chai.expect;

// Create a new loopback app.
var app = require('./fixtures/simple-app/server/server.js');

describe('loopback datasource readonly property (mixin sources.js)', function() {

  lt.beforeEach.withApp(app);

  describe('when called internally', function() {
    lt.beforeEach.givenModel('Product', {name: 'some book', type: 'book', status: 'pending'}, 'product');

    it('should save readonly properties on create.', function(done) {
      expect(this.product.name).to.equal('some book');
      expect(this.product.type).to.equal('book');
      expect(this.product.status).to.equal('pending');
      done();
    });

    it('should change readonly properties on update.', function(done) {
      var self = this;
      self.product.name = 'some other book';
      self.product.status = 'disabled';
      self.product.save(function(err, p) {
        expect(err).to.not.exist;
        expect(p.name).to.equal(self.product.name);
        expect(p.type).to.equal(self.product.type);
        expect(p.status).to.equal(self.product.status);
        done();
      });
    });
  });

  describe('when called remotely', function() {
    lt.beforeEach.givenModel('Product', {name: 'some book', type: 'book', status: 'pending'}, 'product');
    it('should not save readonly properties on create.', function(done) {
      var product = this.product;
      this.post('/api/products')
        .send({
          name: 'test product',
          status: 'active'
        })
        .expect(200)
        .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body.name).to.equal('test product');
          expect(res.body.status).to.not.exist;
          done();
        });
    });

    it('should not save readonly properties on create with an array payload.', function(done) {
      this.post('/api/products')
        .send([
          {name: 'test product 1', status: 'active'},
          {name: 'test product 2', status: 'disabled'}
        ])
        .expect(200)
        .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body).to.be.an('array');
          expect(res.body).to.have.length(2);
          res.body.forEach(function(product) {
            expect(product.name).to.match(/^test product/);
            expect(product.status).to.not.exist;
          });
          app.models.Product.findById(res.body[0].id, function(err, p1) {
            expect(err).to.not.exist;
            expect(p1.name).to.equal('test product 1');
            expect(p1.status).to.not.exist;
            app.models.Product.findById(res.body[1].id, function(err, p2) {
              expect(err).to.not.exist;
              expect(p2.name).to.equal('test product 2');
              expect(p2.status).to.not.exist;
              done();
            });
          });
        });
    });

    it('should not fail the request when an array payload contains non-object entries.', function(done) {
      this.post('/api/products')
        .send([
          {name: 'test product 3', status: 'active'},
          null
        ])
        .end(function(err, res) {
          expect(err).to.not.exist;
          // The mixin only strips readonly keys from object entries; it does
          // not judge payload shape. A malformed entry must not blow up the
          // hook with a TypeError (previously a 500), LoopBack decides what
          // to do with it.
          expect(res.status).to.equal(200);
          expect(res.body).to.have.length(2);
          expect(res.body[0].name).to.equal('test product 3');
          expect(res.body[0].status).to.not.exist;
          // LoopBack currently creates an empty instance for the null entry;
          // whether that input is acceptable is the framework's call.
          expect(res.body[1].name).to.not.exist;
          app.models.Product.findById(res.body[0].id, function(err, p1) {
            expect(err).to.not.exist;
            expect(p1.name).to.equal('test product 3');
            expect(p1.status).to.not.exist;
            done();
          });
        });
    });

    lt.beforeEach.givenModel('Product', {name: 'some book', type: 'book', status: 'pending'}, 'product');
    it('should not change readonly properties on update (single readonly property)', function(done) {
      var product = this.product;
      this.put('/api/products/' + product.id)
        .send({
          name: 'updated name',
          status: 'disabled'
        })
        .expect(200)
        .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body.name).to.equal('updated name');
          expect(res.body.status).to.equal('pending');
          done();
        });
    });

    lt.beforeEach.givenModel('Person', {name: 'Tom', status: 'disabled', role: 'user'}, 'Person');
    it('should not change readonly properties on update (multiple readonly properties)', function(done) {
      var Person = this.Person;
      this.put('/api/people/' + Person.id)
        .send({
          name: 'Tom (edited)',
          status: 'active',
          role: 'user'
        })
        .expect(200)
        .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body.name).to.equal('Tom (edited)');
          expect(res.body.status).to.equal('disabled');
          expect(res.body.role).to.equal('user');
          done();
        });
    });

    lt.beforeEach.givenModel('AuditTrail', {event: 'edit', user: 'tom'}, 'audittrail');
    it('should not change readonly properties on update (full read only model)', function(done) {
      var audittrail = this.audittrail;
      this.put('/api/audittrails/' + audittrail.id)
        .send({
          event: 'update',
          user: 'john'
        })
        .expect(403)
        .end(done);
    });

    it('should reject array payloads on create for a full read only model.', function(done) {
      this.post('/api/audittrails')
        .send([
          {event: 'edit', user: 'tom'},
          {event: 'view', user: 'john'}
        ])
        .expect(403)
        .end(done);
    });

    lt.beforeEach.givenModel('Product', {name: 'book 1', type: 'book', status: 'disabled'}, 'book1', 'product');
    lt.beforeEach.givenModel('Product', {name: 'book 12', type: 'book', status: 'pending'}, 'book2', 'product');
    it('should not change readonly properties with bulk updates', function(done) {
      var self = this;
      var data = { status: 'disabled' };
      var query = { where: {type: 'book' }};
      self.post('/api/products/update')
        .query(query)
        .send(data)
        .set('Accept', 'application/json')
        .expect(200)
        .end(function(err, res) {
          expect(err).to.not.exist;
          app.models.Product.findById(self.book1.id, function(err, b1) {
            expect(err).to.not.exist;
            expect(b1.status).to.equal(self.book1.status);
            app.models.Product.findById(self.book2.id, function(err, b2) {
              expect(err).to.not.exist;
              expect(b2.status).to.equal(self.book2.status);
              done();
            });
          });
        });
    });
  });
});
