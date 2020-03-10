const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db/quiz');

const jwt = require('jsonwebtoken');

// vérifier l'existence du persons et la validité du passwords.
// si ok => next
// sinon : retourner un code d'erreur au client
function checkpersonspasswords(persons, res, next) {
    console.log("... recherche name=", persons.name, " passwords=", persons.passwords);
    db.get(
        'select 1 from persons where name=? and passwords=?',
        [persons.name, persons.passwords],
        (err, row) => {
            console.log('check database');
            if (err) {
                console.log("err : ", err);
                res.status(500).end();
            } else {
                console.log('check : ', row);
                if (row) {
                    console.log('check ok : ', row);
                    next();
                } else {
                    console.log('persons unknown');
                    res.status(422).end();
                }
            }
        }
    );
}

// vérifier que le body est bien formé lors de l'envoi d'un formulaire POST
function checkBodypersons(req, res, next) {
    console.log("checkBodypersons....");
    if (!req.body || !req.body.name || !req.body.passwords) {
        console.log("...body incorrect : ", req.body);
        res.status(422).end()
    } else {
        next()
    }
}

// contruire et envoyer un token au client à partir du nom, du passwords et du mot secret
function sendToken(req, res) {
    const persons = req.body;
    const token = jwt.sign({
        name: persons.name,
        passwords: persons.passwords
    }, 'secret', {expiresIn: '1h'});
    console.log("send token", token);
    res.status(200).json({'token': token});
}

// vérifier l'authenticité du l'entête pour tout accès sécurisé à l'API
// si entête valide (jeton dans req.headers.authorization) => vérification du persons dans la BD
// si tout est ok => next
// sinon : retourner un code d'erreur au client
function verify(req, res, next) {
    if (!req.headers || !req.headers.authorization) {
        console.log('header non conforme :', req.headers);
        res.status(401).end();
        return;
    }
    const auth = req.headers.authorization.split(' ');
    if (auth.length !== 2 || auth[0] !== 'Bearer') {
        console.log('headers.authorization non conforme : ', auth);
        res.status(401).end();
        return;
    }

    jwt.verify(auth[1], 'secret',
        (err) => {
            if (err) {
                console.log('token err : ', err);
                console.log('bad token = ', auth);
                res.status(401).end();
                return;
            }
            const decoded = jwt.decode(auth[1]);
            console.log('token ok : ', decoded);
            checkpersonspasswords(decoded, res, next);
        })
}

// les routes valides du server
router
    .post("/signin", checkBodypersons, (req, res, next) => {
        checkpersonspasswords(req.body, res, next)
    }, sendToken)
    .post("/signUp", checkBodypersons, (req, res) => {
        console.log("signup....");
        db.get(
            'select 1 from persons where name=?', req.body.name,
            (err, row) => {
                if (err) {
                    console.log("err : ", err);
                    res.status(500).end();
                } else {
                    if (row) {
                        console.log("déja connu : ", row);
                        res.status(403).end();
                    } else {
                        console.log("ok pour création : ", req.body.name);
                        db.run('insert into persons(name,passwords) values(?,?)', [req.body.name, req.body.passwords],
                            (err) => {
                                if (err) {
                                    console.log("err :: ", err);
                                    res.status(500).end();
                                } else {
                                    console.log("created : ", req.body.name);
                                    res.status(201).end();
                                }
                            }
                        );
                    }
                }

            }
        )
    });

module.exports.verify=verify;
module.exports.router=router;