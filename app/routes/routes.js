var ObjectID = require('mongodb').ObjectID;

module.exports = (app, db) => {

    /**
     * Inserting Song
     * URL: localhost:8000/insert_song
     * Description: Inserts song in database based on parameters passed in. NOTE: Artist ID for song must already exist in database, so it is vital
     *              to insert the artist for the song first before inserting the song.
     * HTTP Method: POST
     * Body parameters:
     *  - id
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
            id,
            title,
            artistID,
            year,
            mvLink,
            mvStartTime,
            danceLink,
            danceStartTime,
            difficulty,
            duration,
        } = req.body;
        
        if ((!id && id !== 0) || (!artistID && artistID !== 0) || !year || !title || !mvLink || !mvStartTime || (!difficulty && difficulty !== 0) || !duration) {
            responseBody = { success: false, message: 'Invalid parameter passed in for song, please check your parameters before inserting song.' };
            res.send(JSON.stringify(responseBody));
            return;
        }

        const song = {
            _id: Number(id),
            title,
            artist_id: Number(artistID),
            year: Number(year),
            mv: {
                link: mvLink,
                start_time: Number(mvStartTime),
            },
            dance: {
                link: danceLink,
                start_time: Number(danceStartTime),
            },
            difficulty: Number(difficulty),
            duration: Number(duration),
        };

        db.collection('artists').findOne({_id: {$eq: song.artist_id}})
            .then((artist) => {
                if (artist) {   // Artist exists, so we can safely add it to database
                    db.collection('songs').insert(song, (err, results) => {
                        if (err) {
                            responseBody = { success: false, message: 'Failed to insert song on database. Message: ' + err };
                        } else {
                            responseBody = { success: true, message: 'Successfully inserted song!', result: results.ops[0] };
                        }
                        res.send(JSON.stringify(responseBody));
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
     *  - id
     *  - name
     */
    app.post('/insert_artist', (req, res) => {
        let responseBody;
        const {
            id,
            name,
        } = req.body;
        
        if ((!id && id !== 0) || !name) {
            responseBody = { success: false, message: 'Invalid parameter passed in for artist, please check your parameters before inserting artist.' };
            res.send(JSON.stringify(responseBody));
            return;
        }

        const artist = {
            _id: Number(id),
            name,
        };

        db.collection('artists').findOne({name}, (err, artist) => {
            if (err) {
                responseBody = { success: false, message: 'Error finding if artist exists in database.' };
                res.send(JSON.stringify(responseBody));
            } else {
                if (artist) {
                    responseBody = { success: false, message: 'Artist already exists in database.' };
                    res.send(JSON.stringify(responseBody));
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
     *  - id
     *  - name
     *  - isPreset (boolean)
     *  - songIDs (array of song IDs)
     */
    app.post('/insert_playlist', (req, res) => {
        let responseBody;
        const {
            id,
            name,
            isPreset,
            songIDs,
        } = req.body;
        
        if ((!id && id !== 0) || !name || (typeof isPreset === 'undefined' || isPreset === null) || (typeof songIDs === 'undefined' || songIDs === null)) {
            responseBody = { success: false, message: 'Invalid parameter passed in for playlist, please check your parameters before inserting playlist.' };
            res.send(JSON.stringify(responseBody));
            return;
        }

        const playlist = {
            _id: Number(id),
            name,
            isPreset: isPreset === 'true',
            song_ids: songIDs ? JSON.parse(songIDs) : [],
        };

        db.collection('playlists').insert(playlist, (err, results) => {
            if (err) {
                responseBody = { success: false, message: 'Failed to insert playlist on database. Message: ' + err };
            } else {
                responseBody = { success: true, message: 'Successfully inserted playlist!', result: results.ops[0] };
            }
            res.send(JSON.stringify(responseBody));
        });
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

        songID = Number(songID);
        playlistID = Number(playlistID);
        
        if ((!songID && songID !== 0) || (!playlistID && playlistID !== 0)) {
            responseBody = { success: false, message: 'Invalid parameter passed in for inserting song in playlist, please check your parameters before inserting song in playlist.' };
            res.send(JSON.stringify(responseBody));
            return;
        }

        db.collection('songs').findOne({_id: {$eq: songID}})
            .then((song) => {
                if (song) {   // Song exists, so we can safely add it to a playlist
                    db.collection('playlists').update({_id: {$eq: playlistID}}, { $push: { song_ids: song._id } })
                        .then((success) => {
                            responseBody = { success: success.ok ? true : false, message: success.ok ? 'Successfully updated song into playlist!' : 'Playlist does not exist!' };
                            res.send(JSON.stringify(responseBody));
                        });

                } else {    // Song doesn't exist, so cannot insert song
                    responseBody = { success: false, message: 'Song does not exist.' };
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
    app.get('/playlist/:id/:amount', (req, res) => {
        let responseBody;
        let {
            id,
            amount
        } = req.params;

        amount = Number(amount);

        db.collection('playlists').findOne({_id: Number(id)}, (err, playlist) => {
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

                    db.collection('artists').find({name: {$regex: queryStr, $options: 'i'}}).limit(5)
                        .toArray((err, artists) => {
                            if (err) {
                                responseBody = { success: false, message: 'Error finding artists in database.' };
                                res.send(JSON.stringify(responseBody));
                            } else {
                                responseBody.results = responseBody.results.concat(artists.map((artist) => Object.assign({}, artist, {type: 'artist'})));
                                
                                db.collection('songs').find({title: {$regex: queryStr, $options: 'i'}}).limit(5)
                                    .toArray((err, songs) => {
                                        if (err) {
                                            responseBody = { success: false, message: 'Error finding songs in database.' };
                                        } else {
                                            responseBody.results = responseBody.results.concat(songs.map((song) => Object.assign({}, song, {type: 'song'})));
                                        }
                                        res.send(JSON.stringify(responseBody));
                                    });

                            }
                        });
                }
            });
    });
};