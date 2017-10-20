/*

lymme shopping list

© Pertti Roitto 2017

*/

class lymme {
    constructor() {
        //open socket connection
        this.socket = io("https://localhost", {
            secure: true
        });
        this.connected = false;
        this.room = undefined;
        this.input = undefined;
        this.items = [];
        this.clientId = undefined;

        this.editing = undefined;

        this.listEmpty = false;

        this.mobile = false;
    }

    init() {
        console.log("init done");
        this.socket.on("connect", this.onSocketConnected.bind(this));
        this.socket.on("disconnect", this.onSocketDisconnect.bind(this));

        this.socket.on("receiveRoomItems", this.renewRoomItems.bind(this));

        this.socket.on("addItem", this.addNewItem.bind(this));

        this.socket.on("editItem", this.editItem.bind(this));

        this.socket.on("removeItem", function (data) {
            const item = this.getItemById(data.id);
            item.element.className += " popout";
            setTimeout(function () {
                item.element.parentElement.removeChild(item.element);
            }, 200);
            this.items.splice(this.items.indexOf(item), 1);

            if (this.items.length === 0) {
                document.getElementById("shopListItems").innerHTML = "<div id='emptyList'>ʕ•ᴥ•ʔ<br>I'm empty list!</div>";
                this.listEmpty = true;
            }
        }.bind(this));

        this.socket.on("stopEdit", function (data) {
            var item = this.getItemById(data.id);
            item.element.removeAttribute("class");
            item.element.removeAttribute("style");
            item.rightbox.children[0].style.display = "flex";
            item.leftbox.children[0].style.display = "flex";
            //}
        }.bind(this));

        this.socket.on("addItemText", this.updateItemText.bind(this));

        this.socket.on("changeItemOrder", function (data) {
            //move inside the items array
            let item = this.getItemById(data.id);
            const itemIndex = this.items.indexOf(item);
            //console.log("this items index: " + itemIndex);
            if (itemIndex != data.toIndex) {
                this.arrayMove(this.items, data.fromIndex, data.toIndex);
                //then the li elements too
                const toIndex = parseInt(data.toIndex);
                const fromIndex = parseInt(data.fromIndex);

                const list = item.element.parentNode;

                const item1 = list.children[fromIndex];

                if (toIndex < fromIndex) {
                    list.insertBefore(item1, list.children[toIndex]);
                } else {
                    list.insertBefore(item1, list.children[toIndex].nextSibling);
                }

            }
        }.bind(this));

        this.socket.on("itemCheck", function (data) {
            let item = this.getItemById(data.id);
            //{ id: data.id, checked:data.checked })
            if (item) {
                this.setChecked(item, data.checked)
            }
        }.bind(this));

        this.input = document.getElementById("shoplistValue");
        const list = this.input;
        // shoplist
        list.addEventListener('keyup', this.typeUp.bind(this));

        //on keydown, clear the countdown 
        //list.addEventListener('keydown', this.typeDown.bind(this));

        document.getElementById("shopListItems").addEventListener('contextmenu', event => event.preventDefault());


        const sortable = Sortable.create(document.getElementById("shopListItems"), {
            delay: 0,
            onChoose: function ( /**Event*/ evt) {

                //if mobile mode is on, hide the mobile menu footer
                if (k.mobile == true) {
                    document.getElementById('shopListMobileMenu').style.display = "none";
                }
            },
            onUpdate: function (evt) {
                const itemEl = evt.item; // dragged HTMLElement
                //arr, fromIndex, toIndex
                k.arrayMove(k.items, evt.oldIndex, evt.newIndex);

                const id = itemEl.id.replace('item-', '');
                //console.log(id);
                k.socket.emit("changeItemOrder", {
                    id: id,
                    oldIndex: evt.oldIndex,
                    newIndex: evt.newIndex
                });

                //if mobile mode is on, display the mobile footer
                if (k.mobile == true) {
                    document.getElementById('shopListMobileMenu').style.display = "flex";
                }
            }
        });


        /*

        Make this part launch only when mobile is detected?

        */
        if (window.innerWidth <= 800) {

            this.mobile = true;

            //move adder to the mobile menu
            const adder = document.getElementById("shopListAdder");
            //document.getElementById('shopListMobileMenu').appendChild(adder);
            const footer = document.getElementById('shopListMobileMenu');
            footer.insertBefore(adder, footer.firstChild);
            document.getElementById("shopListAdder").style.display = "none"

            //add X -button to adder
            const x = document.createElement("div");
            x.setAttribute("id", "adderClose");
            x.setAttribute("class", "adderButton");
            //
            x.innerHTML += '<span class="fa fa-close lst-button"></span>';

            //add sender to adder
            const s = document.createElement("div");
            s.setAttribute("id", "adderSend");
            s.setAttribute("class", "adderButton");
            s.innerHTML += '<span class="fa fa-arrow-circle-right lst-button"></span>';


            adder.insertBefore(x, adder.firstChild);
            adder.appendChild(s);

            //add mobile menu list to the mobile bar too
            const menu = document.createElement("div");
            menu.setAttribute("id", "shoplistMenu");
            footer.insertBefore(menu, footer.firstChild)
            menu.style.display = "none"

            menu.innerHTML = "<ul>" +
                "</ul>";


            //add menu items
            this.openMenuAddChild("sort", "fa-sort", true, function (event) {
                if (event.target.collapsed === false || event.target.collapsed === undefined) {
                    event.target.children[2].classList.remove("fa-angle-down");
                    event.target.children[2].classList.add("fa-angle-up");

                    const el = document.createElement("li");
                    el.setAttribute("class", "collapsed");
                    event.target.collapsed = true;
                    //el.innerHTML = "<div class='collaps-div'><i class='fa fa-sort fa-fw'></i>Checked</div><div class='collaps-div'><i class='fa fa-sort-alpha-asc fa-fw'></i>Alphabetical</div>";
                    event.target.parentNode.insertBefore(el, event.target.nextSibling);

                    // add divs to the collapsed list
                    let div = document.createElement("div");
                    div.setAttribute("class", "collaps-div");
                    div.innerHTML = "<i class='fa fa-sort fa-fw'></i>Checked";
                    div.addEventListener("click", function () {
                        this.socket.emit("sortItemsBy", {
                            by: "checked"
                        });

                    }.bind(this));
                    el.appendChild(div);

                    div = document.createElement("div");
                    div.setAttribute("class", "collaps-div");
                    div.innerHTML = "<i class='fa fa-sort-alpha-asc fa-fw'></i>Alphabetical";
                    div.addEventListener("click", function () {
                        this.socket.emit("sortItemsBy", {
                            by: "AtoB"
                        });
                    }.bind(this));
                    el.appendChild(div);
                } else {
                    event.target.collapsed = false;
                    event.target.children[2].classList.remove("fa-angle-up");
                    event.target.children[2].classList.add("fa-angle-down");
                    event.target.parentNode.removeChild(event.target.nextSibling);
                }
            }.bind(this))

            this.openMenuAddChild("clear", "fa-trash-o", false, function () {
                if (this.items.length > 0)
                    if (confirm('Are you sure you want to clear the whole list?')) {
                        this.socket.emit("clearItems");
                    }
            }.bind(this))

            this.openMenuAddChild("privacy", "fa-lock", false, function () {
                console.log("open lock thingy");
            }.bind(this))

            this.openMenuAddChild("print", "fa-print", false, function () {
                if (this.items.length > 0) {
                    const mywindow = window.open('', 'PRINT', 'height=400,width=600');

                    mywindow.document.write('<html><head><title>' + document.title + '</title>');
                    mywindow.document.write('</head><body >');
                    mywindow.document.write('<h1>' + document.title + '</h1>');
                    //mywindow.document.write(document.getElementById("shoplistWrapper").innerHTML);
                    mywindow.document.write("<ul style='width:100%;list-style-type:none;'>");
                    for (var i = 0; i < this.items.length; i++) {
                        mywindow.document.write("<li>");
                        mywindow.document.write("<input type='checkbox'");
                        if (this.items[i].checked == true) {
                            mywindow.document.write("checked");
                        }
                        mywindow.document.write("></input>");

                        mywindow.document.write(this.items[i].text + "</li>");
                    }
                    mywindow.document.write('</ul></body></html>');

                    mywindow.document.close(); // necessary for IE >= 10
                    mywindow.focus(); // necessary for IE >= 10*/

                    mywindow.print();
                    mywindow.close();

                    return true;
                }
            }.bind(this))

            this.openMenuAddChild("share", "fa-share-alt", true, function () {
                if (event.target.collapsed === false || event.target.collapsed === undefined) {
                    event.target.children[2].classList.remove("fa-angle-down");
                    event.target.children[2].classList.add("fa-angle-up");

                    const el = document.createElement("li");
                    el.setAttribute("class", "collapsed");
                    event.target.collapsed = true;
                    event.target.parentNode.insertBefore(el, event.target.nextSibling);

                    /*


                    DIVS FOR DIFFERENT CHANNELS:

                    */

                    // add divs to the collapsed list
                    let div = document.createElement("div");
                    div.setAttribute("class", "collaps-div");
                    div.innerHTML = "<i class='fa fa-facebook fa-fw'></i>Facebook";
                    div.addEventListener("click", function () {

                    }.bind(this));
                    el.appendChild(div);

                    div = document.createElement("div");
                    div.setAttribute("class", "collaps-div");
                    div.innerHTML = "<i class='fa fa-twitter fa-fw'></i>Twitter";
                    div.addEventListener("click", function () {

                    }.bind(this));
                    el.appendChild(div);

                    div = document.createElement("div");
                    div.setAttribute("class", "collaps-div");
                    div.innerHTML = "<i class='fa fa-whatsapp fa-fw'></i>Whatsapp";
                    div.addEventListener("click", function () {

                    }.bind(this));
                    el.appendChild(div);

                    div = document.createElement("div");
                    div.setAttribute("class", "collaps-div");
                    div.innerHTML = "<i class='fa fa-envelope fa-fw'></i>Email";
                    div.addEventListener("click", function () {

                    }.bind(this));
                    el.appendChild(div);

                    /*

                    ----------------------------------------------


                    */
                } else {
                    event.target.collapsed = false;
                    event.target.children[2].classList.remove("fa-angle-up");
                    event.target.children[2].classList.add("fa-angle-down");
                    event.target.parentNode.removeChild(event.target.nextSibling);
                }

            }.bind(this))

            //if the adder gets clicks
            document.getElementById("openAdder").addEventListener("click", this.itemAdderSwitch);



            //if the menu is clicked
            document.getElementById("openMenu").addEventListener("click", this.openMenuSwitch);


            x.addEventListener("click", function () {
                //launch the click event of add button
                document.getElementById("openAdder").click();
            });

            s.addEventListener("click", function () {
                this.addTextHandler();
            }.bind(this));

            document.getElementById("shoplistWrapper").addEventListener("click", function () {
                this.itemAdderSwitch(true);
            }.bind(this))

        }

    }

    openMenuAddChild(child, icon, collapsing, functionCallback) {
        const menu = document.getElementById("shoplistMenu");

        const c = document.createElement("li");
        c.setAttribute("id", "shopMenu-" + child);
        menu.children[0].appendChild(c);
        //fa-sort-desc
        c.innerHTML = "<span class='fa " + icon + " icon-mobilemenu fa-fw'></span><span>" + child + "</span>";
        //c.innerHTML = "<span class='icon-"+icon+" icon-mobilemenu'></span><span>"+child+"</span>";
        if (collapsing == true) {
            c.setAttribute("class", "shopMenu-collapsing")
            c.innerHTML += "<span class='fa fa-angle-down icon-mobilecollapse'></span>";
        }

        c.addEventListener("click", functionCallback);
    }
    openMenuSwitch() {
        if (document.getElementById("shoplistMenu").style.display == "none") {
            document.getElementById("shoplistMenu").style.display = "block";
            document.getElementById("shoplistWrapper").style.marginBottom = "33vh";
            document.getElementById("shoplistValue").focus();
        } else {
            document.getElementById("shoplistMenu").style.display = "none";
            document.getElementById("shoplistWrapper").style.marginBottom = "10.1vh";
        }
    }

    itemAdderSwitch(close) {
        if (close != true) {
            if (document.getElementById("shopListAdder").style.display == "none") {
                document.getElementById("shopListAdder").style.display = "flex";
                document.getElementById("shoplistWrapper").style.marginBottom = "33vh";
                document.getElementById("shoplistValue").focus();
            } else {
                document.getElementById("shopListAdder").style.display = "none";
                document.getElementById("shoplistWrapper").style.marginBottom = "10.1vh";
            }
        } else {
            document.getElementById("shopListAdder").style.display = "none";
            document.getElementById("shoplistWrapper").style.marginBottom = "10.1vh";
        }

    }

    renewRoomItems(data) {
        console.log("adding items to room");
        if (data.text.length == 0) {
            document.getElementById("shopListItems").innerHTML = "<div id='emptyList'>ʕ•ᴥ•ʔ<br>I'm empty list!</div>";
            this.listEmpty = true;
        } else {
            document.getElementById("shopListItems").innerHTML = "";
        }
        this.items = [];
        for (var i = 0; i < data.text.length; i++) {
            //console.log("adding old entry");
            //console.log(data.text[i].id);
            this.addNewItem({
                id: data.text[i].id,
                text: data.text[i].text,
                editing: data.text[i].editing,
                checked: data.text[i].checked
            });
        }

    }

    addTextHandler() {
        this.input.value = this.input.value.replace(/(\r\n|\n|\r)/gm, "");
        ///console.log(this.input.value.length);
        if (this.input.value.length > 1) {
            //this.addNewItem(this.input.value);
            this.socket.emit("addText", {
                text: this.input.value
            });
        }
        this.input.value = "";
        this.input.focus();

    }

    typeUp(evt) {
        var charCode = evt.keyCode || evt.which;

        if (charCode === 13) {
            this.addTextHandler()
        }
    }
    addNewItem(data) {
        if (this.items.length >= 128) {
            document.getElementById("shoplistValue").readOnly = true;
            document.getElementById("shoplistValue").setAttribute("placeholder", "The list is full! Create another one, or remove items.");
            return false;
        }


        //if the lsit is empty, then remove the im empty whine
        if (this.listEmpty === true) {
            const emptyDiv = document.getElementById("emptyList");
            emptyDiv.parentElement.removeChild(emptyDiv);
            this.listEmpty = false;
        }

        const item = document.createElement("li");
        item.setAttribute("id", "item-" + data.id);
        // item.setAttribute("draggable", "true");
        const wrapper = document.getElementById("shopListItems");
        wrapper.appendChild(item);


        const socket = this.socket;
        const divL = document.createElement("div");
        const divC = document.createElement("div");
        const divR = document.createElement("div");
        divC.innerHTML = data.text;
        divC.style.width = "100%";
        divC.setAttribute("class", "lst-box");
        divL.setAttribute("class", "lst-left");
        divR.setAttribute("class", "lst-right");
        item.appendChild(divL);
        item.appendChild(divC);
        item.appendChild(divR);

        divC.addEventListener("dblclick", function (el) {
            //console.log("asking server for edit");
            var id = this.parentElement.id.replace('item-', '');
            socket.emit("editItem", {
                id: id
            });
        });

        this.addRemoveButton(divR);
        this.items.push({
            id: data.id,
            element: item,
            leftbox: divL,
            textbox: divC,
            rightbox: divR,
            text: data.text,
            checked: data.checked
        });
        this.addCheckbox(divL, data.checked);

        //check if the item is being edited
        if (data.editing != undefined) {
            console.log(data.editing + " " + this.clientId);
            if (data.editing === this.clientId) {
                console.log("olet edittaamassa");
                this.editing = undefined;
                this.editItem({
                    id: data.id,
                    editor: this.clientId
                });
            } else {
                item.className += " lst-editor";
                divR.children[0].style.display = "none";
                divL.children[0].style.display = "none";
            }
        } else {
            if (data.checked == false)
                item.className += " popin";
        }
    }

    editItem(data) {
        console.log(data);
        for (let i = 0; i < this.items.length; i++) {
            let id = this.items[i].element.id.replace('item-', '');
            if (id == data.id) {
                if (this.clientId === data.editor) {


                    /*
                        
                        if client is already editing something
                    
                    */
                    if (this.editing === undefined) {
                        this.editing = data.id;

                    } else {
                        let olditem = this.getItemById(this.editing)
                        olditem = olditem.textbox.children[0];
                        this.itemAccept({
                            target: olditem
                        });
                        this.editing = data.id;
                    }
                    this.items[i].leftbox.style.display = "none";

                    this.items[i].element.style.fontSize = "2em";

                    this.items[i].textbox.innerHTML = "";
                    const input = document.createElement("textarea");
                    /*input.setAttribute("type", "text");*/
                    input.value = this.items[i].text;
                    //input.setAttribute("value", this.items[i].text);
                    input.setAttribute("maxlength", "256");
                    input.setAttribute("rows", "1");
                    this.items[i].textbox.appendChild(input);
                    //launch this with timeout of 210ms, because the element has 0.2s transition animation :P
                    window.setTimeout(function () {
                        input.style.height = 'auto';
                        input.style.height = input.scrollHeight - 32 + 'px';
                    }, 210);
                    input.focus();
                    input.autofocus = true;
                    const client = this;
                    input.addEventListener('keyup', function (event) {
                        window.setTimeout(function () {
                            input.style.height = 'auto';
                            input.style.height = input.scrollHeight - 32 + 'px';
                        }, 0);

                        let id = event.target.parentElement.parentElement.id.replace('item-', '');
                        event = event || window.event;
                        var charCode = event.keyCode || event.which;
                        if (charCode != 13) {
                            const parent = this.getItemById(id);
                            parent.text = input.value;
                            client.socket.emit("itemAddText", {
                                id: id,
                                text: input.value
                            });
                        } else {
                            this.itemAccept({
                                target: input
                            });
                        }
                    }.bind(this));

                    //yes button
                    const yesbutton = document.createElement("span");
                    yesbutton.innerHTML = "";
                    yesbutton.className = "fa fa-check lst-button";
                    yesbutton.addEventListener("click", this.itemAccept.bind(this));
                    this.items[i].rightbox.innerHTML = "";
                    this.items[i].rightbox.appendChild(yesbutton);
                } else {
                    this.items[i].element.className = "lst-editor";
                    this.items[i].rightbox.children[0].style.display = "none";
                    this.items[i].leftbox.children[0].style.display = "none";
                }
            }
        }
    }

    itemAccept(event) {
        let item = event.target.parentElement.parentElement;
        const id = item.id.replace('item-', '');
        //console.log("asking for edit to stop");
        item = this.getItemById(id);
        this.removeItemEdit(item);
        this.socket.emit("itemEditDone", {
            itemId: id
        });
        this.editing = undefined;
    }

    removeItemEdit(item) {
        item.textbox.innerHTML = item.text;
        this.addRemoveButton(item.rightbox);
        item.leftbox.style.display = "flex";
    }

    addRemoveButton(parent) {
        //no button
        parent.innerHTML = "";
        const nobutton = document.createElement("span");
        nobutton.innerHTML = "";
        //nobutton.className = "lst-reject lst-button";
        nobutton.className = "fa fa-close lst-button";
        var id = parent.parentElement.id.replace('item-', '');
        nobutton.addEventListener("click", function () {
            this.socket.emit("itemRemove", {
                id: id
            });
        }.bind(this));
        parent.appendChild(nobutton);

    }

    addCheckbox(parent, checked) {
        const check = document.createElement("input");
        check.setAttribute("type", "checkbox");

        const id = parent.parentElement.id.replace('item-', '');
        check.addEventListener("click", function (event) {
            const elem = event.target;
            if (elem.checked) {
                this.socket.emit("itemCheck", {
                    id: id,
                    check: true
                });
                console.log("checking box");
            } else {
                this.socket.emit("itemCheck", {
                    id: id,
                    check: false
                });
                console.log("not checked");
            }
        }.bind(this));
        parent.appendChild(check);

        //console.log(id);
        const item = this.getItemById(id);
        //console.log(item);
        this.setChecked(item, checked)

    }

    setChecked(item, checked) {
        if (checked == true) {
            item.checked = true;
            item.element.classList.remove("popin");
            item.element.style.opacity = "0.2";
            item.leftbox.children[0].checked = true;
        } else {
            item.checked = false;
            item.element.classList.remove("popin");
            item.element.style.opacity = "1";
            item.leftbox.children[0].checked = false;
        }

    }

    updateItemText(data) {
        if (this.clientId !== data.editor) {
            //addItemText', {id:data.id,editor:data.editor,text:data.text});
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].id == data.id) {
                    this.items[i].text = data.text;
                    this.items[i].textbox.innerHTML = data.text;
                }
            }
        }
    }

    getItemById(toid) {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].id == toid) {
                return this.items[i];
            }
        }
    }

    arrayMove(arr, fromIndex, toIndex) {
        //console.log("OLD:");
        //console.log(arr[0]);
        var element = arr[fromIndex];
        arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, element);
        //console.log("NEW")
        //console.log(arr[0]);
    }

    onSocketConnected() {
        console.log("connected");
        this.clientId = this.socket.id;
        if (this.room !== undefined) {
            this.socket.emit("setRoom", {
                code: this.room
            });
        }
    }

    onSocketDisconnect() {
        console.log("Disconnected from socket server");
    }

    setRoom(id) {
        this.room = id;
        if (this.connected === true) {
            this.socket.emit("setRoom", {
                code: id
            });
        }
    }

}

const k = new lymme();
document.addEventListener('DOMContentLoaded', function () {
    k.init();
}, false);

/*

pug parser has issues with me (or im just stupid), so i took a this patent to use..

*/
function setRoom(id) {
    k.setRoom(id);
}