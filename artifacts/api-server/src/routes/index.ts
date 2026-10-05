import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kinRouter from "./kin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kinRouter);

export default router;
