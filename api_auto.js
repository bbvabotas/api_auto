
require('dotenv').config()
var API_KEY = process.env.API_KEY
var API_URL_DELETE_DATA = process.env.API_URL_DELETE_DATA,
    API_URL_GET_WALLET = process.env.API_URL_GET_WALLET,
    API_URL_GET_MOBILE = process.env.API_URL_GET_MOBILE,
    API_URL_GET_ADOBE = process.env.API_URL_GET_ADOBE,
    API_URL_REVIEW_UPDATE_STATUS = process.env.API_URL_REVIEW_UPDATE_STATUS,
    API_URL_GLOMO_API_TESTER_STATUS = process.env.API_URL_GLOMO_API_TESTER_STATUS,
    API_URL_GLOMO_API_TESTER_SEND_DATA = process.env.API_URL_GLOMO_API_TESTER_SEND_DATA

var express = require('express')
var app = express()
var request = require('request')
var translate = require('google-translate-api')
var googlePlay = require('google-play-scraper')
var appStore = require('app-store-scraper')
var MongoClient = require('mongodb').MongoClient
var url = process.env.MONGO_APP_URL
var moment = require('moment')
var moment_timezone = require('moment-timezone')
var fs = require('fs')
var path = require('path')
var Papa = require('papaparse')
var bodyParser = require('body-parser')
var headersOpt = {  
    "content-type": "application/json",
}
var CronJob = require('cron').CronJob;
//var nodemailer = require('nodemailer')
var port = 8080

var update_status = 'idle',
    job;

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
})

app.use('/pages', express.static('pages'))

app.use( bodyParser.json() )
app.use(bodyParser.urlencoded({
    extended: true
}))


/*

    Set up the APIs
    
*/

var status_data = {
    message: '',
    results: false
}
app.post(API_URL_GLOMO_API_TESTER_STATUS, function(req, res){
    status_data.message = req.body.message
    status_data.results = req.body.results

    console.log(status_data)

    res.send("success")
})

app.post(API_URL_GLOMO_API_TESTER_SEND_DATA, function(req, res){
    var json_data = {  
        "country": "Mexico",
        "password": "147258",
        "enviroment": "Test",
        "function": "accounts",
        "username": "5538815345"
    }

    request.post({
        url:'',
        form: json_data
    }, function(err,httpResponse,body){
        if(err){
            console.log(err)
        } else {
            console.log(body)
        }
    })

    // axios.post('/user', json_data)
    // .then(function (response) {
    //     console.log(response);
    // })
    // .catch(function (error) {
    //     console.log(error);
    // });
})

app.get(API_URL_DELETE_DATA, function(req, res){
    

    // var temp_url = 'mongodb://temp:temp01@ds151662.mlab.com:51662/appreviews'

    // // Connect using MongoClient
    // MongoClient.connect(temp_url, function(err, db) {
    //     if(err){
    //         console.log(err)
    //         res.send(err)
    //     } else {
            
    //         var collection = db.collection('mobile-android-spain');
            
    //         let date_start = '2017-09-17',
    //             date_end = '2017-09-23'
        
    //         collection.remove({
    //             $and: [
    //                 {date: {$gte: date_start}}, {date: {$lte: date_end}}
    //             ]
    //         })

    //         console.log('removed items')
    //         db.close()
    //     }
    // })
})

//API to get Adobe Analytics Data
app.get(API_URL_GET_ADOBE, function (req, res) {
    
    //Get the start and end dates and the collection to search in
    var start_date = req.query.start_date, 
        end_date = req.query.end_date
    var adobe_url = 'mongodb://analytics:Teambotas01@ds023213.mlab.com:23213/adobeanalytics'
    
    // Connect using MongoClient
    MongoClient.connect(adobe_url, function(err, db) {
        if(err){
            console.log(err)
            res.send(err)
        } else {
            console.log('Retrieved Adobe Analytics data at ' + moment().format('MMMM Do YYYY, h:mm:ss a'))
            
            var i = 0, j = 0,
                call_count = 0, collection_count = 0,
                combined_data = [],
                combined_data2 = [],
                db_collections = [
                    'tuyyo_crashes', 'tuyyo_installs', 'tuyyo_launches', 'tuyyo_logins_total', 'tuyyo_transactions_fail',
                    'tuyyo_transactions_success'
                ],
                db_collections2 = [
                    'tuyyo_transfers', 'tuyyo_transfers_amount'
                ],
                db_collections_range = [
                    'tuyyo_installs', 'tuyyo_logins_total', 'tuyyo_transfers', 'tuyyo_transfers_amount'
                ],
                stats_live_data = {
                    "name": "tuyyo_live_data",
                    "today": {
                        "installs": 0,
                        "logins": 0,
                        "transfers": 0,
                        "transfer_amount": 0
                    },
                    "all_time": {
                        "installs": 0,
                        "logins": 0,
                        "transfers": 0,
                        "transfer_amount": 0
                    }
                },
                stats_range_data = {
                    "yesterday": {
                        "tuyyo_installs": 0,
                        "tuyyo_logins_total": 0,
                        "tuyyo_transfers": 0,
                        "tuyyo_transfers_amount": 0
                    },
                    "last_week": {
                        "tuyyo_installs": 0,
                        "tuyyo_logins_total": 0,
                        "tuyyo_transfers": 0,
                        "tuyyo_transfers_amount": 0
                    }
                }
            
            for(i = 0; i < db_collections.length; i++){
                combined_data.push({
                    name: db_collections[i],
                    android: 0,
                    ios: 0
                })
            }
            
            for(i = 0; i < db_collections2.length; i++){
                combined_data2.push({
                    name: db_collections2[i],
                    android: {
                        atm: 0,
                        cash: 0,
                        bank: 0
                    },
                    ios: {
                        atm: 0,
                        cash: 0,
                        bank: 0
                    }
                })
            }
            
            function getYesterdayData(){
                var current_collection = db_collections_range[collection_count];
                var collection = db.collection(current_collection);
                
                var yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD')
            
                collection.find({
                    $and: [
                        {date: yesterday}
                    ]
                }).toArray(function(err, docs) {

                    if(err){
                        res.send(err)
                    } else {
                        
                        for(i = 0; i < docs.length; i++){
                            if(current_collection == 'tuyyo_installs' || current_collection == 'tuyyo_logins_total'){
                                stats_range_data.yesterday[current_collection] += (docs[i].android + docs[i].ios)    
                            } else if(current_collection == 'tuyyo_transfers' || current_collection == 'tuyyo_transfers_amount') {
                                stats_range_data.yesterday[current_collection] += (
                                    docs[i].android.atm + docs[i].android.bank + docs[i].android.cash + 
                                    docs[i].ios.atm + docs[i].ios.bank + docs[i].ios.cash
                                )
                            }
                            
                        }
                        
                        collection_count++
                        
                        if(collection_count < db_collections_range.length){
                            getYesterdayData()
                        } else {
                            collection_count = 0;
                            getStatsDateRanges()
                        }
                        
                    }
                });
            }
            
            function getStatsDateRanges(){
                var current_collection = db_collections_range[collection_count];
                var collection = db.collection(current_collection);
                
                var last_week_start = moment().subtract(1, 'weeks').day(0).format('YYYY-MM-DD'),
                    last_week_end = moment().subtract(1, 'weeks').day(6).format('YYYY-MM-DD')
            
                collection.find({
                    $and: [
                        {date: {$gte: last_week_start}}, {date: {$lte: last_week_end}}
                    ]
                }).toArray(function(err, docs) {

                    if(err){
                        res.send(err)
                    } else {
                        
                        for(i = 0; i < docs.length; i++){
                            if(current_collection == 'tuyyo_installs' || current_collection == 'tuyyo_logins_total'){
                                stats_range_data.last_week[current_collection] += (docs[i].android + docs[i].ios)    
                            } else if(current_collection == 'tuyyo_transfers' || current_collection == 'tuyyo_transfers_amount') {
                                stats_range_data.last_week[current_collection] += (
                                    docs[i].android.atm + docs[i].android.bank + docs[i].android.cash + 
                                    docs[i].ios.atm + docs[i].ios.bank + docs[i].ios.cash
                                )
                            }
                            
                        }
                        
                        collection_count++
                        
                        if(collection_count < db_collections_range.length){
                            getStatsDateRanges()
                        } else {
                            collection_count = 0;
                            getData()
                        }
                        
                    }
                });
            }

            function getData(){
                var current_collection = db_collections[collection_count];
                var collection = db.collection(current_collection);
            
                collection.find({
                    $and: [
                        {date: {$gte: start_date}}, {date: {$lte: end_date}}
                    ]
                }).toArray(function(err, docs) {

                    if(err){
                        res.send(err)
                    } else {
                        
                        for(i = 0; i < docs.length; i++){
                            combined_data[collection_count].android += docs[i].android
                            combined_data[collection_count].ios += docs[i].ios
                        }
                        
                        collection_count++
                        
                        if(collection_count < db_collections.length){
                            getData()
                        } else {
                            collection_count = 0;
                            getData2()
                        }
                    }
                });
            }
            
            function getData2(){
                var current_collection = db_collections2[collection_count];
                var collection = db.collection(current_collection);
            
                collection.find({
                    $and: [
                        {date: {$gte: start_date}}, {date: {$lte: end_date}}
                    ]
                }).toArray(function(err, docs) {

                    if(err){
                        res.send(err)
                    } else {
                        
                        for(i = 0; i < docs.length; i++){
                            combined_data2[collection_count].android.atm += docs[i].android.atm
                            combined_data2[collection_count].android.cash += docs[i].android.cash
                            combined_data2[collection_count].android.bank += docs[i].android.bank
                            
                            combined_data2[collection_count].ios.atm += docs[i].ios.atm
                            combined_data2[collection_count].ios.cash += docs[i].ios.cash
                            combined_data2[collection_count].ios.bank += docs[i].ios.bank
                        }
                        
                        collection_count++
                        
                        if(collection_count < db_collections2.length){
                            getData2()
                        } else {
                            combineData()
                        }
                    }
                });
            }
            
            function combineData(){
                
                var all_data = {}
                var range_keys = Object.keys(stats_range_data)
                
                all_data[range_keys[0]] = stats_range_data.yesterday
                all_data[range_keys[1]] = stats_range_data.last_week
                
                for(i = 0; i < combined_data.length; i++){
                    all_data[combined_data[i].name] = {
                        android: combined_data[i].android,
                        ios: combined_data[i].ios
                    }
                }
                
                for(i = 0; i < combined_data2.length; i++){
                    all_data[combined_data2[i].name] = {
                        "android": {
                            "atm": combined_data2[i].android.atm,
                            "cash": combined_data2[i].android.cash,
                            "bank": combined_data2[i].android.bank
                        },
                        "ios": {
                            "atm": combined_data2[i].ios.atm,
                            "cash": combined_data2[i].ios.cash,
                            "bank": combined_data2[i].ios.bank
                        }
                    }
                }
                
                res.send(all_data)
            }
            
            getYesterdayData();
        }
    });
})

//API to get Mobile data
app.get(API_URL_GET_MOBILE, function (req, res) {
    
    //Get the start and end dates and the collection to search in
    var start_date = req.query.start_date, 
        end_date = req.query.end_date,
        current_collection = req.query.current_collection;
    
    // Connect using MongoClient
    MongoClient.connect(url, function(err, db) {
        if(err){
            console.log(err)
            res.send(err)
        } else {
            console.log('Retrieved mobile app data at ' + moment().format('MMMM Do YYYY, h:mm:ss a'))

            var combined_data = {
                reviews: [],
                trend: []
            }

            var collection = db.collection(current_collection);
                
            //Get reviews
            collection.find({
                $and: [
                    {date: {$gte: start_date}}, {date: {$lte: end_date}}
                ]
            }).sort({"rating":1}).toArray(function(err, docs) {
                if(err){
                    res.send(err)
                } else {
                    combined_data.reviews = docs;
                    
                    db.collection("mobile-trend-data").find().toArray(function(err, trend_docs){
                        if(err){
                            res.send(err)
                        } else {
                            combined_data.trend = trend_docs
                            
                            res.send(combined_data);
                        }
                    })
                }
            })
        }
    });
})

//API to get Wallet data
app.get(API_URL_GET_WALLET, function (req, res) {
    
    console.log(req.query.api_key)
    
    // Connection url
    
    // Connect using MongoClient
    MongoClient.connect(url, function(err, db) {
        if(err){
            console.log(err)
            res.send(err)
        } else {
            console.log('Retrieved wallet app data at ' + moment().format('MMMM Do YYYY, h:mm:ss a'))
            
            var temp_start = moment().subtract(1, 'weeks').day(0).format('YYYY-MM-DD'),
                temp_end = moment().subtract(1, 'weeks').day(6).format('YYYY-MM-DD')
            
            var call_count = 0, i = 0, j = 0;
            
            var combined_data = {
                    date_range: {
                        from: temp_start,
                        to: temp_end
                    },
                    review_data: []
                },
                db_collections = [
                    'wallet-android-chile', 'wallet-android-colombia', 'wallet-android-mexico', 'wallet-android-peru', 'wallet-android-spain', 'wallet-android-turkey', 'wallet-android-us',
                    'wallet-ios-chile', 'wallet-ios-colombia', 'wallet-ios-mexico', 'wallet-ios-peru', 'wallet-ios-spain', 'wallet-ios-turkey', 'wallet-ios-us'
                ]
            
            for(i = 0; i < db_collections.length; i++){
                combined_data.review_data.push({
                    name: db_collections[i],
                    reviews: '',
                    highcharts_data: {
                        categories: [],
                        review_count: [],
                        review_average_rating: []
                    },
                    weekly_breakdowns: [],
                    all_time_rating: 0
                })
            }

            function getData(){
                var current_collection = db_collections[call_count];
                var collection = db.collection(current_collection);

                
                
                //Get reviews
                collection.find({
                    $and: [
                        {date: {$gte: temp_start}}, {date: {$lte: temp_end}}
                    ]
                }).sort({"rating":1}).toArray(function(err, docs) {

                    if(err){
                        res.send(err)
                    }
                    
                    for(i = 0; i < combined_data.review_data.length; i++){
                        if(combined_data.review_data[i].name == current_collection){
                            combined_data.review_data[i].reviews = docs
                            
                            db.collection('wallet-trend-data').find().toArray(function(err, docs) {

                                if(err){
                                    res.send(err)
                                }

                                var trend_temp = docs[0][current_collection]

                                combined_data.review_data[i].weekly_breakdowns = trend_temp

                                for(j = 0; j < trend_temp.length; j++){
                                    combined_data.review_data[i].highcharts_data.categories.push(
                                        moment(trend_temp[j].date_range.from).format('MMM-DD') + ' to ' + moment(trend_temp[j].date_range.to).format('MMM-DD')
                                    );
                                    combined_data.review_data[i].highcharts_data.review_count.push(trend_temp[j].review_count);
                                    combined_data.review_data[i].highcharts_data.review_average_rating.push(trend_temp[j].review_average_rating);
                                }

                                db.collection('wallet-stats').find().toArray(function(err, docs){
                                    
                                    for(j = 0; j < docs.length; j++){
                                        if(docs[j].country == current_collection){
                                            combined_data.review_data[i].all_time_rating = docs[j].all_time_rating
                                        }
                                    }
                                    
                                    call_count++

                                    if(db_collections.length > call_count){
                                        getData()

                                    } else {
                                        //console.log(combined_data);
                                        db.close();
                                        res.send(JSON.stringify(combined_data, undefined, 2))

                                    }
                                })
                                
                            });
                            break;
                        }
                    } 
                });
            }
            getData();
        }
    });
})

app.get(API_URL_REVIEW_UPDATE_STATUS, function (req, res) {
    res.send(update_status)
})

/*

    Auto update the database
    
*/


/*

    Auto Update once a day at UTC time of 00:00
    
*/

var updateAppRating = ()=>{
    console.log('Getting app ratings at: ' + moment().format('MMMM Do YYYY, h:mm:ss a'))
}

//job = new CronJob({
//    //cronTime: '00 30 11 * * 1-5',
//    cronTime: '00 00 00 * * 0-6',
//    onTick: function() {
//        /*
//         * Runs every weekday (Monday through Friday)
//         * at 11:30:00 AM. It does not run on Saturday
//         * or Sunday.
//         */
//        
//        updateAppRating()
//        
//    },
//    onComplete: function(){
//        console.log('running cron')  
//    },
//    start: false,
//    timeZone: 'Etc/Greenwich'
//});
//job.start();



//setTimeout(() =>{
//    console.log('Started autoUpdate')
//    autoUpdate()
//},2000)

var review_id_data = [], app_count = 0
var updateReviews = {
    init(){
        
        //Get the IDs for each app and platform
        fs.readFile('data/country_review_ids.csv', 'utf8', function (err,file) {
            if (err) {
                console.log(err)
            } else {
                Papa.parse(file, {
                    header: true,
                    complete: (results) => {
                        
                        review_id_data = results.data

                        updateReviews.update()
                    }
                })
            }
        })
    },
    update(){

        //Go through each app and platform and check for updates
        if(app_count < review_id_data.length){

            //Wait 5 seconds between each app to ensure we don't overdo the scrapers
            setTimeout(()=>{
                
                console.log('Update data for: ' + review_id_data[app_count].database_name)

                app_count++

                updateReviews.update()

            }, 5000)
        } else {
            console.log('done')
            app_count = 0

            //Wait 10 minutes and check for updates again
            setTimeout(()=>{
                updateReviews.update()
            }, 600000)
        }
        

        
        
        // appStore.app({
        //     id: '994503642',
        //     // sort: store.sort.RECENT,
        //     // page: 1,
        //     // country: 'tr'
        // }).then((response)=>{
        //     // console.log(response)
        //     // let json_object = response
        
        
        //     // fs.writeFile('data/ios_reviews.json', JSON.stringify(json_object, undefined, 2), 'utf8', function(result){
        //     //     console.log('successfully wrote ios reviews')
        //     // })
        
        
        //     console.log(response)
        // }).catch((err)=>{
        //     console.log(err)
        // })
        
        
        
        // googlePlayer.reviews({
        //     appId: 'com.bbva.nxt_peru',
        //     page: 0,
        //     sort: gplay.sort.NEWEST,
        //     lang: 'es'
        // }).then((response)=>{
        //     // let json_object = response
        //     // fs.writeFile('data/android_reviews.json', JSON.stringify(json_object, undefined, 2), 'utf8', function(result){
        //     //     console.log('successfully wrote android reviews')
        //     // })
        
        //     let date_test = response[0].date.split('de')
        
        //     console.log(moment(new Date(date_test[1] + date_test[0] + date_test[2])).format('YYYY-MM-DD'))
        // }).catch((err)=>{
        //     console.log(err)
        // })
    }
}

// updateReviews.init();

console.log('Listening on port ' + port)
app.listen(port)