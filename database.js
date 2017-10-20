/*

lymme shopping list

© Pertti Roitto 2017

*/
const mysql = require('mysql');
class databaseHandler {
    constructor() {
        this.connection;
    }

    //CHANGE THESE!
    init() {
        this.connection = mysql.createConnection({
            host: 'localhost',
            user: 'CHANGEME',
            password: 'CHANGEME',
            database: 'lymme',
            dateStrings: 'date'
        });
        console.log("...mySQL handler running...");
    }

    //different mysql queries
    query(what, data) {
        const conn = this.connection;
        switch (what) {
            case "getShoplist":
                return new Promise(function (resolve, reject) {
                    conn.query('SELECT * FROM shoplists WHERE code=' + mysql.escape(data['code']), function (error, results, fields) {
                        if (error) reject(error)
                        else resolve(results[0])
                    });
                });
                break;
            case "updateShoplistItems":
                return new Promise(function (resolve, reject) {
                    conn.query('UPDATE `lymme`.`shoplists` SET `text` = "' + conn.escape(data['text']) + '" WHERE `shoplists`.`id` = ' + parseInt(data["id"]), function (error, results, fields) {
                        if (error) reject(error)
                        else resolve(results[0])
                    });
                });
                break;

            case "updateStats":
                return new Promise(function (resolve, reject) {
                    conn.query('UPDATE lymme.stats SET number = number + ' + data["number"] + ' WHERE stats.name = "' + data["name"] + '";', function (error, results, fields) {
                        if (error) reject(error)
                        else resolve(results[0])
                    });
                });
                break;

            case "getStats":
                return new Promise(function (resolve, reject) {
                    conn.query('SELECT * FROM lymme.stats', function (error, results, fields) {
                        if (error) reject(error)
                        else resolve(results)
                    });
                });
                break;

            default:
                return "error!";

        }
    }

    /*

    When inserting new data to the tables

    */
    insert(what, data) {
        const conn = this.connection;
        switch (what) {
            case "newShoplist":
                /*

                Crate random funny sentence

                */
                const adjectives = require('./englishAdjectives.js');
                const nouns = require('./englishNouns.js');
                let randomWord = "";
                for (var i = 0; i < 3; i++) {
                    if (i < 2) {
                        const min = Math.ceil(0);
                        const max = Math.floor(adjectives.length);
                        var randomNumber = Math.floor(Math.random() * (max - min)) + min;
                        randomWord += adjectives[randomNumber];
                    } else {
                        const min = Math.ceil(0);
                        const max = Math.floor(nouns.length);
                        var randomNumber = Math.floor(Math.random() * (max - min)) + min;
                        randomWord += nouns[randomNumber];
                    }
                }

                return new Promise(function (resolve, reject) {
                    conn.query('INSERT INTO `lymme`.`shoplists` (`id`, `code`, `name`, `text`,`date`,`creatorIp`) VALUES (NULL,"' + randomWord + '", ' + mysql.escape(data['name']) + ', NULL,NOW(),' + mysql.escape(data['ip']) + ')', function (error, results, fields) {
                        if (error) reject(error)
                        else resolve({
                            randomCode: randomWord
                        })
                    });
                });
                break;
            default:
                return "error!";
        }
    }
}


exports.databaseHandler = databaseHandler;