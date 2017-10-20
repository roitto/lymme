/*

Lymme shopping list app

© Pertti Roitto 2017

!! IF YOU USE THIS, REMEMBER TO CHANGE THE SESSION SECRET KEY !!

*/

const rooms = require("./rooms").roomHandler;
const database = require("./database").databaseHandler;
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session')

const path = require("path");

const io = require('socket.io')({
    transports: ['websocket']
});


class lymme {
    constructor() {

        //Start up express, database handler and roomhandler, also make the socket.io to listen to right port.
        this.app = express();
        this.db = new database();
        this.roomHandler = new rooms();

        this.socket = io.listen(8554);

        /*

        Stats system

        */
        this.users = [];
        this.stats = {
            items: 0,
            lists: 0,

            update: function (what) {
                switch (what) {
                    //if new item gets added
                    case "item":
                        this.items++;
                        console.log(this.items);
                        break;
                        //if new list gets added
                    case "list":
                        this.lists++;
                        console.log(this.lists);
                        break;
                    default:
                        return false;
                }
            }


        }


        /*

        Update the stats with 1 minute interval..

        */
        this.statsUpdater = setInterval(function () {
            //items 
            if (this.stats.items > 0) {
                this.db.query("updateStats", {
                    number: this.stats.items,
                    name: "items"
                }).then(function (result) {
                    console.log("updated database item stat entries");
                }).catch(function (err) {
                    console.log(err)
                });
                this.stats.items = 0;
            }

            //lists
            if (this.stats.lists > 0) {
                this.db.query("updateStats", {
                    number: this.stats.lists,
                    name: "lists"
                }).then(function (result) {
                    console.log("updated database list stat entries");
                }).catch(function (err) {
                    console.log(err)
                });
                this.stats.lists = 0;
            }
        }.bind(this), 60000)
    }


    /*

    --------------------------------------------

    */

    init() {
        this.db.init();
        const database = this.db;
        this.app.use(bodyParser.json()); // to support JSON-encoded bodies
        this.app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
            extended: true
        }));
        this.app.use(cookieParser());

        //remember to change
        this.app.use(session({
            secret: 'CHANGE_ME_IM_HIDDEN_SECRET_SESSION_COOKIE_DONT_USE_THIS'
        }));

        //we need to serve some static content too
        this.app.use(express.static('public'));

        this.app.locals.basedir = path.join(__dirname, 'views');

        //pug ftw
        this.app.set('view engine', 'pug');

        /*

        Make the express to listen different parts.

        */


        //this is experimental login system, which is not yet fully functional
        /*
        TODO: Login system
        */
        this.app.get('/', function (req, res) {
            if (req.session.authenticated === true) {
                console.log("found authentication");
                res.render('index', {
                    logged: true
                });
            } else {
                console.log("didnt find auth");
                res.render('index');
            }
        });

        this.app.get('/login', function (req, res) {
            res.render('login');
        });

        this.app.post('/login', function (req, res, next) {
            console.log(req.body.loginmail);
            console.log(req.body.loginpass)
            if (req.body.loginmail && req.body.loginmail === 'testi@testi.fi' && req.body.loginpass && req.body.loginpass === 'pass') {
                req.session.authenticated = true;
                res.redirect('/');
                console.log("logged in");
            } else {
                console.log("error in logi in")
                //res.redirect('/');
                res.redirect('/login?=failed');
            }

        });
        //--------------------------


        //render the stats
        this.app.get('/stats', function (req, res) {
            database.query("getStats").then(function (result) {
                if (result != undefined) {
                    console.log(result);
                    res.render('stats', {
                        statsItems: result[0].number,
                        statsLists: result[1].number
                    });
                } else {
                    res.redirect("/");
                }
            }).catch(function (err) {
                console.log(err)
            });
        });


        //if we get create post, create new list to the database and redirect the client to it.
        this.app.post('/create', function (req, res) {
            if (req.body.name != "") {
                //get client ip
                const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                const data = {
                    name: req.body.name,
                    ip: ip
                }

                database.insert("newShoplist", data).then(function (result) {
                    //console.log(result.randomCode);
                    res.redirect("/list/" + result.randomCode);
                    SERVER.stats.update("list");
                }).catch(function (err) {
                    console.log(err)
                });

            } else {
                res.redirect("/");
            }
        })

        //if user tries to find a list, get it from db and render it.
        this.app.get('/list/:tagId', function (req, res) {
            const data = {
                code: req.params.tagId
            }
            database.query("getShoplist", data).then(function (result) {
                //console.log(result);
                if (result != undefined) {
                    res.render('shoplist', {
                        title: 'lymme - ' + result.name,
                        shoplistName: result.name,
                        shoplistCode: result.code,
                        shoplistDate: result.date
                    });
                } else {
                    res.redirect("/");
                }
            }).catch(function (err) {
                console.log(err)
            });
        });

        //make the express listen the right port
        this.app.listen(3554, function () {
            console.log('lymme running at port 3554!');
        })

        //make the cool 404 error page if not found
        this.app.use(function (req, res, next) {
            res.status(404);

            // respond with html page
            if (req.accepts('html')) {
                res.render('404', {
                    url: req.url
                });
                //console.log("lol");
                return;
            }

            // respond with json
            if (req.accepts('json')) {
                res.send({
                    error: 'Not found'
                });
                return;
            }

            // default to plain-text. send()
            res.type('txt').send('Not found');
        });

        this.socket.sockets.on("connection", this.onSocketConnection.bind(this));

    }

    /*

    when getting websocket connetions

    */
    onSocketConnection(client) {

        var database = this.db;
        var roomHandler = this.roomHandler;
        console.log("Opening connection to ip: " + client.handshake.headers["x-real-ip"]);
        client.on("setRoom", function (data) {
            client.join(data.code);
            this.addUser(client.id, client.handshake.headers["x-real-ip"], data.code);


            //get the room/shopList items from database
            database.query("getShoplist", data).then(function (result) {

                //check if the room is already open at roomHandler
                const room = roomHandler.getRoom(result.id);

                //if it's not available yet, create one to roomHandler
                if (room === undefined) {
                    let newresult = undefined;
                    if (result.text != null) {
                        newresult = result.text.slice(1, -1);
                        newresult = JSON.parse(newresult);
                    } else {
                        newresult = [];
                    }
                    roomHandler.addRoom(result.id, result.code, result.name, newresult, client.id);
                    io.to(client.id).emit('receiveRoomItems', {
                        text: newresult
                    });
                    //if room is found, add new user to it.
                } else {
                    room.addUser(client.id);
                    io.to(client.id).emit('receiveRoomItems', {
                        text: room.text
                    });
                }
            }).catch(function (err) {
                console.log(err);
            });
        }.bind(this));

        //add new item to a room.
        // TODO: change this name to better (addItem maybe?)
        client.on("addText", function (data) {
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.addText(data.text);
            }
        }.bind(this));

        //when client wants to edit and item
        client.on("editItem", function (data) {
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.editText(data.id, client.id);
            }
        }.bind(this));

        //when client is editing item, place the text to the roomhandler in real time
        client.on("itemAddText", function (data) {
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.editItemText(data.id, client.id, data.text);
            }
        }.bind(this));

        //when item editing is done by client.
        client.on("itemEditDone", function (data) {
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.stopEditing(data.itemId, client.id);
            }
        }.bind(this));

        //item removing
        client.on("itemRemove", function (data) {
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.removeItem(data.id, client.id);
            }
        }.bind(this));

        client.on("changeItemOrder", function (data) {
            //changeItemOrder", { id: id, oldIndex:evt.oldIndex, newIndex: evt.newIndex });
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.changeItemOrder(data.id, data.oldIndex, data.newIndex);
            }
        }.bind(this));

        client.on("sortItemsBy", function (data) {
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.sortItemsBy(data.by);
            }
        }.bind(this));

        client.on("clearItems", function (data) {
            const room = this.getClientRoom(client.id);

            if (room != undefined) {
                room.clearItems();
            }
        }.bind(this));

        client.on("itemCheck", function (data) {
            const room = this.getClientRoom(client.id);
            if (room != undefined) {
                room.changeItemCheck(data.id, data.check);
            }
        }.bind(this));

        client.on('disconnect', function () {
            const user = this.getUserById(client.id);
            if (user != undefined) {
                const room = this.roomHandler.getRoomByCode(user.room);

                //if room is found, remove all the editings done by user and remove the user.
                if (room != undefined) {
                    room.removeUserEdits(client.id);
                    room.removeUser(client.id);
                }
                const userIndex = this.users.indexOf(user);
                this.users.splice(userIndex, 1);
            }
        }.bind(this));

    }

    //returns the room where the client is
    getClientRoom(id) {
        const roomName = Object.keys(io.sockets.adapter.sids[id])[1];
        const room = this.roomHandler.getRoomByCode(roomName);
        return room;
    }

    //this function is used to send different commands to all clients inside different rooms.
    sendToRoom(roomId, what, data) {
        switch (what) {
            case "addItem":
                io.sockets.in(roomId).emit("addItem", {
                    id: data.id,
                    text: data.text
                });
                break;

            case "editItem":
                io.sockets.in(roomId).emit("editItem", {
                    id: data.id,
                    editor: data.editor
                });
                break;

            case "addItemText":
                io.sockets.in(roomId).emit('addItemText', {
                    id: data.id,
                    editor: data.editor,
                    text: data.text
                });
                break;
            case "stopEdit":
                io.sockets.in(roomId).emit("stopEdit", {
                    id: data.id
                });
                break;
            case "removeItem":
                io.sockets.in(roomId).emit("removeItem", {
                    id: data.id
                });
                break;
            case "changeItemOrder":
                io.sockets.in(roomId).emit("changeItemOrder", {
                    id: data.id,
                    fromIndex: data.fromIndex,
                    toIndex: data.toIndex
                })
                break;
            case "receiveRoomItems":
                io.sockets.in(roomId).emit("receiveRoomItems", {
                    text: data.text
                })
                break;
            case "itemCheck":
                io.sockets.in(roomId).emit("itemCheck", {
                    id: data.id,
                    checked: data.checked
                });
                break;
            default:
                return false;
        }
    }

    //add ne client to the server
    addUser(clientId, clientIp, roomName) {
        let user = function (id, ip, room) {
            this.id = id;
            this.ip = ip;
            this.room = room;
        }

        var u = new user(clientId, clientIp, roomName);
        this.users.push(u);
    }

    //get client by its socket id
    getUserById(id) {
        for (var i = 0; i < this.users.length; i++) {
            if (this.users[i].id === id) {
                return this.users[i];
            }
        }
    };
}

global.SERVER = new lymme();
SERVER.init();