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

    const fillSongsWithArtistNames = (songs, amount, likes, plays, res) => {
        let responseBody = { success: true, songs: [] };       
        amount = Math.min(songs.length, amount); 
        
        songs.forEach((song) => {
            db.collection('artists').findOne({_id: ObjectID(song.artist_id)}, (err, artist) => {
                if (err) {
                    responseBody = { success: false, message: 'Failed to find artist for song.' };
                } else {
                    responseBody.songs.push(Object.assign({}, song, {artist: artist.name}));
                    if (responseBody.songs.length === amount) {
                        responseBody.likes = likes;
                        responseBody.plays = plays;
                        res.send(JSON.stringify(responseBody));
                    }
                }
            });
        });
    };

    const findSongObjectsFromIds = (songIds, amount, likes, plays, res) => {
        let responseBody = { success: true, songs: [] };        

        db.collection('songs').find({_id: {$in: songIds}}).toArray((err, songs) => {
            if (err) {
                responseBody = { success: false, message: 'Failed to find song within playlist. Please check playlist.' };
            } else {
                responseBody.likes = likes;
                responseBody.plays = plays;
                responseBody.songs = [];    // TODO: Something wrong with logic here, we create responseBody but we use the response parameter in the next function
                fillSongsWithArtistNames(songs, amount, likes, plays, res);
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
            author,
            source,
            type,
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
            author,
            source,
            likes: 0,
            plays: 0,
            type,
        };

        db.collection('artists').findOne({name}, (err, existingArtist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding if artist exists in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                if (existingArtist) {
                    let newParams = {};
                    if (imageUrl) newParams.imageUrl = imageUrl;
                    if (author) newParams.author = author;
                    if (source) newParams.source = source;
                    if (type) newParams.type = type;
                    if (!Object.keys(newParams).length) {
                        responseBody = { success: false, message: 'Artist already exists in database.' };
                        res.send(JSON.stringify(responseBody));
                    } else {
                        db.collection('artists').updateOne({_id: ObjectID(existingArtist._id)}, { $set: newParams })
                            .then((success) => {
                                responseBody = { success: success.ok ? true : false, message: success.ok ? 'Song already exists in database, modified changed parameters.' : 'Failed to modify parameters for existing song.', result: success };
                                res.send(JSON.stringify(responseBody));
                            });
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
     * Updating artist like count
     * URL: localhost:8000/update_artist_like/:artistId/:action
     * Description: Updates the artist like count by either incrementing or decrementing the count.
     * HTTP Method: POST
     * Body parameters:
     *  - id
     *  - action
     */
    app.put('/update_artist_like/:id/:action', (req, res) => {
        let responseBody;
        let {
            id,
            action,
        } = req.params;

        db.collection('artists').findOne({_id: ObjectID(id)}, (err, artist) => {
            if (err || !artist) {
                responseBody = { success: false, message: 'Error finding artist.' };
                res.send(JSON.stringify(responseBody));
            } else {
                const likes = Math.max(0, artist.likes + (action === 'inc' ? 1 : action === 'dec' ? -1 : 0));
                db.collection('artists').updateOne({_id: ObjectID(artist._id)}, { $set: { likes } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });

    /**
     * Updating playlist like count
     * URL: localhost:8000/update_playlist_like/:playlistId/:action
     * Description: Updates the playlist like count by either incrementing or decrementing the count.
     * HTTP Method: POST
     * Body parameters:
     *  - id
     *  - action
     */
    app.put('/update_playlist_like/:id/:action', (req, res) => {
        let responseBody;
        let {
            id,
            action,
        } = req.params;

        db.collection('playlists').findOne({_id: ObjectID(id)}, (err, playlist) => {
            if (err || !playlist) {
                responseBody = { success: false, message: 'Error finding playlist.' };
                res.send(JSON.stringify(responseBody));
            } else {
                let likes = playlist.likes ? playlist.likes : 0;
                likes = Math.max(0, likes + (action === 'inc' ? 1 : action === 'dec' ? -1 : 0));
                db.collection('playlists').updateOne({_id: ObjectID(playlist._id)}, { $set: { likes } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });

    /**
     * Updating year like count
     * URL: localhost:8000/update_year_like/:year/:action
     * Description: Updates the year like count by either incrementing or decrementing the count.
     * HTTP Method: POST
     * Body parameters:
     *  - year
     *  - action
     */
    app.put('/update_year_like/:year/:action', (req, res) => {
        let responseBody;
        let {
            year,
            action,
        } = req.params;

        db.collection('featured').findOne({type: 'years'}, (err, years) => {
            if (err || !years) {
                responseBody = { success: false, message: 'Error finding playlist.' };
                res.send(JSON.stringify(responseBody));
            } else {
                let likes = years.likes;
                let like = likes[year] ? likes[year] : 0;
                like = Math.max(0, like + (action === 'inc' ? 1 : action === 'dec' ? -1 : 0));
                likes[year] = like;
                db.collection('featured').updateOne({type: 'years'}, { $set: { likes } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });

    /**
     * Updating type like count
     * URL: localhost:8000/update_type_like/:type/:action
     * Description: Updates the type like count by either incrementing or decrementing the count.
     * HTTP Method: POST
     * Body parameters:
     *  - type
     *  - action
     */
    app.put('/update_type_like/:type/:action', (req, res) => {
        let responseBody;
        let {
            type,
            action,
        } = req.params;

        db.collection('featured').findOne({type: 'type'}, (err, typeData) => {
            if (err || !typeData) {
                responseBody = { success: false, message: 'Error finding type data: ' + err };
                res.send(JSON.stringify(responseBody));
            } else {
                let likes = typeData.likes;
                let like = likes[type] ? likes[type] : 0;
                like = Math.max(0, like + (action === 'inc' ? 1 : action === 'dec' ? -1 : 0));
                likes[type] = like;
                db.collection('featured').updateOne({type: 'type'}, { $set: { likes } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });

    /**
     * Increments artist play count
     * URL: localhost:8000/increment_artist_play/:artistId
     * Description: Increments the play count for an artist.
     * HTTP Method: POST
     * Body parameters:
     *  - id
     */
    app.put('/increment_artist_play/:id', (req, res) => {
        let responseBody;
        let {
            id,
        } = req.params;

        db.collection('artists').findOne({_id: ObjectID(id)}, (err, artist) => {
            if (err || !artist) {
                responseBody = { success: false, message: 'Error finding artist.' };
                res.send(JSON.stringify(responseBody));
            } else {
                const plays = artist.plays + 1;
                db.collection('artists').updateOne({_id: ObjectID(artist._id)}, { $set: { plays } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });

    /**
     * Increments playlist play count
     * URL: localhost:8000/increment_playlist_play/:id
     * Description: Increments the play count for a playlist.
     * HTTP Method: POST
     * Body parameters:
     *  - id
     */
    app.put('/increment_playlist_play/:id', (req, res) => {
        let responseBody;
        let {
            id,
        } = req.params;

        db.collection('playlists').findOne({_id: ObjectID(id)}, (err, playlist) => {
            if (err || !playlist) {
                responseBody = { success: false, message: 'Error finding playlist.' };
                res.send(JSON.stringify(responseBody));
            } else {
                const plays = (playlist.plays ? playlist.plays : 0) + 1;
                db.collection('playlists').updateOne({_id: ObjectID(playlist._id)}, { $set: { plays } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });

    /**
     * Increments year play count
     * URL: localhost:8000/increment_year_play/:year
     * Description: Increments the play count for a year.
     * HTTP Method: POST
     * Body parameters:
     *  - year
     */
    app.put('/increment_year_play/:year', (req, res) => {
        let responseBody;
        let {
            year,
        } = req.params;

        db.collection('featured').findOne({type: 'years'}, (err, years) => {
            if (err || !years) {
                responseBody = { success: false, message: 'Error finding playlist.' };
                res.send(JSON.stringify(responseBody));
            } else {
                let plays = years.plays;
                let play = plays[year] ? plays[year] : 0;
                plays[year] = play + 1;
                db.collection('featured').updateOne({type: 'years'}, { $set: { plays } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });

    /**
     * Increments type play count
     * URL: localhost:8000/increment_type_play/:type
     * Description: Increments the play count for a type.
     * HTTP Method: POST
     * Body parameters:
     *  - type
     */
    app.put('/increment_type_play/:type', (req, res) => {
        let responseBody;
        let {
            type,
        } = req.params;

        db.collection('featured').findOne({type: 'type'}, (err, typeData) => {
            if (err || !typeData) {
                responseBody = { success: false, message: 'Error finding type data: ' + err };
                res.send(JSON.stringify(responseBody));
            } else {
                let plays = typeData.plays;
                let play = plays[type] ? plays[type] : 0;
                plays[type] = play + 1;
                db.collection('featured').updateOne({type: 'type'}, { $set: { plays } })
                    .then((success) => {
                        responseBody = { success, result: success };
                        res.send(JSON.stringify(responseBody));
                    });
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
                    res.send(JSON.stringify(responseBody));
                } else {
                    db.collection('featured').findOne({type: 'years'}, (err, years) => {
                        if (err) {
                            responseBody = { success: false, message: 'Error finding year data in database.' };
                            res.send(JSON.stringify(responseBody));
                        } else {
                            let likes = years.likes[startYear];
                            let plays = years.plays[startYear];
                            fillSongsWithArtistNames(getRandomNElements(songs, amount), amount, likes, plays, res);
                        }
                    });
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
                                responseBody.likes = artist.likes;
                                responseBody.plays = artist.plays;
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
                    fillSongsWithArtistNames(randomSongs, amount, 0, 0, res);                                                            
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
                responseBody = { success: true, likes: playlist.likes, plays: playlist.plays, songs: [] };
                const songIDs = playlist.song_ids.map((id) => ObjectID(id));
                const resultSongIDs = getRandomNElements(songIDs, amount);
                let i = 0;
                findSongObjectsFromIds(resultSongIDs, amount, playlist.likes, playlist.plays, res);
            }
        });
    });

    /**
     * Gets a playlist from name and if it is a preset playlist.
     * URL: localhost:8000/playlist/name/isPreset
     * Description: Returns a playlist from name and if it is a preset playlist.
     * HTTP Method: GET
     * Body Parameters:
     *  - Artist ID
     *  - Artist Name
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
     * Getting a specified amount of random songs based on the artist type
     * URL: localhost:8000/playlistType/:type/:amount
     * HTTP Method: GET
     * Body Parameters:
     *  - Type of artist
     *  - Amount of songs to include
     */
    app.get('/playlistType/:type/:amount', (req, res) => {
        let responseBody;
        let {
            type,
            amount
        } = req.params;

        amount = Number(amount);
        switch (type) {     // Validate the correct artist type
            case 'Boy Group':
            case 'Girl Group':
            case 'Co-Ed Group':
            case 'Sub-Unit Group':
            case 'Solo':
                break;
            default:
                responseBody = { success: false, message: 'Error validating type. Passed in "' + type + '".' };
                res.send(JSON.stringify(responseBody));
                return;
        }

        db.collection('artists').find({ type })
            .toArray((err, artists) => {
                if (err) {
                    responseBody = { success: false, message: 'Error finding artists in database: ' + err };
                    res.send(JSON.stringify(responseBody));                                                
                } else {
                    let artistIDs = artists.map(artist => ObjectID(artist._id));
                    db.collection('songs').find({artist_id: {$in: artistIDs}})
                        .toArray((err, songs) => {
                            if (err) {
                                responseBody = { success: false, message: 'Error finding songs in database: ' + err };
                                res.send(JSON.stringify(responseBody));  
                            } else {
                                db.collection('featured').findOne({type: 'type'}, (err, typeData) => {
                                    if (err) {
                                        responseBody = { success: false, message: 'Error finding featured data: ' + err };
                                        res.send(JSON.stringify(responseBody));      
                                    } else {
                                        let key = type === 'Solo' ? 'Solo Artists' : type + 's';
                                        let likes = typeData.likes[key];
                                        let plays = typeData.plays[key];
                                        fillSongsWithArtistNames(getRandomNElements(songs, amount), amount, likes, plays, res);
                                    }
                                });
                            }
                        })                                                                 
                }
            });
    });

    /**
     * Getting all artists
     * URL: localhost:8000/artist/all
     * Description: Returns alls artists
     * HTTP Method: GET
     * Body Parameters: N/A
     */
    app.get('/artist/all', (req, res) => {
        let responseBody;

        db.collection('artists').find()
            .toArray((err, artists) => {
                if (err) {
                    responseBody = { success: false, message: 'Error collecting artists.' };
                } else {
                    responseBody = { success: true, artists };
                }
                res.send(JSON.stringify(responseBody));
            });
    });

    /**
     * Getting all songs from a given Artist
     * URL: localhost:8000/artist/songs/id
     * Description: Returns all the songs from a given artist
     * HTTP Method: GET
     * Body Parameters:
     *  - Artist ID
     */
    app.get('/artist/songs/:id', (req, res) => {
        let responseBody;
        let {
            id,
        } = req.params;

        db.collection('artists').findOne({_id: ObjectID(id)}, (err, artist) => {
            if (err || !artist) {
                responseBody = { success: false, message: 'Error finding artist.' };
                res.send(JSON.stringify(responseBody));
            } else {
                const artistName = artist.name;
                db.collection('songs').find({artist_id: ObjectID(id)})
                    .toArray((err, songs) => {
                        if (err) {
                            responseBody = { success: false, message: 'Error finding songs for artist.' };
                        } else {
                            responseBody = { success: true, songs: songs.map(song => Object.assign({}, {artist: artistName}, song)) };
                        }
                        res.send(JSON.stringify(responseBody));
                    });
            }
        });
    });
    
    /**
     * Gets a playlist from name and if it is a preset playlist.
     * URL: localhost:8000/featured/all
     * Description: Returns all the featured playlists shown on the home page.
     * HTTP Method: GET
     * Body Parameters: N/A
     */
    app.get('/featured/all', (req, res) => {
        let responseBody = {};

        db.collection('playlists').find()
            .toArray((err, playlists) => {
                if (err) {
                    responseBody = { success: false, message: 'Error finding playlists in database.' };
                    res.send(JSON.stringify(responseBody));
                } else {
                    responseBody.playlists = playlists.map(playlist => {
                        delete playlist.song_ids;
                        return playlist;
                    });
                    
                    db.collection('featured').findOne({type: 'artists'}, (err, featuredArtists) => {
                        if (err) {
                            responseBody = { success: false, message: 'Error finding featured playlists in database.' };
                            res.send(JSON.stringify(responseBody));
                        } else {
                            db.collection('artists').find({name: {$in: featuredArtists.names}})
                                .toArray((err, artists) => {
                                    if (err) {
                                        responseBody = { success: false, message: 'Error finding featured artists in database.' };
                                        res.send(JSON.stringify(responseBody));
                                    } else {
                                        responseBody.artists = artists;

                                        db.collection('featured').findOne({type: 'years'}, (err, years) => {
                                            if (err) {
                                                responseBody = { success: false, message: 'Error finding featured years in database.' };
                                                res.send(JSON.stringify(responseBody));
                                                
                                            } else {
                                                responseBody.years = years;

                                                db.collection('featured').findOne({type: 'type'}, (err, types) => {
                                                    if (err) {
                                                        responseBody = { success: false, message: 'Error finding featured types in database.' };    
                                                        res.send(JSON.stringify(responseBody));
                                                    } else {
                                                        responseBody.types = types;

                                                        db.collection('artists').find()
                                                            .toArray((err, artists) => {
                                                                if (err) {
                                                                    responseBody = { success: false, message: 'Error collecting all artists.' };
                                                                    res.send(JSON.stringify(responseBody));
                                                                } else {
                                                                    responseBody.allArtists = artists;
                                                                }
                                                                res.send(JSON.stringify(responseBody));
                                                            });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                        }
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