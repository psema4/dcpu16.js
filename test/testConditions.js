/*
 *  Js-Test-Driver Test Suite for Generic JavaScript language tests
 *  http://code.google.com/p/js-test-driver
 */

TestCase("Conditions", {
	cpu: null,
	
	setUp: function () {
		this.cpu = new DCPU16.PC();
	},

	tearDown: function () {
	},
	
	testIfe: function () {
		expectAsserts(2);

		var src =
			'SET X, 0x1000\n' +
			'IFE X, 0x1001\n' +
			'SET X, 0xDEAD\n' +

			'SET Y, 0x1000\n' +
			'IFE Y, 0x1000\n' +
			'SET Y, 0xBEEF\n' +
			
			':halt SET PC, halt';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('unequal', 0x1000, this.cpu.ram.X);
		assertEquals('equal', 0xBEEF, this.cpu.ram.Y);
	},

	testIfn: function () {
		expectAsserts(2);

		var src =
			'SET X, 0x1000\n' +
			'IFN X, 0x1001\n' +
			'SET X, 0xDEAD\n' +

			'SET Y, 0x1000\n' +
			'IFN Y, 0x1000\n' +
			'SET Y, 0xBEEF\n' +
			
			':halt SET PC, halt';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('unequal', 0xDEAD, this.cpu.ram.X);
		assertEquals('equal', 0x1000, this.cpu.ram.Y);
	},

	testIfg: function () {
		expectAsserts(3);

		var src =
			'SET X, 0x1000\n' +
			'IFG X, 0x1001\n' +
			'SET X, 0xDEAD\n' +

			'SET Y, 0x1000\n' +
			'IFG Y, 0x1000\n' +
			'SET Y, 0xCAFE\n' +
			
			'SET Z, 0x1000\n' +
			'IFG Z, 0x0100\n' +
			'SET Z, 0xBABE\n' +
			':halt SET PC, halt';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('smaller', 0x1000, this.cpu.ram.X);
		assertEquals('equal', 0x1000, this.cpu.ram.Y);
		assertEquals('greater', 0xBABE, this.cpu.ram.Z);
	},

	testIfb: function () {
		expectAsserts(2);

		var src =
			'SET X, 0x1000\n' +
			'IFB X, 0x0001\n' +
			'SET X, 0xDEAD\n' +

			'SET Y, 0x1000\n' +
			'IFB Y, 0x1001\n' +
			'SET Y, 0xBEEF\n' +
			
			':halt SET PC, halt';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('no bits', 0x1000, this.cpu.ram.X);
		assertEquals('one bit', 0xBEEF, this.cpu.ram.Y);
	},
	
	testIFA: function () {
		expectAsserts(2);

		var src =
			'SET X, 0xfff6\n' +
			'IFA X, 0x0001\n' +
			'SET X, 0xDEAD\n' +

			'SET Y, 0xfff6\n' +
			'IFA Y, 0xfff3\n' +
			'SET Y, 0xBEEF\n' +
			
			'SUB PC, 1';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('no bits', 0xfff6, this.cpu.ram.X);
		assertEquals('one bit', 0xBEEF, this.cpu.ram.Y);
	},
	
	testIFL: function () {
		expectAsserts(2);

		var src =
			'SET X, 0x1000\n' +
			'IFL X, 0x0001\n' +
			'SET X, 0xDEAD\n' +

			'SET Y, 0x1000\n' +
			'IFL Y, 0x1001\n' +
			'SET Y, 0xBEEF\n' +
			
			'SUB PC, 1';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('no bits', 0x1000, this.cpu.ram.X);
		assertEquals('one bit', 0xBEEF, this.cpu.ram.Y);
	},
	
	testIFU: function () {
		expectAsserts(2);

		var src =
			'SET X, 0xfff4\n' +
			'IFU X, 0x0001\n' +
			'SET X, 0xDEAD\n' +

			'SET Y, 0xfff4\n' +
			'IFU Y, 0xfff2\n' +
			'SET Y, 0xBEEF\n' +
			
			'SUB PC, 1';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('no bits', 0xDEAD, this.cpu.ram.X);
		assertEquals('one bit', 0xFFF4, this.cpu.ram.Y);
	},
	
	testIfeAndStack: function () {
		expectAsserts(1);

		var src =
			'SET X, 0\n' +
			'JSR addr\n' +
			':addr IFE X, 1\n' +
			'SET PC, POP\n' +

			':halt SET PC, halt';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('stack altered', 0xFFFF, this.cpu.ram.SP);
	},
	
	testChainedIfs: function () {
		expectAsserts(1);

		var src =
			'SET A, 1\n' +
			'SET X, 0\n' +
			'SET Y, 1\n' +
			'SET Z, 2\n' +
			'IFE X, 0\n' +
			'IFE Y, 1\n' +
			'IFE Z, 2\n' +
			'SET A, 3\n' +

			'SUB PC, 1';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('chained if fulfilled', 0x3, this.cpu.ram.A);
	},

	testChainedIfs: function () {
		expectAsserts(1);

		var src =
			'SET A, 1\n' +
			'SET X, 0\n' +
			'SET Y, 1\n' +
			'IFE X, 2\n' +
			'IFE Y, 1\n' +
			'SET A, 3\n' +

			'SUB PC, 1';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('chained ifs not met', 0x1, this.cpu.ram.A);
	},

	testChainedIfsLastFails: function () {
		expectAsserts(1);

		var src =
			'SET A, 1\n' +
			'SET X, 0\n' +
			'SET Y, 1\n' +
			'SET Z, 2\n' +
			'IFE X, 0\n' +
			'IFE Y, 1\n' +
			'IFE Z, 3\n' +
			'SET A, 3\n' +

			'SUB PC, 1';

		this.cpu.load(DCPU16.asm(src).bc);
		this.cpu.steps(20);
		
		assertEquals('chained ifs not met', 0x1, this.cpu.ram.A);
	}
});
