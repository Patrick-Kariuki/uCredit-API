//routes related to Plan CRUD
import { returnData, errorHandler, forbiddenHandler } from "./helperMethods.js";
import courses from "../model/Course.js";
import distributions from "../model/Distribution.js";
import users from "../model/User.js";
import plans from "../model/Plan.js";
import years from "../model/Year.js";
import { auth } from "../util/token.js";
import reviews from "../model/PlanReview.js";
import express from "express";

const router = express.Router();

//get plan by plan id
router.get("/api/plans/:plan_id", auth, (req, res) => {
  const p_id = req.params.plan_id;
  plans
    .findById(p_id)
    .populate("year_ids")
    .then((plan) => {
      if (req.user._id !== plan.user_id) {
        return forbiddenHandler(res);
      }
      plan.populate("year_ids.courses", () => {
        plan = { ...plan._doc, years: plan.year_ids };
        delete plan.year_ids;
        reviews
          .find({ plan_id: p_id })
          .populate("reviewer_id")
          .then((revs) => {
            plan = { ...plan, reviewers: revs };
            returnData(plan, res);
          });
      });
    })
    .catch((err) => errorHandler(res, 400, err));
});

//get all plans of a user
router.get("/api/plansByUser/:user_id", auth, (req, res) => {
  const user_id = req.params.user_id;
  if (req.user._id !== user_id) {
    return forbiddenHandler(res);
  }
  const plansTotal = [];
  users
    .findById(user_id)
    .then(async (user) => {
      let total = user.plan_ids.length;
      if (!user) errorHandler(res, 404, `${user} of ${user_id} User not found`);
      for (let plan_id of user.plan_ids) {
        let plan = await plans.findById(plan_id).populate("year_ids");
        if (!plan) {
          total--;
          continue;
        }
        await plan.populate("year_ids.courses", () => {
          plan = { ...plan._doc, years: plan.year_ids };
          delete plan.year_ids;
          reviews
            .find({ plan_id: plan_id })
            .populate("reviewer_id")
            .then((revs) => {
              plan = { ...plan, reviewers: revs };
              plansTotal.push(plan);
              if (plansTotal.length === total) {
                returnData(plansTotal, res);
              }
            });
        });
      }
    })
    .catch((err) => errorHandler(res, 400, err));
});

//create plan and add the plan id to user
//require user_id in body
router.post("/api/plans", auth, (req, res) => {
  const plan = {
    name: req.body.name,
    user_id: req.body.user_id,
    majors: req.body.majors,
    expireAt: req.body.expireAt,
  };
  const year = req.body.year;
  const numYears = !req.params.numYears ? 5 : req.params.numYears;
  if (numYears <= 0 || numYears > 5) {
    return errorHandler(res, 400, "numYear must be between 1-5");
  }
  if (plan.user_id !== req.user._id) {
    return forbiddenHandler(res);
  }
  plans
    .create(plan)
    .then(async (retrievedPlan) => {
      users
        .findByIdAndUpdate(
          //update user
          retrievedPlan.user_id,
          { $push: { plan_ids: retrievedPlan._id } },
          { new: true, runValidators: true }
        )
        .exec();
      const yearName = [
        "AP/Transfer",
        "Freshman",
        "Sophomore",
        "Junior",
        "Senior",
      ];
      const startYear = getStartYear(year);
      const yearObjs = [];
      //create default year documents according to numYears
      for (let i = 0; i < numYears; i++) {
        const retrievedYear = {
          name: yearName[i],
          plan_id: retrievedPlan._id,
          user_id: retrievedPlan.user_id,
          year: i === 0 ? 0 : startYear + i,
          expireAt:
            retrievedPlan.user_id === "guestUser" ? Date.now() : undefined,
        };
        const newYear = await years.create(retrievedYear);
        yearObjs.push(newYear);
        retrievedPlan.year_ids.push(newYear._id);
      }
      retrievedPlan.save();
      const resp = { ...retrievedPlan._doc, years: yearObjs, reviewers: [] };
      delete resp.year_ids;
      returnData(resp, res);
    })
    .catch((err) => errorHandler(res, 400, err));
});

const getStartYear = (year) => {
  const date = new Date();
  if (
    (year.includes("Sophomore") && date.getMonth() > 7) ||
    (year.includes("Freshman") && date.getMonth() >= 0 && date.getMonth() <= 7)
  ) {
    return date.getFullYear() - 2;
  } else if (
    (year.includes("Junior") && date.getMonth() > 7) ||
    (year.includes("Sophomore") && date.getMonth() >= 0 && date.getMonth() <= 7)
  ) {
    return date.getFullYear() - 3;
  } else if (
    (year.includes("Senior") && date.getMonth() > 7) ||
    (year.includes("Junior") && date.getMonth() >= 0 && date.getMonth() <= 7)
  ) {
    return date.getFullYear() - 4;
  } else if (
    year.includes("Senior") &&
    date.getMonth() >= 0 &&
    date.getMonth() <= 7
  ) {
    return date.getFullYear() - 5;
  } else {
    return date.getFullYear() - 1;
  }
};

//delete a plan and its years, distributions and courses
//return deleted courses
router.delete("/api/plans/:plan_id", auth, (req, res) => {
  const plan_id = req.params.plan_id;
  // check plan belongs to user
  plans.findById(plan_id).then((plan) => {
    if (req.user._id !== plan.user_id) {
      return forbiddenHandler(res);
    }
  });
  // delete plan
  plans
    .findByIdAndDelete(plan_id)
    .then((plan) => {
      //delete distribution & courses
      distributions.deleteMany({ plan_id: plan._id }).exec();
      courses.deleteMany({ plan_id: plan._id }).exec();
      years.deleteMany({ plan_id: plan._id }).exec();
      // TODO: delete reviews
      users
        .findByIdAndUpdate(
          //delete plan_id from user
          plan.user_id,
          { $pull: { plan_ids: plan._id } },
          { new: true, runValidators: true }
        )
        .exec();
      returnData(plan, res);
    })
    .catch((err) => errorHandler(res, 400, err));
});

//***need to consider not allow user to change major for a plan ***/
router.patch("/api/plans/update", auth, (req, res) => {
  const id = req.body.plan_id;
  const majors = req.body.majors;
  const name = req.body.name;
  if (!(majors || name)) {
    errorHandler(res, 400, "Must update majors or name.");
  } else {
    let updateBody = {};
    if (majors) {
      updateBody.majors = majors;
    }
    if (name) {
      updateBody.name = name;
    }
    // check plan belongs to user
    plans.findById(id).then((plan) => {
      if (req.user._id !== plan.user_id) {
        return forbiddenHandler(res);
      }
    });
    // update plan
    plans
      .findByIdAndUpdate(id, updateBody, { new: true, runValidators: true })
      .then((plan) => {
        reviews
          .find({ plan_id: id })
          .populate("reviewer_id")
          .then((revs) => {
            plan = { ...plan, reviewers: revs };
            returnData(plan, res);
          });
      })
      .catch((err) => errorHandler(res, 400, err));
  }
});

export default router;
