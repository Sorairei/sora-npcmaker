window.generateLUA = function(state) {
	// Helpers
	const safeLua = (str) => {
		if (!str) return "";
		// Escape backslashes first, then characters that would break or alter a Lua string.
		return String(str)
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"')
			.replace(/\r/g, '\\r')
			.replace(/\t/g, '\\t')
			.replace(/\n/g, '\\n');
	};
	const positiveInteger = (value, fallback) => {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
	};
	const nonNegativeInteger = (value, fallback) => {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
	};
	const outfit = state.outfit || {};
	const dialogue = state.dialogue || {};

	let name = safeLua(state.name || "Default NPC");
	
	// Header
	let lua = `local internalNpcName = "${name}"\n`;
	lua += `local npcType = Game.createNpcType(internalNpcName)\n`;
	lua += `local npcConfig = {}\n\n`;

	lua += `npcConfig.name = internalNpcName\n`;
	lua += `npcConfig.description = internalNpcName\n\n`;

	lua += `npcConfig.health = ${positiveInteger(state.health, 100)}\n`;
	lua += `npcConfig.maxHealth = npcConfig.health\n`;
	lua += `npcConfig.walkInterval = ${positiveInteger(state.walkInterval, 2000)}\n`;
	lua += `npcConfig.walkRadius = ${nonNegativeInteger(state.walkRadius, 2)}\n\n`;

	// Outfit
	lua += `npcConfig.outfit = {\n`;
	lua += `\tlookType = ${positiveInteger(outfit.lookType, 128)},\n`;
	lua += `\tlookHead = ${nonNegativeInteger(outfit.lookHead, 0)},\n`;
	lua += `\tlookBody = ${nonNegativeInteger(outfit.lookBody, 0)},\n`;
	lua += `\tlookLegs = ${nonNegativeInteger(outfit.lookLegs, 0)},\n`;
	lua += `\tlookFeet = ${nonNegativeInteger(outfit.lookFeet, 0)},\n`;
	lua += `\tlookAddons = ${nonNegativeInteger(outfit.lookAddons, 0)},\n`;
	const mount = positiveInteger(outfit.mount, 0);
	if(mount > 0) {
		lua += `\tlookMount = ${mount},\n`;
	}
	lua += `}\n\n`;

	// Flags
	lua += `npcConfig.flags = {\n`;
	lua += `\tfloorchange = false,\n`;
	lua += `}\n\n`;

	// Handlers Init
	lua += `local keywordHandler = KeywordHandler:new()\n`;
	lua += `local npcHandler = NpcHandler:new(keywordHandler)\n\n`;

	// Callbacks
	lua += `npcType.onThink = function(npc, interval)\n\tnpcHandler:onThink(npc, interval)\nend\n\n`;
	lua += `npcType.onAppear = function(npc, creature)\n\tnpcHandler:onAppear(npc, creature)\nend\n\n`;
	lua += `npcType.onDisappear = function(npc, creature)\n\tnpcHandler:onDisappear(npc, creature)\nend\n\n`;
	lua += `npcType.onMove = function(npc, creature, fromPosition, toPosition)\n\tnpcHandler:onMove(npc, creature, fromPosition, toPosition)\nend\n\n`;
	lua += `npcType.onSay = function(npc, creature, type, message)\n\tnpcHandler:onSay(npc, creature, type, message)\nend\n\n`;
	lua += `npcType.onCloseChannel = function(npc, creature)\n\tnpcHandler:onCloseChannel(npc, creature)\nend\n\n`;

	// Messages
	lua += `npcHandler:setMessage(MESSAGE_GREET, "${safeLua(dialogue.greet) || 'Hello |PLAYERNAME|.'}")\n`;
	lua += `npcHandler:setMessage(MESSAGE_FAREWELL, "${safeLua(dialogue.farewell) || 'Farewell.'}")\n`;
	lua += `npcHandler:setMessage(MESSAGE_WALKAWAY, "${safeLua(dialogue.walkaway) || 'How rude!'}")\n`;
	lua += `npcHandler:setMessage(MESSAGE_SENDTRADE, "Sure.")\n\n`;

	// Keywords
	if (state.keywords && state.keywords.length > 0) {
		state.keywords.forEach(kw => {
			// Format trigger as { "name" } and response as double quoted string
			let safeResponse = safeLua(kw.response);
			lua += `keywordHandler:addKeyword({ "${safeLua(kw.trigger)}" }, StdModule.say, { npcHandler = npcHandler, text = "${safeResponse}" })\n`;
		});
		lua += `\n`;
	}

	lua += `npcHandler:addModule(FocusModule:new(), npcConfig.name, true, true, true)\n\n`;

	// Shop
	const tradeItems = (state.tradeItems || []).map(item => ({
		id: positiveInteger(item.id, 0),
		name: item.name,
		buy: positiveInteger(item.buy, 0),
		sell: positiveInteger(item.sell, 0)
	})).filter(item => item.id > 0 && (item.buy > 0 || item.sell > 0));
	if (tradeItems.length > 0) {
		lua += `npcConfig.shop = {\n`;
		tradeItems.forEach(item => {
			let buyStr = item.buy > 0 ? `, buy = ${item.buy}` : '';
			let sellStr = item.sell > 0 ? `, sell = ${item.sell}` : '';
			lua += `\t{ itemName = "${safeLua(item.name)}", clientId = ${item.id}${buyStr}${sellStr} },\n`;
		});
		lua += `}\n`;
		
		lua += `-- On buy npc shop message\n`;
		lua += `npcType.onBuyItem = function(npc, player, itemId, subType, amount, ignore, inBackpacks, totalCost)\n`;
		lua += `\tnpc:sellItem(player, itemId, amount, subType, 0, ignore, inBackpacks)\n`;
		lua += `end\n`;
		
		lua += `-- On sell npc shop message\n`;
		lua += `npcType.onSellItem = function(npc, player, itemId, subtype, amount, ignore, name, totalCost)\n`;
		lua += `\tplayer:sendTextMessage(MESSAGE_TRADE, string.format("Sold %ix %s for %i gold.", amount, name, totalCost))\n`;
		lua += `end\n`;
		
		lua += `-- On check npc shop message (look item)\n`;
		lua += `npcType.onCheckItem = function(npc, player, clientId, subType) end\n\n`;
	}

	lua += `npcType:register(npcConfig)\n`;
	
	return lua;
};
