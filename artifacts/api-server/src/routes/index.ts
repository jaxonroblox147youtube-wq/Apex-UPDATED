import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot";
import authRouter from "./auth";
import guildRouter from "./guild";
import robloxRouter from "./roblox";
import applicationsRouter from "./applications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(botRouter);
router.use(guildRouter);
router.use(robloxRouter);
router.use(applicationsRouter);

export default router;
