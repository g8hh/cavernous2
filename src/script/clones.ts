type timeLineEntry = { type: string; time: number; el: HTMLElement };
type timeLine = timeLineEntry[];

class Clone {
	id: number;
	x: number = 0;
	y: number = 0;
	walkTime: number = 0;
	startDamage: number = 0;
	damage: number = 0;
	minHealth: number = 0;
	waiting: boolean | number = false;
	noSync: boolean = false;
	currentProgress: number = 0;
	repeated: boolean = false;
	activeSpells: Spell[] = [];
	timeLines: timeLine[] = [];
	timeLineElements: HTMLElement[] = [];
	el: HTMLElement | null = null;
	repeatsThisTick: number = 0;
	noActionsAvailable: boolean = false;
	currentCompletions: number | null = null;
	timeAvailable: number = 0;
	occupiedNode: HTMLElement | null = null;
	isPausing: boolean = false;
	constructor(id: number) {
		this.id = id;
		this.createTimeline();
		this.reset();
		this.createQueue();
	}

	enterZone() {
		this.x = 0;
		this.y = 0;
		this.walkTime = 0;
		this.startDamage = this.damage;
		this.minHealth = 0;
		this.waiting = false;
		this.noSync = false;
	}

	reset() {
		this.enterZone();
		this.currentProgress = 0;
		this.damage = 0;
		this.styleDamage();
		this.repeated = false;
		this.activeSpells = [];
		this.resetTimeLine();
	}

	resetTimeLine() {
		for (let i = 0; i < this.timeLines.length; i++) {
			this.timeLines[i] = [];
			const timelineElement = this.timeLineElements[i];
			while (timelineElement.lastChild) {
				timelineElement.removeChild(timelineElement.lastChild);
			}
		}
	}

	takeDamage(amount: number) {
		if (this.activeSpells.find(spell => spell.name == "Arcane Shield") && amount > 0) {
			const mana = getStat("Mana");
			if (mana.current < amount) {
				mana.spendMana(mana.current);
				amount -= mana.current;
			} else {
				mana.spendMana(amount);
				amount = 0;
			}
		}
		if (getStat("Health").current - this.damage > 0.1) {
			this.damage = Math.min(getStat("Health").current - 0.05, this.damage + amount);
		} else {
			this.damage += amount;
		}
		this.minHealth = Math.min(this.minHealth, this.startDamage - this.damage);
		if (this.damage < 0) this.damage = 0;
		if (this.damage >= getStat("Health").current) {
			this.damage = Infinity;
			getMessage("Death").display();
			if (clones.every(c => c.damage == Infinity && c.x == this.x && c.y == this.y)) {
				const route = getBestRoute(this.x, this.y, currentZone);
				if (route) {
					route.allDead = true;
				}
			}
		}
		this.styleDamage();
	}

	styleDamage() {
		if (!this.el) return;
		const hp = 1 - Math.min(this.damage / getStat("Health").current);
		(this.el.querySelector(".damage") as HTMLElement).style.width = hp == 1 || !Number.isFinite(hp) ? "0" : hp * 100 + "%";
		if (hp < 0) this.el.classList.add("dead-clone");
		else this.el.classList.remove("dead-clone");
	}

	createQueue() {
		const queueTemplate = document.querySelector("#queue-template");
		if (queueTemplate === null) throw new Error("No queue template found");
		this.el = queueTemplate.cloneNode(true) as HTMLElement;
		this.el.id = `queue${clones.length}`;
		document.querySelector("#queues")!.append(this.el);
		const q = new ActionQueue();
		q.index = queues.length;
		queues.push(q);
	}

	createTimeline() {
		this.timeLines = [];
		const timelineTemplate = document.querySelector("#timeline-template");
		if (timelineTemplate === null) throw new Error("No timeline template found");

		this.timeLineElements = [];
		for (let i = 0; i < zones.length; i++) {
			this.timeLines[i] = [];
			this.timeLineElements[i] = timelineTemplate.cloneNode(true) as HTMLElement;
			this.timeLineElements[i].id = `zone${i + 1}-timeline${clones.length}`;
		}
		document.querySelector("#timelines")!.append(this.timeLineElements[displayZone]);
	}

	select(allowMultiple = false) {
		if (!allowMultiple) {
			for (const index of selectedQueue) {
				if (index != this.id) clones[index].deselect();
			}
			if (cursor[0] != this.id) {
				cursor = [this.id, null];
			}
			selectedQueue = [this.id];
		} else {
			cursor = [0, null];
		}

		(document.querySelector(`#queue${this.id}`) as HTMLElement).classList.add("selected-clone");
		if (!selectedQueue.includes(this.id)) {
			selectedQueue.push(this.id);
		}
	}

	deselect() {
		(document.querySelector(`#queue${this.id}`) as HTMLElement).classList.remove("selected-clone");
		if (cursor[0] == this.id) cursor[1] = null;
		selectedQueue = selectedQueue.filter(e => e != this.id);
	}

	completeNextAction(force: boolean = false) {
		return completeNextAction(force);
	}

	selectQueueAction(actionIndex: number, n: number) {
		if (currentZone == displayZone) {
			selectQueueAction(this.id, actionIndex, n);
		}
	}

	sustainSpells(time: number) {
		this.activeSpells.forEach(s => s.sustain(time));
	}

	drown(time: number) {
		const location = zones[currentZone].getMapLocation(this.x, this.y, true);
		if (location?.water) this.takeDamage((location.water ** 2 * time) / 1000);
	}

	addToTimeline(action: { name: string }, time = 0) {
		if (action.name == "None") return;
		if (action === null || time < 1 || isNaN(time)) return;
		// Loop log
		if (!loopActions[action.name]) loopActions[action.name] = 0;
		loopActions[action.name] += time;

		// Timeline
		if (!settings.timeline) return;
		const lastEntry = this.timeLines[currentZone][this.timeLines[currentZone].length - 1];
		if (lastEntry?.type == action.name) {
			lastEntry.time += time;
			lastEntry.el.dataset.time = Math.round(lastEntry.time).toString();
			lastEntry.el.style.flexGrow = lastEntry.time.toString();
		} else {
			const entryElement = document.createElement("div");
			entryElement.dataset.name = action.name;
			entryElement.dataset.time = Math.round(time).toString();
			entryElement.style.flexGrow = time.toString();
			entryElement.classList.add(action.name.replace(/ /g, "-"));
			this.timeLineElements[currentZone].append(entryElement);
			this.timeLines[currentZone].push({ type: action.name, time, el: entryElement });
		}
	}

	revertTimelineWait(time: number){
		// Loop Log
		loopActions["Wait"] -= time;

		// Timeline
		if (!settings.timeline) return;
		let lastEntry = this.timeLines[currentZone][this.timeLines[currentZone].length - 1];
		if (lastEntry?.type == "Wait"){
			lastEntry.time -= time;
			lastEntry.el.dataset.time = Math.round(lastEntry.time).toString();
			lastEntry.el.style.flexGrow = lastEntry.time.toString();
		}
	}

	getNextActionTime(): [number, number | null, number | null, boolean?] {
		currentClone = this.id;
		let [action, actionIndex] = getNextAction();
		if (action === undefined) {
			// No actions available

			const repeat = this.queue.findIndex(q => q[0] == "<");
			if (repeat > -1 && repeat < this.queue.length - 1) {
				this.repeated = true;
				this.repeatsThisTick++;
				for (let i = repeat + 1; i < this.queue.length; i++) {
					this.queue[i][1] = true;
					if (this.queue[i][2]) {
						for (const inner of this.queue[i][2]) {
							delete inner[`${currentClone}_${i}`];
						}
					}
					this.selectQueueAction(i, 0);
				}
			} else {
				this.noActionsAvailable = true;
				return [Infinity, null, null];
			}
			[action, actionIndex] = getNextAction();
		}
		const actionToDo = action?.action ?? null;
		if (actionToDo === null) {
			// Pathfinding or repeat interact is done
			return [0, null, null];
		}
		if (actionToDo == ":"){
			// Pause game
			return [0, null, null];
		}
		if (actionToDo === undefined || actionToDo === "W") {
			// Clone is waiting
			return [Infinity, null, null];
		}
		if (actionToDo == ".") {
			return [this.walkTime || 100, null, null];
		}
		if (actionToDo == "=") {
			if (
				!this.waiting ||
				clones.every((c, i) => {
					return (
						c.noSync === true || c.waiting === true || (c.waiting && c.waiting >= queueTime - MAX_TICK) || !queues[i].find(q => q[0] == "=" && q[1])
					);
				})
			) {
				return [0, null, null];
			} else {
				return [Infinity, null, null];
			}
		}
		if (this.waiting !== false && this.waiting < queueTime - MAX_TICK) this.waiting = false;

		const actionXOffset ={
			R: 1,
			L: -1
		}[actionToDo] || 0;
		const actionYOffset ={
			U: -1,
			D: 1
		}[actionToDo] || 0;
		const hasOffset = !!actionXOffset || !!actionYOffset;
		const x = this.x + actionXOffset;
		const y = this.y + actionYOffset;
		const location = getMapLocation(x, y);
		if (location === null) throw new Error("Location not found");
		if (actionToDo[0] == "N" &&
			runes[parseInt(actionToDo[1])].isInscribable() === false &&
			!runesTiles.includes(zones[currentZone].map[y + zones[currentZone].yOffset][x + zones[currentZone].xOffset])
		) {
			return [Infinity, null, null];
		}
		if ("NS<+".includes(actionToDo[0]) || (actionToDo == "=" && this.waiting !== true)) {
			// Clone's next action is free.
			return [0, null, null];
		}
		if (hasOffset) {
			let enterTime = location.type.getEnterAction(location.entered)?.getProjectedDuration(location, 0, location.remainingEnter || 0);
			if (enterTime === undefined || isNaN(enterTime)) enterTime = 100;
			return [enterTime, x, y, ["Walk", "Kudzu Chop"].includes(location.type.getEnterAction(location.entered)?.name as string) || !location.type.canWorkTogether];
		} else {
			let presentTime =
				location.type.presentAction?.getProjectedDuration(location, 0, location.remainingPresent || 0) || // Time a new action takes
				location.temporaryPresent?.getProjectedDuration(location, 0, location.remainingPresent || 0) || // Time a new rune action takes
				0; // Illegal present action
			if (isNaN(presentTime)) presentTime = 100;
			return [presentTime, x, y];
		}
	}

	executeAction(time: number, action: QueueAction, actionIndex: number) {
		const initialTime = time;
		currentClone = this.id;
		const actionToDo = action.action;
		// Failed pathfind
		if (actionToDo === null || actionToDo === undefined) {
			this.selectQueueAction(actionIndex, 100);
			this.completeNextAction(true);
			return time;
		}
		// Explicit non-action wait
		if (actionToDo === "W") {
			this.isPausing = true;
			this.addToTimeline({ name: "Wait" }, initialTime);
			return 0;
		}
		// Pause game
		if (actionToDo === ":"){
			if (settings.running) toggleRunning();
			this.selectQueueAction(actionIndex, 100);
			this.completeNextAction(true);
			return time;
		}

		const actionXOffset = {
			"R": 1,
			"L": -1
		}[actionToDo] || 0;
		const actionYOffset = {
			"U": -1,
			"D": 1
		}[actionToDo] || 0;
		const hasOffset = !!actionXOffset || !!actionYOffset;

		if (actionToDo[0][0] == "N") {
			if (runes[parseInt(actionToDo[1])].create(this.x + actionXOffset, this.y + actionYOffset)) {
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				this.addToTimeline({ name: "Create rune" });
				return time;
			} else {
				this.isPausing = true;
				this.addToTimeline({ name: "Wait" }, initialTime);
				return 0;
			}
		}
		if (actionToDo[0][0] == "S") {
			if (spells[parseInt(actionToDo[1])].cast()) {
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				this.addToTimeline({ name: "Cast spell" });
				return time;
			} else {
				this.isPausing = true;
				this.addToTimeline({ name: "Wait" }, initialTime);
				return 0;
			}
		}
		if (actionToDo == "<") {
			this.completeNextAction();
			return time;
		}
		if (actionToDo == "+") {
			this.noSync = !this.noSync;
			this.selectQueueAction(actionIndex, 100);
			this.completeNextAction();
			return time;
		}
		if (actionToDo == "=") {
			if (this.noSync) {
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				return time;
			}
			this.waiting = true;
			if (
				clones.every((c, i) => {
					return (
						c.noSync === true || c.waiting === true || (c.waiting && c.waiting >= queueTime - MAX_TICK) || !queues[i].find(q => q[0] == "=" && q[1])
					);
				})
			) {
				this.waiting = queueTime;
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				this.addToTimeline({ name: "Sync" });
				return time;
			}
			this.isPausing = true;
			this.addToTimeline({ name: "Wait" }, initialTime);
			return 0;
		}
		if (actionToDo == "."){
			if (!this.walkTime) this.walkTime = 100;
			let waitTime = Math.min(time, this.walkTime);
			getAction("Wait")!.tick(waitTime);
			this.selectQueueAction(actionIndex, 100 - this.walkTime);
			if (!this.walkTime) this.completeNextAction();
			this.addToTimeline({name: "Wait"}, waitTime);
			return time - waitTime;
		}

		const location = getMapLocation(this.x + actionXOffset, this.y + actionYOffset);
		if (location === null) throw new Error("Location not found");

		const locationEnterAction = location.type.getEnterAction(location.entered);
		const locationPresentAction = location.type.presentAction || location.temporaryPresent
		if (this.currentCompletions === null) this.currentCompletions = location.completions;

		if (!hasOffset && this.currentCompletions !== null && this.currentCompletions < location.completions && location.temporaryPresent?.name != "Teleport") {
			this.completeNextAction();
			this.currentProgress = 0;
			this.selectQueueAction(actionIndex, 100);
			this.addToTimeline((!hasOffset ? locationPresentAction : locationEnterAction) || {name: "None"}, initialTime - time);
			return time;
		}
		if ((location.remainingPresent <= 0 && !hasOffset) || (location.remainingEnter <= 0 && hasOffset)) {
			const startStatus = location.start();
			if (startStatus == 0) {
				this.completeNextAction();
				this.currentProgress = 0;
				this.selectQueueAction(actionIndex, 100);
				this.addToTimeline((!hasOffset ? locationPresentAction : locationEnterAction) || {name: "None"}, initialTime - time);
				return time;
			} else if (startStatus < 0) {
				this.isPausing = true;
				this.addToTimeline({ name: "Wait" }, initialTime);
				if (time < 1) this.timeAvailable = time;
				return 0;
			}
		}
		let percentRemaining;
		[time, percentRemaining] = location.tick(time);
		this.selectQueueAction(actionIndex, 100 - percentRemaining * 100);
		this.currentProgress = location.remainingPresent;
		if (!percentRemaining) {
			this.completeNextAction();
			this.currentProgress = 0;
		}
		this.addToTimeline((!hasOffset ? locationPresentAction : locationEnterAction) || {name: "None"}, initialTime - time);
		return time;
	}

	get queue() {
		return queues[this.id];
	}

	performSingleAction(maxTime: number) {
		if (maxTime > this.timeAvailable) {
			maxTime = this.timeAvailable;
		}
		if (this.noActionsAvailable || this.damage == Infinity) {
			if (this.damage == Infinity) {
				this.addToTimeline({ name: "Dead" }, maxTime);
			} else {
				this.addToTimeline({ name: "No action" }, maxTime);
			}
			return;
		}
		this.isPausing = false;
		currentClone = this.id;
		const [nextAction, actionIndex] = getNextAction();

		if (nextAction) {
			const timeLeft = this.executeAction(maxTime, nextAction, actionIndex);
			this.sustainSpells(maxTime - timeLeft);
			this.drown(maxTime - timeLeft);
			this.timeAvailable -= maxTime - timeLeft;
			return;
		}

		// Shouldn't get to here.
		this.noActionsAvailable = true;
		this.drown(this.timeAvailable);
		this.timeAvailable = 0;
		this.addToTimeline({ name: "No action" }, maxTime);
		return;
	}

	setTimeAvalable(time: number) {
		this.timeAvailable = time;
		this.noActionsAvailable = false;
		this.repeatsThisTick = 0;
	}

	static performActions(time: number) {
		for (const c of clones) {
			c.setTimeAvalable(time);
		}

		let maxTime = time;
		let count = 0;
		clones.forEach(c => c.isPausing = false);
		while (maxTime) {
			if (count++ > 100) break;
			const nextActionTimes = clones
				.map(c => (c.noActionsAvailable || c.damage == Infinity || !(c.timeAvailable || 0) ? [Infinity, null, null] as [number, null, null] : c.getNextActionTime()))
				.map((t, i, arr) => t[3] ? t[0] : t[0] / (arr.reduce((a, c) => a + Math.abs(+(c[1] !== null && c[2] !== null && c[1] === t[1] && c[2] === t[2])), 0) || 1));
			const nextSingleActionTime = Math.min(...nextActionTimes) + 0.001; // Add .001 to prevent rounding errors.
			clones.filter((c, i) => nextActionTimes[i] <= nextSingleActionTime).forEach(c => c.performSingleAction(Math.max(nextSingleActionTime, 1)));
			if (clones.every(c => c.isPausing)) {
				clones.forEach(c => c.revertTimelineWait(nextSingleActionTime));
				return maxTime;
			}
			maxTime = Math.max(...clones.map((e, i) => (!e.noActionsAvailable && e.damage != Infinity && nextActionTimes[i] < Infinity ? e.timeAvailable || 0 : 0)));
			if (maxTime < 0.001) break;
		}

		const timeNotSpent = Math.min(...clones.map(e => e.timeAvailable || 0));
		clones.forEach(c => {
			if (c.timeAvailable > timeNotSpent) {
				c.sustainSpells(c.timeAvailable - timeNotSpent);
				if (c.noActionsAvailable) {
					c.addToTimeline({ name: "No action" }, c.timeAvailable - timeNotSpent);
				} else {
					c.addToTimeline({ name: "Wait" }, c.timeAvailable - timeNotSpent);
				}
			}
		});
		queueTime += time - timeNotSpent;
		getStat("Mana").spendMana((time - timeNotSpent) / 1000);
		return timeNotSpent;
	}

	static addNewClone(loading = false) {
		const c = new Clone(clones.length);
		clones.push(c);
		if (!loading) {
			if (clones.length == 2) getMessage("First Clone").display();
			if (clones.length == 3) getMessage("Second Clone").display();
			if (clones.length == 4) getMessage("Third Clone").display();
			if (clones.length == 5) getMessage("Fourth Clone").display();
		}
	}
}
function selectClone(target: number): void;
function selectClone(target: HTMLElement | number, event: MouseEvent): void;
function selectClone(target: HTMLElement | number, event?: MouseEvent) {
	if (target instanceof HTMLElement) {
		const index = +target.id.replace("queue", "");
		if (event && (event.ctrlKey || event.metaKey)) {
			if (selectedQueue.includes(index)) {
				clones[index].deselect();
			} else {
				clones[index].select(true);
			}
		} else {
			clones[index].select();
		}
	} else {
		clones[target].select();
	}

	showCursor();
	showFinalLocation();
}

let clones: Clone[] = [];
