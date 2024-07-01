const express = require("express");
const router = express.Router();
const axios = require("axios");

const uid2 = require("uid2");
const encBase64 = require("crypto-js/enc-base64");
const SHA256 = require("crypto-js/sha256");

const Travel = require("../models/Travel");
const Traveller = require("../models/Traveller");
const isAuthenticated = require("../middlewares/isAuthenticated");

// // 1. Créer un nouveau voyage (/create)
// // 2. Récupérer ses voyages (/myTravels)
// // 3. Récupérer tous les voyages (/travels)
// // 4. Supprimer un voyage (.delete/travel/:id)

// 1. Créer un nouveau voyage (/create)
router.post("/create", isAuthenticated, async (req, res) => {
  console.log("Création en cours");
  try {
    const travellerFound = req.travellerFound;
    const {
      name,
      date_start,
      date_end,
      type,
      place,
      zipCode,
      isShared,
      categories,
    } = req.body;
    const travellers = [travellerFound._id];
    const status = "ongoing";
    // Vérifier que les covoyageurs sont bien inscris en base de donnée.
    if (req.body.travellers) {
      for (let t = 0; t < req.body.travellers.length; t++) {
        const coTraveller = await Traveller.findOne({
          email: req.body.travellers[t],
        });
        if (coTraveller) {
          travellers.push(coTraveller._id);
        }
      }
    }
    let activities = [];

    //on stocke les promises et on utilise ensuite Promise.all pour attendre qu'elles soient résolues avant de continuer le code. !!! un await ne fonctionne pas sur un map !!!

    const activitiesPromises = categories.map(async (category) => {
      const newActivities = await axios.post(
        // ajouter zipcode en textquery!!!
        `https://places.googleapis.com/v1/places:searchText?key=${process.env.GOOGLE_API_KEY}`,
        { textQuery: `${category} ${place} ${zipCode}`, minRating: 4 },
        {
          headers: {
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.primaryType,places.formattedAddress,places.priceLevel,places.rating,places.regularOpeningHours,places.websiteUri",
          },
        }
      );
      return newActivities.data.places;
    });

    try {
      const results = await Promise.all(activitiesPromises);
      results.forEach((result) => {
        activities = [...activities, ...result];
      });
      //On supprime les activités en double
      const activitiesSorted = [];
      activities.map((elt) => {
        let exist = false;
        activitiesSorted.map((eltSorted) => {
          if (eltSorted.id === elt.id) {
            exist = true;
          }
        });
        if (exist === false) {
          activitiesSorted.push(elt);
        }
      });

      activities = activitiesSorted;
    } catch (error) {
      console.log("Erreur lors de la récupération des activités:", error);
    }

    // Créer le voyage
    const newTravel = new Travel({
      name,
      status,
      date_start,
      date_end,
      type,
      place,
      isShared,
      categories,
      travellers,
    });
    await newTravel.save();
    console.log("voyage créé");
    // Mettre à jour les voyageurs en intégrant le voyage à leur liste de voyages
    for (let t = 0; t < travellers.length; t++) {
      const traveller = await Traveller.findById(travellers[t]);
      const travels = traveller.travels;
      travels.push(newTravel._id);
      const travellerUpdated = await Traveller.findByIdAndUpdate(
        traveller._id,
        {
          travels,
        },
        { new: true }
      );
    }
    // Renvoyer au voyageur les informations de son voyage + les activités à sélectionner
    const response = { travel: newTravel, activities };
    return res.status(200).json(response);
  } catch (error) {
    console.log("error=", error);
    return res.status(400).json(error);
  }
});

// 2. Récupérer ses voyages (/myTravels)
router.get("/myTravels", isAuthenticated, async (req, res) => {
  try {
    // récupérer tous les voyages
    const myTravels = await Traveller.findById(req.travellerFound._id).populate(
      { path: `travels` }
    );
    return res.status(200).json(myTravels);
  } catch (error) {
    console.log("error=", error);
    return res.status(400).json(error);
  }
});

//  3. Récupérer tous les voyages (/travels)
router.get("/travels", async (req, res) => {
  try {
    const travels = await Travel.find().populate([
      { path: `activities.activity` },
      { path: `travellers`, select: [`username`, `email`] },
    ]);
    return res.status(200).json(travels);
  } catch (error) {
    return res.status(400).json(error);
  }
});

// 4. Supprimer un voyage (.delete/travel)
router.delete("/travel/:id", isAuthenticated, async (req, res) => {
  try {
    const travelId = req.params.id;
    const result = await Travel.findByIdAndDelete(travelId);
    if (!result) {
      return res.status(404).send("Aucun voyage à supprimer");
    }
    const newTravels = [];
    req.travellerFound.travels.map((travel) => {
      if (JSON.stringify(travel).slice(1, 25) !== travelId) {
        newTravels.push(travel);
      }
    });
    const traveller = await Traveller.findByIdAndUpdate(
      req.travellerFound._id,
      { travels: newTravels },
      { new: true }
    );
    await traveller.save();
    res.status(200).send(`Le voyage a bien été supprimé`);
  } catch (error) {
    res.status(500).send("Un erreur est survenue:", error);
  }
});

//Renvoyer les informations d'un voyage
router.get("/travel/:travelId", isAuthenticated, async (req, res) => {
  const { travelId } = req.params;
  try {
    const travel = await Travel.findById(travelId);
    return res.status(200).json(travel);
  } catch (error) {
    console.log("Erreur lors de la récupération du voyage", error);
  }
});

module.exports = router;
