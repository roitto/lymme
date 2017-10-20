/*

lymme shopping list

© Pertti Roitto 2017

*/

var striptags = require('striptags');
class roomHandler {
    constructor() {
        this.rooms = [];
    }

    addRoom(id, code, name, text, userId) {

        let room = function (id, code, name, text) {
            this.id = id;
            this.code = code;
            this.name = name;

            //TODO: change this text variables name, it actually is an array where all the items are
            this.text = text;
            this.users = [];
            this.updated = false;
            this.maxLength = 128;
            this.maxUsers = 50;

            //make an interval of 1 minute
            this.timer = setInterval(function () {

                //if the items has updated inside the array or the room is empty
                if (this.updated == true || this.updated == false && this.users.length == 0) {
                    //remove all editings from the items inside the array and push it to db
                    const arrayWithoutEditors = JSON.parse(JSON.stringify(this.text));
                    for (let i = 0; i < arrayWithoutEditors.length; i++) {
                        arrayWithoutEditors[i].editing = undefined;
                    }

                    //place the updated items to the db
                    const data = {
                        id: this.id,
                        text: JSON.stringify(arrayWithoutEditors)
                    }
                    SERVER.db.query("updateShoplistItems", data).then(function (result) {
                        this.updated = false;

                        //if the room is empty, remove it from the handler.
                        if (this.users.length === 0) {
                            clearInterval(this.timer);
                            const roomIndex = SERVER.roomHandler.rooms.indexOf(this);
                            SERVER.roomHandler.rooms.splice(roomIndex, 1);
                            //console.log(SERVER.roomHandler.rooms);
                        }
                    }.bind(this)).catch(function (err) {
                        console.log(err)
                    });
                } else {
                    //nothing here, but a place for a function if needed.
                }

            }.bind(this), 60000);

            this.addUser = function (userId) {
                this.users.push({
                    id: userId
                });
                this.updated = true;
            }

            //this actually gets the item not the text
            //TODO: change this functions name
            this.getText = function (id) {
                for (var i = 0; i < this.text.length; i++) {
                    if (this.text[i].id == id) {
                        return this.text[i];
                    }
                }
            }

            //this actually gets the item not the text
            //TODO: change this functions name
            this.addText = function (add) {
                if (this.text.length <= this.maxLength) {
                    const id = Date.now();
                    const text = striptags(add);
                    this.text.push({
                        id: id,
                        text: text,
                        editing: undefined,
                        checked: false
                    });
                    SERVER.sendToRoom(this.code, "addItem", {
                        id: id,
                        text: text
                    });
                    this.updated = true;
                    SERVER.stats.update("item");
                }
            }

            //this actually gets the item not the text
            //TODO: change this functions name
            this.editText = function (id, clientId) {
                var item = this.getText(id);
                if (item)
                    if (item.editing === undefined) {
                        item.editing = clientId;
                        SERVER.sendToRoom(this.code, "editItem", {
                            id: id,
                            editor: clientId
                        });
                    }
                this.updated = true;
            }

            //when editing items text
            this.editItemText = function (itemid, clientId, text, callback) {
                var item = this.getText(itemid);
                if (item) {
                    if (item.editing === clientId) {
                        const safetext = striptags(text);
                        item.text = safetext;

                        return SERVER.sendToRoom(this.code, "addItemText", {
                            id: itemid,
                            editor: clientId,
                            text: safetext
                        })

                    };
                    this.updated = true;
                }

            }

            this.stopEditing = function (itemid, clientId) {
                var item = this.getText(itemid);
                if (item) {
                    if (item.editing == clientId) {
                        item.editing = undefined;
                        //if the item is empty
                        const testEmptiness = item.text.replace(/\s/g, '');
                        if (!testEmptiness) {
                            this.removeItem(item.id, clientId);
                        } else {

                            SERVER.sendToRoom(this.code, "stopEdit", {
                                id: itemid
                            });
                        }
                        this.updated = true;
                    }
                }
            };

            this.removeItem = function (itemid, clientId) {
                const item = this.getText(itemid);
                const index = this.text.indexOf(item);
                if (item) {
                    this.text.splice(index, 1);
                    SERVER.sendToRoom(this.code, "removeItem", {
                        id: itemid
                    });
                    this.updated = true;
                }
            };

            this.sortItemsBy = function (by) {

                let sortBy = (p, a) => a.sort((i, j) => p.map(v => i[v] - j[v]).find(r => r))

                switch (by) {
                    case "checked":
                        for (var i = 0; i < 3; i++) {
                            sortBy(['checked', 'text'], this.text);
                        }
                        SERVER.sendToRoom(this.code, "receiveRoomItems", {
                            text: this.text
                        });
                        this.updated = true;
                        break;
                    case "AtoB":
                        this.text.sort(function (a, b) {
                            return (a.text > b.text) ? 1 : ((b.text > a.text) ? -1 : 0);
                        });
                        SERVER.sendToRoom(this.code, "receiveRoomItems", {
                            text: this.text
                        });
                        this.updated = true;
                        break;
                    default:
                        return "error 9000!";
                }
            };


            this.clearItems = function () {
                this.text = [];
                SERVER.sendToRoom(this.code, "receiveRoomItems", {
                    text: this.text
                });
                this.updated = true;
            }

            //when the client changes the order of items (moves the around)
            this.changeItemOrder = function (itemid, fromIndex, toIndex) {
                let arr = this.text;
                var element = arr[fromIndex];
                if (element.id == itemid) {
                    arr.splice(fromIndex, 1);
                    arr.splice(toIndex, 0, element);
                    SERVER.sendToRoom(this.code, "changeItemOrder", {
                        id: itemid,
                        fromIndex: fromIndex,
                        toIndex: toIndex
                    });
                    this.updated = true;
                }
            };


            //remove all the editing -variables from items which the client were editing
            this.removeUserEdits = function (clientId) {
                for (var i = 0; i < this.text.length; i++) {
                    if (this.text[i].editing === clientId) {
                        this.text[i].editing = undefined;
                        SERVER.sendToRoom(this.code, "stopEdit", {
                            id: this.text[i].id
                        });
                    }
                    this.updated = true;
                }
            }

            this.removeUser = function (clientId) {
                for (var i = 0; i < this.users.length; i++) {
                    if (this.users[i].id == clientId) {
                        this.users.splice(i, 1);
                    }
                    this.updated = true;
                }
            }


            //if item gets checked
            this.changeItemCheck = function (itemid, check) {
                var item = this.getText(itemid);

                if (item) {
                    if (check == true) {
                        item.checked = true;
                    } else {
                        item.checked = false;

                    }
                    SERVER.sendToRoom(this.code, "itemCheck", {
                        id: item.id,
                        checked: item.checked
                    });
                }
            };

        };

        const r = new room(id, code, name, text);
        r.addUser(userId);
        this.rooms.push(r);
    }

    getRoom(id) {
        var found = undefined;
        for (var i = 0; i < this.rooms.length; i++) {
            if (this.rooms[i].id === id) {
                found = this.rooms[i];
            }
        }
        return found;
    }

    getRoomByCode(code) {
        var found = undefined;
        for (var i = 0; i < this.rooms.length; i++) {
            if (this.rooms[i].code === code) {
                found = this.rooms[i];
            }
        }
        return found;
    }
}


exports.roomHandler = roomHandler;