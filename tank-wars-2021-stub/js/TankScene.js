class TankScene extends Phaser.Scene {
    map;
    playerTank;
    destructLayer;
    bullets;
    enemyBullets;
    enemyTanks = []
    explosions;
    preload() {
        this.load.atlas('tank', 'assets/tanks/tanks.png', 'assets/tanks/tanks.json');
        this.load.atlas('enemy', 'assets/tanks/enemy-tanks.png', 'assets/tanks/tanks.json');
        this.load.atlas('boss', 'assets/tanks/boss-tanks.png', 'assets/tanks/tanks.json')
        this.load.image('tileset', 'assets/tanks/landscape-tileset.png')
        this.load.tilemapTiledJSON('tilemap', 'assets/tanks/map.json')
        this.load.image('bullet', 'assets/tanks/bullet.png');
        this.load.spritesheet('kaboom', 'assets/tanks/explosion.png', {
            frameWidth: 64,
            frameHeight: 64
        })

    }
    create() {
        this.map = this.make.tilemap({
            key: "tilemap"

        });
        let landscape = this.map.addTilesetImage("landscape-tileset", "tileset");
        this.map.createLayer('ground', landscape, 0, 0);
        this.destructLayer = this.map.createLayer("destructable", landscape, 0, 0);
        this.destructLayer.setCollisionByProperty(
            { collides: true }
        );
        let objectLayer = this.map.getObjectLayer("objects");
        let tempEnemies = [];
        objectLayer.objects.forEach(
            function (object) {
                let obj = Utils.RetrieveCustomProperties(object);
                if (obj.type == "playerSpawn") {
                    this.createPlayer(obj);
                } else if (obj.type == "enemySpawn" || obj.type == "bossSpawn") {
                    tempEnemies.push(obj);

                }


            }, this
        );
        this.enemyBullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 10
        });
        for (let i = 0; i < tempEnemies.length; i++) {
            this.createEnemy(tempEnemies[i]);
        }
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 5
        });
        this.physics.world.on('worldbounds', function (body) {
            this.disposeOfBullet(body.gameObject);
        }, this);
        this.input.on('pointerdown', this.tryShoot, this);
        this.anims.create({
            key: 'explode',
            frames: this.anims.generateFrameNumbers('kaboom', {
                start: 0,
                end: 23,
                first: 23

            }),
            frameRate: 24
        });
        this.explosions = this.physics.add.staticGroup({
            defaultKey: 'kaboom',
            maxSize: tempEnemies.length + 1
        })
    }

    update(time, delta) {
        this.playerTank.update()
        for (let i = 0; i < this.enemyTanks.length; i++) {
            this.enemyTanks[i].update(time, delta)
        }

    }
    tryShoot(pointer) {
        let bullet = this.bullets.get(this.playerTank.turret.x, this.playerTank.turret.y)
        if (bullet) {
            this.fireBullet(bullet, this.playerTank.turret.rotation, this.enemyTanks);
        }
    }
    fireBullet(bullet, rotation, target) {
        bullet.setDepth(3);
        bullet.body.collideWorldBounds = true;
        bullet.body.onWorldBounds = true;
        bullet.enableBody(false, bullet.x, bullet.y, true, true);
        bullet.rotation = rotation;
        let firingOffset = new Phaser.Math.Vector2();
        this.physics.velocityFromRotation(bullet.rotation, 40, firingOffset);
        bullet.setPosition(bullet.x + firingOffset.x, bullet.y + firingOffset.y)
        this.physics.velocityFromRotation(bullet.rotation, 500, bullet.body.velocity);
        this.physics.add.collider(bullet, this.destructLayer, this.damageTile, null, this);
        if (target == this.playerTank) {
            this.physics.add.overlap(this.playerTank.hull, bullet, this.bulletHitPlayer, null, this);
        } else {
            for (let i = 0; i < this.enemyTanks.length; i++) {
                this.physics.add.overlap(this.enemyTanks[i].hull, bullet, this.bulletHitEnemy, null, this);

            }
        }

    }
    bulletHitPlayer(hull, bullet) {
        this.disposeOfBullet(bullet);
        this.playerTank.damage();
        if(this.playerTank.isDestroyed()){
            this.input.enabled = false;
            this.enemyTanks = [];
            this.physics.pause();
            let explosion = this.explosions.get(hull.x,hull.y);
            if(explosion){
                this.activateExplosion(explosion);
                explosion.play('explode');

            }
        }
    }
    bulletHitEnemy(hull, bullet) {
        let enemyTank;
        let index;
        for (let i = 0; i < this.enemyTanks.length; i++) {
            if (this.enemyTanks[i].hull == hull) {
                enemyTank = this.enemyTanks[i];
                index = i;
                break;
            }
        }
        this.disposeOfBullet(bullet);
        enemyTank.damage();
        if (enemyTank.isImmobilised()) {
            let explosion = this.explosions.get(hull.x, hull.y);
            if (explosion) {
                this.activateExplosion(explosion)
                explosion.on('animationcomplete', this.animComplete, this);
                explosion.play('explode');
            }
            if (enemyTank.isDestroyed()) {
                this.enemyTanks.splice(index, 1)
            }

        }

    }
    activateExplosion(explosion) {
        explosion.setDepth(5);
        explosion.setActive(true);
        explosion.setVisible(true);
    }
    animComplete(animation, frame, gameObject) {
        gameObject.disableBody(true, true);
    }
    disposeOfBullet(bullet) {
        bullet.disableBody(true, true);

    }
    createPlayer(obj) {
        this.playerTank = new PlayerTank(this, obj.x, obj.y, 'tank');
        console.log(this.playerTank)
        this.cameras.main.startFollow(this.playerTank.hull, true, 0.5, 0.5)
        this.playerTank.enableCollision(this.destructLayer);

    }
    createEnemy(obj) {
        let enemyTank;
        if(obj.type == "enemySpawn"){
            enemyTank = new EnemyTank(this, obj.x, obj.y, 'enemy', this.playerTank);
        }else if(obj.type == "bossSpawn"){
            enemyTank = new BossEnemy(this, obj.x, obj.y, 'boss', this.playerTank);

        }
        
        enemyTank.initMvt();
        enemyTank.setBullets(this.enemyBullets);
        enemyTank.enableCollision(this.destructLayer);
        this.enemyTanks.push(enemyTank);
        this.physics.add.collider(enemyTank.hull, this.playerTank.hull);
        if (this.enemyTanks.length > 1) {
            for (let i = 0; i < this.enemyTanks.length - 1; i++) {
                this.physics.add.collider(enemyTank.hull, this.enemyTanks[i].hull);
            }
        }
    }
    damageTile(bullet, tile) {
        this.disposeOfBullet(bullet);
        let firstGID = this.destructLayer.tileset[0].firstgid;
        let nextTileID = tile.index + 1 - firstGID;
        let tileProperties = this.destructLayer.tileset[0].tileProperties[nextTileID];
        let newTile = this.destructLayer.putTileAt(nextTileID + firstGID, tile.x, tile.y);
        if (tileProperties) {
            if (tileProperties.collides) {
                newTile.setCollision(true);
            }
        }

    }
}