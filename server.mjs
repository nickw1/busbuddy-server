import express from 'express';
import { BODSClient, createBoundingBox } from 'bodsjs'
import 'dotenv/config';

import db from './db/db.mjs';

const app = express();
const bods = new BODSClient(process.env.API_KEY);


app.get('/', (req, res) => {
    res.send("Welcome to the busbuddy server");
});

let lastRequestTime = 0;

app.get('/live', async(req, res) => {
    const time = Date.now();
    const timePassed = time - lastRequestTime;
    const bbox = req.query.bbox || "-1.5,50.88,-1.3,50.95";
    if(timePassed > 5000) {
        const [ minLng, minLat, maxLng, maxLat ] = bbox.split(',');
        const result = await bods.fetchBusLocationDatafeed({
            boundingBox: createBoundingBox(minLat, maxLat, minLng, maxLng) 
        });
        lastRequestTime = time;
        res.json(result.Siri
                .ServiceDelivery
                .VehicleMonitoringDelivery
                .VehicleActivity);
    } else {
        const waitSeconds = Math.ceil((5000 - timePassed) / 1000);
        res.status(503).set({
            'Retry-After' : waitSeconds
        }).json({
            error: `Please retry in ${waitSeconds} seconds.`
        });
    }
});


app.get('/working/find', async(req, res) => {

    try {
        const run_days = req.query.run_days || 'Mo,Tu,We,Th,Fr';
        const dbres = await db.query("SELECT * FROM journeys WHERE analysed_block_ref=(SELECT analysed_block_ref FROM journeys WHERE route=$1 AND deptime=$2 AND direction=$3 AND run_days=$4) ORDER BY deptime", [req.query.route, req.query.deptime, req.query.direction, run_days]);
        res.json(dbres.rows);
    } catch(e) {
        if (e.routine == "DateTimeParseError") {
            res.status(400).json({
                "error":"Invalid time format for deptime"
            });
        } else {
            res.status(500).json({
                code: e.code,
                errorType: e.routine
            });
        }
    }
});

app.get('/working/:analysed_block_ref', async(req, res) => {

    try {
        const run_days = req.query.run_days || 'Mo,Tu,We,Th,Fr';
        const dbres = await db.query("SELECT * FROM journeys WHERE analysed_block_ref=$1 ORDER BY deptime", [req.params.analysed_block_ref]);
        res.json(dbres.rows);
    } catch(e) {
        res.status(500).json({
            code: e.code,
            errorType: e.routine
        });
    }
});

// Note currently hardcoded Mon-Fri
app.get('/stop/:atco/departures', async(req, res) => {
    try {
        const dbres = await db.query("SELECT * FROM (SELECT j.deptime, j.deptime + js.reltime*'1 second'::interval AS actualtime, j.route, j.journey_code, j.analysed_block_ref, j.origin, j.destination FROM journeystops js INNER JOIN stops s ON js.stopid=s.id INNER JOIN journeys j ON js.journeyid=j.id WHERE s.atco_code = $1 AND j.run_days='Mo,Tu,We,Th,Fr') AS stoptimes WHERE actualtime BETWEEN current_time AND current_time + interval '30 minutes'", [req.params.atco])
        res.json(dbres.rows);
    } catch(e) {
        res.status(500).json({
            code: e.code,
            errorType: e.routine
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`);
});
