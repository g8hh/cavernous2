type DOMEvent = Event & {
	target: HTMLElement,
};

let dragTarget: HTMLElement;
let newDropTarget: HTMLElement | null;
let newIsDropTopHalf: boolean;
let oldDropTarget: HTMLElement | null;
let oldIsDropTopHalf: boolean;

function saveQueue(el: HTMLElement){
	let queue = +el.parentElement!.parentElement!.id.replace("queue", "");
	// This seems tricky to make ts accept, and I'm not 100% sure it works.
	// But we're not using it, so let's just ignore it for now.
	// @ts-ignore
	savedQueues.push(queues[queue].map(q => [q[0]]).filter(q => q[0] != "Q" && q[0] != "<"));
	savedQueues[savedQueues.length - 1].icon = possibleActionIcons[0];
	// Generate random colour.
	savedQueues[savedQueues.length - 1].colour = '#'+Math.floor(Math.random()*16777215).toString(16);
	drawSavedQueues();
}

function saveAllQueues(){
	queues.forEach(queue => {
		// This seems tricky to make ts accept, and I'm not 100% sure it works.
		// But we're not using it, so let's just ignore it for now.
		// @ts-ignore
		savedQueues.push(queue.map(q => q.actionID).filter(a => a != "Q" && a != "<"));
		savedQueues[savedQueues.length - 1].icon = possibleActionIcons[0];
		// Generate random colour.
		savedQueues[savedQueues.length - 1].colour = '#'+Math.floor(Math.random()*16777215).toString(16);
	});
	drawSavedQueues();
}

function deleteSavedQueue(el: HTMLElement){
	let queue = +el!.parentElement!.parentElement!.id.replace("saved-queue", "");
	if (queues.some(q => q.some(a => a[0] == queue))){
		alert("不能删除； 正在使用。");
		return;
	}
	savedQueues.splice(queue, 1);
	for (let i = 0; i < queues.length; i++){
		for (let j = 0; j < queues[i].length; j++){
			if (queues[i][j][0][0] == "Q" && getActionValue(queues[i][j][0]) > queue){
				queues[i][j][0] = `Q${getActionValue(queues[i][j][0]) - 1};`;
			}
		}
	}
	drawSavedQueues();
}

function selectSavedQueue(event: DOMEvent, el: HTMLElement){
	if (!event.target!.closest("input") && !event.target!.closest("select")) el.focus();
}

function insertSavedQueue(event: DOMEvent, el: HTMLElement){
	if (event.target!.closest("input") || event.target!.closest("select")) return;

	let source = el.closest('.saved-queue')!.id.replace("saved-queue", "");

	for (let target of selectedQueues) {
		queues[target.clone].addActionAt(`Q${source};`, null);
	}

	(<HTMLElement>el.closest('.saved-queue')).blur()
}

function setSavedQueueName(el: HTMLInputElement){
	let queue = +el.parentElement!.id.replace("saved-queue", "");
	savedQueues[queue].name = el.value;
	updateSavedIcon(queue);
}

function setSavedQueueIcon(el: HTMLInputElement){
	let queue = +el.parentElement!.id.replace("saved-queue", "");
	savedQueues[queue].icon = el.value;
	updateSavedIcon(queue);
}

function setSavedQueueColour(el: HTMLInputElement){
	let queue = +el.parentElement!.id.replace("saved-queue", "");
	savedQueues[queue].colour = el.value;
	(<HTMLElement>el.parentElement!.querySelector(".icon-select")).style.color = el.value;
	updateSavedIcon(queue);
}

function updateSavedIcon(queue: number){
	document.querySelectorAll(`.action${queue}`).forEach(node => {
		if (!(node instanceof HTMLElement)) return;
		node.style.color = savedQueues[queue].colour;
		node.querySelector(".character")!.innerHTML = savedQueues[queue].icon;
		node.setAttribute("title", savedQueues[queue].name);
	});
}

function addActionToSavedQueue(action: string){
	let queueNode = document.querySelector(".saved-queue:focus");
	if (!queueNode) return; // This occurs when we prevent adding actions because we're typing in a name
	let queue = +queueNode.id.replace("saved-queue", "");
	if (savedQueues[queue] === undefined) return;
	queueNode = queueNode.querySelector(".queue-inner")!;
	if (action == "B") {
		if (savedQueues[queue].length == 0) return;
		savedQueues[queue].pop();
		queueNode.removeChild(queueNode.lastChild!);
	} else if ("UDLRI=".includes(action) || ("NS".includes(action[0]) && !isNaN(+action[1]))) {
		savedQueues[queue].push(new QueueAction(action, true));
		queueNode.append(createActionNode(action));
	}
}

function startSavedQueueDrag(event: DragEvent, el: HTMLElement){
	dragTarget = el.closest(".saved-queue")!;
	event.dataTransfer!.setDragImage(el.querySelector(".icon-select")!, 0, 0);
	event.dataTransfer!.setData("text/plain", el.id.replace("saved-queue", ""));
	event.dataTransfer!.effectAllowed = "copyMove";
}

function queueDragOver(event: DragEvent){
	event.preventDefault();
	event.dataTransfer!.dropEffect = "copy";
}

function savedQueueDragOver(event: DragEvent, el: HTMLElement){
	event.preventDefault();
	if (el.closest(".saved-queue") === dragTarget){
		event.dataTransfer!.dropEffect = "none";
	}
	else {
		event.dataTransfer!.dropEffect = "move";
		newDropTarget = el.closest(".saved-queue");
		newIsDropTopHalf = isDropTopHalf(event);
	}
}

function savedQueueDragOut(el: HTMLElement){
	if (newDropTarget === el) {
		newDropTarget = null;
	}
}

function isDropTopHalf(event: DragEvent){
	return event.offsetY < 14;
}

function updateDropTarget() {
	let targetChanged = newDropTarget !== oldDropTarget;
	let halfChanged = newIsDropTopHalf !== oldIsDropTopHalf;

	if (oldDropTarget && targetChanged) {
		let oldClasses = oldDropTarget.classList;
		oldClasses.remove(oldIsDropTopHalf ? "drop-above" : "drop-below");
		oldDropTarget = null;
	}

	if (newDropTarget && (targetChanged || halfChanged)) {
		let newClasses = newDropTarget.classList;
		newClasses.add(newIsDropTopHalf ? "drop-above" : "drop-below");
		halfChanged && newClasses.remove(newIsDropTopHalf ? "drop-below" : "drop-above");
		oldDropTarget = newDropTarget;
		oldIsDropTopHalf = newIsDropTopHalf;
	}
}

function savedQueueDrop(event: DragEvent, el: HTMLElement){
	let source = +event.dataTransfer!.getData("text/plain");
	let target = +el.id.replace("queue", "");
	if (event.ctrlKey){
		queues[target].copyQueueAt(savedQueues[source], null);
	} else {
		queues[target].addActionAt(`Q${source};`, null);
	}
}

function savedQueueMove(event: DragEvent, el: HTMLElement){
	savedQueueDragOut(el);
	let source = +event.dataTransfer!.getData("text/plain");
	let target = +el.id.replace("saved-queue", "") + (isDropTopHalf(event) ? -1 : 0);
	if (source > target) target++;
	for (let i = 0; i < queues.length; i++){
		for (let j = 0; j < queues[i].length; j++){
			if (queues[i][j][0][0] == "Q"){
				let value = getActionValue(queues[i][j][0]);
				if (value > source && value <= target){
					queues[i][j][0] = `Q${value - 1};`;
				} else if (value < source && value >= target){
					queues[i][j][0] = `Q${value + 1};`;
				} else if (value == source){
					queues[i][j][0] = `Q${target}`;
				}
			}
		}
	}

	let oldQueue = savedQueues.splice(source, 1)[0];
	savedQueues.splice(target, 0, oldQueue);

	let queueContainer = document.querySelector("#saved-queues-inner")!;
	dragTarget.id = "";
	queueContainer.insertBefore(dragTarget, queueContainer.children[source > target ? target : target+1]);
	let delta = source > target ? -1 : 1;
	for (let i = source; i != target; i += delta) {
		queueContainer.children[i].id = `saved-queue${i}`
	}
	dragTarget.id = `saved-queue${target}`;
}

function drawSavedQueues(){
	let node = document.querySelector("#saved-queues-inner");
	if (!node) return;
	while (node.firstChild){
		node.removeChild(node.lastChild!);
	}
	let template = document.querySelector("#saved-queue-template")!;
	for (let i = 0; i < savedQueues.length; i++){
		let el = template.cloneNode(true) as HTMLElement;
		el.id = `saved-queue${i}`;
		let queueNode = el.querySelector(".queue-inner")!;
		while (queueNode.firstChild) {
			queueNode.removeChild(queueNode.lastChild!);
		}
		for (let j = 0; j < savedQueues[i].length; j++){
			queueNode.append(createActionNode(savedQueues[i][j][0]));
		}
		if (savedQueues[i].name) (<HTMLInputElement>el.querySelector(".saved-name")).value = savedQueues[i].name;
		if (savedQueues[i].icon) (<HTMLInputElement>el.querySelector(".icon-select")).value = savedQueues[i].icon;
		if (savedQueues[i].colour){
			(<HTMLInputElement>el.querySelector(".colour-select")).value = savedQueues[i].colour;
			(<HTMLInputElement>el.querySelector(".icon-select")).style.color = savedQueues[i].colour;
		}
		node.append(el);
	}
	// node.parentNode.style.display = savedQueues.length ? "block" : "none";
}

function filterSaved(filterInput: HTMLInputElement){
	if (filterInput.value.length == 0){
		document.querySelectorAll(`.saved-queue`).forEach(queue => (<HTMLElement>queue).style.display = "inline-block");
		return;
	}
	let filter = RegExp(filterInput.value);
	for (let i = 0; i < savedQueues.length; i++){
		if (filter.test(savedQueues[i].name)){
			(<HTMLElement>document.querySelector(`#saved-queue${i}`)).style.display = "inline-block";
		} else {
			(<HTMLElement>document.querySelector(`#saved-queue${i}`)).style.display = "none";
		}
	}
}
