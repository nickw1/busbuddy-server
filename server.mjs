import express from 'express';
import { BODSClient, createBoundingBox } from 'bodsjs'
import 'dotenv/config';

const app = express();
const bods = new BODSClient(process.env.API_KEY);


app.get('/', (req, res) => {
    res.send("Welcome to the busbuddy server");
});

let lastRequestTime = 0;

app.get('/live', async(req, res) => {
    const time = Date.now();
    const timePassed = time - lastRequestTime;
    if(timePassed > 5000) {
        const [ minLng, minLat, maxLng, maxLat ] = req.query.bbox.split(',');
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`);
});
