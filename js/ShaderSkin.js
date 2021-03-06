/**
 * @author alteredq / http://alteredqualia.com/
 *
 */


THREE.ShaderSkin = {

	/* ------------------------------------------------------------------------------------------
	//	Simple skin shader
	//		- per-pixel Blinn-Phong diffuse term mixed with half-Lambert wrap-around term (per color component)
	//		- physically based specular term (Kelemen/Szirmay-Kalos specular reflectance)
	//
	//		- diffuse map
	//		- bump map
	//		- specular map
	//		- point, directional and hemisphere lights (use with "lights: true" material option)
	//		- fog (use with "fog: true" material option)
	//		- shadow maps
	//
	// ------------------------------------------------------------------------------------------ */

	'skinSimple' : {

		uniforms: THREE.UniformsUtils.merge( [

			THREE.UniformsLib[ "fog" ],
			THREE.UniformsLib[ "lights" ],
			THREE.UniformsLib[ "shadowmap" ],

			{

			"enableBump"	: { type: "i", value: 0 },
			"enableSpecular": { type: "i", value: 0 },

			"tDiffuse"	: { type: "t", value: null },
			"tBeckmann"	: { type: "t", value: null },
			"normalT"	: { type: "t", value: null },
			"scatter1"	: { type: "t", value: null },
			"scatter2"	: { type: "t", value: null },
			"noise"	: { type: "t", value: null },

			"uDiffuseColor":  { type: "c", value: new THREE.Color( 0xeeeeee ) },
			"uSpecularColor": { type: "c", value: new THREE.Color( 0x111111 ) },
			"uAmbientColor":  { type: "c", value: new THREE.Color( 0x050505 ) },
			"uOpacity": 	  { type: "f", value: 1 },

			"uRoughness": 	  		{ type: "f", value: 0.15 },
			"uSpecularBrightness": 	{ type: "f", value: 0.75 },

			"uScatterness": 	  		{ type: "f", value: 0.5 },

			"uCheeks": 	  		{ type: "f", value: 0.5 },
			"uNeck": 	  		{ type: "f", value: 0.5 },
			"uChin": 	  		{ type: "f", value: 0.5 },
			"uLips": 	  		{ type: "f", value: 0.5 },
			"uForehead": 	  	{ type: "f", value: 0.5 },
			"uNose": 	  		{ type: "f", value: 0.5 },

			"uSine": 	  { type: "f", value: 1 },


			"tFaceSection"	: { type: "t", value: null },

			"bumpMap"	: { type: "t", value: null },
			"bumpScale" : { type: "f", value: 1 },
			"gammaCorrection" : { type: "f", value: 2.2 },

			"specularMap" : { type: "t", value: null },

			"offsetRepeat" : { type: "v4", value: new THREE.Vector4( 0, 0, 1, 1 ) },

			"uWrapRGB":	{ type: "v3", value: new THREE.Vector3( 0.75, 0.375, 0.1875 ) }

			}

		] ),

		fragmentShader: [
			"#extension GL_OES_standard_derivatives : enable",
			"#define USE_BUMPMAP",
			

			"uniform bool enableBump;",
			"uniform bool enableSpecular;",

			"uniform vec3 uAmbientColor;",
			"uniform vec3 uDiffuseColor;",
			"uniform vec3 uSpecularColor;",
			"uniform float uOpacity;",

			"uniform float uRoughness;",
			"uniform float uSpecularBrightness;",

			"uniform vec3 uWrapRGB;",

			"uniform sampler2D tDiffuse;",
			"uniform sampler2D tBeckmann;",

			"uniform sampler2D diffuse;",
			"uniform sampler2D scatter1;",
			"uniform sampler2D scatter2;",
			"uniform sampler2D normalT;",
			"uniform sampler2D noise;",


			"uniform sampler2D specularMap;",

			"varying vec3 vNormal;",
			"varying vec2 vUv;",



			"uniform vec3 ambientLightColor;",

			"varying float vScatterOn;",
			"uniform float uScatterness;",
			"uniform float uCheeks;",
			"uniform float gammaCorrection;",


			"#if MAX_DIR_LIGHTS > 0",

				"uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];",
				"uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];",

			"#endif",

			"#if MAX_HEMI_LIGHTS > 0",

				"uniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];",
				"uniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];",
				"uniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];",

			"#endif",

			"#if MAX_POINT_LIGHTS > 0",

				"uniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];",
				"uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];",
				"uniform float pointLightDistance[ MAX_POINT_LIGHTS ];",

			"#endif",

			"varying vec3 vViewPosition;",

			THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
			THREE.ShaderChunk[ "fog_pars_fragment" ],
			THREE.ShaderChunk[ "bumpmap_pars_fragment" ],

			// Fresnel term

			"float fresnelReflectance( vec3 H, vec3 V, float F0 ) {",

				"float base = 1.0 - dot( V, H );",
				"float exponential = pow( base, 5.0 );",

				"return exponential + F0 * ( 1.0 - exponential );",

			"}",

			// Kelemen/Szirmay-Kalos specular BRDF

			"float KS_Skin_Specular( vec3 N,", 		// Bumped surface normal
									"vec3 L,", 		// Points to light
									"vec3 V,", 		// Points to eye
									"float m,",  	// Roughness
									"float rho_s", 	// Specular brightness
									") {",

				"float result = 0.0;",
				"float ndotl = dot( N, L );",

				"if( ndotl > 0.0 ) {",

					"vec3 h = L + V;", // Unnormalized half-way vector
					"vec3 H = normalize( h );",

					"float ndoth = dot( N, H );",

					"float PH = pow( 2.0 * texture2D( tBeckmann, vec2( ndoth, m ) ).x, 10.0 );",

					"float F = fresnelReflectance( H, V, 0.028 );",
					"float frSpec = max( PH * F / dot( h, h ), 0.0 );",

					"result = ndotl * rho_s * frSpec;", // BRDF * dot(N,L) * rho_s

				"}",

				"return result;",

			"}",


			"vec4 GammaCorrection (vec4 Color)",
			"{",
			"vec4 Final_color;",
			"Final_color.x = pow(Color.x,gammaCorrection);",
			"Final_color.y = pow(Color.y,gammaCorrection);",
			"Final_color.z = pow(Color.z,gammaCorrection);",
			"Final_color.w = pow(Color.w,gammaCorrection);",
			"return Final_color;",
			"}",		


			"vec4 lerp(vec4 input1, vec4 input2, float weight)",
			"{ // the weight for lerping",
			"return input1*(1.0-weight)+input2*(weight);",
			"}",



			"void main() {",

				"gl_FragColor = vec4( vec3( 1.0 ), uOpacity );",

				"vec4 colDiffuse = texture2D( tDiffuse, vUv );",






				 "vec4 Cnoise   = texture2D( noise, vUv);",
				 "vec4 Cscatter1= texture2D( scatter1, vUv+ Cnoise.yz);",
				 "vec4 Cscatter2= texture2D( scatter2, vUv+ Cnoise.xy);",
				 "vec4 Cnormal  = texture2D( normalT, vUv);",
				 "vec3 fvNormal = normalize( ( Cnormal.xyz * 2.0 ) - 1.0 );",

				 "colDiffuse = GammaCorrection(colDiffuse);",
				 "Cscatter1 = GammaCorrection(Cscatter1);",
				 "Cscatter2 = GammaCorrection(Cscatter2);",
				 "Cnoise = GammaCorrection(Cnoise);",
				 "//float lum = dot(colDiffuse.xyz, vec3(0.33, 0.59, 0.11));",
				 "float fresnelBias = 0.10;",
				 "float fresnelScale = 0.25;",
				 "float fresnelPower = 1.30;",



				"vec4 temp_color = colDiffuse * 1.0 + 0.0 * vScatterOn * Cscatter2 * uScatterness + Cscatter1 * 0.0;",

				"//colDiffuse.rgb *= colDiffuse.rgb;",



				"vec3 normal = normalize( vNormal );",
				"vec3 viewPosition = normalize( vViewPosition );",

				"//vec4 Fresnel = vec4((fresnelBias+fresnelScale*pow(1+dot(viewPosition,fvNormal)), fresnelPower));",
				"vec4 Fresnel = vec4(dot(viewPosition,fvNormal));",
				"//Fresnel = vec4(fresnelBias)+vec4(fresnelScale)*(vec4(1)+Fresnel)",
		
				"vec4 fvAmbient = vec4(0.517, 0.517, 0.517, 1);",
				"vec4 fvDiffuse = vec4(0.498, 0.494, 0.494, 1);",
				"vec4 fvSpecular = vec4(0.49, 0.48, 0.48, 1);",
				"vec4 fvLightColor  = vec4 (1, 0.99, 0.74, 1);",



	
"vec4 ambient_color = ( colDiffuse * 0.3 * Fresnel * fvAmbient + 0.6 * Cscatter1 * Fresnel * fvAmbient + 1.5 * uScatterness * vScatterOn * Cscatter2 * Fresnel * fvAmbient );",
"vec4 diffuse_color =  ( ( colDiffuse * 0.3 * Fresnel * fvDiffuse * fvLightColor + 0.6 * Cscatter1 * Fresnel * fvDiffuse *fvLightColor + 1.5 *  vScatterOn * uScatterness * Cscatter2 * Fresnel * fvDiffuse * fvLightColor ) );",
"vec4 specular_color =  ( colDiffuse * 0.3 * fvSpecular + 0.6 * Cscatter1 * Fresnel * fvSpecular + 1.5 *vScatterOn * uScatterness * Cscatter2 * Fresnel * fvSpecular );",


				"gl_FragColor = gl_FragColor * temp_color * ( ambient_color + diffuse_color + specular_color );",


				"float specularStrength;",

				"if ( enableSpecular ) {",

					"vec4 texelSpecular = texture2D( specularMap, vUv );",
					"specularStrength = texelSpecular.r;",

				"} else {",

					"specularStrength = 1.0;",

				"}",

				"#ifdef USE_BUMPMAP",

					"if ( enableBump ) normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );",

				"#endif",

				// point lights

				"vec3 specularTotal = vec3( 0.0 );",

				"#if MAX_POINT_LIGHTS > 0",

					"vec3 pointTotal = vec3( 0.0 );",

					"for ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",

						"vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",

						"vec3 lVector = lPosition.xyz + vViewPosition.xyz;",

						"float lDistance = 1.0;",

						"if ( pointLightDistance[ i ] > 0.0 )",
							"lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );",

						"lVector = normalize( lVector );",

						"float pointDiffuseWeightFull = max( dot( normal, lVector ), 0.0 );",
						"float pointDiffuseWeightHalf = max( 0.5 * dot( normal, lVector ) + 0.5, 0.0 );",
						"vec3 pointDiffuseWeight = mix( vec3 ( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), uWrapRGB );",

						"float pointSpecularWeight = KS_Skin_Specular( normal, lVector, viewPosition, uRoughness, uSpecularBrightness );",

						"pointTotal    += lDistance * uDiffuseColor * pointLightColor[ i ] * pointDiffuseWeight;",
						"specularTotal += lDistance * uSpecularColor * pointLightColor[ i ] * pointSpecularWeight * specularStrength;",

					"}",

				"#endif",

				// directional lights

				"#if MAX_DIR_LIGHTS > 0",

					"vec3 dirTotal = vec3( 0.0 );",

					"for( int i = 0; i < MAX_DIR_LIGHTS; i++ ) {",

						"vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",

						"vec3 dirVector = normalize( lDirection.xyz );",

						"float dirDiffuseWeightFull = max( dot( normal, dirVector ), 0.0 );",
						"float dirDiffuseWeightHalf = max( 0.5 * dot( normal, dirVector ) + 0.5, 0.0 );",
						"vec3 dirDiffuseWeight = mix( vec3 ( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), uWrapRGB );",

						"float dirSpecularWeight =  KS_Skin_Specular( normal, dirVector, viewPosition, uRoughness, uSpecularBrightness );",

						"dirTotal 	   += uDiffuseColor * directionalLightColor[ i ] * dirDiffuseWeight;",
						"specularTotal += uSpecularColor * directionalLightColor[ i ] * dirSpecularWeight * specularStrength;",

					"}",

				"#endif",

				// hemisphere lights

				"#if MAX_HEMI_LIGHTS > 0",

					"vec3 hemiTotal = vec3( 0.0 );",

					"for ( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {",

						"vec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );",
						"vec3 lVector = normalize( lDirection.xyz );",

						"float dotProduct = dot( normal, lVector );",
						"float hemiDiffuseWeight = 0.5 * dotProduct + 0.5;",

						"hemiTotal += uDiffuseColor * mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );",

						// specular (sky light)

						"float hemiSpecularWeight = 0.0;",
						"hemiSpecularWeight += KS_Skin_Specular( normal, lVector, viewPosition, uRoughness, uSpecularBrightness );",

						// specular (ground light)

						"vec3 lVectorGround = -lVector;",
						"hemiSpecularWeight += KS_Skin_Specular( normal, lVectorGround, viewPosition, uRoughness, uSpecularBrightness );",

						"specularTotal += uSpecularColor * mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight ) * hemiSpecularWeight * specularStrength;",

					"}",

				"#endif",

				// all lights contribution summation

				"vec3 totalLight = vec3( 0.0 );",

				"#if MAX_DIR_LIGHTS > 0",
					"totalLight += dirTotal;",
				"#endif",

				"#if MAX_POINT_LIGHTS > 0",
					"totalLight += pointTotal;",
				"#endif",

				"#if MAX_HEMI_LIGHTS > 0",
					"totalLight += hemiTotal;",
				"#endif",

				"gl_FragColor.xyz = gl_FragColor.xyz * ( totalLight + ambientLightColor * uAmbientColor ) + specularTotal;",

				THREE.ShaderChunk[ "shadowmap_fragment" ],
				THREE.ShaderChunk[ "linear_to_gamma_fragment" ],
				THREE.ShaderChunk[ "fog_fragment" ],

			"}"

		].join("\n"),

		vertexShader: [

			"uniform vec4 offsetRepeat;",

			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"varying vec3 vViewPosition;",

			"uniform sampler2D tFaceSection;",


			"varying float vScatterOn;",

			
			"uniform float uCheeks;",
			"uniform float uNeck;",
			"uniform float uChin;",
			"uniform float uLips;",
			"uniform float uForehead;",
			"uniform float uNose;",
			"uniform float uScatterness;",	 

			"uniform float uSine;",	 
	  

			"vec4 cheeksColor = vec4(0.00, 0.00, 254.00/255.00, 0.00);",
			"vec4 neckColor = vec4(0.00/255.00, 255.00/255.00, 1.00/255.00, 0.00);",
			"vec4 chinColor = vec4(254.00/255.00, 0.0, 0.00, 0.00);",
			"vec4 lipsColor = vec4(255.00/255.00, 255.00/255.0,1.00/255.0, 0.00);",
			"vec4 foreheadColor = vec4(1.00/255.00, 1.00,1.00, 0.00);",
			"vec4 noseColor = vec4(255.00/255.00, 0.00/255.00, 255.00/255.00, 0.00);",

			THREE.ShaderChunk[ "shadowmap_pars_vertex" ],

			"void main() {",

				 		




				"vNormal = normalize( normalMatrix * normal );",

				"vUv = uv * offsetRepeat.zw + offsetRepeat.xy;",

				"vScatterOn = 0.00;",

				"vec4 colFaceSection = texture2D(tFaceSection,vUv);",

				"float testSound =  uSine + position.y * position.x  * position.z;",

				"float c = pow(-1.00 , testSound);",
				"vec3 b = c * vNormal * uSine /300.00;",



				"vec4 mvPosition = modelViewMatrix * vec4( position.x   ,position.y  ,position.z , 1.0  );",
				"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",

								"vViewPosition = -mvPosition.xyz;",
				

				"if ( colFaceSection.xyz == cheeksColor.xyz  ) {",
					
					
						"vScatterOn = vScatterOn + 1.0  - (min(colFaceSection.x , min (colFaceSection.y, colFaceSection.z )) / (1.0));",
						"vScatterOn = vScatterOn *	uCheeks;",
				
					
				"}",


				"if ( colFaceSection.xyz == cheeksColor.xyz  ) {",
					
					
						"vScatterOn = vScatterOn + 1.0  - (min(colFaceSection.x , min (colFaceSection.y, colFaceSection.z )) / (1.0));",
						"vScatterOn = vScatterOn *	uCheeks;",
				
					
				"}",


				"if ( colFaceSection.xyz == neckColor.xyz  ) {",
					
					
						"vScatterOn = vScatterOn + 1.0  - (min(colFaceSection.x , min (colFaceSection.y, colFaceSection.z )) / (1.0));",
						"vScatterOn = vScatterOn *	uNeck;",
				
					
				"}",


				"if ( colFaceSection.xyz == chinColor.xyz  ) {",
					
					
						"vScatterOn = vScatterOn + 1.0  - (min(colFaceSection.x , min (colFaceSection.y, colFaceSection.z )) / (1.0));",
						"vScatterOn = vScatterOn *	uChin;",
				
					
				"}",


				"if ( colFaceSection.xyz == lipsColor.xyz  ) {",
					
					
						"vScatterOn = vScatterOn + 1.0  - (min(colFaceSection.x , min (colFaceSection.y, colFaceSection.z )) / (1.0));",
						"vScatterOn = vScatterOn *	uLips;",
				
					
				"}",


				"if ( colFaceSection.xyz == foreheadColor.xyz  ) {",
					
					
						"vScatterOn = vScatterOn + 1.0  - (min(colFaceSection.x , min (colFaceSection.y, colFaceSection.z )) / (1.0));",
						"vScatterOn = vScatterOn *	uForehead;",
				
					
				"}",
				"if ( colFaceSection.xyz == noseColor.xyz  ) {",
					
					
						"vScatterOn = vScatterOn + 1.0  - (min(colFaceSection.x , min (colFaceSection.y, colFaceSection.z )) / (1.0));",
						"vScatterOn = vScatterOn *	uNose;",
				
					
				"}",


				"gl_Position =    projectionMatrix * mvPosition  ;",

				THREE.ShaderChunk[ "shadowmap_vertex" ],

			"}"

		].join( "\n" )

	},

	/* ------------------------------------------------------------------------------------------
	//	Skin shader
	//		- Blinn-Phong diffuse term (using normal + diffuse maps)
	//		- subsurface scattering approximation by four blur layers
	//		- physically based specular term (Kelemen/Szirmay-Kalos specular reflectance)
	//
	//		- point and directional lights (use with "lights: true" material option)
	//
	//		- based on Nvidia Advanced Skin Rendering GDC 2007 presentation
	//		  and GPU Gems 3 Chapter 14. Advanced Techniques for Realistic Real-Time Skin Rendering
	//
	//			http://developer.download.nvidia.com/presentations/2007/gdc/Advanced_Skin.pdf
	//			http://http.developer.nvidia.com/GPUGems3/gpugems3_ch14.html
	// ------------------------------------------------------------------------------------------ */

	'skin' : {

		uniforms: THREE.UniformsUtils.merge( [

			THREE.UniformsLib[ "fog" ],
			THREE.UniformsLib[ "lights" ],

			{

			"passID": { type: "i", value: 0 },

			"tDiffuse"	: { type: "t", value: null },
			"tNormal"	: { type: "t", value: null },

			"tBlur1"	: { type: "t", value: null },
			"tBlur2"	: { type: "t", value: null },
			"tBlur3"	: { type: "t", value: null },
			"tBlur4"	: { type: "t", value: null },

			"tBeckmann"	: { type: "t", value: null },

			"uNormalScale": { type: "f", value: 1.0 },

			"uDiffuseColor":  { type: "c", value: new THREE.Color( 0xeeeeee ) },
			"uSpecularColor": { type: "c", value: new THREE.Color( 0x111111 ) },
			"uAmbientColor":  { type: "c", value: new THREE.Color( 0x050505 ) },
			"uOpacity": 	  { type: "f", value: 1 },

			"uRoughness": 	  		{ type: "f", value: 0.15 },
			"uSpecularBrightness": 	{ type: "f", value: 0.75 },

			"uScatterness": 	  		{ type: "f", value: 0.5 },

			"uCheeks": 	  		{ type: "f", value: 0.5 },
			"uNeck": 	  		{ type: "f", value: 0.5 },
			"uChin": 	  		{ type: "f", value: 0.5 },
			"uLips": 	  		{ type: "f", value: 0.5 },
			"uForehead": 	  	{ type: "f", value: 0.5 },
			"uNose": 	  		{ type: "f", value: 0.5 }

			}

		] ),

		fragmentShader: [

			"uniform vec3 uAmbientColor;",
			"uniform vec3 uDiffuseColor;",
			"uniform vec3 uSpecularColor;",
			"uniform float uOpacity;",

			"uniform float uRoughness;",
			"uniform float uSpecularBrightness;",
			"uniform float gammaCorrection;",


			"uniform int passID;",

			"uniform sampler2D tDiffuse;",
			"uniform sampler2D tNormal;",

			"uniform sampler2D tBlur1;",
			"uniform sampler2D tBlur2;",
			"uniform sampler2D tBlur3;",
			"uniform sampler2D tBlur4;",

			"uniform sampler2D tBeckmann;",

			"uniform float uNormalScale;",

			"varying vec3 vTangent;",
			"varying vec3 vBinormal;",
			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"uniform vec3 ambientLightColor;",

			"#if MAX_DIR_LIGHTS > 0",
				"uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];",
				"uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];",
			"#endif",

			"#if MAX_POINT_LIGHTS > 0",
				"uniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];",
				"varying vec4 vPointLight[ MAX_POINT_LIGHTS ];",
			"#endif",

			"varying vec3 vViewPosition;",

			THREE.ShaderChunk[ "fog_pars_fragment" ],

			"float fresnelReflectance( vec3 H, vec3 V, float F0 ) {",

				"float base = 1.0 - dot( V, H );",
				"float exponential = pow( base, 5.0 );",

				"return exponential + F0 * ( 1.0 - exponential );",

			"}",

			// Kelemen/Szirmay-Kalos specular BRDF

			"float KS_Skin_Specular( vec3 N,", 		// Bumped surface normal
									"vec3 L,", 		// Points to light
									"vec3 V,", 		// Points to eye
									"float m,",  	// Roughness
									"float rho_s", 	// Specular brightness
									") {",

				"float result = 0.0;",
				"float ndotl = dot( N, L );",

				"if( ndotl > 0.0 ) {",

					"vec3 h = L + V;", // Unnormalized half-way vector
					"vec3 H = normalize( h );",

					"float ndoth = dot( N, H );",

					"float PH = pow( 2.0 * texture2D( tBeckmann, vec2( ndoth, m ) ).x, 10.0 );",
					"float F = fresnelReflectance( H, V, 0.028 );",
					"float frSpec = max( PH * F / dot( h, h ), 0.0 );",

					"result = ndotl * rho_s * frSpec;", // BRDF * dot(N,L) * rho_s

				"}",

				"return result;",

			"}",

			"void main() {",

				"gl_FragColor = vec4( 1.0 );",

				"vec4 mColor = vec4( uDiffuseColor, uOpacity );",
				"vec4 mSpecular = vec4( uSpecularColor, uOpacity );",

				"vec3 normalTex = texture2D( tNormal, vUv ).xyz * 2.0 - 1.0;",
				"normalTex.xy *= uNormalScale;",
				"normalTex = normalize( normalTex );",

				"vec4 colDiffuse = texture2D( tDiffuse, vUv );",
				"colDiffuse *= colDiffuse;",

				"gl_FragColor = gl_FragColor * colDiffuse;",

				"mat3 tsb = mat3( vTangent, vBinormal, vNormal );",
				"vec3 finalNormal = tsb * normalTex;",

				"vec3 normalv = normalize( finalNormal );",
				"vec3 viewPosition = normalize( vViewPosition );",

				// point lights

				"vec3 specularTotal = vec3( 0.0 );",

				"#if MAX_POINT_LIGHTS > 0",

					"vec4 pointTotal = vec4( vec3( 0.0 ), 1.0 );",

					"for ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",

						"vec3 pointVector = normalize( vPointLight[ i ].xyz );",
						"float pointDistance = vPointLight[ i ].w;",

						"float pointDiffuseWeight = max( dot( normalv, pointVector ), 0.0 );",

						"pointTotal  += pointDistance * vec4( pointLightColor[ i ], 1.0 ) * ( mColor * pointDiffuseWeight );",

						"if ( passID == 1 )",
							"specularTotal += pointDistance * mSpecular.xyz * pointLightColor[ i ] * KS_Skin_Specular( normalv, pointVector, viewPosition, uRoughness, uSpecularBrightness );",

					"}",

				"#endif",

				// directional lights

				"#if MAX_DIR_LIGHTS > 0",

					"vec4 dirTotal = vec4( vec3( 0.0 ), 1.0 );",

					"for( int i = 0; i < MAX_DIR_LIGHTS; i++ ) {",

						"vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",

						"vec3 dirVector = normalize( lDirection.xyz );",

						"float dirDiffuseWeight = max( dot( normalv, dirVector ), 0.0 );",

						"dirTotal  += vec4( directionalLightColor[ i ], 1.0 ) * ( mColor * dirDiffuseWeight );",

						"if ( passID == 1 )",
							"specularTotal += mSpecular.xyz * directionalLightColor[ i ] * KS_Skin_Specular( normalv, dirVector, viewPosition, uRoughness, uSpecularBrightness );",

					"}",

				"#endif",

				// all lights contribution summation

				"vec4 totalLight = vec4( vec3( 0.0 ), uOpacity );",

				"#if MAX_DIR_LIGHTS > 0",
					"totalLight += dirTotal;",
				"#endif",

				"#if MAX_POINT_LIGHTS > 0",
					"totalLight += pointTotal;",
				"#endif",

				"gl_FragColor = gl_FragColor * totalLight;",

				"if ( passID == 0 ) {",

					"gl_FragColor = vec4( sqrt( gl_FragColor.xyz ), gl_FragColor.w );",

				"} else if ( passID == 1 ) {",

					//"#define VERSION1",

					"#ifdef VERSION1",

						"vec3 nonblurColor = sqrt( gl_FragColor.xyz );",

					"#else",

						"vec3 nonblurColor = gl_FragColor.xyz;",

					"#endif",

					"vec3 blur1Color = texture2D( tBlur1, vUv ).xyz;",
					"vec3 blur2Color = texture2D( tBlur2, vUv ).xyz;",
					"vec3 blur3Color = texture2D( tBlur3, vUv ).xyz;",
					"vec3 blur4Color = texture2D( tBlur4, vUv ).xyz;",


					//"gl_FragColor = vec4( blur1Color, gl_FragColor.w );",

					//"gl_FragColor = vec4( vec3( 0.22, 0.5, 0.7 ) * nonblurColor + vec3( 0.2, 0.5, 0.3 ) * blur1Color + vec3( 0.58, 0.0, 0.0 ) * blur2Color, gl_FragColor.w );",

					//"gl_FragColor = vec4( vec3( 0.25, 0.6, 0.8 ) * nonblurColor + vec3( 0.15, 0.25, 0.2 ) * blur1Color + vec3( 0.15, 0.15, 0.0 ) * blur2Color + vec3( 0.45, 0.0, 0.0 ) * blur3Color, gl_FragColor.w );",


					"gl_FragColor = vec4( vec3( 0.22,  0.437, 0.635 ) * nonblurColor + ",
										 "vec3( 0.101, 0.355, 0.365 ) * blur1Color + ",
										 "vec3( 0.119, 0.208, 0.0 )   * blur2Color + ",
										 "vec3( 0.114, 0.0,   0.0 )   * blur3Color + ",
										 "vec3( 0.444, 0.0,   0.0 )   * blur4Color",
										 ", gl_FragColor.w );",

					"gl_FragColor.xyz *= pow( colDiffuse.xyz, vec3( 0.5 ) );",

					"gl_FragColor.xyz += ambientLightColor * uAmbientColor * colDiffuse.xyz + specularTotal;",

					"#ifndef VERSION1",

						"gl_FragColor.xyz = sqrt( gl_FragColor.xyz );",

					"#endif",

				"}",

				THREE.ShaderChunk[ "fog_fragment" ],

			"}"

		].join("\n"),

		vertexShader: [

			"attribute vec4 tangent;",

			"#ifdef VERTEX_TEXTURES",

				"uniform sampler2D tDisplacement;",
				"uniform float uDisplacementScale;",
				"uniform float uDisplacementBias;",

			"#endif",

			"varying vec3 vTangent;",
			"varying vec3 vBinormal;",
			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"#if MAX_POINT_LIGHTS > 0",

				"uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];",
				"uniform float pointLightDistance[ MAX_POINT_LIGHTS ];",

				"varying vec4 vPointLight[ MAX_POINT_LIGHTS ];",

			"#endif",

			"varying vec3 vViewPosition;",

			"void main() {",

				"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",

				"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",

				"vViewPosition = -mvPosition.xyz;",

				"vNormal = normalize( normalMatrix * normal );",

				// tangent and binormal vectors

				"vTangent = normalize( normalMatrix * tangent.xyz );",

				"vBinormal = cross( vNormal, vTangent ) * tangent.w;",
				"vBinormal = normalize( vBinormal );",

				"vUv = uv;",

				// point lights

				"#if MAX_POINT_LIGHTS > 0",

					"for( int i = 0; i < MAX_POINT_LIGHTS; i++ ) {",

						"vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",

						"vec3 lVector = lPosition.xyz - mvPosition.xyz;",

						"float lDistance = 1.0;",

						"if ( pointLightDistance[ i ] > 0.0 )",
							"lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );",

						"lVector = normalize( lVector );",

						"vPointLight[ i ] = vec4( lVector, lDistance );",

					"}",

				"#endif",

				// displacement mapping

				"#ifdef VERTEX_TEXTURES",

					"vec3 dv = texture2D( tDisplacement, uv ).xyz;",
					"float df = uDisplacementScale * dv.x + uDisplacementBias;",
					"vec4 displacedPosition = vec4( vNormal.xyz * df, 0.0 ) + mvPosition;",
					"gl_Position = projectionMatrix * displacedPosition;",

				"#else",

					"gl_Position = projectionMatrix * mvPosition;",

				"#endif",

			"}"

		].join("\n"),

		vertexShaderUV: [

			"attribute vec4 tangent;",

			"#ifdef VERTEX_TEXTURES",

				"uniform sampler2D tDisplacement;",
				"uniform float uDisplacementScale;",
				"uniform float uDisplacementBias;",

			"#endif",

			"varying vec3 vTangent;",
			"varying vec3 vBinormal;",
			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"#if MAX_POINT_LIGHTS > 0",

				"uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];",
				"uniform float pointLightDistance[ MAX_POINT_LIGHTS ];",

				"varying vec4 vPointLight[ MAX_POINT_LIGHTS ];",

			"#endif",

			"varying vec3 vViewPosition;",

			"void main() {",

				"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",

				"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",

				"vViewPosition = -mvPosition.xyz;",

				"vNormal = normalize( normalMatrix * normal );",

				// tangent and binormal vectors

				"vTangent = normalize( normalMatrix * tangent.xyz );",

				"vBinormal = cross( vNormal, vTangent ) * tangent.w;",
				"vBinormal = normalize( vBinormal );",

				"vUv = uv;",

				// point lights

				"#if MAX_POINT_LIGHTS > 0",

					"for( int i = 0; i < MAX_POINT_LIGHTS; i++ ) {",

						"vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",

						"vec3 lVector = lPosition.xyz - mvPosition.xyz;",

						"float lDistance = 1.0;",

						"if ( pointLightDistance[ i ] > 0.0 )",
							"lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );",

						"lVector = normalize( lVector );",

						"vPointLight[ i ] = vec4( lVector, lDistance );",

					"}",

				"#endif",

				"gl_Position = vec4( uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0 );",

			"}"

		].join("\n")

	},

	/* ------------------------------------------------------------------------------------------
	// Beckmann distribution function
	//	- to be used in specular term of skin shader
	//	- render a screen-aligned quad to precompute a 512 x 512 texture
	//
	//		- from http://developer.nvidia.com/node/171
	 ------------------------------------------------------------------------------------------ */

	"beckmann" : {

		uniforms: {},

		vertexShader: [

			"varying vec2 vUv;",

			"void main() {",

				"vUv = uv;",
				"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

			"}"

		].join("\n"),

		fragmentShader: [

			"varying vec2 vUv;",

			"float PHBeckmann( float ndoth, float m ) {",

				"float alpha = acos( ndoth );",
				"float ta = tan( alpha );",

				"float val = 1.0 / ( m * m * pow( ndoth, 4.0 ) ) * exp( -( ta * ta ) / ( m * m ) );",
				"return val;",

			"}",

			"float KSTextureCompute( vec2 tex ) {",

				// Scale the value to fit within [0,1]  invert upon lookup.

				"return 0.5 * pow( PHBeckmann( tex.x, tex.y ), 0.1 );",

			"}",

			"void main() {",

				"float x = KSTextureCompute( vUv );",

				"gl_FragColor = vec4( x, x, x, 1.0 );",

			"}"

		].join("\n")

	}

};
