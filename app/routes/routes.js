var ObjectID = require('mongodb').ObjectID;

const getRandomNElements = (items, n) => {
    let res = [];
    n = Math.min(n, items.length);
    while (res.length < n) {
        const randomIndex = Math.floor(Math.random()*items.length);
        res.push(items[randomIndex]);
        items.splice(randomIndex, 1);
    }
    return res;
};

module.exports = (app, db) => {

    const fillSongsWithArtistNames = (songs, amount, res) => {
        let responseBody = { success: true, songs: [] };        
        
        songs.forEach((song) => {
            db.collection('artists').findOne({_id: ObjectID(song.artist_id)}, (err, artist) => {
                if (err) {
                    responseBody = { success: false, message: 'Failed to find artist for song.' };
                } else {
                    responseBody.songs.push(Object.assign({}, song, {artist: artist.name}));
                    if (responseBody.songs.length === amount) {
                        res.send(JSON.stringify(responseBody));
                    }
                }
            });
        });
    };

    const findSongObjectsFromIds = (songIds, amount, res) => {
        let responseBody = { success: true, songs: [] };        

        db.collection('songs').find({_id: {$in: songIds}}).toArray((err, songs) => {
            if (err) {
                responseBody = { success: false, message: 'Failed to find song within playlist. Please check playlist.' };
            } else {
                responseBody.songs = [];
                fillSongsWithArtistNames(songs, amount, res);
            }
        });
    };

    /**
     * Inserting Song
     * URL: localhost:8000/insert_song
     * Description: Inserts song in database based on parameters passed in. NOTE: Artist ID for song must already exist in database, so it is vital
     *              to insert the artist for the song first before inserting the song.
     * HTTP Method: POST
     * Body parameters:
     *  - title
     *  - artistID
     *  - year
     *  - mvLink
     *  - mvStartTime
     *  - danceLink
     *  - danceStartTime
     *  - difficulty
     *  - duration
     */
    app.post('/insert_song', (req, res) => {
        let responseBody;
        const {
            title,
            artistName,
            year,
            mvLink,
            mvStartTime,
            danceLink,
            danceStartTime,
            difficulty,
            duration,
        } = req.body;
        
        if (!artistName || !year || !title || !mvLink || !mvStartTime || (!difficulty && difficulty !== 0) || !duration) {
            responseBody = { success: false, message: 'Invalid parameter passed in for song, please check your parameters before inserting song.' };
            res.send(JSON.stringify(responseBody));
            return;
        }

        const song = {
            title,
            year: Number(year),
            mv: {
                link: mvLink,
                start_time: Number(mvStartTime),
            },
            dance: {
                link: danceLink,
                start_time: Number(danceStartTime),
            },
            difficulty: difficulty,
            duration: Number(duration),
        };

        db.collection('artists').findOne({name: artistName})
            .then((artist) => {
                if (artist) {   // Artist exists, so we can safely add it to database
                    song.artist_id = artist._id;

                    db.collection('songs').findOne({title, artist_id: ObjectID(artist._id)}, (err, existingSong) => {
                        if (err) {
                            responseBody = { success: false, message: 'Failed to search for existing song on database. Message: ' + err };
                            res.send(JSON.stringify(responseBody));                            
                        } else {
                            if (existingSong) {
                                responseBody = { success: false, message: 'Duplicate song found for "' + title + '" by ' + artist.name + '. Quitting operation.' };
                                res.send(JSON.stringify(responseBody));                                
                            } else {
                                db.collection('songs').insert(song, (err, results) => {
                                    if (err) {
                                        responseBody = { success: false, message: 'Failed to insert song on database. Message: ' + err };
                                    } else {
                                        responseBody = { success: true, message: 'Successfully inserted song!', result: results.ops[0] };
                                    }
                                    res.send(JSON.stringify(responseBody));
                                });
                            }
                        }
                    });
                } else {    // Artist doesn't exist, so cannot insert song
                    responseBody = { success: false, message: 'Artist does not exist for song "' + title + '".' };
                    res.send(JSON.stringify(responseBody));
                }
            });
    });

    /**
     * Inserting Artist
     * URL: localhost:8000/insert_artist
     * Description: Inserts artist in database.
     * HTTP Method: POST
     * Body parameters:
     *  - name
     */
    app.post('/insert_artist', (req, res) => {
        let responseBody;
        let {
            id,
            name,
            imageUrl,
        } = req.body;
        
        if ((!id && id !== 0) || !name) {
            responseBody = { success: false, message: 'Invalid parameter passed in for artist, please check your parameters before inserting artist.' };
            res.send(JSON.stringify(responseBody));
            return;
        }
        if (!imageUrl) imageUrl = '';

        const artist = {
            name,
            imageUrl,
        };

        db.collection('artists').findOne({name}, (err, existingArtist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding if artist exists in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                if (existingArtist) {
                    if (imageUrl) {
                        db.collection('artists').updateOne({_id: ObjectID(existingArtist._id)}, { $set: { imageUrl } })
                            .then((success) => {
                                responseBody = { success: success.ok ? true : false, message: success.ok ? 'Song already exists in database, modified image URL.' : 'Failed to modify image URL for existing song.', result: success };
                                res.send(JSON.stringify(responseBody));
                            });
                    } else {
                        responseBody = { success: false, message: 'Artist already exists in database.' };
                        res.send(JSON.stringify(responseBody));
                    }
                } else {
                    db.collection('artists').insert(artist, (err, results) => {
                        if (err) {
                            responseBody = { success: false, message: 'Failed to insert artist on database. Message: ' + err };
                        } else {
                            responseBody = { success: true, message: 'Successfully inserted artist!', result: results.ops[0] };
                        }
                        res.send(JSON.stringify(responseBody));
                    });
                }
            }
        });
    });

    /**
     * Inserting Playlist
     * URL: localhost:8000/insert_playlist
     * Description: Inserts playlist in database.
     * HTTP Method: POST
     * Body parameters:
     *  - name
     *  - isPreset (boolean)
     *  - songIDs (array of song IDs)
     */
    app.post('/insert_playlist', (req, res) => {
        let responseBody;
        const {
            name,
            isPreset,
            songIDs,
        } = req.body;
        
        if (!name || (typeof isPreset === 'undefined' || isPreset === null) || (typeof songIDs === 'undefined' || songIDs === null)) {
            responseBody = { success: false, message: 'Invalid parameter passed in for playlist, please check your parameters before inserting playlist.' };
            res.send(JSON.stringify(responseBody));
            return;
        }

        const playlist = {
            name,
            isPreset: isPreset.toUpperCase() === 'TRUE',
            song_ids: songIDs ? JSON.parse(songIDs) : [],
        };


        if (isPreset) {
            db.collection('playlists').findOne({name, isPreset: true}, (err, existingPlaylist) => {
                if (err) {
                    responseBody = { success: false, message: 'Failed to search for existing playlist in database.' };
                    res.send(JSON.stringify(responseBody));                    
                } else {
                    if (existingPlaylist) {
                        responseBody = { success: false, message: 'Duplicate preset playlist found. Quitting operation.' };
                        res.send(JSON.stringify(responseBody));   
                    } else {
                        db.collection('playlists').insert(playlist, (err, results) => {
                            if (err) {
                                responseBody = { success: false, message: 'Failed to insert playlist on database. Message: ' + err };
                            } else {
                                responseBody = { success: true, message: 'Successfully inserted playlist!', result: results.ops[0] };
                            }
                            res.send(JSON.stringify(responseBody));
                        });
                    }
                }
            });
        } else {
            db.collection('playlists').insert(playlist, (err, results) => {
                if (err) {
                    responseBody = { success: false, message: 'Failed to insert playlist on database. Message: ' + err };
                } else {
                    responseBody = { success: true, message: 'Successfully inserted playlist!', result: results.ops[0] };
                }
                res.send(JSON.stringify(responseBody));
            });
        }
    });

    /**
     * Inserting Song into Playlist
     * URL: localhost:8000/insert_song_in_playlist
     * Description: Inserts song into a playlist to allow it to be one of the randomly chosen songs.
     * HTTP Method: POST
     * Body parameters:
     *  - songID
     *  - playlistID
     */
    app.post('/insert_song_in_playlist', (req, res) => {
        let responseBody;
        let {
            songID,
            playlistID,
        } = req.body;
        
        if (!songID || !playlistID) {
            responseBody = { success: false, message: 'Invalid parameter passed in for inserting song in playlist, please check your parameters before inserting song in playlist.' };
            res.send(JSON.stringify(responseBody));
            return;
        }

        db.collection('playlists').update({_id: ObjectID(playlistID)}, { $push: { song_ids: songID } })
            .then((success) => {
                responseBody = { success: success.ok ? true : false, message: success.ok ? 'Successfully updated song into playlist!' : 'Playlist does not exist!' };
                res.send(JSON.stringify(responseBody));
            });
    });

    /**
     * Getting Random Songs from the "Easy" Playlist
     * URL: localhost:8000/playlist/easy/:amount
     * Description: Returns a random amount of songs from the "Easy" playlist
     * HTTP Method: GET
     * Body Parameters:
     *  - Amount of songs to include
     */
    app.get('/playlistEasy/:amount', (req, res) => {
        let responseBody;
        let {
            id,
            amount
        } = req.params;

        amount = Number(amount);

        db.collection('playlists').findOne({name: 'Easy'}, (err, playlist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding "Easy" playlist in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                responseBody = { success: true, songs: [] };
                const songIDs = playlist.song_ids.map((id) => ObjectID(id));
                const resultSongIDs = getRandomNElements(songIDs, amount);
                let i = 0;
                findSongObjectsFromIds(resultSongIDs, amount, res);
            }
        });
    });

    /**
     * Getting Random Songs from the "Medium" Playlist
     * URL: localhost:8000/playlistMedium/:amount
     * Description: Returns a random amount of songs from the "Medium" playlist
     * HTTP Method: GET
     * Body Parameters:
     *  - Amount of songs to include
     */
    app.get('/playlistMedium/:amount', (req, res) => {
        let responseBody;
        let {
            id,
            amount
        } = req.params;

        amount = Number(amount);

        db.collection('playlists').findOne({name: 'Medium'}, (err, playlist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding "Medium" playlist in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                responseBody = { success: true, songs: [] };
                const songIDs = playlist.song_ids.map((id) => ObjectID(id));
                const resultSongIDs = getRandomNElements(songIDs, amount);
                let i = 0;
                findSongObjectsFromIds(resultSongIDs, amount, res);
            }
        });
    });

    /**
     * Getting Random Songs from the "Hard" Playlist
     * URL: localhost:8000/playlistHard/:amount
     * Description: Returns a random amount of songs from the "Hard" playlist
     * HTTP Method: GET
     * Body Parameters:
     *  - Amount of songs to include
     */
    app.get('/playlistHard/:amount', (req, res) => {
        let responseBody;
        let {
            id,
            amount
        } = req.params;

        amount = Number(amount);

        db.collection('playlists').findOne({name: 'Hard'}, (err, playlist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding "Hard" playlist in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                responseBody = { success: true, songs: [] };
                const songIDs = playlist.song_ids.map((id) => ObjectID(id));
                const resultSongIDs = getRandomNElements(songIDs, amount);
                let i = 0;
                findSongObjectsFromIds(resultSongIDs, amount, res);
            }
        });
    });

    /**
     * Getting Random Songs from the "Hard" Playlist
     * URL: localhost:8000/playlistHard/:amount
     * Description: Returns a random amount of songs from the "Hard" playlist
     * HTTP Method: GET
     * Body Parameters:
     *  - Amount of songs to include
     */
    app.get('/playlistYear/:startYear/:endYear/:amount', (req, res) => {
        let responseBody;
        let {
            id,
            amount,
            startYear,
            endYear,
        } = req.params;

        startYear = Number(startYear);
        endYear = Number(endYear);
        amount = Number(amount);

        let yearRange = [];
        for (let year = startYear; year <= endYear; year++) yearRange.push(year);

        responseBody = { success:true, results: [] };

        db.collection('songs').find({year: {$in: yearRange }})
            .toArray((err, songs) => {
                if (err) {
                    responseBody = { success: false, message: 'Error finding songs in database.' };
                } else {
                    const randomSongs = getRandomNElements(songs, amount);
                    fillSongsWithArtistNames(randomSongs, randomSongs.length, res);
                }        
            });
    });

    /**
     * Getting Random Songs from an artist
     * URL: localhost:8000/playlistArtist/:artistName/:amount
     * Description: Returns random songs up to a parameterized amount of a certain artist
     * HTTP Method: GET
     * Body Parameters:
     *  - Artist name
     *  - Amount of songs to include
     */
    app.get('/playlistArtist/:artistName/:amount', (req, res) => {
        let responseBody;
        let {
            artistName,
            amount,
        } = req.params;
        
        amount = Number(amount);
        responseBody = { success:true, songs: [] };

        db.collection('artists').findOne({name: { $regex: artistName, $options: 'i' } }, (err, artist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding artist in database: ' + err };
                res.send(JSON.stringify(responseBody));
            } else {
                if (!artist) {
                    responseBody = { success: false, message: 'Artist not found in database.' };
                    res.send(JSON.stringify(responseBody));
                } else {
                    const artistId = ObjectID(artist._id);
                    
                    db.collection('songs').find({artist_id: artistId})
                        .toArray((err, songs) => {
                            if (err) {
                                responseBody = { success: false, message: 'Error finding songs in database.' };
                                res.send(JSON.stringify(responseBody));                                                
                            } else {
                                responseBody.songs = getRandomNElements(songs, amount).map((song) => Object.assign({}, song, {artist: artistName}));
                                res.send(JSON.stringify(responseBody));                                                                                
                            }
                        });
                }
            }
        });
    });

    /**
     * Getting Random Songs from all possible set of songs
     * URL: localhost:8000/playlistRandom/:amount
     * Description: Returns random songs from all possible sets of songs
     * HTTP Method: GET
     * Body Parameters:
     *  - Amount of songs to include
     */
    app.get('/playlistRandom/:amount', (req, res) => {
        let responseBody;
        let {
            amount,
        } = req.params;
        
        amount = Number(amount);
        responseBody = { success:true, songs: [] };

        db.collection('songs').find({})
            .toArray((err, songs) => {
                if (err) {
                    responseBody = { success: false, message: 'Error finding songs in database.' };
                    res.send(JSON.stringify(responseBody));                                                
                } else {
                    const randomSongs = getRandomNElements(songs, amount);
                    fillSongsWithArtistNames(randomSongs, amount, res);                                                            
                }
            });
    });

    /**
     * Getting Random Songs from a playlist by ID
     * URL: localhost:8000/playlistId/:id/:amount
     * HTTP Method: GET
     * Body Parameters:
     *  - ID of playlist
     *  - Amount of songs to include
     */
    app.get('/playlistId/:id/:amount', (req, res) => {
        let responseBody;
        let {
            id,
            amount
        } = req.params;

        id = ObjectID(id);
        amount = Number(amount);

        db.collection('playlists').findOne({_id: id}, (err, playlist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding playlist by ID in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                responseBody = { success: true, songs: [] };
                const songIDs = playlist.song_ids.map((id) => ObjectID(id));
                const resultSongIDs = getRandomNElements(songIDs, amount);
                let i = 0;
                findSongObjectsFromIds(resultSongIDs, amount, res);
            }
        });
    });

    /**
     * Gets a playlist from name and if it is a preset playlist.
     * URL: localhost:8000/playlist/name/isPreset
     * Description: Returns a playlist from name and if it is a preset playlist.
     * HTTP Method: GET
     * Body Parameters:
     *  - name
     *  - isPreset
     */
    app.get('/playlist/:name/:isPreset', (req, res) => {
        let responseBody;
        let {
            name,
            isPreset
        } = req.params;

        db.collection('playlists').findOne({name, isPreset: isPreset.toUpperCase() === 'TRUE'}, (err, playlist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding playlist in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                if (!playlist) {
                    responseBody = { success: false, message: 'No playlist found with name "' + name + '" and isPreset set to ' + isPreset + '.' };
                } else {
                    responseBody = { success: true, result: playlist };
                }
                res.send(JSON.stringify(responseBody));                
            }
        });
    });

    /**
     * Getting Random Songs from a given Playlist
     * URL: localhost:8000/playlist/id/amount
     * Description: Returns a random amount of songs from a given playlist
     * HTTP Method: GET
     * Body Parameters:
     *  - Playlist ID
     *  - Amount of songs to include
     */
    app.get('/playlist/random/:id/:amount', (req, res) => {
        let responseBody;
        let {
            id,
            amount
        } = req.params;

        amount = Number(amount);

        db.collection('playlists').findOne({_id: ObjectID(id)}, (err, playlist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding playlist in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                responseBody = { success: true, songs: [] };
                const songIDs = playlist.song_ids;
                const randomSongIDs = songIDs.sort(() => .5 - Math.random());
                const resultSongIDs = randomSongIDs.slice(0,Math.min(amount, randomSongIDs.length));
                let i = 0;

                db.collection('songs').find({_id: {$in: resultSongIDs}}).toArray((err, songs) => {
                    if (err) {
                        responseBody = { success: false, message: 'Failed to find song within playlist. Please check playlist.' };
                    } else {
                        responseBody.songs = songs;
                    }
                    res.send(JSON.stringify(responseBody));
                });
            }
        });
    });

    /**
     * Getting all playlists, songs, and artists by some generalized search query.
     * URL: localhost:8000/search/queryStr
     * Description: Returns all playlists, songs, and artists by some generalized search query.
     * HTTP Method: GET
     * Body Parameters:
     *  - queryStr
     */
    app.get('/search/:queryStr', (req, res) => {
        let responseBody = { success: true, results: [] };
        let {
            queryStr
        } = req.params;

        if (!queryStr) queryStr = '';

        db.collection('playlists').find({name: {$regex: queryStr, $options: 'i'}}).limit(5)
            .toArray((err, playlists) => {
                if (err) {
                    responseBody = { success: false, message: 'Error finding playlists in database.' };
                    res.send(JSON.stringify(responseBody));
                } else {
                    responseBody.results = responseBody.results.concat(playlists.map((playlist) => Object.assign({}, playlist, {type: 'playlist'})));

                    db.collection('artists').find({name: {$regex: queryStr, $options: 'i'}}).limit(10)
                        .toArray((err, artists) => {
                            if (err) {
                                responseBody = { success: false, message: 'Error finding artists in database.' };
                                res.send(JSON.stringify(responseBody));
                            } else {
                                responseBody.results = responseBody.results.concat(artists.map((artist) => Object.assign({}, artist, {type: 'artist'})));
                                const artistIDs = artists.map((artist) => ObjectID(artist._id));

                                db.collection('songs').find({$or: [{artist_id: {$in: artistIDs}}, {title: {$regex: queryStr, $options: 'i'}}]}).limit(10)
                                    .toArray((err, songs) => {
                                        if (err) {
                                            responseBody = { success: false, message: 'Error finding songs in database.' };
                                            res.send(JSON.stringify(responseBody));                                            
                                        } else {
                                            const amount = responseBody.results.length + songs.length;

                                            if (!songs.length) {
                                                res.send(JSON.stringify(responseBody)); 
                                            } else {
                                                songs.forEach((song) => {
                                                    db.collection('artists').findOne({_id: ObjectID(song.artist_id)}, (err, artist) => {
                                                        if (err) {
                                                            responseBody = { success: false, message: 'Failed to find artist for song.' };
                                                            res.send(JSON.stringify(responseBody));    
                                                        } else {
                                                            responseBody.results.push(Object.assign({}, song, {artist: artist.name, imageUrl: artist.imageUrl, type: 'song'}));
                                                            if (responseBody.results.length === amount) {
                                                                res.send(JSON.stringify(responseBody));
                                                            }
                                                        }
                                                    });
                                                });
                                            }
                                        }
                                    });

                            }
                        });
                }
            });
    });
};