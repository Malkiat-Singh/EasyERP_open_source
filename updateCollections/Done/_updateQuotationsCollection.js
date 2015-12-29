/**
 * Created by lilya on 15/12/15.
 */
/**
 * Created by lilya on 24/11/15.
 */
var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;
require('../../models/index.js');
var async = require('async');

var Schema = mongoose.Schema;

var payments = {
    _id    : false,
    id     : false,
    total  : {type: Number, default: 0},
    unTaxed: {type: Number, default: 0},
    taxes  : {type: Number, default: 0}
};

var products = {
    _id          : false,
    id           : false,
    scheduledDate: {type: Date},
    quantity     : {type: Number, default: 1},
    taxes        : {type: Number},
    subTotal     : Number,
    unitPrice    : Number,
    product      : {type: ObjectId, ref: 'Product', default: null},
    description  : {type: String, default: ''},
    jobs: {type: ObjectId, ref: "jobs", default: null}
};

var quotationSchema = new Schema({
    currency: {
        _id : {type: ObjectId, ref: 'currency', default: null},
        name: {type: String, default: ''},
        rate: {type: Number, default: 1}
    },
    forSales      : {type: Boolean, default: true},
    type          : {type: String, default: 'Not Ordered', enum: ['Not Ordered', 'Not Invoiced', 'Invoiced']},
    isOrder       : {type: Boolean, default: false},
    supplier      : {
        _id: {type: ObjectId, ref: 'Customers', default: null},
        name: {type: String, default: ''}
    },
    project       : {
        _id: {type: ObjectId, ref: 'Project', default: null},
        projectmanager: {
            _id: {type: ObjectId, ref: 'Employees', default: null},
            name: {type: String, default: ''}
        },
        projectName: {type: String, default: ''}
    },
    deliverTo     : {type: ObjectId, ref: 'DeliverTo', default: null},
    orderDate     : {type: Date, default: Date.now},
    expectedDate  : Date,
    name          : {type: String, default: 'PO', unique: true},
    destination   : {type: ObjectId, ref: 'Destination', default: null},
    incoterm      : {type: ObjectId, ref: 'Incoterm', default: null},
    invoiceControl: {type: ObjectId, ref: 'InvoicingControl', default: null},
    invoiceRecived: {type: Boolean, default: false},
    paymentTerm   : {type: ObjectId, ref: 'PaymentTerm', default: null},
    paymentInfo   : payments,
    products      : [products],
    workflow      : {
        _id: {type: ObjectId, ref: 'workflows', default: null},
        name: {type: String, default: ''}
    },
    whoCanRW      : {type: String, enum: ['owner', 'group', 'everyOne'], default: 'everyOne'},
    groups        : {
        owner: {type: ObjectId, ref: 'Users', default: null},
        users: [{type: ObjectId, ref: 'Users', default: null}],
        group: [{type: ObjectId, ref: 'Department', default: null}]
    },
    creationDate  : {type: Date, default: Date.now},
    createdBy     : {
        user: {type: ObjectId, ref: 'Users', default: null},
        date: {type: Date, default: Date.now}
    },
    editedBy      : {
        user: {type: ObjectId, ref: 'Users', default: null},
        date: {type: Date, default: Date.now}
    }
}, {collection: 'Quotation'});

mongoose.model('QuotationOld', quotationSchema);

if (!mongoose.Schemas) {
    mongoose.Schemas = {};
}

mongoose.Schemas['QuotationOld'] = quotationSchema;

var QuotationSchema = mongoose.Schemas['Quotation'];
var QuotationSchemaOld = mongoose.Schemas['QuotationOld'];

var dbObject = mongoose.createConnection('localhost', 'production');
dbObject.on('error', console.error.bind(console, 'connection error:'));
dbObject.once('open', function callback() {
    console.log("Connection to production is success");
});

var  Quotation = dbObject.model("Quotation", QuotationSchema);
var  QuotationOld = dbObject.model("QuotationNew", QuotationSchemaOld);

var query = QuotationOld.find().lean();

query.exec(function (error, _res) {
    if (error) {
        return console.dir(error);
    }

    async.each(_res, function (quot, callback) {
        var objectToSave = {};

        objectToSave.workflow = quot.workflow._id ? quot.workflow._id : null;
        objectToSave.project = quot.project._id ? quot.project._id : null;
        objectToSave.supplier = quot.supplier._id ? quot.supplier._id : null;

        Quotation.update({_id: quot._id}, objectToSave, callback);

    }, function (err) {
        if (err) {
            return console.dir(err);
        }

        return console.dir('Good');
    })
});