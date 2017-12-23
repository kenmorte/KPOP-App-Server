module.exports = (app, db) => {
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

        db.collection('songs').insert(song, (err, results) => {
            if (err) {
                responseBody = { success: false, message: 'Failed to insert song on database. Message: ' + err };
            } else {
                responseBody = { success: true, message: 'Successfully inserted song!', result: results.ops[0] };
            }
            res.send(JSON.stringify(responseBody));
        });
    });
};