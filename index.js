require("dotenv").config();
const express = require("express");
const app = express();
const axios = require("axios");
const cors = require("cors");
//COMMENTAIRE POUR ESSAI
//LIGNE A RAJOUTER AU MAIN
app.use(cors());
app.use(express.json());

app.get("/", () => {
  console.log("coucou");
});

app.get("/search", async (req, res) => {
  console.log("search longitude/latitude");
  console.log(req.query.address);

  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${req.query.address}&key=${process.env.GOOGLE_API_KEY}`
  );
  console.log(response.data);
  console.log("response=", response.data.results[0].geometry.location);
  const lat = response.data.results[0].geometry.location.lat;
  console.log("lat=", lat);
  const long = response.data.results[0].geometry.location.lng;
  console.log("long=", long);

  const response2 = await axios.post(
    `https://places.googleapis.com/v1/places:searchText?key=${process.env.GOOGLE_API_KEY}`,
    {
      textQuery: "randonnée",
      strictTypeFiltering: true,
      locationBias: {
        circle: {
          center: {
            latitude: lat,
            longitude: long,
          },
          radius: 5000.0,
        },
      },
      minRating: 4,
    },
    {
      headers: {
        "X-Goog-FieldMask": [
          // "*",
          "places.displayName",
          "places.rating",
          "places.websiteUri",
          "places.regularOpeningHours.weekdayDescriptions",
          "places.primaryType",
          "places.shortFormattedAddress",
        ],
      },
    }
  );
  console.log("response2=", response.data);
  res
    .status(200)
    .json({ count: response2.data.places.length, data: response2.data });
});

app.listen(3000, () => {
  console.log("Server on fire!");
});
