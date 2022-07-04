// debug only
function logSimpleVariable (variableObject) {
  const key = Object.keys(variableObject)[0];
  console.log(key + ": " + variableObject[key]);
}
function logVariable (variableObject) {
  const key = Object.keys(variableObject)[0];
  console.log(key + ":");
  console.log(variable[key]);
}





class Player {

  // RenderAble property to determine importance of rendering
  static LAYER = 10;

  maxHealth = 100;
  health;
  #invincibility = false;

  // current position of center of the Player
  position;
  force = Vector2.zero(); // current force
  movement = Vector2.zero(); // movement from previous frame
  maxSpeed = 350;
  
  // Player sprite
  path = [
    Coords.Polar.fromDegrees(0.5, 0), // start
    Coords.Polar.fromDegrees(1, 30), // top point
    Coords.Polar.fromDegrees(1, 180), // tip - 2
    Coords.Polar.fromDegrees(1, 330), // bottom point
  ];
  
  // Do you need to render flare?
  isBoosting = false;
  // flare sprite
  flare = [
    Coords.Polar.fromDegrees(0.75, 345),
    Coords.Polar.fromDegrees(1, 0),
    Coords.Polar.fromDegrees(0.75, 15),
  ];
  // flare flicker animation
  flareAnimation = new Time.ContinuousInterpolate([
      new Time.Interval(1, 1.5, 50),
      new Time.Interval(1.5, 1, 50)
    ], (val, i) => {
      this.flare[1] = Coords.Polar.fromDegrees(val, 0);
    }, false, "flare animation");
  flareScale = 1;

  // rotation.distance holds speed addition for each frame the ArrowUp is pressed
  rotation;
  // degrees per second
  rotationSpeed = 180;

  scale = 20;
  normalScale;

  // collideAble -> Engine.#framehandler():for(3)
  hitRadius;

  // Delay between shots
  shootingSpeed = 200;

  // color of sprite
  color = "white";

  constructor (health = -1) {
    if (health === undefined || health < 0) {
      this.health = this.maxHealth;
    } else {
      this.health = health;
    }
    this.position = Engine.center(); // default position
    this.rotation = Coords.Polar.fromDegrees(-15, 90); // add 15 units of force if the button ArrowUp is pressed, face up
    this.normalScale = this.scale; // remember default scale value
    this.hitRadius = this.scale;

    // rotate clockwise
    Keyboard.addRegister(
      new Keyboard.KeyRegister("ArrowRight")
        .onKeyHold(() => { this.rotation.angle += Coords.toRadians(this.rotationSpeed * (Time.deltaTime / 1000)); })
    );

    // rotate counter clockwise
    Keyboard.addRegister(
      new Keyboard.KeyRegister("ArrowLeft")
        .onKeyHold(() => { this.rotation.angle -= Coords.toRadians(this.rotationSpeed * (Time.deltaTime / 1000)); })
    );

    // timeout for shooting
    const shootTimeout = new Time.TimeOut(this.shootingSpeed, false, () => {}, "shoot timer");
    // shooting animation
    // from: 140% of default scale
    // to: default scale
    // for: 2/3 this.shootingSpeed -> 200ms * 2/3 -> 133.34ms
    // update: this.scale
    // don't start immediately
    const shootAniInterpolator = new Time.Interpolate(
      new Time.Interval(
        1.4,
        1,
        this.shootingSpeed * 2/3
      ),
      val => this.scale = this.normalScale * val,
      false,
      "shoot animation"
    );
  
    // on shoot request (holding down space)
    Keyboard.addRegister(
      new Keyboard.KeyRegister(" ")
        .onKeyHold(() => {
          // check if shooting is under cooldown
          if (shootTimeout.finished) {
            // reset cooldown
            shootTimeout.reset();
            // reset animation -> starts animating
            shootAniInterpolator.reset();
          
            // get modified polar coord of tip (current scale and rotation)
            const tip = new Coords.Polar(this.path[2].distance * this.scale, this.path[2].angle + this.rotation.angle);
            // move tip point on the player position
            const tipposition = Coords.addCartToPolar(this.position, tip);
            // create new bullet from the tip of the player with same direction
            new Bullet(tipposition, Vector2.fromPolar(tip), 40);
          }
        })
    );

    // flare animation handler, keydown -> start the animation last frame; keyup -> pause the animation on current frame
    Keyboard.addRegister(
      new Keyboard.KeyRegister("ArrowUp")
        .onKeyDown(() => { this.flareAnimation.resume(); })
        .onKeyUp(() => { this.flareAnimation.pause(); })
    );

    // add to collideAble (player can collide with asteroids)
    Engine.addCollideAble(this);
    // add renderAble (needs to be rerendered every frame)
    Engine.addRenderAble(this);

    // - inicialisation animations
    // fade in and scale in
    ParticleSystem.Effects.fadeIn(this, 500);
    new Time.Interpolate(new Time.Interval(this.normalScale * 0.5, this.normalScale, 500), v => this.scale = v, true, "scale in");
    
    // move in hp bar
    new Time.Interpolate(new Time.Interval(0, 30, 500), v => this.heightProp = v, "move in hp bar");
  }

  update () {
    // check if the ArrowUp button is pressed -> signal to move the player
    if (Keyboard.isPressedDown("ArrowUp")) {
      // calculate new force from force on frame earlier
      this.force = Vector2.clamp(
        Vector2.multiply( // gliding behaviour
          Vector2.add(
            this.movement,
            Vector2.fromPolar(this.rotation),
          ),
        1.15), // the bigger the value the slipper the behaviour
        this.maxSpeed // clamp for max speed so the player isn't yeeting itself into the oblivion
      );

      // rendering flare in render function
      this.isBoosting = true;
    } else {
      this.isBoosting = false;
    }
    
    // adding current force to position
    this.position.x += this.force.x * (Time.deltaTime / 1000);
    this.position.y += this.force.y * (Time.deltaTime / 1000);

    // scaling current force down for glide effect
    this.force = Vector2.multiply(this.force, 0.95);

    // setting force to zero for simplier calculations (I hope)
    if (this.force.size < 1) {
      this.force = Vector2.zero();
    }

    // remember current force for next frame
    this.movement = this.force;

    // checking if player is out of the playing field and teleporting him to the other side
    if (Coords.Cartesian.isOutOfBoundsX(this.position, this.normalScale)) {
      if (this.position.x <= (0 - this.normalScale)) {
        this.position.x += Engine.width + (2 * this.normalScale);
      }
      
      if (this.position.x >= (Engine.width + this.normalScale)) {
        this.position.x = 0 - this.normalScale;
      }
    }

    if (Coords.Cartesian.isOutOfBoundsY(this.position, this.normalScale)) {
      if (this.position.y <= (0 - this.normalScale)) {
        this.position.y += Engine.height + (2 * this.normalScale);
      }
      
      if (this.position.y >= (Engine.height + this.normalScale)) {
        this.position.y = 0 - this.normalScale;
      }
    }

  }

  // inicialization animation property
  heightProp = 0;
  render () {
    // rendering character sprite
    Engine.drawCicular(
      this.position,
      this.path,
      this.rotation.angle,
      this.scale,
      this.color
    );

    // rendering flare sprite if the player is currently being "boosted"
    if (this.isBoosting) {
      Engine.drawCicular(
        this.position,
        this.flare,
        this.rotation.angle,
        this.scale,
        false
      );
    }

    // rendering player health
    Engine.drawRect(
      new Coords.Cartesian(0, Engine.height - this.heightProp),
      Engine.width * (this.health / this.maxHealth),
      30,
      this.#pickColor(this.health / this.maxHealth),
      true
    );

    // debug only

    // rendering player hit circle
    // Engine.drawCircle(
    //   this.position,
    //   this.hitRadius,
    //   "red"
    // );

  }


  /**
   * Fires event on collision with asteroid and passes down the asteroid with which the collision occurred
   * @param {Asteroid} asteroid 
   * @param {Vector2} direction Direction of impact from this objects prespective 
   */
   onCollision (asteroid, direction) {
    // check for invincibility so the player doesn't get insta killed
    if (this.#invincibility === false) {
      // set asteroid as destroyed -> no more collisions on set asteroid, fade out
      asteroid.destroy();
      // try to split the asteroid
      asteroid.split();
      // take 1/4 of the asteroid scale as a demage
      this.takeDamage(asteroid.scale * 0.25);
      // spwn particles around the impact in player direction
      ParticleSystem.spwnParticles(Coords.addCartToVec(this.position, Vector2.clamp(direction, this.hitRadius)), direction);
    }
  }


  // getting color from green to red based on value
  #pickColor (value) {
    // https://stackoverflow.com/questions/7128675/from-green-to-red-color-depend-on-percentage
    // value from 0 to 1
    const hue = (value * 120).toString(10);
    return ["hsl(", hue, ",100%,50%)"].join("");
  }


  #invincibilityTimeOut = new Time.TimeOut(400, false, () => this.#invincibility = false, "invincibility timer");
  takeDamage (amount) {
    // player health animation interval:
    // from:
    const snapshot = this.health;
    // to:
    let finalHealth = this.health - amount;
  
    if (finalHealth < 0) {
      finalHealth = 0;
    }

    // animate player health in 100 ms
    const healthInter = new Time.Interpolate(
      new Time.Interval(snapshot, finalHealth, 100), 
      (val, i) => this.health = val,
      true,
      "health animate"
    );

    // if finalHealth is 0 end the game
    healthInter.setOnFinished(() => {
      if (finalHealth == 0) {
        Engine.end();
      }
    });

    // trigger shake effect with magnitude scaling on the damage taken over 250 ms
    ParticleSystem.triggerShake(250, ((amount / this.maxHealth) * 40) + 10);

    // play hit animation -> color player sprite
    ParticleSystem.Effects.hitEffect(this, 200);

    // give invincibility for 400 miliseconds
    this.#invincibility = true;
    this.#invincibilityTimeOut.reset();
  }

}





class Asteroid {

  // RenderAble property to determine importance of rendering
  static LAYER = 2;

  // all asteriods in the game
  static asteroids = [];
  // center of the asteroid
  position;
  // vertexes of the asteroid
  path = [];
  // rotation props
  rotation = Coords.toRadians(0);
  rotationSpeed; // degrees per second
  rotationDirection;

  scale;
  sizes = [30, 60, 90]; //! must be sorted from lowest to highest (Asteroid.split():if(0)) and only possitive integers
  isizes; // index in sizes array

  // collideAble
  hitRadius;

  destroyed = false;
  destroy () {
    // cancel all other collisions
    this.destroyed = true;
    // fade out
    ParticleSystem.Effects.fadeOut(this, 200, () => this.unlink());
  }

  direction;

  color = "white";

  /**
   * Creates an asteroid object and automatically links it to renderAble
   * @param {Coords.Cartesian} position Position of the center of the asteroid
   * @param {Number} scale 
   * @param {Vector2} direction Heading direction
   */
  constructor (position = undefined, scale = undefined, direction = undefined) {
    // scale of the asteroid
    this.isizes = (scale === undefined) ? Math.floor(Engine.RNG(0, this.sizes.length)) : this.sizes.indexOf(scale);
    this.scale = scale ?? this.sizes[this.isizes];

    this.rotationSpeed = Engine.RNG(30, 60);
    // clockwise | counter clockwise
    this.rotationDirection = [-1, 1][Math.round(Math.random())];
    
    // creating random asteroid surface
    let angle = 0;
    let avgDistance;
    // until its whole circle create new vertexies
    while (angle < 360) {
      // in range <0.75; 1>
      const distance = Engine.RNG(0.75, 1);
      if (angle !== 0) {
        // update average distance with current distance
        avgDistance = (avgDistance + distance) / 2;
      } else {
        // first vertex
        avgDistance = distance;
      }

      this.path.push(Coords.Polar.fromDegrees(distance, angle));
      // in range <5; 15> degrees for next vertex
      angle = angle + (Engine.RNG(5, 15));
    }

    // set hit radius on the scale and average distance
    this.hitRadius = this.scale * avgDistance;

    if (position != undefined && direction != undefined) {
      this.position = position;
      this.direction = direction;
    } else {
      // creating start position and end position if position and direction are undefined
      // spwnable sides spaces
      const sides = [
        {
          name: 'up',
          width: current => Engine.RNG(0, current),
          height: current => 0 - this.scale - 10,
        }, {
          name: 'down',
          width: current => Engine.RNG(0, current),
          height: current =>  current + this.scale + 10,
        }, {
          name: 'left',
          width: current => 0 - this.scale - 10,
          height: current => Engine.RNG(0, current),
        }, {
          name: 'right',
          width: current => current + this.scale + 10,
          height: current => Engine.RNG(0, current),
        }
      ];
  
      // pick random start side
      const startSide = sides[Math.floor(Engine.RNG(0, sides.length))];
      // remove start side
      sides.splice(sides.indexOf(startSide), 1);
  
      // pick random end side
      const endSide = sides[Math.floor(Engine.RNG(0, sides.length))];
  
      // pick random coords from start side
      const start = new Coords.Cartesian(startSide.width(Engine.width), startSide.height(Engine.height));
      // pick random coords from end side and set it as target that the asteroid should arrive at
      const target = new Coords.Cartesian(endSide.width(Engine.width), endSide.height(Engine.height));
      // create a vector from these 2 points and pick random size (speed of the asteroid)
      this.direction = Vector2.clamp(new Vector2(target.x - start.x, target.y - start.y), Engine.RNG(30, 80));
      this.position = start;
    }

    Asteroid.asteroids.push(this);
    // needs to be rerendered every frame
    Engine.addRenderAble(this);
  }


  split () {
    // is able to split. (check if the asteroid is the smallest that it can get by checking first value on sizes array)
    if (this.scale != this.sizes[0]) {
      const amount = Math.round(Engine.RNG(1, 3));
      // get smaller scale value by subtracting 1 from isizes
      const s = this.sizes[this.isizes - 1];

      // spwn in box (scale/2 x scale/2) around the current center of the asteroid 
      const to = this.scale / 4;
      const from = to * (-1);
  
      // spwn all asteroids 
      for (let a = 0; a < amount; a++) {
        // random position
        const pos = Coords.addCartToCart(this.position, new Coords.Cartesian(Engine.RNG(from, to), Engine.RNG(from, to)));
        
        // pick random direction
        const dir = Vector2.fromPolar(Coords.Polar.fromDegrees(Engine.RNG(30, 80), Engine.RNG(0, 360)));

        new Asteroid(pos, s, dir);
      }
    }
  }



  update () {
    // updating center position of asteroid
    this.position.x += this.direction.x * (Time.deltaTime / 1000);
    this.position.y += this.direction.y * (Time.deltaTime / 1000);

    // check if it left the playing field
    if (Coords.Cartesian.isOutOfBounds(this.position, this.scale + 10)) {
      this.unlink();
    }

    // updating rotation by a fraction of rotation speed
    this.rotation += Coords.toRadians(this.rotationSpeed * (Time.deltaTime / 1000) * this.rotationDirection);
  }


  render () {

    // rendering asteriod path
    Engine.drawCicular(
      this.position,
      this.path,
      this.rotation,
      this.scale,
      this.color
    );

    // debug only 

    // Engine.drawVector(this.position, this.direction, "blue");

  }

  unlink () {
    Engine.removeRenderAble(this);
    Asteroid.asteroids.splice(Asteroid.asteroids.indexOf(this), 1);
  }

}





class Bullet {

  // RenderAble property to determine importance of rendering
  static LAYER = 5;

  // coords center of bullet
  position = new Coords.Cartesian(0, 0);
  direction = Vector2.zero();
  speed;
  size;

  // collideAble
  hitRadius;

  // color of the bullet
  color = "white";

  /**
   * Creates a bullet and adds it to collideable and renderable
   * @param {Coords.Cartesian} position Cartesian point in space (position of player tip)
   * @param {Vector2} direction Normalized Vector2
   * @param {Number} speed Travel speed of a bullet in pixels per second
   * @param {Number} size Radius of bullet in pixels
   */
   constructor (position, direction, speed = 40, size = 5, autoLink = true) {
    this.position = position;
    this.direction = direction;
    this.speed = speed;
    this.size = size;
    this.hitRadius = size;

    if (autoLink) {
      // add to renderAble will be rerandered every frame
      Engine.addRenderAble(this);
      // collideAble (can collide with asteroid)
      Engine.addCollideAble(this);
    }
  }

  update () {
    // update center of bullet by a fraction of direction vector
    this.position.x += this.direction.x * (Time.deltaTime / 1000) * this.speed;
    this.position.y += this.direction.y * (Time.deltaTime / 1000) * this.speed;

    // when the bullet gets out of the playing zone destroy the bullet
    if (Coords.Cartesian.isOutOfBounds(this.position, 200)) {
      this.unlink();
    }
  }

  render () {
    // render bullet as a circle
    Engine.drawCircle(this.position, this.size, this.color, true);
  }


  /**
   * Fires event on collision with asteroid and passes down the asteroid with which the collision occurred
   * @param {Asteroid} asteroid 
   * @param {Vector2} direction Direction of impact from this objects prespective 
   */
   onCollision (asteroid, direction) {
    // remove collision from set asteroid and fade it out
    asteroid.destroy();
    // add score that depends on the scale of the destroyed asteroid
    Engine.addScore(asteroid.scale);
    // try to split asteroid into smaller pieces
    asteroid.split();
    // spwn particles on the impact and from bullet direction
    ParticleSystem.spwnParticles(Coords.addCartToVec(this.position, Vector2.clamp(direction, this.hitRadius)), direction);
    // remove this bullet
    this.unlink();
  }


  unlink () {
    // remove object from renderable array
    Engine.removeCollideAble(this);
    Engine.removeRenderAble(this);
  }

}





class Time {

  // difference between frames in milliseconds
  static deltaTime = 0;
  // time of last frame
  static #lastSnapshot;

  // all time relate objects that needs to be update each frame such as TimeOut or Interpolate
  static #toUpdate = [];

  // add object to update array
  static link (idObject) {
    let inserted = false;

    // run through all Time.#toUpdate array and try to find time function with same ID and update the object
    for (let i = 0; i < this.#toUpdate.length; i++) {
      if (this.#toUpdate[i]._ID == idObject._ID) {
        this.#toUpdate[i] = idObject;
        inserted = true;
        return;
      }
    }
    
    // else push new object on the end
    if (!inserted) {
      this.#toUpdate.push(idObject);
    }
  }
  // remove object from update array
  static unlink (id) {
    let index = -1;

    // find index of given ID
    for (let i = 0; i < this.#toUpdate.length; i++) {
      if (this.#toUpdate[i]._ID == id) {
        index = i;
        break;
      }
    }

    if (index != -1) {
      // remove object on found index
      this.#toUpdate.splice(index, 1);
    }
  }

  // currect id
  static #ID = 0;
  // request new id
  static id () {
    return this.#ID++;
  }

  static setup () {
    // set default lastSnapshot to this moment
    this.#lastSnapshot = Date.now();
  }

  static reset () {
    this.#ID = 0;
    this.#toUpdate = [];
    this.deltaTime = 0;
    this.#lastSnapshot = Date.now();
  }

  // update Time.deltaTime
  static fixedUpdate () {
    // get this moment
    const current = Date.now();
    // get difference between now and previous frame
    this.deltaTime = (current - this.#lastSnapshot);
    // save for next frame
    this.#lastSnapshot = current;

    if (Engine.mode === "debug") {
      // in debug mode -> able to play the game frame by frame
      // set time difference to set value
      this.deltaTime = 20;
      console.log("Time.deltaTime: " + Time.deltaTime);
    }
  }

  // update all objects in toUpdate array
  static update () {
    if (Engine.mode === "debug") {
      console.log(this.#toUpdate);
    }
    for (let i = 0; i < this.#toUpdate.length; i++) {
      this.#toUpdate[i].update();
    }
  }

  // id system for toUpdate array
  static ID = class ID {

    _ID;

    constructor () {
      // request new ID
      this._ID = Time.id();
    }

    get id () {
      return this._ID;
    }

    link () {
      // add current object to timing functions that needs to be updated every frame
      Time.link(this);
    }
    
    unlink () {
      // remove current object from timing functions that needs to be updated every frame
      // stops the countdown but still sits in memory if the timeing function is saved in variable for later reuse
      Time.unlink(this._ID);
    }

  }

  // check TimeOut.finished value to see when given timeout has finished or set onFinished to call a function when the timeout has finished
  static TimeOut = class TimeOut extends Time.ID {

    finished = false;
    onFinished = () => {}; // function that will be played when the timeout has finished
    duration;
    defaultDuration;

    #paused = false;
    useOnCreationValue = true;
    // TRUE -> on creation value
    // FALSE -> last used value
    useLastValue () {
      this.useOnCreationValue = false;
    }
    useCreationValue () {
      this.useOnCreationValue = true;
    }

    /**
     * Creates new timing function of type TimeOut -> countdowns from the given duration and fires onFinished event when the countdown is completed
     * @param {Number} duration Duration of timeout in miliseconds. Only possitive numbers are valid input
     * @param {Boolean} autoLink Starts on creation TRUE|FALSE
     * @param {Function} onFinished Handler function for end of timeout
     */
    constructor (duration, autoLink = true, onFinished = () => {}) {
      super(); // request new id

      if (duration < 0) {
        throw new Error("Negative duration passed. Only possitive numbers are valid input. Expected: <0; +Infinity>. Got: " +  duration);
      }

      this.defaultDuration = duration;
      this.duration = duration;

      if (typeof onFinished === "function") {
        this.onFinished = onFinished;
      } else {
        throw new Error("Time.TimeOut.constructor(): onFinished handler must be a function.");
      }

      // add to update array on creation of object and start counting down the timeout
      if (autoLink) {
        this.link();
      } else {
        this.#paused = true;
        this.finished = true;
      }
    }

    

    decrese (duration) { // decrese timeout by a given duration
      this.duration -= duration;
      if (this.duration <= 0) { // when the timeout has reached the desired duration
        this.finished = true;
        this.duration = 0;

        // remove from update array -> will no longer be updated
        this.unlink();
        
        // call callback on finished event
        this.onFinished();
      }
    }

    /**
     * Resets a TimeOut for new countdown and starts it
     * @param {Number} duration Duration in miliseconds. If it is negaite number then default value will be used determened by useOnCreationValue property
     */
     reset (duration = -1) { // reuse timeout for new duration value. If the duration value is not passed the value on creation|last will be used
      this.duration = duration;
      if (duration < 0) {
        // no duration passed
        this.duration = this.defaultDuration;
      } else if (!this.useOnCreationValue) {
        // write duration if useCreationValue is set to false -> useLastValue
        this.defaultDuration = duration;
      }

      this.finished = false;
      this.#paused = false;
      // start counting down
      this.link();
    }

    /**
     * Stops counting on countdown. You are able to set if the countdown has finished: Calling TimeOut.resume() will call TimeOut.reset() method when finished property is set to TRUE
     * @param {Boolean} finishesCountdown This boolean value will be set on TimeOut.finished property.
     */
    pause (finishesCountdown = false) {
      this.unlink(); // stop counting 
      this.finished = finishesCountdown;
      this.#paused = true;

      if (this.finished) {
        this.onFinished();
      }
    }

    /**
     * Resumes from paused state
     * If paused and finished equals true -> resets the whole timer 
     */
    resume () {
      if (this.#paused) {
        if (!this.finished) {
          this.link()
          this.#paused = true;
        } else {
          this.reset();
        }
      }
    }

    update () {
      this.decrese(Time.deltaTime);
    }

  }

  static Interpolate = class Interpolate extends Time.ID {
    
    // array of intervals in order of execution [0] -> [max index]
    intervals;
    changeIntervals (intervals) {
      if (intervals instanceof Array) {
        this.intervals = intervals;
      } else {
        this.intervals = [intervals];
      }
    }
    // index of current interval
    intPointer = 0;
    // time accumulator on current interval
    localAcc = 0;
    finished = false;
    currentValue;
    onValueChange = (value) => {};
    #paused = false;
    onFinished = () => {};

    /**
     * 
     * @param {Time.Interval} intervals
     * @param {Function} onValueChange handler function for change in value. Takes 2 parameters (new_value: Number, frame_index: Number) and returns void
     * @param {Boolean} autoLink Start on creation TRUE|FALSE. Default TRUE
     */
     constructor (intervals, onValueChange, autoLink = true) {
      super();

      if (intervals instanceof Array) {
        this.intervals = intervals;
      } else {
        this.intervals = [intervals];
      }

      if (typeof onValueChange === "function") {
        this.onValueChange = onValueChange;
      } else {
        throw new Error("Time.Interpolate.constructor(): onValueChange handler must be a function with one parameter (value).")
      }

      // add to update array on creation of object and start counting down the timeout
      if (autoLink) {
        this.link();
      } else {
        this.#paused = true;
        this.finished = true;
      }
    }

    setOnFinished (func) {
      if (typeof func === "function") {
        this.onFinished = func;
      } else {
        throw new Error("Time.Interpolate.setOnFinished(): onFinished handler must be a function with one parameter (value).")
      }
    }


    next () {
      // check if localAcc is bigger than duration of current interval
      this.localAcc += Time.deltaTime;
      if (this.localAcc <= this.intervals[this.intPointer].duration) {
        // calculate new value from current interval
        return this.intervals[this.intPointer].calc(this.localAcc);
      } else {
        // increment pointer or set 0 if it is the same size as length of intervals
        this.intPointer++;
        if (this.intPointer === this.intervals.length) {
          this.finished = true;
          this.onFinished(); // call callback on finished event
          this.unlink(); // remove from update array - will no longer be updated
          return this.intervals[this.intervals.length - 1].to; // return last value of the last interval
        }
        // reset localAcc for new interval
        this.localAcc = 0;
      }
    }

    reset () {
      this.finished = false;
      this.localAcc = 0;
      this.intPointer = 0;
      this.link();
    }

    /**
     * Stops counting on countdown. You are able to set if the countdown has finished: Calling Interpolate.resume() will call Interpolate.reset() method when finished property is set to TRUE
     * @param {Boolean} finishesCountdown This boolean value will be set on Interpolate.finished property.
     */
     pause (finishesCountdown = false) {
      this.unlink(); // stop counting 
      this.finished = finishesCountdown;
      this.#paused = true;

      if (this.finished && this.onFinished !== null) {
        this.onFinished();
      }
    }

    /**
     * Resumes from paused state
     */
    resume () {
      if (this.#paused) {
        if (!this.finished) {
          this.link()
          this.#paused = true;
        } else {
          this.reset();
        }
      }
    }

    update () {
      this.currentValue = this.next();
      this.onValueChange(this.currentValue);
    }

  }

  static RandomGenerator = class RandomGenerator extends Time.ID {

    amount; // amount of generated values per frame
    duration;
    acc = 0;
    finished = false;
    onValueChange;
    #paused = false;
    onFinished = () => {};

    /**
     * 
     * @param {Number} amount Amount of generated values. lowest number is 1 and if given one it will return only Number if give more than 1 it will return arry of new values
     * @param {Number} duration Duration in miliseconds
     * @param {Function} onValueChange handler function for change in value. Takes 2 parameters (new_value: Number, frame_index: Number) and returns void
     * @param {Boolean} autoLink Start on creation TRUE|FALSE
     */
     constructor (amount, duration, onValueChange, autoLink = true) {
      super();
      // only possitive numbers
      if (amount < 1) {
        throw new Error("Negative amount passed. Only possitive numbers are valid input. Expected: <1; +Infinity>. Got: " +  amount);
      }
      // only whole numbers
      this.amount = Math.round(amount);

      if (duration < 0) {
        throw new Error("Negative duration passed. Only possitive numbers are valid input. Expected: <0; +Infinity>. Got: " +  duration);
      }
      this.duration = duration;
      if (typeof onValueChange === "function") {
        this.onValueChange = onValueChange;
      } else {
        throw new Error("Time.RandomGenerator.constructor(): onValueChange handler must be a function with one parameter (value).")
      }

      if (autoLink) {
        this.link();
      } else {
        this.#paused = true;
      }
    }

    setOnFinished (func) {
      if (typeof func === "function") {
        this.onFinished = func;
      } else {
        throw new Error("Time.RandomGenerator.setOnFinished(): onFinished handler must be a function with one parameter (value).")
      }
    }

    next () {
      this.acc += Time.deltaTime; // add time difference between frames

      if (this.acc > this.duration) { // check if it is out of time
        this.finished = true;
        this.onFinished();
        this.unlink();
      }

      if (this.amount == 1) {
        return Math.random(); // return only one number
      }
      return new Array(this.amount).fill().map(v => Math.random()); // return array of numbers
    }

    reset () {
      this.finished = false;
      this.acc = 0;
      this.link();
    }

    /**
     * Stops counting on countdown. You are able to set if the countdown has finished: Calling RandomGenerator.resume() will call RandomGenerator.reset() method when finished property is set to TRUE
     * @param {Boolean} finishesCountdown This boolean value will be set on RandomGenerator.finished property.
     */
    pause (finishesCountdown = false) {
      this.unlink(); // stop counting 
      this.finished = finishesCountdown;
      this.#paused = true;

      if (this.finished && this.onFinished !== null) {
        this.onFinished();
      }
    }

    /**
     * Resumes from paused state
     */
    resume () {
      if (this.#paused) {
        if (!this.finished) {
          this.link()
          this.#paused = true;
        } else {
          this.reset();
        }
      }
    }

    update () {
      let val = this.next();
      this.onValueChange(val);
    }

  }

  static ContinuousInterpolate = class ContinuousInterpolate extends Time.ID {
    
    intervals;
    changeIntervals (intervals) {
      if (intervals instanceof Array) {
        this.intervals = intervals;
      } else {
        this.intervals = [intervals];
      }
    }
    intPointer = 0;
    localAcc = 0;
    finished = false;
    currentValue;
    onValueChange;
    #paused = false;
    onFinished = () => {};

    /**
     * 
     * @param {Time.Interval[]} intervals Array of intervals objects { from: Number, to: Number, duration: Number }
     * @param {Function} onValueChange handler function for change in value. Takes 2 parameters (new_value: Number, frame_index: Number) and returns void
     * @param {Boolean} autoLink Start on creation TRUE|FALSE
     */
     constructor (intervals, onValueChange, autoLink = true) {
      super();
      this.intervals = intervals;
      if (typeof onValueChange === "function") {
        this.onValueChange = onValueChange;
      } else {
        throw new Error("Time.ContinuousInterpolate.constructor(): onValueChange handler must be a function with one parameter (value).")
      }

      if (autoLink) {
        this.link();
      } else {
        this.#paused = true;
      }
    }

    setOnFinished (func) {
      if (typeof func === "function") {
        this.onFinished = func;
      } else {
        throw new Error("Time.ContinuousInterpolate.setOnFinished(): onFinished handler must be a function with one parameter (value).")
      }
    }

    next () {
      // check if localAcc is bigger than duration of current interval
      this.localAcc += Time.deltaTime;
      if (this.localAcc <= this.intervals[this.intPointer].duration) {
        // calculate new value from current interval
        return this.intervals[this.intPointer].calc(this.localAcc);
      } else {
        // increment pointer or set 0 if it is the same size as length of intervals
        this.intPointer++;
        if (this.intPointer === this.intervals.length) this.intPointer = 0;
        // reset localAcc for new interval
        this.localAcc = 0;
      }
    }

    reset () {
      this.finished = false;
      this.localAcc = 0;
      this.intPointer = 0;
      this.link();
    }

    /**
     * Stops counting on countdown. You are able to set if the countdown has finished: Calling Interpolate.resume() will call Interpolate.reset() method when finished property is set to TRUE
     * @param {Boolean} finishesCountdown This boolean value will be set on Interpolate.finished property.
     */
    pause (finishesCountdown = false) {
      this.unlink(); // stop counting 
      this.finished = finishesCountdown;
      this.#paused = true;

      if (this.finished && this.onFinished !== null) {
        this.onFinished();
      }
    }

    /**
     * Resumes from paused state
     */
    resume () {
      if (this.#paused) {
        if (!this.finished) {
          this.link()
          this.#paused = true;
        } else {
          this.reset();
        }
      }
    }

    update () {
      this.currentValue = this.next();
      this.onValueChange(this.currentValue);
    }

  }

  static Interval = class Interval {

    from;
    to;
    duration;

    lowerBound;
    upperBound;

    constructor (from, to, duration) {
      this.from = from;
      this.to = to;

      if (duration < 0) {
        throw new Error("Negative duration passed. Only possitive numbers are valid input. Expected: <0; +Infinity>. Got: " +  duration);
      }

      this.duration = duration;

      this.lowerBound = Math.min(from, to);
      this.upperBound = Math.max(from, to);
    }

    /**
     * Calculates and returns value thats on a given step.
     * @param {Number} i Step between from and to values.
     * @returns Number function linear value for i
     */
    calc (i) {
      // calculate and return functional value on i => f(i)
      const val = ((i / this.duration * (this.to - this.from)) + this.from)
      
      // check if val is out of bounds if it is return closest bound
      if (val <= this.lowerBound) return this.lowerBound;
      if (val >= this.upperBound) return this.upperBound;

      if (val === undefined) {
        return this.to;
      }

      return val;
    }

  }

}





class ParticleSystem {

  // for screen shake
  static #multiplier;
  static triggerShake (duration, strength = 20) {
    // reset back global offset
    const onFinishedHandler = () => {
      Engine.setGlobalOffset(new Coords.Cartesian(0, 0));
    };

    // from: strength
    // to: 0
    // for: duration
    // change: this.#multiplier
    // start on creation
    const shakeInter = new Time.Interpolate(
      new Time.Interval(
        strength, 
        0, 
        duration
      ),
      (val) => {
        this.#multiplier = val;
      }
    );

    // generate 2 random values per frame
    // for: duration
    // change: Engine.globalOffSet
    const shakeGenerator = new Time.RandomGenerator(
      2,
      duration,
      (vals) => {
        Engine.setGlobalOffset(new Coords.Cartesian((vals[0] - 0.5) * this.#multiplier, (vals[1] - 0.5) * this.#multiplier));
      }
    );

    // onFinished event reset Engine.globalOffset
    shakeInter.setOnFinished(onFinishedHandler);
    shakeGenerator.setOnFinished(onFinishedHandler);
  }

  
  static Particle = class Particle extends Bullet {

    // RenderAble property to determine importance of rendering
    static LAYER = 9;

    interpolator;
    baseSpeed;
    baseSize;

    color = "white";

    /**
     * Spwns a particle
     * @param {Coords.Cartesian} position Start position of the particle
     * @param {Vector2} direction Heading direction
     * @param {Number} speed pixels per second
     * @param {Number} size Number of pixels for particle radius
     * @param {Number} ttl TimeToLive a time frame of the particle lifespan
     */
     constructor (position, direction, speed, size, ttl) {
      super(position, direction, speed, size);
      this.baseSpeed = this.speed;
      this.baseSize = this.size;
      // slowly shrink and slow down the particle
      this.interpolator = new Time.Interpolate(new Time.Interval(1, 0, ttl), v => {
        this.speed = v * this.baseSpeed;
        this.size = v * this.baseSize;
      });

      // fancy colors
      if (Engine.rainbow === true) {
        this.color = "hsl(" + Math.round(Engine.RNG(0, 360)) + ", 100%, 70%)";
      }

      // unlink from collideable
      super.unlink();
      
      // link only to renderable
      Engine.addRenderAble(this);
    }

    update () {
      // update center of bullet by a fraction of direction vector
      this.position.x += this.direction.x * (Time.deltaTime / 1000) * this.speed;
      this.position.y += this.direction.y * (Time.deltaTime / 1000) * this.speed;
  
      // when the bullet gets out of the playing zone destroy the bullet
      if (Coords.Cartesian.isOutOfBounds(this.position)) {
        this.interpolator.pause(true);
        this.unlink();
      }
    }

    unlink () {
      Engine.removeRenderAble(this);
    }

  }
  /**
   * Generates handfull of particles around the center of impact
   * @param {Coords.Cartesian} position Center of impact
   * @param {Vector2} direction Direction of impact
   */
  static spwnParticles (position, direction) {
    const amount = Math.round(Engine.RNG(5, 10));
    // spwn in box (20x20) around the center of the impact 
    const to = 0;
    const from = 0;
    // spwn all asteroids
    for (let a = 0; a < amount; a++) {
      // random position
      const pos = Coords.addCartToCart(position, new Coords.Cartesian(Engine.RNG(from, to), Engine.RNG(from, to)));
      // pick random direction
      const dir = Vector2.fromPolar(new Coords.Polar(1, direction.toPolar().angle + Coords.toRadians(Engine.RNG(-75, 75))));
      // random speed and size based on factor -> the bigger the factor the bigger the speed but smaller the particle
      const factor = Math.random();
      const speed = factor * 200 + 200;
      const size = (1 - factor) * 9 + 1;
      // lifespan duration of the particle
      const ttl = Engine.RNG(200, 500);

      new this.Particle(pos, dir, speed, size, ttl);
    }
  }

  static Effects = class Effects {

    // fade out object -> from white to black
    static fadeOut (renderAble, duration, onFinished = () => {}) {
      new Time.Interpolate(new Time.Interval(100, 0, duration), v => renderAble.color = "hsl(0, 0%, " + v + "%)", true)
        .setOnFinished(onFinished);
    }

    // fade in object -> from black to white
    static fadeIn (renderAble, duration, onFinished = () => {}) {
      new Time.Interpolate(new Time.Interval(0, 100, duration), v => renderAble.color = "hsl(0, 0%, " + v + "%)", true)
        .setOnFinished(onFinished);
    }

    // change color from white to red-ish and then back white
    static hitEffect (renderAble, duration, onFinished = () => {}) {
      new Time.Interpolate([
        new Time.Interval(100, 25, 20),
        new Time.Interval(25, 25, duration),
        new Time.Interval(25, 100, 20)
      ], v => renderAble.color = "hsl(340,100%," + v + "%)", true)
        .onFinished(onFinished);
    }

  }

}





class Engine {

  // random number from to
  static RNG (from, to) {
    return Math.random() * (Math.max(from, to) - Math.min(from, to)) + from;
  }



  // screen shake effect
  static #globalOffsetposition;
  static getGlobalOffSet () {
    if (this.#globalOffsetposition === undefined) {
      this.#globalOffsetposition = new Coords.Cartesian(0, 0);
    }

    return this.#globalOffsetposition;
  }
  static setGlobalOffset (coords) {
    this.#globalOffsetposition = coords;
  }




  static renderAble = [];
  /**
   * Gets index from renderAble array for layer given layer
   * @param {Number} layer
   * @returns 
   */
  static renderAbleIndex(layer) { // https://stackoverflow.com/questions/1344500/efficient-way-to-insert-a-number-into-a-sorted-array-of-numbers
    var low = 0,
    high = this.renderAble.length;

    while (low < high) {
      var mid = (low + high) >>> 1;
      if ((this.renderAble[mid].constructor.LAYER ?? this.renderAble[mid].layer ?? 0) > layer) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  static addRenderAble (object, layer = 0) { // add to sorted array of renderAble by LAYER
    if (object.constructor.LAYER === undefined && object.layer === undefined) {
      object.layer = layer ?? 0;
    }

    layer = object.constructor.LAYER ?? object.layer;
    this.renderAble.splice(this.renderAbleIndex(layer), 0, object);
  }
  static removeRenderAble (object) {
    Engine.renderAble.splice(Engine.renderAble.indexOf(object), 1);
  }



  static collideAble = [];
  static addCollideAble (object) {
    this.collideAble.push(object);
  }
  static removeCollideAble (object) {
    Engine.collideAble.splice(Engine.collideAble.indexOf(object), 1);
  }





  static #frameHandler = () => {
    this.iteration++;
    Time.fixedUpdate();
    Keyboard.update();
    
    Time.update();

    // update props of renderables
    for (let i = Engine.renderAble.length - 1; i >= 0; i--) {
      Engine.renderAble[i].update();
    }

    // check for collisions
    for (let i = 0; i < Asteroid.asteroids.length; i++) {
      const a = Asteroid.asteroids[i];
      for (let i = 0; i < this.collideAble.length; i++) {
        const c = this.collideAble[i];
        const v = Vector2.from2Cart(a.position, c.position);
        if (a.destroyed === false && v.size < (a.hitRadius + c.hitRadius)) {
          c.onCollision(a, v);
        }
      }
    }

    // clear game area
    this.canvas.clearRect(0, 0, canvas.width, canvas.height);

    // rereder game area
    for (var i = Engine.renderAble.length - 1; i >= 0; i--) {
      Engine.renderAble[i].render();
    }

    if (Engine.mode !== "debug") {
      // check if the game should be ended
      if (!this.endOnNextFrame) {
        this.#frameRequest = requestAnimationFrame(this.#frameHandler);
      } else {
        gameOver.classList.remove("hide");
        gameOver.style.zIndex = 8;
        gameOver.querySelector("p.totalScore").innerHTML = "TOTAL SCORE: " + Engine.score;
      }
    }
  };
  static #frameRequest;
  static iteration = 0;

  static #canvasHTML;
  static #scoreHTML;
  static canvas;
  static width = 800;
  static height = 800;

  static mode = "standard";
  static rainbow = false;
  static endOnNextFrame = false;
  static asteroidInterval;
  
  static start () {
    // get html elements
    this.#canvasHTML = document.querySelector("canvas#canvas");
    this.#scoreHTML = document.querySelector("p.score");
    this.canvas = this.#canvasHTML.getContext("2d");
    
    // setup time and keyboard listener
    Time.setup();
    Keyboard.setup();

    // add player and one asteroid
    new Player();
    new Asteroid(undefined, 90, undefined);
    
    // spwn asteroid every 2500ms
    this.asteroidInterval = new Time.TimeOut(2500, true, () => {
      new Asteroid(undefined, 90, undefined);
      this.asteroidInterval.reset();
    });

    this.#frameRequest = requestAnimationFrame(this.#frameHandler);
  }

  static debug () {
    this.mode = "debug";
    this.#canvasHTML = document.querySelector("canvas#canvas");
    this.canvas = this.#canvasHTML.getContext("2d");
    
    this.score = 0;
    
    Time.setup();
    Keyboard.setup();

    new Player();
    new Asteroid(undefined, 90, undefined);

    const asteroidInterval = new Time.TimeOut(2500, true, () => {
      new Asteroid(undefined, 90, undefined);
      asteroidInterval.reset();
    }, "asteroid timer");

    document.addEventListener("click", evt => {
      console.log("_________NEW FRAME_________");
      console.time("Time for single frame");
      this.#frameHandler();
      console.timeEnd("Time for single frame");
      console.log("___________________________");
    });
  }


  static reset () {
    // reset whole game to default state
    this.score = 0;
    this.#scoreHTML.innerHTML = "SCORE: 0";
    this.renderAble = [];
    this.collideAble = [];
    this.#globalOffsetposition = new Coords.Cartesian(0, 0);
    this.endOnNextFrame = false;
    this.iteration = 0;
    Asteroid.asteroids = [];
    Keyboard.reset();
    Time.reset();

    new Player();
    new Asteroid(undefined, 90, undefined);

    this.asteroidInterval = new Time.TimeOut(2500, true, () => {
      new Asteroid(undefined, 90, undefined);
      this.asteroidInterval.reset();
    }, "asteroid timer");

    this.#frameRequest = requestAnimationFrame(this.#frameHandler);
  }


  static score = 0;
  // score animator
  static #scoreInterpolator = new Time.Interpolate(new Time.Interval(0, 0, 0), v => {
    v = Math.round(v);
    this.score = v;
    this.#scoreHTML.innerHTML = "SCORE: " + v;
  }, false);
  static addScore (amount) {
    let from, to;
    if (this.#scoreInterpolator.finished === true) {
      from = this.score;
      to = this.score + amount;
    } else {
      // pause animation
      this.#scoreInterpolator.pause(true);
      // get current value and set it as start
      from = this.#scoreInterpolator.currentValue;
      // get to value of interval and add amount to it
      to = this.#scoreInterpolator.intervals[0].to + amount;
    }

    // set and interpolate new interval
    this.#scoreInterpolator.changeIntervals(new Time.Interval(from, to, 350));
    this.#scoreInterpolator.reset();
  }



  static end () {
    this.endOnNextFrame = true;
  }


  /**
   * Draws a shape as if it is circular
   * @param {Coords.Cartesian} center center of shape
   * @param {Coords.Polar[]} polarCoords points of shape
   * @param {Number} rotationAngle in radians
   * @param {Boolean} closePath Connect last point to the first one? TRUE|FALSE
   * @param {String} style Color of fill in string format
   * @param {Boolean} fill Do you want to fill path? TRUE|FALSE
   */
   static drawCicular (center, polarCoords, rotationAngle = 0, scale = 1, style = "white", closePath = true, fill = false) {
    // modify points
    const modifiedPCoords = polarCoords.map(p => new Coords.Polar(p.distance * scale, p.angle + rotationAngle));
    // modify center by globalOffSet
    const offsetedCenter = Coords.addCartToCart(center, Engine.getGlobalOffSet());

    // get first vertex and move "pen" to it
    const start = Coords.addCartToPolar(offsetedCenter, modifiedPCoords.shift());

    this.canvas.beginPath();
    this.canvas.lineWidth = "3";
    this.canvas.moveTo(start.x, start.y);
    
    // iterate through all vertexies and draw line between them
    for (let i = 0; i < modifiedPCoords.length; i++) {
      const vertex = Coords.addCartToPolar(offsetedCenter, modifiedPCoords[i]);
      this.canvas.lineTo(vertex.x, vertex.y);
    }
    
    if (closePath) {
      this.canvas.closePath();
    }
    
    // fill or stroke
    if (fill) {
      this.canvas.fillStyle = style;
      this.canvas.fill();
    } else {
      this.canvas.strokeStyle = style;
      this.canvas.stroke();
    }
  }

  static drawCircle (center, radius, style = "white", fill = false) {
    // offset the center of the circle by globalOffSet
    const offsetedCenter = Coords.addCartToCart(center, Engine.getGlobalOffSet());

    this.canvas.beginPath();
    this.canvas.arc(offsetedCenter.x, offsetedCenter.y, radius, 0, 2 * Math.PI);

    // fill or stroke
    if (fill) {
      this.canvas.fillStyle = style;
      this.canvas.fill();
    } else {
      this.canvas.strokeStyle = style;
      this.canvas.stroke();
    }

    this.canvas.strokeStyle = style;
    this.canvas.stroke();
  }

  /**
   * 
   * @param {Coords.Cartesian} start x and y of top left corner of the rectangle
   * @param {Number} width Width of the rectangle
   * @param {Number} height Height of the rectangle
   * @param {String} style Color of fill in string format
   * @param {Boolean} fill Do you want to fill rectangle? TRUE|FALSE
   */
  static drawRect (start, width, heigh, style = "white", fill = false) {
    this.canvas.beginPath();
    const globalOffset = this.getGlobalOffSet();
    this.canvas.rect(
      start.x + globalOffset.x,
      start.y + globalOffset.y,
      width,
      heigh
    );

    // fill or stroke
    if (fill) {
      this.canvas.fillStyle = style;
      this.canvas.fill();
    } else {
      this.canvas.strokeStyle = style;
      this.canvas.stroke();
    }
  }

  static drawVector (start, v, style = "white") {
    const offsetedStart = Coords.addCartToCart(start, this.getGlobalOffSet());

    this.canvas.beginPath();
    this.canvas.moveTo(offsetedStart.x, offsetedStart.y);
    this.canvas.lineTo(offsetedStart.x + v.x, offsetedStart.y + v.y);
    this.canvas.strokeStyle = style;
    this.canvas.stroke();    
  }

  static center () {
    return new Coords.Cartesian(this.width / 2, this.height / 2)
  }

}





class Keyboard {

  // key event info holder
  static KeyRegister = class KeyRegister {

    down = () => {};
    hold = () => {};
    up = () => {};
    key;

    onKeyDown (handler) {
      this.down = handler;
      return this;
    }
    onKeyHold (handler) {
      this.hold = handler;
      return this;
    }
    onKeyUp (handler) {
      this.up = handler;
      return this;
    }

    constructor (key) {
      this.key = key;
    }

  }

  // all key event info holders
  static #registers = {};
  // active keys that are currently pressed down
  static #active = new Set();

  static isPressedDown (key) {
    return this.#active.has(key);
  }

  static setup () {
    // add to active and call keydown event
    document.addEventListener("keydown", evt => {
      this.#active.add(evt.key);
      if (this.#registers[evt.key] !== undefined) {
        for (let i = 0; i < this.#registers[evt.key].length; i++) {
          this.#registers[evt.key][i].down();
        }
      }
    });
    
    // remove from active and call keyup event
    document.addEventListener("keyup", evt => {
      this.#active.delete(evt.key);
      if (this.#registers[evt.key] !== undefined) {
        for (let i = 0; i < this.#registers[evt.key].length; i++) {
          this.#registers[evt.key][i].up();
        }
      }
    });
  }

  static reset () {
    this.#registers = {};
    this.#active = new Set();
  }

  static addRegister (register) {
    // add key event info holder
    if (this.#registers[register.key] === undefined) {
      this.#registers[register.key] = [register];
    } else {
      this.#registers[register.key].push(register);
    }
  }

  static update () {
    for (const key in this.#registers) {
      if (this.#active.has(key)) {
        for (let i = 0; i < this.#registers[key].length; i++) {
          this.#registers[key][i].hold();
        }
      }
    }
  }

}




class Vector2 {

  static zero () {
    return new Vector2(0, 0, true);
  }


  static add (v1, v2) {
    return new Vector2(v1.x + v2.x, v1.y + v2.y);
  }


  static division (v, num = 2) {
    if (v.isZero === true) return this.zero();
    return new Vector2(v.x / num, v.y / num);
  }


  static multiply (v, num) {
    return new Vector2(v.x * num, v.y * num);
  }


  static mean (v1, v2) {
    return new Vector2((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
  }


  static clamp (v, maxLength) {
    if (v.size <= maxLength) return v;
    return Vector2.multiply(v, (1 - (v.size - maxLength) / v.size));
  }


  static fromPolar (polar) {
    const cart = polar.toCartesian();
    return new Vector2(cart.x, cart.y);
  }


  /**
   * Creates vector from cart1 to cart2
   * @param {Coords.Cartesian} cart1 p1
   * @param {Coords.Cartesian} cart2 p2
   * @returns Vector2
   */
  static from2Cart (cart1, cart2) {
    return new Vector2(cart2.x - cart1.x, cart2.y - cart1.y);
  }

  x;
  y;
  isZero;
  size;

  constructor (x, y, isZero = false) {
    this.x = x;
    this.y = y;
    this.isZero = isZero;

    if (this.isZero === true) {
      this.size = 0;
    } else {
      this.size = Math.sqrt((this.x ** 2) + (this.y ** 2));
    }
  }

  toPolar () {
    return new Coords.Polar(Math.sqrt((this.x * this.x) + (this.y * this.y)), Math.atan2(this.y, this.x));
  }

}




class Coords {

  static Polar = class Polar {

    static fromDegrees (distance, angle) {
      return new Coords.Polar(distance, Coords.toRadians(angle));
    }

    static isOutOfBounds (coords) {
      Coords.Cartesian.isOutOfBounds(coords.toCartesian());
    }

    distance;
    angle;

    /**
     * 
     * @param {Number} distance distance to relative center
     * @param {Number} angle in radians
     */
    constructor (distance, angle) {
      this.distance = distance;
      this.angle = angle;
    }

    toCartesian () {
      return Coords.toCartesian(this.distance, this.angle);
    }

    addCartesian (cartesian) {
      const thisCart = this.toCartesian();
      const newPolar = new Coords.Cartesian(cartesian.x + thisCart.x, cartesian.y + thisCart.y).toPolar();

      this.angle = newPolar.angle;
      this.distance = newPolar.distance;
    }

  }




  static Cartesian = class Cartesian {

    static isOutOfBounds (coords, mean = 0) {
      return ((coords.x <= (0 - mean) || coords.x >= (Engine.width + mean)) || (coords.y <= (0 - mean) || coords.y >= (Engine.height + mean)))
    }

    static isOutOfBoundsX (coords, mean = 0) {
      return (coords.x <= (0 - mean) || coords.x >= (Engine.width + mean));
    }
    static isOutOfBoundsY (coords, mean = 0) {
      return (coords.y <= (0 - mean) || coords.y >= (Engine.height + mean));
    }

    x;
    y;

    constructor (x, y) {
      this.x = x;
      this.y = y;
    }

    toPolar () {
      return Coords.toPolar(this.x, this.y);
    }

    toString () {
      return "{x: " + this.x + ", y: " + this.y + "}";
    }

  }




  /**
   * Converts polar coordinates to cartesian coordinates
   * @param {Number} distance in pixels relative to the center of the canvas
   * @param {Number} angle in radians
   * @returns x, y
   */
  static toCartesian (distance, angle) {
    return { x: (distance * Math.cos(angle)), y: (distance * Math.sin(angle))};
  }


  /**
   * Converts cartesian coordinates to polar coordinates
   * @param {Number} x in pixels relative to the center of the canvas
   * @param {Number} y in pixels relative to the center of the canvas
   * @returns distance, angle
   */
  static toPolar (x, y) {
    return { distance: Math.sqrt((x * x) + (y * y)), angle: Math.atan2(y, x) };
  }


  static toRadians (degrees) {
    return degrees * (Math.PI / 180);
  }


  static toDegrees (radians) {
    return radians * (180 / Math.PI);
  }


  /**
   * adds 2 coords and depending on inCartesian boolean returns prefered type
   * @param {Coords.Cartesian} cartesian 
   * @param {Coords.Polar} polar 
   * @param {Boolean} inCartesian Default value TRUE
   */
  static addCartToPolar (cartesian, polar, inCartesian = true) {
    const cart = polar.toCartesian();

    if (inCartesian) {
      return new Coords.Cartesian(cart.x + cartesian.x, cart.y + cartesian.y);
    }

    return new Coords.Cartesian(cart.x + cartesian.x, cart.y + cartesian.y).toPolar();
  }

  /**
   * adds 2 coords and depending on inCartesian boolean returns prefered type
   * @param {Coords.Cartesian} cartesian1 
   * @param {Coords.Cartesian} cartesian2
   * @param {Boolean} inCartesian Default TRUE
   */
  static addCartToCart (cartesian1, cartesian2, inCartesian = true) {
    if (inCartesian) {
      return new Coords.Cartesian(cartesian1.x + cartesian2.x, cartesian1.y + cartesian2.y);
    }

    return new Coords.Cartesian(cartesian1.x + cartesian2.x, cartesian1.y + cartesian2.y).toPolar();
  }

  /**
   * Uses cartesian as the start of the vector and translates to the tip of the vector and returns its coords
   * @param {Coords.Cartesian} cartesian 
   * @param {Vector2} vector 
   * @returns 
   */
  static addCartToVec (cartesian, vector) {
    return new Coords.Cartesian(cartesian.x + vector.x, cartesian.y + vector.y);
  }

}




const ui = document.querySelector("section.ui");
const gameOver = document.querySelector("section.gameOver");
document.querySelector("section.ui button.play").addEventListener("click", evt => {
  evt.target.blur();
  ui.classList.add("hide");
  setTimeout(() => {
    Engine.start();
    ui.style.zIndex = 0;
  }, 1000);
});
document.querySelector("section.gameOver button.playAgain").addEventListener("click", evt => {
  evt.target.blur();
  gameOver.classList.add("hide");
  setTimeout(() => {
    Engine.reset();
    gameOver.style.zIndex = 0;
  }, 1000);
});