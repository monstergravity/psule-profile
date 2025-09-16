/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useEffect } from 'react';
import { motion } from 'framer-motion';
import { generateStyledImage } from './services/geminiService';
import PolaroidCard from './components/PolaroidCard';
import { createAlbumPage } from './lib/albumUtils';
import { addWatermark } from './lib/imageUtils';
import Footer from './components/Footer';
import ImageCropper from './components/ImageCropper';

const STYLES = {
    'digital-painting': {
        name: 'Digital Painting',
        prompt: "Create a vibrant, artistic, and expressive digital painting of the person in this photo. The style should be modern and eye-catching, suitable for a social profile. Make the person look their best, enhancing their features in a flattering way. The background should be abstract and complementary to the portrait."
    },
    'watercolor': {
        name: 'Watercolor',
        prompt: "Create a portrait of the person in this photo in a soft, flowing watercolor style. Use a wet-on-wet technique with delicate washes of color and visible brushstrokes. The background should be light and abstract, suggesting a paper texture."
    },
    'sketch': {
        name: 'Sketch',
        prompt: "Create a detailed charcoal sketch portrait of the person in this photo. Emphasize strong light and shadow (chiaroscuro) for a dramatic, classic effect. The background should be minimal, like a piece of artist's paper."
    },
    'vaporwave': {
        name: 'Pastel Pop',
        prompt: "Transform the person in this photo into a vibrant K-pop idol style portrait. The aesthetic should be cute, energetic, and trendy. Adorn their hair with large, puffy, shiny bows (like pink and light blue) and scatter small, colorful star-shaped stickers or confetti on their face and hair. The makeup should be soft and doll-like, with prominent blush and glossy lips. Use bright, even studio lighting against a solid, vibrant pastel background (like lavender or bubblegum pink)."
    },
    '3d-render': {
        name: '3D Render',
        prompt: "Recreate the person in this photo as a stylized 3D character render, similar to modern animated movies. Focus on soft lighting, detailed textures for hair and clothing, and a friendly, appealing expression. The background should be a simple, clean studio setup."
    },
    'impressionism': {
        name: 'Impressionism',
        prompt: "Generate a portrait of the person in this photo in the style of Impressionism. Use visible, short, thick brushstrokes and a focus on the accurate depiction of light and its changing qualities. The overall effect should be a fleeting moment captured on canvas. Avoid hard outlines."
    },
    'pop-art': {
        name: 'Pop Art',
        prompt: "Create a Pop Art portrait of the person from this photo, inspired by artists like Andy Warhol. Use bold, flat colors, strong black outlines, and a screen-printed look. The background should be a single, vibrant, solid color."
    },
    'anime': {
        name: 'Anime',
        prompt: "Illustrate the person in this photo in a classic 90s anime/manga style. Emphasize large, expressive eyes, stylized hair, and clean lines. The background should be simple, perhaps with speed lines or a soft gradient to focus on the character."
    },
    'comic-book': {
        name: 'Comic Book',
        prompt: "Transform this photo into a Western comic book style portrait. Use bold ink lines, dynamic shading with cross-hatching or Ben-Day dots, and a dramatic, action-oriented pose. The colors should be vibrant and slightly saturated."
    }
};

const STYLE_KEYS = Object.keys(STYLES);


const GHOST_POLAROIDS_CONFIG = [
  { initial: { x: "-150%", y: "-100%", rotate: -30 }, transition: { delay: 0.2 } },
  { initial: { x: "150%", y: "-80%", rotate: 25 }, transition: { delay: 0.4 } },
  { initial: { x: "-120%", y: "120%", rotate: 45 }, transition: { delay: 0.6 } },
  { initial: { x: "180%", y: "90%", rotate: -20 }, transition: { delay: 0.8 } },
  { initial: { x: "0%", y: "-200%", rotate: 0 }, transition: { delay: 0.5 } },
  { initial: { x: "100%", y: "150%", rotate: 10 }, transition: { delay: 0.3 } },
];


type ImageStatus = 'pending' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

const primaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-yellow-400 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)]";
const secondaryButtonClasses = "font-permanent-marker text-xl text-center text-white bg-white/10 backdrop-blur-sm border-2 border-white/80 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";

function App() {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [croppedImageForDisplay, setCroppedImageForDisplay] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<'idle' | 'cropping' | 'image-uploaded' | 'generating' | 'results-shown'>('idle');
    
    useEffect(() => {
        if (appState === 'cropping') {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }, [appState]);

    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
                setAppState('cropping');
                setGeneratedImages({});
                setCroppedImageForDisplay(null);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; // Allow re-uploading the same file
    };

    const handleCropConfirm = (croppedImageUrl: string) => {
        setCroppedImageForDisplay(croppedImageUrl);
        setAppState('image-uploaded');
    };

    const handleCropCancel = () => {
        setUploadedImage(null);
        setAppState('idle');
    };

    const handleGenerateClick = async () => {
        if (!croppedImageForDisplay) return;

        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        STYLE_KEYS.forEach(styleKey => {
            initialImages[styleKey] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        const concurrencyLimit = 3;
        const stylesQueue = [...STYLE_KEYS];

        const processStyle = async (styleKey: string) => {
            try {
                const prompt = STYLES[styleKey as keyof typeof STYLES].prompt;
                const resultUrl = await generateStyledImage(croppedImageForDisplay, prompt);
                const watermarkedUrl = await addWatermark(resultUrl);
                setGeneratedImages(prev => ({
                    ...prev,
                    [styleKey]: { status: 'done', url: watermarkedUrl },
                }));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                setGeneratedImages(prev => ({
                    ...prev,
                    [styleKey]: { status: 'error', error: errorMessage },
                }));
                console.error(`Failed to generate image for ${styleKey}:`, err);
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(async () => {
            while (stylesQueue.length > 0) {
                const styleKey = stylesQueue.shift();
                if (styleKey) {
                    await processStyle(styleKey);
                }
            }
        });

        await Promise.all(workers);

        setAppState('results-shown');
    };

    const handleRegenerateStyle = async (styleKey: string) => {
        if (!croppedImageForDisplay) return;

        if (generatedImages[styleKey]?.status === 'pending') {
            return;
        }
        
        setGeneratedImages(prev => ({
            ...prev,
            [styleKey]: { status: 'pending' },
        }));

        try {
            const prompt = STYLES[styleKey as keyof typeof STYLES].prompt;
            const resultUrl = await generateStyledImage(croppedImageForDisplay, prompt);
            const watermarkedUrl = await addWatermark(resultUrl);
            setGeneratedImages(prev => ({
                ...prev,
                [styleKey]: { status: 'done', url: watermarkedUrl },
            }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setGeneratedImages(prev => ({
                ...prev,
                [styleKey]: { status: 'error', error: errorMessage },
            }));
            console.error(`Failed to regenerate image for ${styleKey}:`, err);
        }
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setCroppedImageForDisplay(null);
        setGeneratedImages({});
        setAppState('idle');
    };

    const handleDownloadIndividualImage = (styleKey: string) => {
        const image = generatedImages[styleKey];
        if (image?.status === 'done' && image.url) {
            const link = document.createElement('a');
            link.href = image.url;
            link.download = `pfp-perfect-${styleKey}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadAlbum = async () => {
        setIsDownloading(true);
        try {
            const imageData = Object.entries(generatedImages)
                .filter(([, image]) => image.status === 'done' && image.url)
                .reduce((acc, [styleKey, image]) => {
                    const styleName = STYLES[styleKey as keyof typeof STYLES].name;
                    acc[styleName] = image!.url!;
                    return acc;
                }, {} as Record<string, string>);

            if (Object.keys(imageData).length < STYLE_KEYS.length) {
                alert("Please wait for all images to finish generating before downloading the album.");
                return;
            }

            const albumDataUrl = await createAlbumPage(imageData);

            const link = document.createElement('a');
            link.href = albumDataUrl;
            link.download = 'pfp-perfect-album.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Failed to create or download album:", error);
            alert("Sorry, there was an error creating your album. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <main className="bg-black text-neutral-200 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-24 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>
            
            <div className="z-10 flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
                <div className="text-center mb-10">
                    <h1 className="text-6xl md:text-8xl font-caveat font-bold text-neutral-100">Psule Profile</h1>
                    <p className="font-permanent-marker text-neutral-300 mt-2 text-xl tracking-wide">Generate your portrait in iconic art styles.</p>
                </div>

                {appState === 'idle' && (
                     <div className="relative flex flex-col items-center justify-center w-full">
                        {GHOST_POLAROIDS_CONFIG.map((config, index) => (
                             <motion.div
                                key={index}
                                className="absolute w-80 h-[26rem] rounded-md p-4 bg-neutral-100/10 blur-sm"
                                initial={config.initial}
                                animate={{
                                    x: "0%", y: "0%", rotate: (Math.random() - 0.5) * 20,
                                    scale: 0,
                                    opacity: 0,
                                }}
                                transition={{
                                    ...config.transition,
                                    ease: "circOut",
                                    duration: 2,
                                }}
                            />
                        ))}
                        <motion.div
                             initial={{ opacity: 0, scale: 0.8 }}
                             animate={{ opacity: 1, scale: 1 }}
                             transition={{ delay: 2, duration: 0.8, type: 'spring' }}
                             className="flex flex-col items-center"
                        >
                            <label htmlFor="file-upload" className="cursor-pointer group transform hover:scale-105 transition-transform duration-300">
                                 <PolaroidCard 
                                     caption="Click to begin"
                                     styleKey="start"
                                     status="done"
                                 />
                            </label>
                            <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                            <p className="mt-8 font-permanent-marker text-neutral-500 text-center max-w-xs text-lg">
                                Click the polaroid to upload your photo and create your new profile picture.
                            </p>
                        </motion.div>
                    </div>
                )}
                
                {appState === 'cropping' && uploadedImage && (
                    <ImageCropper 
                        isOpen={appState === 'cropping'}
                        imageSrc={uploadedImage}
                        onConfirm={handleCropConfirm}
                        onCancel={handleCropCancel}
                    />
                )}

                {appState === 'image-uploaded' && croppedImageForDisplay && (
                    <div className="flex flex-col items-center gap-6">
                         <PolaroidCard 
                            imageUrl={croppedImageForDisplay} 
                            caption="Your Photo" 
                            styleKey="your-photo"
                            status="done"
                         />
                         <div className="flex items-center gap-4 mt-4">
                            <button onClick={handleReset} className={secondaryButtonClasses}>
                                Different Photo
                            </button>
                            <button onClick={handleGenerateClick} className={primaryButtonClasses}>
                                Generate Styles
                            </button>
                         </div>
                    </div>
                )}

                {(appState === 'generating' || appState === 'results-shown') && (
                     <>
                        <div className="w-full max-w-7xl flex-1 overflow-y-auto mt-4 p-4">
                            <motion.div
                                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-8 justify-items-center"
                                variants={{
                                    hidden: { opacity: 0 },
                                    show: {
                                        opacity: 1,
                                        transition: {
                                            staggerChildren: 0.08,
                                        },
                                    },
                                }}
                                initial="hidden"
                                animate="show"
                            >
                                {STYLE_KEYS.map((styleKey) => (
                                    <motion.div key={styleKey} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                                         <PolaroidCard
                                            caption={STYLES[styleKey as keyof typeof STYLES].name}
                                            styleKey={styleKey}
                                            status={generatedImages[styleKey]?.status || 'pending'}
                                            imageUrl={generatedImages[styleKey]?.url}
                                            error={generatedImages[styleKey]?.error}
                                            onRegenerate={handleRegenerateStyle}
                                            onDownload={handleDownloadIndividualImage}
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>
                        </div>

                         <div className="h-20 mt-4 flex items-center justify-center">
                            {appState === 'results-shown' && (
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <button 
                                        onClick={handleDownloadAlbum} 
                                        disabled={isDownloading} 
                                        className={`${primaryButtonClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isDownloading ? 'Creating Album...' : 'Download Album'}
                                    </button>
                                    <button onClick={handleReset} className={secondaryButtonClasses}>
                                        Start Over
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            <Footer />
        </main>
    );
}

export default App;